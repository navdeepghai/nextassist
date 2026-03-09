import json
from datetime import datetime

from croniter import croniter

from nextassist.database.id_gen import new_id
from nextassist.database.pool import get_cursor


def compute_next_run(cron_expr: str, base_time: datetime | None = None) -> datetime:
	"""Return the next run datetime from a cron expression."""
	if base_time is None:
		from frappe.utils import now_datetime

		base_time = now_datetime()
	return croniter(cron_expr, base_time).get_next(datetime)


# ---------------------------------------------------------------------------
# Scheduler CRUD
# ---------------------------------------------------------------------------


def create_scheduler(
	title: str,
	user_email: str,
	query_doctype: str,
	action_type: str,
	action_config: dict,
	description: str | None = None,
	session_id: str | None = None,
	cron_expression: str = "0 9 * * *",
	query_filters: dict | None = None,
	query_fields: list | None = None,
	query_condition: str | None = None,
) -> dict:
	"""Create a new scheduler and return it."""
	sid = new_id()
	next_run = compute_next_run(cron_expression)

	with get_cursor() as cur:
		cur.execute(
			"""
			INSERT INTO na_scheduler (
				id, title, description, user_email, session_id, cron_expression,
				next_run_at, query_doctype, query_filters, query_fields,
				query_condition, action_type, action_config
			) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
			RETURNING *
			""",
			(
				sid,
				title,
				description,
				user_email,
				session_id,
				cron_expression,
				next_run,
				query_doctype,
				json.dumps(query_filters or {}),
				json.dumps(query_fields or ["name"]),
				query_condition,
				action_type,
				json.dumps(action_config),
			),
		)
		return dict(cur.fetchone())


def get_scheduler(scheduler_id: str) -> dict | None:
	"""Get a single scheduler by ID."""
	with get_cursor() as cur:
		cur.execute("SELECT * FROM na_scheduler WHERE id = %s", (scheduler_id,))
		row = cur.fetchone()
		return dict(row) if row else None


def list_schedulers(
	user_email: str | None = None,
	limit: int = 50,
	offset: int = 0,
	status: str | None = None,
	action_type: str | None = None,
) -> list[dict]:
	"""List schedulers with optional filters."""
	conditions = []
	params: list = []

	if user_email:
		conditions.append("user_email = %s")
		params.append(user_email)
	if status:
		conditions.append("status = %s")
		params.append(status)
	if action_type:
		conditions.append("action_type = %s")
		params.append(action_type)

	where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
	params.extend([int(limit), int(offset)])

	with get_cursor() as cur:
		cur.execute(
			f"""
			SELECT * FROM na_scheduler
			{where}
			ORDER BY created_at DESC
			LIMIT %s OFFSET %s
			""",
			params,
		)
		return [dict(r) for r in cur.fetchall()]


def update_scheduler(scheduler_id: str, **fields) -> dict | None:
	"""Update specific fields on a scheduler. Recomputes next_run if cron changes."""
	if not fields:
		return get_scheduler(scheduler_id)

	# Recompute next_run_at if cron_expression changed
	if "cron_expression" in fields:
		fields["next_run_at"] = compute_next_run(fields["cron_expression"])

	# Serialize JSON fields
	for key in ("query_filters", "query_fields", "action_config"):
		if key in fields and not isinstance(fields[key], str):
			fields[key] = json.dumps(fields[key])

	fields["modified_at"] = "now()"
	set_clauses = []
	values = []
	for key, val in fields.items():
		if val == "now()":
			set_clauses.append(f"{key} = now()")
		else:
			set_clauses.append(f"{key} = %s")
			values.append(val)
	values.append(scheduler_id)

	with get_cursor() as cur:
		cur.execute(
			f"UPDATE na_scheduler SET {', '.join(set_clauses)} WHERE id = %s RETURNING *",
			values,
		)
		row = cur.fetchone()
		return dict(row) if row else None


def delete_scheduler(scheduler_id: str) -> None:
	"""Delete a scheduler (runs cascade-deleted via FK)."""
	with get_cursor() as cur:
		cur.execute("DELETE FROM na_scheduler WHERE id = %s", (scheduler_id,))


def toggle_scheduler(scheduler_id: str, enabled: bool) -> dict | None:
	"""Enable or disable a scheduler."""
	if enabled:
		scheduler = get_scheduler(scheduler_id)
		if not scheduler:
			return None
		next_run = compute_next_run(scheduler["cron_expression"])
		return update_scheduler(scheduler_id, enabled=True, status="Active", next_run_at=next_run)
	else:
		return update_scheduler(scheduler_id, enabled=False, status="Paused")


