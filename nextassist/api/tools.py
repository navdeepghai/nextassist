import json

import frappe

from nextassist.ai.tools import execute_tool, get_tool_definitions
from nextassist.permissions import check_app_permission


@frappe.whitelist()
def list_tools():
	if not check_app_permission():
		frappe.throw("Only System Manager can view tools.", frappe.PermissionError)
	return get_tool_definitions()


@frappe.whitelist()
def test_tool(tool_name, args=None):
	"""Test a tool execution. Restricted to System Manager.

	System Manager can test write operations (Create/Update) via this API.
	Regular users and AI chat cannot perform writes.
	"""
	if not check_app_permission():
		frappe.throw("Only System Manager can test tools.", frappe.PermissionError)
	if args and isinstance(args, str):
		args = json.loads(args)
	return execute_tool(tool_name, args or {}, allow_writes=True)
