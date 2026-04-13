import json

import frappe

from nextassist.database import message_db, provider_db, session_db, settings_db


def _get_default_system_prompt() -> str:
	"""Load the default system prompt from prompts/prompt.txt."""
	prompt_path = frappe.get_app_path("nextassist", "prompts", "prompt.txt")
	try:
		with open(prompt_path) as f:
			return f.read()
	except FileNotFoundError:
		return ""


def build_messages(
	session_name: str,
	new_message: str,
	attachments: list[dict] | None = None,
) -> list[dict]:
	"""Build the message list for the AI provider from session history."""
	session = session_db.get_session(session_name)
	provider_config = _get_provider_config_for_session(session)

	messages = []

	# System prompt always from prompt.txt
	system_prompt = _get_default_system_prompt()
	if system_prompt:
		messages.append({"role": "system", "content": system_prompt})

	# Fetch latest N messages (desc order, then reverse) so new messages
	# are always included even when the session exceeds max_context_messages.
	max_context = (provider_config.max_context_messages if provider_config else 0) or 20
	history = message_db.get_recent_messages(session_name, max_context)

	for msg in history:
		# Skip empty/error messages from context
		if msg["role"] == "assistant" and not (msg.get("content") or "").strip():
			continue
		if msg.get("is_error"):
			continue

		entry = {"role": msg["role"], "content": msg.get("content") or ""}

		tc = msg.get("tool_calls")
		if tc:
			if isinstance(tc, str):
				try:
					entry["tool_calls"] = json.loads(tc)
				except json.JSONDecodeError, TypeError:
					pass
			elif isinstance(tc, list):
				entry["tool_calls"] = tc

		if msg.get("tool_call_id"):
			entry["tool_call_id"] = msg["tool_call_id"]

		messages.append(entry)

	# New user message
	user_content = new_message
	if attachments:
		file_texts = []
		for att in attachments:
			if att.get("extracted_content"):
				file_texts.append(f"[File: {att.get('file_name', 'attachment')}]\n{att['extracted_content']}")
		if file_texts:
			user_content = user_content + "\n\n---\n" + "\n\n".join(file_texts)

	messages.append({"role": "user", "content": user_content})

	return messages


def get_model_for_session(session_name: str) -> str:
	"""Get the model to use for a session.

	Priority: session.model > provider.default_model > default provider's model
	"""
	session = session_db.get_session(session_name)
	if session and session.get("model"):
		return session["model"]

	provider_config = _get_provider_config_for_session(session)
	if provider_config and provider_config.default_model:
		return provider_config.default_model

	return "gpt-4o"


def get_provider_for_session(session_name: str) -> str | None:
	"""Get the provider name for a session."""
	session = session_db.get_session(session_name)
	return session.get("provider") if session else None


def get_provider_config(session_name: str) -> dict:
	"""Get all provider configuration for a session.

	Returns a dict with: temperature, max_tokens, max_context_messages, system_prompt
	"""
	session = session_db.get_session(session_name)
	provider_config = _get_provider_config_for_session(session)

	return {
		"temperature": (provider_config.temperature if provider_config else 0) or 0.7,
		"max_tokens": (provider_config.max_tokens if provider_config else 0) or 4096,
		"max_context_messages": (provider_config.max_context_messages if provider_config else 0) or 20,
		"system_prompt": _get_default_system_prompt(),
		"context_window": getattr(provider_config, "context_window", None),
	}


def _get_provider_config_for_session(session):
	"""Resolve the ProviderConfig for a session, falling back to defaults."""
	if not session:
		return provider_db.get_default_provider() or provider_db.get_any_enabled_provider()

	# Session's own provider
	if session.get("provider"):
		config = provider_db.get_provider(session["provider"])
		if config:
			return config

	# Default provider from settings
	settings = settings_db.get_settings()
	if settings.get("default_provider"):
		config = provider_db.get_provider(settings["default_provider"])
		if config:
			return config

	# Any default provider
	return provider_db.get_default_provider() or provider_db.get_any_enabled_provider()
