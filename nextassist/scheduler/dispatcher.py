"""Cron dispatcher — called every minute by Frappe scheduler.

Finds all due schedulers and enqueues each for background execution.
"""

import frappe

from nextassist.database import scheduler_db
from nextassist.scheduler.executor import execute_scheduler


def dispatch_due_schedulers():
	"""Find schedulers whose next_run_at has passed and enqueue them."""
	try:
		due = scheduler_db.get_due_schedulers()
	except Exception as e:
		frappe.log_error(
			title="NextAssist Scheduler: Failed to fetch due schedulers",
			message=str(e),
		)
		return

	for scheduler in due:
		frappe.enqueue(
			execute_scheduler,
			scheduler_id=scheduler["id"],
			queue="long",
			deduplicate=True,
			timeout=300,
		)
