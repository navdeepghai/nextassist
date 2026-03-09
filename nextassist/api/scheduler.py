import json

import frappe
from croniter import croniter

from nextassist.database import scheduler_db
from nextassist.security.script_validator import validate_scheduler_config


def _check_scheduler_access(scheduler: dict) -> None:
	"""Verify the current user owns the scheduler or is System Manager."""
	if scheduler["user_email"] != frappe.session.user and "System Manager" not in frappe.get_roles():
		frappe.throw("You can only access your own schedulers.", frappe.PermissionError)


def _map_keys(s: dict) -> dict:
	"""Map PG column names to what the frontend expects."""
	s["name"] = s["id"]
	s["creation"] = s["created_at"]
	s["modified"] = s["modified_at"]
	s["user"] = s["user_email"]
	return s


@frappe.whitelist()
@frappe.read_only()
def list_schedulers(limit=50, offset=0, status=None, action_type=None):
	"""List schedulers. Admin sees all, users see their own."""
	user_email = None
	if "System Manager" not in frappe.get_roles():
		user_email = frappe.session.user

	schedulers = scheduler_db.list_schedulers(
		user_email=user_email,
		limit=int(limit),
		offset=int(offset),
		status=status,
		action_type=action_type,
	)

	for s in schedulers:
		_map_keys(s)

	return schedulers


@frappe.whitelist()
@frappe.read_only()
def get_scheduler(scheduler_id):
	"""Get a single scheduler by ID."""
	scheduler = scheduler_db.get_scheduler(scheduler_id)
	if not scheduler:
		frappe.throw("Scheduler not found.")
	_check_scheduler_access(scheduler)
	return _map_keys(scheduler)


MAX_SCHEDULERS_PER_USER = 25


@frappe.whitelist()
def save_scheduler(
	title,
	query_doctype,
	action_type,
	action_config,
	cron_expression="0 9 * * *",
	description=None,
	query_filters=None,
	query_fields=None,
	query_condition=None,
	scheduler_id=None,
):
	"""Create or update a scheduler."""
	# Validate cron expression
	try:
		croniter(cron_expression)
	except (ValueError, KeyError) as e:
		frappe.throw(f"Invalid cron expression: {e}")

	# Rate limit: cap schedulers per user (only on create, not update)
	if not scheduler_id:
		existing = scheduler_db.list_schedulers(
			user_email=frappe.session.user, limit=MAX_SCHEDULERS_PER_USER + 1
		)
		if len(existing) >= MAX_SCHEDULERS_PER_USER:
			frappe.throw(
				f"You have reached the maximum number of schedulers ({MAX_SCHEDULERS_PER_USER}). "
				"Please delete unused schedulers before creating new ones."
			)

	# Parse JSON strings from frontend
	if isinstance(action_config, str):
		action_config = json.loads(action_config)
	if isinstance(query_filters, str):
		query_filters = json.loads(query_filters)
	if isinstance(query_fields, str):
		query_fields = json.loads(query_fields)

	# Security validation: action type, query condition, webhook URL, Jinja templates
	violations = validate_scheduler_config(
		action_type=action_type,
		action_config=action_config,
		query_condition=query_condition,
	)
	if violations:
		frappe.throw(f"Security validation failed: {'; '.join(violations)}")

	if scheduler_id:
		# Update existing
		scheduler = scheduler_db.get_scheduler(scheduler_id)
		if not scheduler:
			frappe.throw("Scheduler not found.")
		_check_scheduler_access(scheduler)

		result = scheduler_db.update_scheduler(
			scheduler_id,
			title=title,
			description=description,
			query_doctype=query_doctype,
			action_type=action_type,
			action_config=action_config,
			cron_expression=cron_expression,
			query_filters=query_filters or {},
			query_fields=query_fields or ["name"],
			query_condition=query_condition,
		)
	else:
		# Create new
		result = scheduler_db.create_scheduler(
			title=title,
			user_email=frappe.session.user,
			query_doctype=query_doctype,
			action_type=action_type,
			action_config=action_config,
			description=description,
			cron_expression=cron_expression,
			query_filters=query_filters or {},
			query_fields=query_fields or ["name"],
			query_condition=query_condition,
		)

	return _map_keys(result)


@frappe.whitelist()
def delete_scheduler(scheduler_id):
	"""Delete a scheduler."""
	scheduler = scheduler_db.get_scheduler(scheduler_id)
	if not scheduler:
		frappe.throw("Scheduler not found.")
	_check_scheduler_access(scheduler)
	scheduler_db.delete_scheduler(scheduler_id)
	return {"success": True}


@frappe.whitelist()
def toggle_scheduler(scheduler_id, enabled):
	"""Enable or disable a scheduler."""
	scheduler = scheduler_db.get_scheduler(scheduler_id)
	if not scheduler:
		frappe.throw("Scheduler not found.")
	_check_scheduler_access(scheduler)

	enabled_bool = enabled if isinstance(enabled, bool) else str(enabled).lower() in ("true", "1")
	result = scheduler_db.toggle_scheduler(scheduler_id, enabled_bool)
	return _map_keys(result)


@frappe.whitelist()
@frappe.read_only()
def list_runs(scheduler_id, limit=50, offset=0):
	"""List run history for a scheduler."""
	scheduler = scheduler_db.get_scheduler(scheduler_id)
	if not scheduler:
		frappe.throw("Scheduler not found.")
	_check_scheduler_access(scheduler)

	runs = scheduler_db.list_runs(scheduler_id, int(limit), int(offset))
	for r in runs:
		r["name"] = r["id"]
		r["creation"] = r["created_at"]
	return runs


@frappe.whitelist()
@frappe.read_only()
def get_run_stats(scheduler_id, days=30):
	"""Get daily run stats for charts."""
	scheduler = scheduler_db.get_scheduler(scheduler_id)
	if not scheduler:
		frappe.throw("Scheduler not found.")
	_check_scheduler_access(scheduler)

	return scheduler_db.get_run_stats(scheduler_id, int(days))
