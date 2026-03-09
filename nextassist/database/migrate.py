"""One-time migration from MariaDB (Frappe DocTypes) to PostgreSQL.

Run via: bench --site <site> execute nextassist.database.migrate.run

Re-runnable — uses ON CONFLICT DO NOTHING for idempotency.
"""

import json

import frappe
import frappe.utils.password
import psycopg2.extras

from nextassist.database.crypto import encrypt_value
from nextassist.database.pool import get_cursor
from nextassist.database.schema import ensure_schema


def run():
	"""Migrate all NextAssist data from MariaDB to PostgreSQL."""
	print("NextAssist Migration: MariaDB → PostgreSQL")
	print("=" * 50)

	ensure_schema()
	print("✓ PG schema ensured")

	counts = {}
	counts["providers"] = _migrate_providers()
	counts["settings"] = _migrate_settings()
	counts["tools"] = _migrate_tools()
	counts["sessions"] = _migrate_sessions()
	counts["messages"] = _migrate_messages()

	print("\n" + "=" * 50)
	print("Migration Summary:")
	for table, count in counts.items():
		print(f"  {table}: {count} rows")
	print("✓ Migration complete")


def _migrate_providers() -> int:
	"""Migrate AI providers, re-encrypting API keys."""
	rows = frappe.db.sql(
		"""
		SELECT name, provider_type, enabled, is_default,
		       api_base_url, organization_id, default_model,
		       max_tokens, temperature, max_context_messages,
		       creation, modified
		FROM `tabNextAssist AI Provider`
		""",
		as_dict=True,
	)

	if not rows:
		print("  providers: 0 rows (none in MariaDB)")
		return 0

	count = 0
	with get_cursor() as cur:
		for row in rows:
			# Decrypt API key from Frappe's Password storage
			try:
				api_key = frappe.utils.password.get_decrypted_password(
					"NextAssist AI Provider", row["name"], "api_key"
				)
			except Exception as e:
				print(f"  ⚠ Could not decrypt API key for provider '{row['name']}': {e}")
				continue

			if not api_key:
				print(f"  ⚠ Empty API key for provider '{row['name']}', skipping")
				continue

			encrypted_key = encrypt_value(api_key)

			cur.execute(
				"""
				INSERT INTO na_ai_provider (
					provider_name, provider_type, enabled, is_default,
					api_key_encrypted, api_base_url, organization_id,
					default_model, max_tokens, temperature,
					max_context_messages, created_at, modified_at
				) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
				ON CONFLICT (provider_name) DO NOTHING
				""",
				(
					row["name"],
					row["provider_type"],
					bool(row.get("enabled", 1)),
					bool(row.get("is_default", 0)),
					encrypted_key,
					row.get("api_base_url"),
					row.get("organization_id"),
					row.get("default_model"),
					row.get("max_tokens") or 4096,
					row.get("temperature") or 0.7,
					row.get("max_context_messages") or 20,
					row["creation"],
					row["modified"],
				),
			)
			count += 1

	print(f"  providers: {count} rows migrated")
	return count


def _migrate_settings() -> int:
	"""Migrate settings singleton from tabSingles."""
	singles = frappe.db.sql(
		"""
		SELECT field, value FROM tabSingles
		WHERE doctype = 'NextAssist Settings'
		""",
		as_dict=True,
	)

	if not singles:
		print("  settings: 0 rows (none in MariaDB)")
		return 0

	settings = {row["field"]: row["value"] for row in singles}

	with get_cursor() as cur:
		cur.execute(
			"""
			INSERT INTO na_settings (id, default_provider, enable_tool_calling, enable_file_uploads)
			VALUES (1, %s, %s, %s)
			ON CONFLICT (id) DO NOTHING
			""",
			(
				settings.get("default_provider"),
				bool(int(settings.get("enable_tool_calling", "1"))),
				bool(int(settings.get("enable_file_uploads", "1"))),
			),
		)

	print("  settings: 1 row migrated")
	return 1


def _migrate_tools() -> int:
	"""Migrate tools with parameters embedded as JSONB."""
	tools = frappe.db.sql(
		"""
		SELECT name, tool_type, enabled, requires_confirmation,
		       description, reference_doctype, function_path,
		       creation, modified
		FROM `tabNextAssist Tool`
		""",
		as_dict=True,
	)

	if not tools:
		print("  tools: 0 rows (none in MariaDB)")
		return 0

	# Fetch all params grouped by parent
	params = frappe.db.sql(
		"""
		SELECT parent, param_name, param_type, description,
		       `required`, default_value
		FROM `tabNextAssist Tool Param`
		WHERE parenttype = 'NextAssist Tool'
		ORDER BY parent, idx
		""",
		as_dict=True,
	)

	params_by_tool = {}
	for p in params:
		params_by_tool.setdefault(p["parent"], []).append(
			{
				"param_name": p["param_name"],
				"param_type": p["param_type"],
				"description": p.get("description") or "",
				"required": bool(p.get("required", 0)),
				"default_value": p.get("default_value"),
			}
		)

	count = 0
	with get_cursor() as cur:
		for tool in tools:
			tool_params = params_by_tool.get(tool["name"], [])
			cur.execute(
				"""
				INSERT INTO na_tool (
					tool_name, tool_type, enabled, requires_confirmation,
					description, reference_doctype, function_path,
					parameters, created_at, modified_at
				) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
				ON CONFLICT (tool_name) DO NOTHING
				""",
				(
					tool["name"],
					tool["tool_type"],
					bool(tool.get("enabled", 1)),
					bool(tool.get("requires_confirmation", 0)),
					tool.get("description") or "",
					tool.get("reference_doctype"),
					tool.get("function_path"),
					json.dumps(tool_params),
					tool["creation"],
					tool["modified"],
				),
			)
			count += 1

	print(f"  tools: {count} rows migrated")
	return count


