import json
import re

import frappe

from nextassist.database import tool_db

# Tool types that modify data — blocked from AI-initiated execution.
# These can only run via the test_tool API with System Manager role.
_WRITE_TOOL_TYPES = frozenset({"Create Document", "Update Document"})

# Allowed module prefixes for Custom Function tool paths.
# Only functions within the same Frappe site's installed apps are permitted.
_ALLOWED_FUNCTION_PREFIXES = frozenset(
	{
		"nextassist.",
		"frappe.client.",
		"erpnext.",
	}
)

# Blocked function path patterns for Custom Function (even within allowed modules)
_BLOCKED_FUNCTION_PATTERNS = [
	r"\.safe_exec",
	r"\.exec",
	r"\.eval",
	r"\.db\.",
	r"\.install",
	r"\.migrate",
	r"\.destroy",
	r"\.reset",
	r"\.delete",
	r"\.drop",
]

# Hardcoded create_scheduler tool definition
_SCHEDULER_TOOL_DEFINITION = {
	"type": "function",
	"function": {
		"name": "create_scheduler",
		"description": (
			"Create a recurring automated task (scheduler) that runs on a cron schedule. "
			"Use this when the user wants to set up reminders, monitors, alerts, or recurring automations "
			"like 'email me if Leads haven't changed in 10 days' or 'notify me about overdue purchase orders every Monday'."
		),
		"parameters": {
			"type": "object",
			"properties": {
				"title": {
					"type": "string",
					"description": "Short title for the scheduler (e.g. 'Stale Lead Alert')",
				},
				"description": {
					"type": "string",
					"description": "Human-readable description of what this scheduler does",
				},
				"query_doctype": {
					"type": "string",
					"description": "The ERPNext DocType to query (e.g. 'Lead', 'Sales Invoice', 'Purchase Order')",
				},
				"query_filters": {
					"type": "object",
					"description": 'Frappe-style filters dict (e.g. {"status": "Open"})',
				},
				"query_fields": {
					"type": "array",
					"items": {"type": "string"},
					"description": 'Fields to fetch from the DocType (e.g. ["name", "lead_name", "lead_owner", "modified"])',
				},
				"query_condition": {
					"type": "string",
					"description": (
						"Python expression evaluated per doc. Has access to 'doc' (dict) and 'frappe.utils'. "
						"Example: \"doc.get('modified') < str(frappe.utils.add_days(frappe.utils.today(), -10))\""
					),
				},
				"cron_expression": {
					"type": "string",
					"description": (
						"Cron schedule expression. Examples: '0 9 * * *' (daily 9am), "
						"'0 9 * * 1-5' (weekdays 9am), '0 9 * * 1' (weekly Monday 9am), "
						"'0 */6 * * *' (every 6 hours)"
					),
				},
				"action_type": {
					"type": "string",
					"enum": ["email", "notification", "webhook"],
					"description": "Action to perform on matched documents",
				},
				"action_config": {
					"type": "object",
					"description": (
						"Config for the action. "
						"Email: {recipients_field, subject, message}. "
						"Notification: {user_field, subject, message}. "
						"Webhook: {url, method, headers, body_template}. "
						"Subject/message support Jinja: {{ doc.field_name }}"
					),
				},
			},
			"required": ["title", "query_doctype", "action_type", "action_config", "cron_expression"],
		},
	},
}


def get_tool_definitions() -> list[dict]:
	"""Convert enabled NextAssist tools to OpenAI function calling format."""
	tools = tool_db.get_enabled_tools()

	# Always include the hardcoded create_scheduler tool
	definitions = [_SCHEDULER_TOOL_DEFINITION]
	for tool in tools:
		# Parameters come from the JSONB column
		params = tool.get("parameters") or []
		if isinstance(params, str):
			params = json.loads(params)

		properties = {}
		required = []
		for p in params:
			properties[p["param_name"]] = {
				"type": p.get("param_type", "string"),
				"description": p.get("description", ""),
			}
			if p.get("required"):
				required.append(p["param_name"])

		# Add implicit parameters based on tool type
		tool_type = tool["tool_type"]
		ref_doctype = tool.get("reference_doctype", "")

		if tool_type in ("Get Document", "Update Document") and "name" not in properties:
			properties["name"] = {
				"type": "string",
				"description": f"The document name/ID of the {ref_doctype}",
			}
			if "name" not in required:
				required.append("name")

		if tool_type == "Get List" and "doctype" not in properties:
			properties["filters"] = {
				"type": "object",
				"description": "Filters to apply when listing documents",
			}
			properties["limit"] = {"type": "number", "description": "Maximum number of results to return"}

		definition = {
			"type": "function",
			"function": {
				"name": tool["tool_name"],
				"description": tool["description"],
				"parameters": {
					"type": "object",
					"properties": properties,
					"required": required,
				},
			},
		}
		definitions.append(definition)

	return definitions


