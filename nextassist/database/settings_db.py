from nextassist.database.pool import get_cursor


def get_settings() -> dict:
	"""Get the singleton settings row. Returns defaults if none exists."""
	with get_cursor() as cur:
		cur.execute(
			"""
			SELECT s.*, p.provider_type, p.default_model, p.max_tokens,
			       p.temperature, p.max_context_messages
			FROM na_settings s
			LEFT JOIN na_ai_provider p ON p.provider_name = s.default_provider
			WHERE s.id = 1
			"""
		)
		row = cur.fetchone()
		if row:
			return dict(row)

	# Return defaults if no row exists
	return {
		"default_provider": None,
		"enable_tool_calling": True,
		"enable_file_uploads": True,
		"provider_type": None,
		"default_model": None,
		"max_tokens": 4096,
		"temperature": 0.7,
		"max_context_messages": 20,
	}


def save_settings(data: dict) -> dict:
	"""Insert or update the singleton settings row."""
	with get_cursor() as cur:
		cur.execute(
			"""
			INSERT INTO na_settings (id, default_provider, enable_tool_calling, enable_file_uploads)
			VALUES (1, %s, %s, %s)
			ON CONFLICT (id) DO UPDATE SET
				default_provider = EXCLUDED.default_provider,
				enable_tool_calling = EXCLUDED.enable_tool_calling,
				enable_file_uploads = EXCLUDED.enable_file_uploads,
				modified_at = now()
			RETURNING *
			""",
			(
				data.get("default_provider"),
				data.get("enable_tool_calling", True),
				data.get("enable_file_uploads", True),
			),
		)
		return dict(cur.fetchone())
