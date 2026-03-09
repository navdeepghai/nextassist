from abc import ABC, abstractmethod
from collections.abc import Generator


class BaseProvider(ABC):
	"""Abstract base class for AI providers."""

	@abstractmethod
	def __init__(self, provider_doc):
		"""Initialize with a provider config."""

	@abstractmethod
	def chat_completion(
		self,
		messages: list[dict],
		model: str,
		temperature: float = 0.7,
		max_tokens: int = 4096,
		tools: list[dict] | None = None,
		stream: bool = False,
	) -> dict:
		"""Send messages and get a non-streaming completion."""

	@abstractmethod
	def stream_chat_completion(
		self,
		messages: list[dict],
		model: str,
		temperature: float = 0.7,
		max_tokens: int = 4096,
		tools: list[dict] | None = None,
	) -> Generator[dict]:
		"""
		Stream tokens one by one.

		Yields dicts with these types:
		  {"type": "token", "content": "..."}
		  {"type": "tool_call", "id": "...", "name": "...", "arguments": "..."}
		  {"type": "done", "usage": {...}}
		  {"type": "error", "message": "..."}
		"""

	@abstractmethod
	def validate_api_key(self, model: str | None = None) -> bool:
		"""Test the API connection and optionally the model. Returns True if valid."""