# ---------------------------------------------------------------------------
# Due schedulers (for dispatcher)
# ---------------------------------------------------------------------------


def get_due_schedulers() -> list[dict]:
	"""Find all enabled, active schedulers whose next_run_at has passed."""
	with get_cursor() as cur:
		cur.execute(
			"""
			SELECT * FROM na_scheduler
			WHERE enabled = TRUE AND status = 'Active' AND next_run_at <= now()
			ORDER BY next_run_at ASC
			"""
		)
		return [dict(r) for r in cur.fetchall()]


def advance_next_run(scheduler_id: str, cron_expression: str) -> None:
	"""Compute and set the next_run_at after an execution."""
	next_run = compute_next_run(cron_expression)
	with get_cursor() as cur:
		cur.execute(
			"UPDATE na_scheduler SET next_run_at = %s, modified_at = now() WHERE id = %s",
			(next_run, scheduler_id),
		)


# ---------------------------------------------------------------------------
# Scheduler Runs
# ---------------------------------------------------------------------------


def create_run(scheduler_id: str) -> dict:
	"""Create a new run record with status='running'."""
	run_id = new_id()
	with get_cursor() as cur:
		cur.execute(
			"""
			INSERT INTO na_scheduler_run (id, scheduler_id, status)
			VALUES (%s, %s, 'running')
			RETURNING *
			""",
			(run_id, scheduler_id),
		)
		return dict(cur.fetchone())


def complete_run(
	run_id: str,
	status: str,
	matched_count: int = 0,
	actioned_count: int = 0,
	error: str | None = None,
	result_data: dict | None = None,
) -> None:
	"""Complete a run, computing duration_ms from started_at."""
	with get_cursor() as cur:
		cur.execute(
			"""
			UPDATE na_scheduler_run
			SET status = %s,
				completed_at = now(),
				duration_ms = EXTRACT(EPOCH FROM (now() - started_at))::integer * 1000,
				matched_count = %s,
				actioned_count = %s,
				error = %s,
				result_data = %s
			WHERE id = %s
			""",
			(
				status,
				matched_count,
				actioned_count,
				error,
				json.dumps(result_data) if result_data else None,
				run_id,
			),
		)


def update_scheduler_stats(scheduler_id: str, success: bool, error_msg: str | None = None) -> None:
	"""Increment run counters on the parent scheduler."""
	with get_cursor() as cur:
		if success:
			cur.execute(
				"""
				UPDATE na_scheduler
				SET total_runs = total_runs + 1,
					success_runs = success_runs + 1,
					last_run_at = now(),
					last_error = NULL,
					modified_at = now()
				WHERE id = %s
				""",
				(scheduler_id,),
			)
		else:
			cur.execute(
				"""
				UPDATE na_scheduler
				SET total_runs = total_runs + 1,
					error_runs = error_runs + 1,
					last_run_at = now(),
					last_error = %s,
					status = 'Error',
					modified_at = now()
				WHERE id = %s
				""",
				(error_msg, scheduler_id),
			)


def list_runs(scheduler_id: str, limit: int = 50, offset: int = 0) -> list[dict]:
	"""List runs for a scheduler, newest first."""
	with get_cursor() as cur:
		cur.execute(
			"""
			SELECT * FROM na_scheduler_run
			WHERE scheduler_id = %s
			ORDER BY started_at DESC
			LIMIT %s OFFSET %s
			""",
			(scheduler_id, int(limit), int(offset)),
		)
		return [dict(r) for r in cur.fetchall()]


def get_run_stats(scheduler_id: str, days: int = 30) -> list[dict]:
	"""Get daily run stats grouped by date and status for charts."""
	with get_cursor() as cur:
		cur.execute(
			"""
			SELECT
				started_at::date AS run_date,
				status,
				COUNT(*) AS count,
				COALESCE(SUM(matched_count), 0) AS total_matched,
				COALESCE(SUM(actioned_count), 0) AS total_actioned,
				COALESCE(AVG(duration_ms), 0)::integer AS avg_duration_ms
			FROM na_scheduler_run
			WHERE scheduler_id = %s
			  AND started_at >= now() - make_interval(days => %s)
			GROUP BY run_date, status
			ORDER BY run_date DESC, status
			""",
			(scheduler_id, days),
		)
		return [dict(r) for r in cur.fetchall()]
