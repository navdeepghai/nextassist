import json

from nextassist.database.id_gen import new_id
from nextassist.database.pool import get_cursor


def create_message(
	session_id: str,
	role: str,
	content: str | None = None,
	provider: str | None = None,
	model: str | None = None,
	token_count: int = 0,
	is_error: bool = False,
	tool_call_id: str | None = None,
	tool_calls: list | None = None,
	attachments: list | None = None,
	metadata: dict | None = None,
) -> dict:
	"""Create a message and update the parent session's last_message_at."""
	mid = new_id()
	tc_json = json.dumps(tool_calls) if tool_calls else None
	att_json = json.dumps(attachments) if attachments else "[]"
	meta_json = json.dumps(metadata) if metadata else None

	with get_cursor() as cur:
		cur.execute(
			"""
			INSERT INTO na_message
				(id, session_id, role, content, provider, model, token_count,
				 is_error, tool_call_id, tool_calls, attachments, metadata)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb)
			RETURNING *
			""",
			(
				mid,
				session_id,
				role,
				content,
				provider,
				model,
				token_count,
				is_error,
				tool_call_id,
				tc_json,
				att_json,
				meta_json,
			),
		)
		msg = dict(cur.fetchone())

		# Update parent session's last_message_at and modified_at
		cur.execute(
			"UPDATE na_session SET last_message_at = now(), modified_at = now() WHERE id = %s",
			(session_id,),
		)
		return msg


def get_messages(session_id: str, limit: int = 50, offset: int = 0) -> list[dict]:
	"""Get messages for a session, ordered by creation ASC (oldest first)."""
	with get_cursor() as cur:
		cur.execute(
			"""
			SELECT * FROM na_message
			WHERE session_id = %s
			ORDER BY created_at ASC
			LIMIT %s OFFSET %s
			""",
			(session_id, int(limit), int(offset)),
		)
		return [dict(r) for r in cur.fetchall()]


def get_recent_messages(session_id: str, limit: int = 20) -> list[dict]:
	"""Get the N most recent messages, returned in chronological order (oldest first)."""
	with get_cursor() as cur:
		cur.execute(
			"""
			SELECT * FROM (
				SELECT * FROM na_message
				WHERE session_id = %s
				ORDER BY created_at DESC
				LIMIT %s
			) sub
			ORDER BY created_at ASC
			""",
			(session_id, int(limit)),
		)
		return [dict(r) for r in cur.fetchall()]


def get_latest_user_message(session_id: str) -> dict | None:
	"""Get the most recent user message in a session."""
	with get_cursor() as cur:
		cur.execute(
			"""
			SELECT * FROM na_message
			WHERE session_id = %s AND role = 'user'
			ORDER BY created_at DESC
			LIMIT 1
			""",
			(session_id,),
		)
		row = cur.fetchone()
		return dict(row) if row else None


def sum_tokens(session_id: str) -> int:
	"""Sum all token counts for a session."""
	with get_cursor() as cur:
		cur.execute(
			"SELECT COALESCE(SUM(token_count), 0) AS total FROM na_message WHERE session_id = %s",
			(session_id,),
		)
		return cur.fetchone()["total"]


def sum_tokens_bulk(session_ids: list[str]) -> dict[str, int]:
	"""Sum token counts for multiple sessions at once. Returns {session_id: total}."""
	if not session_ids:
		return {}
	with get_cursor() as cur:
		cur.execute(
			"""
			SELECT session_id, COALESCE(SUM(token_count), 0) AS total
			FROM na_message
			WHERE session_id = ANY(%s)
			GROUP BY session_id
			""",
			(session_ids,),
		)
		return {r["session_id"]: r["total"] for r in cur.fetchall()}
