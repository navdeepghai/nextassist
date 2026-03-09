import json

import frappe

from nextassist.database import tool_db
from nextassist.permissions import check_app_permission


def _check_admin():
	if not check_app_permission():
		frappe.throw("Only System Manager can manage tools.", frappe.PermissionError)


@frappe.whitelist()
def list_tools():
	_check_admin()
	from nextassist.database.pool import get_cursor

	with get_cursor() as cur:
		cur.execute("SELECT * FROM na_tool ORDER BY tool_name")
		return [dict(r) for r in cur.fetchall()]


@frappe.whitelist()
def get_tool(tool_name):
	_check_admin()
	tool = tool_db.get_tool(tool_name)
	if not tool:
		frappe.throw(f"Tool '{tool_name}' not found.")
	return tool


@frappe.whitelist()
def save_tool(
	tool_name,
	tool_type,
	description,
	enabled=True,
	requires_confirmation=False,
	reference_doctype=None,
	function_path=None,
	parameters=None,
):
	_check_admin()

	data = {
		"tool_name": tool_name,
		"tool_type": tool_type,
		"description": description,
		"enabled": enabled
		if isinstance(enabled, bool)
		else enabled == "true" or enabled == "1" or enabled is True,
		"requires_confirmation": requires_confirmation
		if isinstance(requires_confirmation, bool)
		else requires_confirmation == "true" or requires_confirmation == "1" or requires_confirmation is True,
		"reference_doctype": reference_doctype,
		"function_path": function_path,
		"parameters": json.loads(parameters) if isinstance(parameters, str) else (parameters or []),
	}

	return tool_db.save_tool(data)


@frappe.whitelist()
def delete_tool(tool_name):
	_check_admin()
	tool_db.delete_tool(tool_name)
	return {"success": True}
