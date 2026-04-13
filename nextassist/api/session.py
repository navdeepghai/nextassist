import frappe

from nextassist.database import message_db, provider_db, session_db, settings_db

# Canonical model list per provider type.
# Also duplicated in nextassist_ai_provider.js for the DocType form.
PROVIDER_MODELS = {
	"OpenAI": [
		"gpt-5.4-pro",
		"gpt-5.4",
		"gpt-4.1",
		"gpt-4.1-mini",
		"gpt-4.1-nano",
		"gpt-4o",
		"gpt-4o-mini",
		"o4-mini",
		"o3",
		"o3-mini",
	],
	"Anthropic": [
		"claude-opus-4-6",
		"claude-sonnet-4-6",
		"claude-haiku-4-5",
		"claude-opus-4-20250514",
		"claude-sonnet-4-20250514",
		"claude-haiku-4-5-20251001",
	],
	"Google": [
		"gemini-3.1-pro-preview",
		"gemini-3.1-flash-lite-preview",
		"gemini-3-flash-preview",
		"gemini-2.5-pro",
		"gemini-2.5-flash",
		"gemini-2.5-flash-lite",
		"gemini-2.0-flash",
		"gemini-2.0-flash-lite",
	],
	"Claude Code": [
		"claude-sonnet-4-6",
		"claude-opus-4-6",
	],
}


def _check_session_access(session: dict) -> None:
	"""Verify the current user owns the session or is System Manager."""
	if session["user_email"] != frappe.session.user and "System Manager" not in frappe.get_roles():
		frappe.throw("You can only access your own sessions.", frappe.PermissionError)


def _map_session_keys(s: dict) -> dict:
	"""Map PG column names to what the frontend expects."""
	s["name"] = s["id"]
	s["creation"] = s["created_at"]
	s["modified"] = s["modified_at"]
	s["user"] = s["user_email"]
	return s


@frappe.whitelist()
def create_session(title=None, provider=None, model=None):
	# Resolve provider and model from defaults if not specified
	if not provider:
		settings = settings_db.get_settings()
		if settings.get("default_provider"):
			provider = settings["default_provider"]
		else:
			p = provider_db.get_default_provider()
			if not p:
				p = provider_db.get_any_enabled_provider()
			if p:
				provider = p.provider_name

	if not model and provider:
		model = provider_db.get_provider_value(provider, "default_model")

	session = session_db.create_session(
		title=title or "New Chat",
		user=frappe.session.user,
		provider=provider,
		model=model,
	)

	return _map_session_keys(session)


@frappe.whitelist()
@frappe.read_only()
def list_sessions(limit=50, offset=0):
	sessions = session_db.list_sessions(frappe.session.user, int(limit), int(offset))

	# Aggregate token counts per session
	if sessions:
		session_ids = [s["id"] for s in sessions]
		token_map = message_db.sum_tokens_bulk(session_ids)
		for s in sessions:
			s["total_tokens"] = token_map.get(s["id"], 0)
			_map_session_keys(s)

	return sessions


@frappe.whitelist()
def rename_session(session_id, title):
	session = session_db.get_session(session_id)
	if not session:
		frappe.throw("Session not found.")
	_check_session_access(session)
	session_db.update_session(session_id, title=title)
	return {"success": True}


@frappe.whitelist()
def delete_session(session_id):
	session = session_db.get_session(session_id)
	if not session:
		frappe.throw("Session not found.")
	_check_session_access(session)
	session_db.delete_session(session_id)
	return {"success": True}


@frappe.whitelist()
def archive_session(session_id):
	session = session_db.get_session(session_id)
	if not session:
		frappe.throw("Session not found.")
	_check_session_access(session)
	session_db.update_session(session_id, status="Archived")
	return {"success": True}


@frappe.whitelist()
def continue_session(session_id):
	"""Create a new session as a continuation of an existing one."""
	old_session = session_db.get_session(session_id)
	if not old_session:
		frappe.throw("Session not found.")
	if old_session["user_email"] != frappe.session.user:
		frappe.throw("You can only continue your own sessions.")

	# Create new session with same config
	new_session = session_db.create_session(
		title="New Chat",
		user=frappe.session.user,
		provider=old_session.get("provider"),
		model=old_session.get("model"),
	)

	# Archive the old session
	if old_session["status"] != "Archived":
		session_db.update_session(session_id, status="Archived")

	return _map_session_keys(new_session)


@frappe.whitelist()
@frappe.read_only()
def get_available_models():
	"""Return all models grouped by enabled provider."""
	providers = provider_db.get_all_enabled_providers()

	# Deduplicate by provider_type
	seen_types = set()
	result = []
	for p in providers:
		if p["provider_type"] in seen_types:
			continue
		seen_types.add(p["provider_type"])
		result.append(
			{
				"provider_name": p["provider_name"],
				"provider_type": p["provider_type"],
				"default_model": p.get("default_model"),
				"models": PROVIDER_MODELS.get(p["provider_type"], []),
			}
		)

	return result


@frappe.whitelist()
def update_session_model(session_id, model):
	"""Update the model (and provider) for an active session."""
	session = session_db.get_session(session_id)
	if not session:
		frappe.throw("Session not found.")
	_check_session_access(session)

	if session["status"] != "Active":
		frappe.throw("Cannot change model on a non-active session.")

	# Resolve which enabled provider owns this model
	providers = provider_db.get_all_enabled_providers()
	resolved_provider = None
	for p in providers:
		if model in PROVIDER_MODELS.get(p["provider_type"], []):
			resolved_provider = p["provider_name"]
			break

	if not resolved_provider:
		frappe.throw(f"No enabled provider found for model '{model}'.")

	session_db.update_session(session_id, model=model, provider=resolved_provider)
	return {"success": True, "model": model, "provider": resolved_provider}
