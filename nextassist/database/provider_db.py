from nextassist.database.crypto import decrypt_value, encrypt_value
from nextassist.database.pool import get_cursor

DEFAULT_BASE_URLS = {
	"OpenAI": "https://api.openai.com/v1",
	"Anthropic": "https://api.anthropic.com",
	"Google": "https://generativelanguage.googleapis.com/v1beta",
	"Claude Code": None,
}


class ProviderConfig:
	"""Drop-in replacement for Frappe Document with same attribute access.

	Provider classes (OpenAIProvider, AnthropicProvider, GeminiProvider) call
	provider_doc.get_password("api_key") and access attributes like
	provider_doc.api_base_url — this wrapper supports both identically.
	"""

	def __init__(self, row: dict):
		self.provider_name = row["provider_name"]
		self.provider_type = row["provider_type"]
		self.enabled = row.get("enabled", True)
		self.is_default = row.get("is_default", False)
		self.api_base_url = row.get("api_base_url")
		self.organization_id = row.get("organization_id")
		self.default_model = row.get("default_model")
		self.max_tokens = row.get("max_tokens", 4096)
		self.temperature = row.get("temperature", 0.7)
		self.max_context_messages = row.get("max_context_messages", 20)
		self.context_window = row.get("context_window")
		self._api_key = row.get("api_key", "")  # already decrypted

	def get_password(self, field: str) -> str:
		if field == "api_key":
			return self._api_key
		raise ValueError(f"Unknown password field: {field}")


def _row_to_config(row: dict) -> ProviderConfig:
	"""Convert a raw PG row to a ProviderConfig, decrypting the API key."""
	row = dict(row)
	encrypted_key = row.pop("api_key_encrypted", "")
	row["api_key"] = decrypt_value(encrypted_key) if encrypted_key else ""
	return ProviderConfig(row)


def get_provider(name: str) -> ProviderConfig | None:
	"""Get a provider by name, with decrypted API key."""
	with get_cursor() as cur:
		cur.execute("SELECT * FROM na_ai_provider WHERE provider_name = %s", (name,))
		row = cur.fetchone()
		return _row_to_config(row) if row else None


def get_default_provider() -> ProviderConfig | None:
	"""Get the default enabled provider."""
	with get_cursor() as cur:
		cur.execute("SELECT * FROM na_ai_provider WHERE is_default = TRUE AND enabled = TRUE LIMIT 1")
		row = cur.fetchone()
		return _row_to_config(row) if row else None


def get_any_enabled_provider() -> ProviderConfig | None:
	"""Get any enabled provider as fallback."""
	with get_cursor() as cur:
		cur.execute("SELECT * FROM na_ai_provider WHERE enabled = TRUE LIMIT 1")
		row = cur.fetchone()
		return _row_to_config(row) if row else None


def get_all_enabled_providers() -> list[dict]:
	"""Get all enabled providers (without decrypting API keys)."""
	with get_cursor() as cur:
		cur.execute(
			"""
			SELECT provider_name, provider_type, enabled, is_default,
			       default_model, context_window, max_tokens, temperature,
			       max_context_messages
			FROM na_ai_provider
			WHERE enabled = TRUE
			"""
		)
		return [dict(r) for r in cur.fetchall()]


def get_provider_value(name: str, field: str):
	"""Get a single field value from a provider."""
	with get_cursor() as cur:
		cur.execute(
			f"SELECT {field} FROM na_ai_provider WHERE provider_name = %s",
			(name,),
		)
		row = cur.fetchone()
		return row[field] if row else None


def save_provider(data: dict) -> dict:
	"""Insert or update a provider. Handles API key encryption and default enforcement."""
	# Encrypt API key if provided as plaintext
	api_key_encrypted = data.get("api_key_encrypted", "")
	if data.get("api_key"):
		api_key_encrypted = encrypt_value(data["api_key"])

	# Set default base URL if not provided
	provider_type = data.get("provider_type", "OpenAI")
	api_base_url = data.get("api_base_url") or DEFAULT_BASE_URLS.get(provider_type)

	with get_cursor() as cur:
		# If this provider is marked as default, unset all others first
		if data.get("is_default"):
			cur.execute(
				"UPDATE na_ai_provider SET is_default = FALSE WHERE provider_name != %s",
				(data["provider_name"],),
			)

		cur.execute(
			"""
			INSERT INTO na_ai_provider
				(provider_name, provider_type, enabled, is_default, api_key_encrypted,
				 api_base_url, organization_id, default_model, context_window,
				 max_tokens, temperature, max_context_messages)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
			ON CONFLICT (provider_name) DO UPDATE SET
				provider_type = EXCLUDED.provider_type,
				enabled = EXCLUDED.enabled,
				is_default = EXCLUDED.is_default,
				api_key_encrypted = EXCLUDED.api_key_encrypted,
				api_base_url = EXCLUDED.api_base_url,
				organization_id = EXCLUDED.organization_id,
				default_model = EXCLUDED.default_model,
				context_window = EXCLUDED.context_window,
				max_tokens = EXCLUDED.max_tokens,
				temperature = EXCLUDED.temperature,
				max_context_messages = EXCLUDED.max_context_messages,
				modified_at = now()
			RETURNING *
			""",
			(
				data["provider_name"],
				provider_type,
				data.get("enabled", True),
				data.get("is_default", False),
				api_key_encrypted,
				api_base_url,
				data.get("organization_id"),
				data.get("default_model"),
				data.get("context_window"),
				data.get("max_tokens", 4096),
				data.get("temperature", 0.7),
				data.get("max_context_messages", 20),
			),
		)
		return dict(cur.fetchone())


def delete_provider(name: str) -> None:
	"""Delete a provider by name."""
	with get_cursor() as cur:
		cur.execute("DELETE FROM na_ai_provider WHERE provider_name = %s", (name,))