def _migrate_sessions() -> int:
	"""Migrate chat sessions."""
	sessions = frappe.db.sql(
		"""
		SELECT name, title, user, status, last_message_at,
		       provider, model, creation, modified
		FROM `tabNextAssist Session`
		""",
		as_dict=True,
	)

	if not sessions:
		print("  sessions: 0 rows (none in MariaDB)")
		return 0

	count = 0
	with get_cursor() as cur:
		for s in sessions:
			cur.execute(
				"""
				INSERT INTO na_session (
					id, title, user_email, status, last_message_at,
					provider, model, created_at, modified_at
				) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
				ON CONFLICT (id) DO NOTHING
				""",
				(
					s["name"],
					s.get("title") or "New Chat",
					s["user"],
					s.get("status") or "Active",
					s.get("last_message_at"),
					s.get("provider"),
					s.get("model"),
					s["creation"],
					s["modified"],
				),
			)
			count += 1

	print(f"  sessions: {count} rows migrated")
	return count


def _migrate_messages() -> int:
	"""Migrate messages with attachments embedded as JSONB. Batched."""
	BATCH_SIZE = 500

	# Get total count first
	total = frappe.db.sql("SELECT COUNT(*) AS cnt FROM `tabNextAssist Message`", as_dict=True)[0]["cnt"]

	if not total:
		print("  messages: 0 rows (none in MariaDB)")
		return 0

	# Fetch all attachments grouped by parent
	attachments_raw = frappe.db.sql(
		"""
		SELECT parent, file, file_name, file_type, extracted_content
		FROM `tabNextAssist Message Attachment`
		WHERE parenttype = 'NextAssist Message'
		ORDER BY parent, idx
		""",
		as_dict=True,
	)

	attachments_by_msg = {}
	for att in attachments_raw:
		attachments_by_msg.setdefault(att["parent"], []).append(
			{
				"file_url": att.get("file"),
				"file_name": att.get("file_name"),
				"file_type": att.get("file_type"),
				"extracted_content": att.get("extracted_content"),
			}
		)

	# Migrate in batches
	count = 0
	offset = 0
	while offset < total:
		messages = frappe.db.sql(
			"""
			SELECT name, session, role, content, provider, model,
			       token_count, is_error, tool_call_id, tool_calls,
			       metadata, creation
			FROM `tabNextAssist Message`
			ORDER BY creation ASC
			LIMIT %s OFFSET %s
			""",
			(BATCH_SIZE, offset),
			as_dict=True,
		)

		if not messages:
			break

		values = []
		for msg in messages:
			# Parse tool_calls JSON string if present
			tc = msg.get("tool_calls")
			if tc and isinstance(tc, str):
				try:
					tc = json.loads(tc)
				except json.JSONDecodeError, TypeError:
					tc = None

			# Parse metadata JSON string if present
			meta = msg.get("metadata")
			if meta and isinstance(meta, str):
				try:
					meta = json.loads(meta)
				except json.JSONDecodeError, TypeError:
					meta = None

			atts = attachments_by_msg.get(msg["name"], [])

			values.append(
				(
					msg["name"],
					msg["session"],
					msg["role"],
					msg.get("content"),
					msg.get("provider"),
					msg.get("model"),
					msg.get("token_count") or 0,
					bool(msg.get("is_error", 0)),
					msg.get("tool_call_id"),
					json.dumps(tc) if tc else None,
					json.dumps(atts) if atts else "[]",
					json.dumps(meta) if meta else None,
					msg["creation"],
				)
			)

		with get_cursor() as cur:
			psycopg2.extras.execute_values(
				cur,
				"""
				INSERT INTO na_message (
					id, session_id, role, content, provider, model,
					token_count, is_error, tool_call_id, tool_calls,
					attachments, metadata, created_at
				) VALUES %s
				ON CONFLICT (id) DO NOTHING
				""",
				values,
				template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
			)
			count += len(values)

		offset += BATCH_SIZE
		if offset % 2000 == 0:
			print(f"    messages: {offset}/{total} processed...")

	print(f"  messages: {count} rows migrated")
	return count
