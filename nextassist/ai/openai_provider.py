import json
from collections.abc import Generator

from openai import OpenAI

from nextassist.ai.base_provider import BaseProvider


class OpenAIProvider(BaseProvider):
	def __init__(self, provider_doc):
		self.provider_doc = provider_doc
		self.client = OpenAI(
			api_key=provider_doc.get_password("api_key"),
			base_url=provider_doc.api_base_url or None,
			organization=provider_doc.organization_id or None,
		)

	def chat_completion(
		self,
		messages: list[dict],
		model: str,
		temperature: float = 0.7,
		max_tokens: int = 4096,
		tools: list[dict] | None = None,
		stream: bool = False,
	) -> dict:
		kwargs = {
			"model": model,
			"messages": messages,
			"temperature": temperature,
			"max_tokens": max_tokens,
		}
		if tools:
			kwargs["tools"] = tools

		response = self.client.chat.completions.create(**kwargs)
		choice = response.choices[0]

		result = {
			"content": choice.message.content or "",
			"role": choice.message.role,
			"usage": {
				"prompt_tokens": response.usage.prompt_tokens,
				"completion_tokens": response.usage.completion_tokens,
				"total_tokens": response.usage.total_tokens,
			},
		}

		if choice.message.tool_calls:
			result["tool_calls"] = [
				{
					"id": tc.id,
					"name": tc.function.name,
					"arguments": tc.function.arguments,
				}
				for tc in choice.message.tool_calls
			]

		return result

	def stream_chat_completion(
		self,
		messages: list[dict],
		model: str,
		temperature: float = 0.7,
		max_tokens: int = 4096,
		tools: list[dict] | None = None,
	) -> Generator[dict]:
		kwargs = {
			"model": model,
			"messages": messages,
			"temperature": temperature,
			"max_tokens": max_tokens,
			"stream": True,
			"stream_options": {"include_usage": True},
		}
		if tools:
			kwargs["tools"] = tools

		tool_calls_buffer: dict[int, dict] = {}

		stream = self.client.chat.completions.create(**kwargs)
		for chunk in stream:
			if not chunk.choices and chunk.usage:
				yield {
					"type": "done",
					"usage": {
						"prompt_tokens": chunk.usage.prompt_tokens,
						"completion_tokens": chunk.usage.completion_tokens,
						"total_tokens": chunk.usage.total_tokens,
					},
				}
				continue

			if not chunk.choices:
				continue

			delta = chunk.choices[0].delta

			if delta.content:
				yield {"type": "token", "content": delta.content}

			if delta.tool_calls:
				for tc in delta.tool_calls:
					idx = tc.index
					if idx not in tool_calls_buffer:
						tool_calls_buffer[idx] = {
							"id": tc.id or "",
							"name": tc.function.name if tc.function and tc.function.name else "",
							"arguments": "",
						}
					if tc.function and tc.function.arguments:
						tool_calls_buffer[idx]["arguments"] += tc.function.arguments

					if tc.id and not tool_calls_buffer[idx]["id"]:
						tool_calls_buffer[idx]["id"] = tc.id

			if chunk.choices[0].finish_reason == "tool_calls":
				for _idx, tc_data in sorted(tool_calls_buffer.items()):
					yield {
						"type": "tool_call",
						"id": tc_data["id"],
						"name": tc_data["name"],
						"arguments": tc_data["arguments"],
					}
				tool_calls_buffer.clear()

	def validate_api_key(self, model: str | None = None) -> bool:
		try:
			if model:
				self.client.chat.completions.create(
					model=model,
					max_tokens=10,
					messages=[{"role": "user", "content": "hi"}],
				)
			else:
				self.client.models.list()
			return True
		except Exception:
			return False
