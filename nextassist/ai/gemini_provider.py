import json
from collections.abc import Generator

from google import genai
from google.genai import types

from nextassist.ai.base_provider import BaseProvider


class GeminiProvider(BaseProvider):
	def __init__(self, provider_doc):
		self.provider_doc = provider_doc
		self.client = genai.Client(api_key=provider_doc.get_password("api_key"))

	def _convert_messages(self, messages: list[dict]) -> tuple[str, list[types.Content]]:
		"""Convert OpenAI-style messages to Gemini format.

		Returns (system_instruction, contents).
		"""
		system_prompt = ""
		contents = []

		for msg in messages:
			if msg["role"] == "system":
				system_prompt += msg["content"] + "\n"
			elif msg["role"] == "assistant":
				parts = []
				if msg.get("content"):
					parts.append(types.Part.from_text(text=msg["content"]))
				if msg.get("tool_calls"):
					tool_calls = msg["tool_calls"]
					if isinstance(tool_calls, str):
						tool_calls = json.loads(tool_calls)
					for tc in tool_calls:
						args = tc.get("arguments", "{}")
						if isinstance(args, str):
							args = json.loads(args)
						parts.append(
							types.Part.from_function_call(
								name=tc["name"],
								args=args,
							)
						)
				if parts:
					contents.append(types.Content(role="model", parts=parts))
			elif msg["role"] == "tool":
				contents.append(
					types.Content(
						role="user",
						parts=[
							types.Part.from_function_response(
								name=msg.get("name", ""),
								response={"result": msg["content"]},
							)
						],
					)
				)
			else:
				contents.append(
					types.Content(
						role="user",
						parts=[types.Part.from_text(text=msg["content"])],
					)
				)

		return system_prompt.strip(), contents

	def _convert_tools(self, tools: list[dict] | None) -> list[types.Tool] | None:
		"""Convert OpenAI-style tool definitions to Gemini format."""
		if not tools:
			return None

		declarations = []
		for tool in tools:
			func = tool.get("function", {})
			params = func.get("parameters", {})
			declarations.append(
				types.FunctionDeclaration(
					name=func.get("name", ""),
					description=func.get("description", ""),
					parameters=params if params.get("properties") else None,
				)
			)
		return [types.Tool(function_declarations=declarations)]

	def chat_completion(
		self,
		messages: list[dict],
		model: str,
		temperature: float = 0.7,
		max_tokens: int = 4096,
		tools: list[dict] | None = None,
		stream: bool = False,
	) -> dict:
		system_prompt, contents = self._convert_messages(messages)

		config = types.GenerateContentConfig(
			temperature=temperature,
			max_output_tokens=max_tokens,
		)
		if system_prompt:
			config.system_instruction = system_prompt
		gemini_tools = self._convert_tools(tools)
		if gemini_tools:
			config.tools = gemini_tools

		response = self.client.models.generate_content(
			model=model,
			contents=contents,
			config=config,
		)

		content = ""
		tool_calls = []
		if response.candidates and response.candidates[0].content:
			for part in response.candidates[0].content.parts:
				if part.text:
					content += part.text
				elif part.function_call:
					tool_calls.append(
						{
							"id": f"call_{part.function_call.name}",
							"name": part.function_call.name,
							"arguments": json.dumps(
								dict(part.function_call.args) if part.function_call.args else {}
							),
						}
					)

		usage_meta = response.usage_metadata
		result = {
			"content": content,
			"role": "assistant",
			"usage": {
				"prompt_tokens": usage_meta.prompt_token_count if usage_meta else 0,
				"completion_tokens": usage_meta.candidates_token_count if usage_meta else 0,
				"total_tokens": usage_meta.total_token_count if usage_meta else 0,
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
		system_prompt, contents = self._convert_messages(messages)

		config = types.GenerateContentConfig(
			temperature=temperature,
			max_output_tokens=max_tokens,
		)
		if system_prompt:
			config.system_instruction = system_prompt
		gemini_tools = self._convert_tools(tools)
		if gemini_tools:
			config.tools = gemini_tools

		total_prompt_tokens = 0
		total_completion_tokens = 0

		for chunk in self.client.models.generate_content_stream(
			model=model,
			contents=contents,
			config=config,
		):
			if chunk.usage_metadata:
				total_prompt_tokens = chunk.usage_metadata.prompt_token_count or 0
				total_completion_tokens = chunk.usage_metadata.candidates_token_count or 0

			if not chunk.candidates:
				continue

			for part in chunk.candidates[0].content.parts:
				if part.text:
					yield {"type": "token", "content": part.text}
				elif part.function_call:
					yield {
						"type": "tool_call",
						"id": f"call_{part.function_call.name}",
						"name": part.function_call.name,
						"arguments": json.dumps(
							dict(part.function_call.args) if part.function_call.args else {}
						),
					}

		yield {
			"type": "done",
			"usage": {
				"prompt_tokens": total_prompt_tokens,
				"completion_tokens": total_completion_tokens,
				"total_tokens": total_prompt_tokens + total_completion_tokens,
			},
		}

	def validate_api_key(self, model: str | None = None) -> bool:
		try:
			self.client.models.generate_content(
				model=model or "gemini-2.0-flash",
				contents="hi",
				config=types.GenerateContentConfig(max_output_tokens=10),
			)
			return True
		except Exception:
			return False
