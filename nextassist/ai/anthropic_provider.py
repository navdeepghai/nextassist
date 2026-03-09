import json
from collections.abc import Generator

from anthropic import Anthropic

from nextassist.ai.base_provider import BaseProvider


class AnthropicProvider(BaseProvider):
	def __init__(self, provider_doc):
		self.provider_doc = provider_doc
		self.client = Anthropic(
			api_key=provider_doc.get_password("api_key"),
			base_url=provider_doc.api_base_url or None,
		)

	def _convert_messages(self, messages: list[dict]) -> tuple[str, list[dict]]:
		"""Convert OpenAI-style messages to Anthropic format.

		Returns (system_prompt, messages_list).
		Handles:
		- System messages → extracted to system_prompt
		- Assistant messages with tool_calls → content blocks with text + tool_use
		- Tool result messages → user messages with tool_result content blocks
		- Consecutive same-role messages → merged into a single message
		"""
		system_prompt = ""
		converted = []

		for msg in messages:
			if msg["role"] == "system":
				system_prompt += msg["content"] + "\n"
			elif msg["role"] == "tool":
				entry = {
					"role": "user",
					"content": [
						{
							"type": "tool_result",
							"tool_use_id": msg.get("tool_call_id", ""),
							"content": msg["content"],
						}
					],
				}
				# Merge with previous message if also role=user (multiple tool results)
				if (
					converted
					and converted[-1]["role"] == "user"
					and isinstance(converted[-1]["content"], list)
				):
					converted[-1]["content"].extend(entry["content"])
				else:
					converted.append(entry)
			elif msg["role"] == "assistant":
				content_blocks = []
				text = (msg.get("content") or "").strip()
				if text:
					content_blocks.append({"type": "text", "text": text})

				# Convert tool_calls to Anthropic tool_use blocks
				tool_calls = msg.get("tool_calls") or []
				for tc in tool_calls:
					func = tc.get("function", tc)
					args = func.get("arguments", "{}")
					if isinstance(args, str):
						try:
							args = json.loads(args)
						except json.JSONDecodeError, TypeError:
							args = {}
					content_blocks.append(
						{
							"type": "tool_use",
							"id": tc.get("id", ""),
							"name": func.get("name", tc.get("name", "")),
							"input": args,
						}
					)

				if content_blocks:
					converted.append({"role": "assistant", "content": content_blocks})
				elif text:
					converted.append({"role": "assistant", "content": text})
			else:
				# User messages
				converted.append({"role": msg["role"], "content": msg["content"]})

		return system_prompt.strip(), converted

	def _convert_tools(self, tools: list[dict] | None) -> list[dict] | None:
		"""Convert OpenAI-style tool definitions to Anthropic format."""
		if not tools:
			return None

		converted = []
		for tool in tools:
			func = tool.get("function", {})
			converted.append(
				{
					"name": func.get("name", ""),
					"description": func.get("description", ""),
					"input_schema": func.get("parameters", {"type": "object", "properties": {}}),
				}
			)
		return converted

	def chat_completion(
		self,
		messages: list[dict],
		model: str,
		temperature: float = 0.7,
		max_tokens: int = 4096,
		tools: list[dict] | None = None,
		stream: bool = False,
	) -> dict:
		system_prompt, converted_messages = self._convert_messages(messages)
		kwargs = {
			"model": model,
			"messages": converted_messages,
			"max_tokens": max_tokens,
			"temperature": temperature,
		}
		if system_prompt:
			kwargs["system"] = system_prompt
		anthropic_tools = self._convert_tools(tools)
		if anthropic_tools:
			kwargs["tools"] = anthropic_tools

		response = self.client.messages.create(**kwargs)

		content = ""
		tool_calls = []
		for block in response.content:
			if block.type == "text":
				content += block.text
			elif block.type == "tool_use":
				tool_calls.append(
					{
						"id": block.id,
						"name": block.name,
						"arguments": json.dumps(block.input),
					}
				)

		result = {
			"content": content,
			"role": "assistant",
			"usage": {
				"prompt_tokens": response.usage.input_tokens,
				"completion_tokens": response.usage.output_tokens,
				"total_tokens": response.usage.input_tokens + response.usage.output_tokens,
			},
		}
		if tool_calls:
			result["tool_calls"] = tool_calls

		return result

	def stream_chat_completion(
		self,
		messages: list[dict],
		model: str,
		temperature: float = 0.7,
		max_tokens: int = 4096,
		tools: list[dict] | None = None,
	) -> Generator[dict]:
		system_prompt, converted_messages = self._convert_messages(messages)
		kwargs = {
			"model": model,
			"messages": converted_messages,
			"max_tokens": max_tokens,
			"temperature": temperature,
		}
		if system_prompt:
			kwargs["system"] = system_prompt
		anthropic_tools = self._convert_tools(tools)
		if anthropic_tools:
			kwargs["tools"] = anthropic_tools

		current_tool = None

		with self.client.messages.stream(**kwargs) as stream:
			for event in stream:
				if event.type == "content_block_start":
					if hasattr(event.content_block, "type") and event.content_block.type == "tool_use":
						current_tool = {
							"id": event.content_block.id,
							"name": event.content_block.name,
							"arguments": "",
						}
				elif event.type == "content_block_delta":
					if hasattr(event.delta, "text"):
						yield {"type": "token", "content": event.delta.text}
					elif hasattr(event.delta, "partial_json"):
						if current_tool:
							current_tool["arguments"] += event.delta.partial_json
				elif event.type == "content_block_stop":
					if current_tool:
						yield {
							"type": "tool_call",
							"id": current_tool["id"],
							"name": current_tool["name"],
							"arguments": current_tool["arguments"],
						}
						current_tool = None
				elif event.type == "message_delta":
					pass
				elif event.type == "message_stop":
					pass

			final_message = stream.get_final_message()
			yield {
				"type": "done",
				"usage": {
					"prompt_tokens": final_message.usage.input_tokens,
					"completion_tokens": final_message.usage.output_tokens,
					"total_tokens": final_message.usage.input_tokens + final_message.usage.output_tokens,
				},
			}

	def validate_api_key(self, model: str | None = None) -> bool:
		try:
			self.client.messages.create(
				model=model or "claude-sonnet-4-6",
				max_tokens=10,
				messages=[{"role": "user", "content": "hi"}],
			)
			return True
		except Exception:
			return False
