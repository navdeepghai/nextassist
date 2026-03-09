import frappe

from nextassist.database.schema import ensure_schema
from nextassist.database.settings_db import save_settings


def after_install():
	ensure_pg_schema()
	create_default_settings()


def ensure_pg_schema():
	"""Create PostgreSQL tables if they don't exist."""
	try:
		ensure_schema()
	except Exception as e:
		frappe.log_error(
			title="NextAssist: Failed to create PG schema",
			message=str(e),
		)


def create_default_settings():
	"""Insert default settings into PostgreSQL if no settings row exists."""
	try:
		save_settings(
			{
				"default_provider": None,
				"enable_tool_calling": True,
				"enable_file_uploads": True,
			}
		)
	except Exception as e:
		frappe.log_error(
			title="NextAssist: Failed to create default settings",
			message=str(e),
		)