def execute_tool(tool_name: str, arguments: dict, allow_writes: bool = False) -> dict:
	"""Execute a tool and return the result.

	Args:
		tool_name: The tool to execute.
		arguments: Arguments for the tool.
		allow_writes: If False (default), Create/Update tools are blocked.
			Only the test_tool API (System Manager) sets this to True.
	"""
	# Handle hardcoded create_scheduler tool
	if tool_name == "create_scheduler":
		return _execute_create_scheduler(arguments)

	tool = tool_db.get_tool(tool_name)

	if not tool:
		return {"error": f"Tool '{tool_name}' not found"}

	if not tool.get("enabled"):
		return {"error": f"Tool '{tool_name}' is disabled"}

	tool_type = tool["tool_type"]
	ref_doctype = tool.get("reference_doctype", "")

	# Block write operations from AI chat (only allowed via explicit test_tool API)
	if tool_type in _WRITE_TOOL_TYPES and not allow_writes:
		return {
			"error": (
				f"Write operation '{tool_type}' is not allowed from AI chat. "
				f"Data modification requires manual action in ERPNext."
			)
		}

	try:
		if tool_type == "Get Document":
			name = arguments.get("name")
			if not name:
				return {"error": "Missing 'name' parameter"}
			# Use permission-aware access (respects user's Frappe permissions)
			if not frappe.has_permission(ref_doctype, "read", name):
				return {"error": f"No permission to read {ref_doctype}: {name}"}
			doc = frappe.get_doc(ref_doctype, name)
			return {"data": doc.as_dict()}

		elif tool_type == "Get List":
			filters = arguments.get("filters", {})
			limit = arguments.get("limit", 20)
			data = frappe.get_all(
				ref_doctype,
				filters=filters,
				limit_page_length=min(limit, 100),
			)
			return {"data": data}

		elif tool_type == "Create Document":
			if not frappe.has_permission(ref_doctype, "create"):
				return {"error": f"No permission to create {ref_doctype}"}
			doc = frappe.get_doc({"doctype": ref_doctype, **arguments})
			doc.insert()
			frappe.db.commit()
			return {"data": {"name": doc.name, "message": f"Created {ref_doctype}: {doc.name}"}}

		elif tool_type == "Update Document":
			name = arguments.pop("name", None)
			if not name:
				return {"error": "Missing 'name' parameter"}
			if not frappe.has_permission(ref_doctype, "write", name):
				return {"error": f"No permission to update {ref_doctype}: {name}"}
			doc = frappe.get_doc(ref_doctype, name)
			doc.update(arguments)
			doc.save()
			frappe.db.commit()
			return {"data": {"name": doc.name, "message": f"Updated {ref_doctype}: {doc.name}"}}

		elif tool_type == "Run Report":
			report_name = arguments.get("report_name", ref_doctype)
			filters = arguments.get("filters", {})
			if not frappe.has_permission("Report", "read", report_name):
				return {"error": f"No permission to run report: {report_name}"}
			data = frappe.get_doc("Report", report_name).get_data(filters=filters)
			return {"data": data}

		elif tool_type == "Custom Function":
			func_path = tool.get("function_path", "")
			# Validate function path against allowlist
			if not any(func_path.startswith(prefix) for prefix in _ALLOWED_FUNCTION_PREFIXES):
				return {
					"error": (
						f"Function path '{func_path}' is not in the allowed list. "
						f"Only paths starting with {', '.join(sorted(_ALLOWED_FUNCTION_PREFIXES))} are permitted."
					)
				}
			# Block dangerous function patterns
			for pattern in _BLOCKED_FUNCTION_PATTERNS:
				if re.search(pattern, func_path):
					return {"error": f"Function path '{func_path}' matches a blocked pattern"}

			func = frappe.get_attr(func_path)
			result = func(**arguments)
			return {"data": result}

		else:
			return {"error": f"Unknown tool type: {tool_type}"}

	except frappe.PermissionError as e:
		return {"error": f"Permission denied: {e!s}"}
	except Exception as e:
		return {"error": str(e)}


def _execute_create_scheduler(arguments: dict) -> dict:
	"""Create a scheduler from AI tool call arguments."""
	from nextassist.database import scheduler_db
	from nextassist.security.script_validator import validate_scheduler_config

	required = ["title", "query_doctype", "action_type", "action_config", "cron_expression"]
	for field in required:
		if field not in arguments:
			return {"error": f"Missing required parameter: {field}"}

	try:
		from croniter import croniter

		croniter(arguments["cron_expression"])
	except (ValueError, KeyError) as e:
		return {"error": f"Invalid cron expression: {e}"}

	# Security validation of action type, query condition, and action config
	action_config = arguments.get("action_config", {})
	if isinstance(action_config, str):
		action_config = json.loads(action_config)

	violations = validate_scheduler_config(
		action_type=arguments["action_type"],
		action_config=action_config,
		query_condition=arguments.get("query_condition"),
	)
	if violations:
		return {"error": f"Scheduler config blocked by security policy: {'; '.join(violations)}"}

	try:
		scheduler = scheduler_db.create_scheduler(
			title=arguments["title"],
			user_email=frappe.session.user,
			query_doctype=arguments["query_doctype"],
			action_type=arguments["action_type"],
			action_config=action_config,
			description=arguments.get("description"),
			cron_expression=arguments["cron_expression"],
			query_filters=arguments.get("query_filters"),
			query_fields=arguments.get("query_fields"),
			query_condition=arguments.get("query_condition"),
		)
		return {
			"scheduler_id": scheduler["id"],
			"title": scheduler["title"],
			"cron_expression": scheduler["cron_expression"],
			"next_run_at": str(scheduler.get("next_run_at", "")),
			"message": f"Scheduler '{scheduler['title']}' created successfully.",
		}
	except Exception as e:
		return {"error": str(e)}
