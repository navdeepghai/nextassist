from nextassist.database.pool import get_cursor


def get_tool(tool_name: str) -> dict | None:
	"""Get a tool by name."""
	with get_cursor() as cur:
		cur.execute("SELECT * FROM na_tool WHERE tool_name = %s", (tool_name,))
		row = cur.fetchone()
		return dict(row) if row else None


def get_enabled_tools() -> list[dict]:
	"""Get all enabled tools."""
	with get_cursor() as cur:
		cur.execute("SELECT * FROM na_tool WHERE enabled = TRUE ORDER BY tool_name")
		return [dict(r) for r in cur.fetchall()]


def save_tool(data: dict) -> dict:
	"""Insert or update a tool."""
	import json

	params_json = json.dumps(data.get("parameters", []))

	with get_cursor() as cur:
		cur.execute(
			"""
			INSERT INTO na_tool
				(tool_name, tool_type, enabled, requires_confirmation,
				 description, reference_doctype, function_path, parameters)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
			ON CONFLICT (tool_name) DO UPDATE SET
				tool_type = EXCLUDED.tool_type,
				enabled = EXCLUDED.enabled,
				requires_confirmation = EXCLUDED.requires_confirmation,
				description = EXCLUDED.description,
				reference_doctype = EXCLUDED.reference_doctype,
				function_path = EXCLUDED.function_path,
				parameters = EXCLUDED.parameters,
				modified_at = now()
			RETURNING *
			""",
			(
				data["tool_name"],
				data["tool_type"],
				data.get("enabled", True),
				data.get("requires_confirmation", False),
				data["description"],
				data.get("reference_doctype"),
				data.get("function_path"),
				params_json,
			),
		)
		return dict(cur.fetchone())


def delete_tool(tool_name: str) -> None:
	"""Delete a tool by name."""
	with get_cursor() as cur:
		cur.execute("DELETE FROM na_tool WHERE tool_name = %s", (tool_name,))
