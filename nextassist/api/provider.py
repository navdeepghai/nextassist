import frappe

from nextassist.database import provider_db, session_db
from nextassist.database.crypto import decrypt_value
from nextassist.database.pool import get_cursor
from nextassist.permissions import check_app_permission


def _check_admin():
	if not check_app_permission():
		frappe.throw("Only System Manager can manage providers.", frappe.PermissionError)


def _normalize_row(row: dict) -> dict:
	"""Map PG column names to frontend-expected names."""
	row["creation"] = row.pop("created_at", None)
	row["modified"] = row.pop("modified_at", None)
	return row


@frappe.whitelist()
@frappe.read_only()
def list_providers():
	_check_admin()
	with get_cursor() as cur:
		cur.execute(
			"""
			SELECT provider_name, provider_type, enabled, is_default,
			       api_base_url, organization_id, default_model,
			       max_tokens, temperature, max_context_messages,
			       created_at, modified_at
			FROM na_ai_provider
			ORDER BY provider_name
			"""
		)
		return [_normalize_row(dict(r)) for r in cur.fetchall()]


@frappe.whitelist()
@frappe.read_only()
def get_provider(provider_name=None):
	if not provider_name:
		return {}
	_check_admin()
	with get_cursor() as cur:
		cur.execute(
			"""
			SELECT provider_name, provider_type, enabled, is_default,
			       api_key_encrypted,
			       api_base_url, organization_id, default_model,
			       max_tokens, temperature, max_context_messages,
			       created_at, modified_at
			FROM na_ai_provider
			WHERE provider_name = %s
			""",
			(provider_name,),
		)
		row = cur.fetchone()
		if not row:
			frappe.throw(f"Provider '{provider_name}' not found.")
		result = _normalize_row(dict(row))
		# Decrypt API key for the admin form
		encrypted = result.pop("api_key_encrypted", "")
		result["api_key"] = decrypt_value(encrypted) if encrypted else ""
		return result


@frappe.whitelist()
def save_provider(
	provider_name,
	provider_type,
	api_key=None,
	enabled=True,
	is_default=False,
	api_base_url=None,
	organization_id=None,
	default_model=None,
	max_tokens=4096,
	temperature=0.7,
	max_context_messages=20,
):
	_check_admin()

	data = {
		"provider_name": provider_name,
		"provider_type": provider_type,
		"enabled": enabled
		if isinstance(enabled, bool)
		else enabled == "true" or enabled == "1" or enabled is True,
		"is_default": is_default
		if isinstance(is_default, bool)
		else is_default == "true" or is_default == "1" or is_default is True,
		"api_base_url": api_base_url,
		"organization_id": organization_id,
		"default_model": default_model,
		"max_tokens": int(max_tokens) if max_tokens else 4096,
		"temperature": float(temperature) if temperature else 0.7,
		"max_context_messages": int(max_context_messages) if max_context_messages else 20,
	}

	if api_key:
		data["api_key"] = api_key

	result = provider_db.save_provider(data)
	# Don't return encrypted key to frontend
	result.pop("api_key_encrypted", None)
	return result


@frappe.whitelist()
def delete_provider(provider_name):
	_check_admin()
	provider_db.delete_provider(provider_name)
	return {"success": True}


@frappe.whitelist()
@frappe.read_only()
def get_provider_usage(provider_name):
	_check_admin()
	return session_db.get_provider_usage(provider_name)
