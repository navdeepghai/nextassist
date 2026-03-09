"""Execute a single scheduler: query ERPNext, filter, run action, record results."""

import json

import frappe

from nextassist.database import scheduler_db
from nextassist.scheduler.actions import execute_action
from nextassist.security.script_validator import validate_scheduler_condition


def _compile_condition(condition: str):
	"""Pre-validate and compile a scheduler condition to bytecode.

	Returns compiled code object or None if validation fails.
	Raises ScriptValidationError if the condition is unsafe.
	"""
	violations = validate_scheduler_condition(condition)
	if violations:
		raise ValueError(f"Unsafe scheduler condition blocked: {'; '.join(violations)}")
	# Compile as expression (not exec) — prevents statement injection
	return compile(condition, "<scheduler_condition>", "eval")


# Restricted namespace for condition evaluation — only safe utilities exposed
def _build_condition_namespace(doc: dict) -> dict:
	"""Build a minimal, safe namespace for evaluating scheduler conditions."""
	import frappe.utils

	return {
		"__builtins__": {
			# Only allow safe builtins
			"str": str,
			"int": int,
			"float": float,
			"bool": bool,
			"len": len,
			"abs": abs,
			"min": min,
			"max": max,
			"round": round,
			"True": True,
			"False": False,
			"None": None,
		},
		"doc": doc,
		"frappe": type("FrappeProxy", (), {"utils": frappe.utils})(),
	}


def execute_scheduler(scheduler_id: str):
	"""Run a single scheduler end-to-end.

	1. Fetch scheduler config from PG
	2. Set frappe user context to scheduler owner
	3. Create run record
	4. Query ERPNext documents
	5. Apply query_condition filter (pre-validated, compiled expression)
	6. Execute action on matched docs
	7. Record results and advance next_run_at
	"""
	scheduler = scheduler_db.get_scheduler(scheduler_id)
	if not scheduler or not scheduler["enabled"]:
		return

	# Run as the scheduler's owner for permission-aware queries
	frappe.set_user(scheduler["user_email"])

	run = scheduler_db.create_run(scheduler_id)
	run_id = run["id"]

	try:
		# Query ERPNext
		filters = scheduler.get("query_filters") or {}
		if isinstance(filters, str):
			filters = json.loads(filters)

		fields = scheduler.get("query_fields") or ["name"]
		if isinstance(fields, str):
			fields = json.loads(fields)

		docs = frappe.get_all(
			scheduler["query_doctype"],
			filters=filters,
			fields=fields,
			limit_page_length=0,
		)

		matched_count = len(docs)

		# Apply query_condition if present — pre-validated and compiled
		condition = scheduler.get("query_condition")
		if condition and docs:
			compiled_condition = _compile_condition(condition)
			filtered = []
			for doc in docs:
				try:
					ns = _build_condition_namespace(doc)
					if eval(compiled_condition, ns):
						filtered.append(doc)
				except Exception:
					pass
			docs = filtered

		actioned_count = len(docs)

		# Execute action
		action_config = scheduler.get("action_config") or {}
		if isinstance(action_config, str):
			action_config = json.loads(action_config)

		result_data = {}
		if docs:
			result_data = execute_action(scheduler["action_type"], action_config, docs)

		# Record success
		scheduler_db.complete_run(
			run_id,
			status="success",
			matched_count=matched_count,
			actioned_count=actioned_count,
			result_data=result_data,
		)
		scheduler_db.update_scheduler_stats(scheduler_id, success=True)

	except Exception as e:
		error_msg = str(e)
		scheduler_db.complete_run(
			run_id,
			status="error",
			error=error_msg,
		)
		scheduler_db.update_scheduler_stats(scheduler_id, success=False, error_msg=error_msg)
		frappe.log_error(
			title=f"NextAssist Scheduler Error: {scheduler.get('title', scheduler_id)}",
			message=f"Scheduler: {scheduler_id}\nError: {error_msg}",
		)

	finally:
		# Always advance next_run to prevent re-firing
		scheduler_db.advance_next_run(scheduler_id, scheduler["cron_expression"])
