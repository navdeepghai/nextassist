import frappe

from nextassist.ai.base_provider import BaseProvider
from nextassist.database import provider_db

PROVIDER_MAP = {
	"OpenAI": "nextassist.ai.openai_provider.OpenAIProvider",
	"Anthropic": "nextassist.ai.anthropic_provider.AnthropicProvider",
	"Google": "nextassist.ai.gemini_provider.GeminiProvider",
}


def get_provider(provider_name: str | None = None) -> BaseProvider:
	"""Get a provider instance by name, or fall back to the default."""
	if provider_name:
		provider_config = provider_db.get_provider(provider_name)
	else:
		# Try to find the default provider
		provider_config = provider_db.get_default_provider()
		if not provider_config:
			# Fall back to any enabled provider
			provider_config = provider_db.get_any_enabled_provider()

	if not provider_config:
		frappe.throw("No AI provider configured. Please set up a provider in Settings.")

	if not provider_config.enabled:
		frappe.throw(f"Provider '{provider_config.provider_name}' is disabled.")

	provider_type = provider_config.provider_type
	class_path = PROVIDER_MAP.get(provider_type)
	if not class_path:
		frappe.throw(f"Unsupported provider type: {provider_type}")

	provider_class = frappe.get_attr(class_path)
	return provider_class(provider_config)
