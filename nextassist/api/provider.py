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
			       context_window, max_tokens, temperature,
			       max_context_messages, created_at, modified_at
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
			       context_window, max_tokens, temperature,
			       max_context_messages, created_at, modified_at
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


def _to_int(value, default):
	try:
		return int(value)
	except (TypeError, ValueError):
		return default


def _to_float(value, default):
	try:
		return float(value)
	except (TypeError, ValueError):
		return default


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
	context_window=None,
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
		"context_window": _to_int(context_window, None),
		"max_tokens": _to_int(max_tokens, 4096),
		"temperature": _to_float(temperature, 0.7),
		"max_context_messages": _to_int(max_context_messages, 20),
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


@frappe.whitelist()
def check_claude_code_status():
	"""Check if Claude Code CLI is installed and authenticated."""
	import subprocess

	from nextassist.ai.claude_code_utils import find_claude_cli

	result = {"installed": False, "authenticated": False, "error": None}

	# 1. Check if claude-code-sdk is importable
	try:
		import claude_code_sdk
	except ImportError:
		result["error"] = (
			"The claude-code-sdk Python package is not installed. "
			"Install it with: pip install claude-code-sdk"
		)
		return result

	# 2. Find claude CLI binary (checks PATH + fallback locations)
	claude_path = find_claude_cli()
	if not claude_path:
		result["error"] = (
			"Claude Code CLI is not installed on this server. "
			"Install it from: https://docs.anthropic.com/en/docs/claude-code/overview"
		)
		return result

	result["installed"] = True

	# 3. Check authentication by running `claude --version`
	try:
		proc = subprocess.run(
			[claude_path, "--version"],
			capture_output=True,
			text=True,
			timeout=10,
		)
		if proc.returncode != 0:
			result["error"] = (
				"Claude Code CLI is installed but not working correctly. "
				f"Error: {proc.stderr.strip()}"
			)
			return result
	except subprocess.TimeoutExpired:
		result["error"] = "Claude Code CLI timed out. Please check your installation."
		return result
	except Exception as e:
		result["error"] = f"Failed to run Claude Code CLI: {e}"
		return result

	# 4. Check auth by running a minimal print command
	try:
		proc = subprocess.run(
			[claude_path, "-p", "hi", "--max-turns", "1", "--output-format", "json"],
			capture_output=True,
			text=True,
			timeout=30,
		)
		if proc.returncode != 0:
			stderr = proc.stderr.strip()
			if "auth" in stderr.lower() or "login" in stderr.lower() or "api key" in stderr.lower():
				result["error"] = (
					"Claude Code is not authenticated. "
					"Please run `claude login` on the server to configure it before proceeding."
				)
			else:
				result["error"] = (
					"Claude Code CLI returned an error. "
					f"Details: {stderr[:200]}"
				)
			return result
	except subprocess.TimeoutExpired:
		# If it timed out but didn't error on auth, it's likely authenticated but slow
		result["authenticated"] = True
		return result
	except Exception as e:
		result["error"] = f"Failed to verify Claude Code authentication: {e}"
		return result

	result["authenticated"] = True
	return result
