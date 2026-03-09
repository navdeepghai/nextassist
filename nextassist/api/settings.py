import frappe

from nextassist.ai.provider_factory import get_provider
from nextassist.database import settings_db
from nextassist.permissions import check_app_permission


@frappe.whitelist()
def get_settings():
	if not check_app_permission():
		frappe.throw("Only System Manager can view settings.", frappe.PermissionError)
	return settings_db.get_settings()


@frappe.whitelist()
def save_settings(default_provider=None, enable_tool_calling=True, enable_file_uploads=True):
	"""Save settings (System Manager only)."""
	if not check_app_permission():
		frappe.throw("Only System Manager can update settings.", frappe.PermissionError)

	data = {
		"default_provider": default_provider,
		"enable_tool_calling": enable_tool_calling
		if isinstance(enable_tool_calling, bool)
		else enable_tool_calling == "true" or enable_tool_calling == "1" or enable_tool_calling is True,
		"enable_file_uploads": enable_file_uploads
		if isinstance(enable_file_uploads, bool)
		else enable_file_uploads == "true" or enable_file_uploads == "1" or enable_file_uploads is True,
	}

	return settings_db.save_settings(data)


@frappe.whitelist()
def test_provider(provider_name, model=None):
	"""Test if a provider's API key and model are valid. System Manager only."""
	if not check_app_permission():
		frappe.throw("Only System Manager can test providers.", frappe.PermissionError)
	provider = get_provider(provider_name)
	try:
		is_valid = provider.validate_api_key(model=model or None)
		return {"valid": is_valid, "provider": provider_name, "model": model}
	except Exception as e:
		return {"valid": False, "provider": provider_name, "model": model, "error": str(e)}
