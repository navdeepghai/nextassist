import json

from nextassist.database.id_gen import new_id
from nextassist.database.pool import get_cursor


def create_session(title: str, user: str, provider: str | None = None, model: str | None = None) -> dict:
	"""Create a new session and return it as a dict."""
	sid = new_id()
	with get_cursor() as cur:
		cur.execute(
			"""
			INSERT INTO na_session (id, title, user_email, provider, model)
			VALUES (%s, %s, %s, %s, %s)
			RETURNING *
			""",
			(sid, title or "New Chat", user, provider, model),
		)
		return dict(cur.fetchone())


def get_session(session_id: str) -> dict | None:
	"""Get a single session by ID."""
	with get_cursor() as cur:
		cur.execute("SELECT * FROM na_session WHERE id = %s", (session_id,))
		row = cur.fetchone()
		return dict(row) if row else None


def list_sessions(user: str, limit: int = 50, offset: int = 0) -> list[dict]:
	"""List sessions for a user, ordered by modified_at desc."""
	with get_cursor() as cur:
		cur.execute(
			"""
			SELECT * FROM na_session
			WHERE user_email = %s AND status IN ('Active', 'Limit Reached')
			ORDER BY modified_at DESC
			LIMIT %s OFFSET %s
			""",
			(user, int(limit), int(offset)),
		)
		return [dict(r) for r in cur.fetchall()]


def update_session(session_id: str, **fields) -> None:
	"""Update specific fields on a session."""
	if not fields:
		return
	# Always bump modified_at
	fields["modified_at"] = "now()"
	set_clauses = []
	values = []
	for key, val in fields.items():
		if val == "now()":
			set_clauses.append(f"{key} = now()")
		else:
			set_clauses.append(f"{key} = %s")
			values.append(val)
	values.append(session_id)
	with get_cursor() as cur:
		cur.execute(
			f"UPDATE na_session SET {', '.join(set_clauses)} WHERE id = %s",
			values,
		)


def delete_session(session_id: str) -> None:
	"""Delete a session (messages cascade-deleted via FK)."""
	with get_cursor() as cur:
		cur.execute("DELETE FROM na_session WHERE id = %s", (session_id,))


def get_provider_usage(provider_name: str, limit: int = 10) -> dict:
	"""Get usage summary and recent sessions for a provider."""
	with get_cursor() as cur:
		# Summary stats
		cur.execute(
			"""
			SELECT
				COALESCE(SUM(m.token_count), 0)::bigint AS total_tokens,
				COUNT(DISTINCT s.id) AS total_sessions,
				COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'Active') AS active_sessions,
				MAX(s.last_message_at) AS last_used_at
			FROM na_session s
			LEFT JOIN na_message m ON m.session_id = s.id
			WHERE s.provider = %s
			""",
			(provider_name,),
		)
		summary = dict(cur.fetchone())
		if summary["last_used_at"]:
			summary["last_used_at"] = summary["last_used_at"].isoformat()

		# Recent sessions with per-session token totals
		cur.execute(
			"""
			SELECT
				s.id, s.title, s.user_email, s.status, s.last_message_at,
				COALESCE(t.total_tokens, 0) AS total_tokens
			FROM na_session s
			LEFT JOIN (
				SELECT session_id, SUM(token_count) AS total_tokens
				FROM na_message GROUP BY session_id
			) t ON t.session_id = s.id
			WHERE s.provider = %s
			ORDER BY s.last_message_at DESC NULLS LAST
			LIMIT %s
			""",
			(provider_name, int(limit)),
		)
		sessions = []
		for row in cur.fetchall():
			d = dict(row)
			if d["last_message_at"]:
				d["last_message_at"] = d["last_message_at"].isoformat()
			sessions.append(d)

		return {
			"summary": summary,
			"recent_sessions": sessions,
		}
