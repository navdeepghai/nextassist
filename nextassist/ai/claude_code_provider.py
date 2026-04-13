import asyncio
import json
import queue
import threading
from collections.abc import Generator

from claude_code_sdk import ClaudeCodeOptions, query
from claude_code_sdk._errors import MessageParseError
from claude_code_sdk._internal.transport.subprocess_cli import SubprocessCLITransport

from nextassist.ai.base_provider import BaseProvider
from nextassist.ai.claude_code_utils import find_claude_cli


class ClaudeCodeProvider(BaseProvider):
	"""AI provider that uses the Claude Code SDK (claude CLI) as the backend."""

	def __init__(self, provider_doc):
		self.provider_doc = provider_doc
		self._api_key = provider_doc.get_password("api_key")
		self._context_window = getattr(provider_doc, "context_window", None)
		self._cli_path = find_claude_cli()

	def _build_options(self, model: str, system_prompt: str | None = None) -> ClaudeCodeOptions:
		"""Build ClaudeCodeOptions for the SDK query."""
		env = {}
		if self._api_key:
			env["ANTHROPIC_API_KEY"] = self._api_key

		opts = ClaudeCodeOptions(
			model=model,
			max_turns=10,
		)

		if env:
			opts.env = env

		if system_prompt:
			opts.system_prompt = system_prompt

		return opts

	def _make_transport(self, prompt: str, options: ClaudeCodeOptions) -> SubprocessCLITransport:
		"""Create a transport with an explicit CLI path to avoid PATH issues."""
		return SubprocessCLITransport(prompt=prompt, options=options, cli_path=self._cli_path)

	def _extract_from_messages(self, messages: list[dict]) -> tuple[str, str]:
		"""Extract system prompt and build a combined user prompt from messages.

		Returns (system_prompt, user_prompt).
		"""
		system_parts = []
		conversation_parts = []

		for msg in messages:
			if msg["role"] == "system":
				system_parts.append(msg["content"])
			elif msg["role"] == "user":
				conversation_parts.append(f"User: {msg['content']}")
			elif msg["role"] == "assistant":
				content = msg.get("content") or ""
				if content.strip():
					conversation_parts.append(f"Assistant: {content}")

		system_prompt = "\n".join(system_parts).strip()

		# If there's only one user message (no prior conversation), just use its content directly
		user_messages = [m for m in messages if m["role"] == "user"]
		if len(user_messages) == 1 and len(conversation_parts) == 1:
			user_prompt = user_messages[0]["content"]
		else:
			user_prompt = "\n\n".join(conversation_parts)

		return system_prompt, user_prompt

	def _run_async_query(self, result_queue: queue.Queue, prompt: str, options: ClaudeCodeOptions):
		"""Run the async SDK query in a separate thread, pushing events to the queue."""

		async def _stream():
			got_content = False
			try:
				transport = self._make_transport(prompt, options)
				async for message in query(prompt=prompt, options=options, transport=transport):
					msg_type = type(message).__name__

					if msg_type == "AssistantMessage":
						content = getattr(message, "content", None)
						if isinstance(content, list):
							for block in content:
								block_type = type(block).__name__
								if block_type == "TextBlock":
									text = getattr(block, "text", "")
									if text:
										got_content = True
										result_queue.put({"type": "token", "content": text})
								elif block_type == "ToolUseBlock":
									result_queue.put({
										"type": "tool_call",
										"id": getattr(block, "id", ""),
										"name": getattr(block, "name", ""),
										"arguments": json.dumps(getattr(block, "input", {})),
									})
						elif isinstance(content, str) and content:
							got_content = True
							result_queue.put({"type": "token", "content": content})

					elif msg_type == "ResultMessage":
						is_error = getattr(message, "is_error", False)
						if is_error:
							error_text = getattr(message, "result", "Claude Code returned an error.")
							result_queue.put({"type": "error", "message": str(error_text)})
						else:
							usage = {}
							cost_usd = getattr(message, "total_cost_usd", 0) or 0
							raw_usage = getattr(message, "usage", {}) or {}
							input_tokens = raw_usage.get("input_tokens", 0) or 0
							output_tokens = raw_usage.get("output_tokens", 0) or 0
							total_tokens = input_tokens + output_tokens
							usage = {
								"prompt_tokens": input_tokens,
								"completion_tokens": output_tokens,
								"total_tokens": total_tokens,
								"cost_usd": cost_usd,
							}
							result_queue.put({"type": "done", "usage": usage})

			except MessageParseError:
				# SDK can't parse some message types (e.g. rate_limit_event).
				# If we already received content, treat as successful completion.
				if got_content:
					result_queue.put({"type": "done", "usage": {}})
				else:
					result_queue.put({"type": "error", "message": "Failed to parse Claude Code response."})
			except Exception as e:
				result_queue.put({"type": "error", "message": str(e)})
			finally:
				result_queue.put(None)  # sentinel to signal completion

		loop = asyncio.new_event_loop()
		try:
			loop.run_until_complete(_stream())
		finally:
			loop.close()

	def chat_completion(
		self,
		messages: list[dict],
		model: str,
		temperature: float = 0.7,
		max_tokens: int = 4096,
		tools: list[dict] | None = None,
		stream: bool = False,
	) -> dict:
		"""Non-streaming completion — collect all streamed content."""
		content_buffer = ""
		tool_calls = []
		usage = {}

		for chunk in self.stream_chat_completion(messages, model, temperature, max_tokens, tools):
			if chunk["type"] == "token":
				content_buffer += chunk["content"]
			elif chunk["type"] == "tool_call":
				tool_calls.append(chunk)
			elif chunk["type"] == "done":
				usage = chunk.get("usage", {})
			elif chunk["type"] == "error":
				raise Exception(chunk["message"])

		result = {"content": content_buffer, "role": "assistant", "usage": usage}
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
		"""Stream tokens from Claude Code SDK.

		Uses a background thread to run the async SDK query and yields
		events from a thread-safe queue.
		"""
		system_prompt, user_prompt = self._extract_from_messages(messages)
		options = self._build_options(model, system_prompt)

		result_queue = queue.Queue()

		thread = threading.Thread(
			target=self._run_async_query,
			args=(result_queue, user_prompt, options),
			daemon=True,
		)
		thread.start()

		while True:
			item = result_queue.get(timeout=600)
			if item is None:
				break
			yield item

		thread.join(timeout=10)

	def validate_api_key(self, model: str | None = None) -> bool:
		"""Test that Claude Code SDK can run a minimal query."""
		try:
			options = self._build_options(model or "claude-sonnet-4-6")
			options.max_turns = 1

			async def _test():
				transport = self._make_transport("hi", options)
				async for _msg in query(prompt="hi", options=options, transport=transport):
					pass

			loop = asyncio.new_event_loop()
			try:
				loop.run_until_complete(_test())
			finally:
				loop.close()

			return True
		except MessageParseError:
			# SDK may not handle all message types — the query itself succeeded
			return True
		except Exception:
			return False
