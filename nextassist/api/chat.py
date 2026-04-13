import json

import frappe

from nextassist.ai.file_processor import extract_file_content
from nextassist.ai.streaming import stream_ai_response
from nextassist.database import message_db, provider_db, session_db

# Token limits per model family (input context window)
MODEL_TOKEN_LIMITS = {
	"claude-haiku": 200_000,
	"claude-sonnet": 200_000,
	"claude-opus": 200_000,
	"gpt-4o": 128_000,
	"gpt-4o-mini": 128_000,
	"gpt-4-turbo": 128_000,
	"gpt-4": 8_192,
	"gpt-3.5": 16_385,
	"gemini-2": 1_000_000,
	"gemini-1.5": 1_000_000,
}

# Warn at 80% of limit
TOKEN_WARNING_RATIO = 0.8


def _get_token_limit_for_model(model: str) -> int:
	"""Get the input token limit for a model, matching by prefix."""
	if not model:
		return 128_000  # conservative default

	model_lower = model.lower()
	for prefix, limit in MODEL_TOKEN_LIMITS.items():
		if prefix in model_lower:
			return limit

	return 128_000  # default


@frappe.whitelist()
def send_message(session_id, message, attachments=None):
	"""Send a user message and trigger AI response streaming."""
	session = session_db.get_session(session_id)
	if not session:
		frappe.throw("Session not found.")
	if session["user_email"] != frappe.session.user:
		frappe.throw("You can only send messages in your own sessions.")

	# Check token usage before sending
	total_tokens = message_db.sum_tokens(session_id)

	model = session.get("model") or ""

	# Use provider's context_window if set (e.g. Claude Code 1M), else prefix-based lookup
	provider_config = provider_db.get_provider(session.get("provider")) if session.get("provider") else None
	if provider_config and provider_config.context_window:
		token_limit = provider_config.context_window
	else:
		token_limit = _get_token_limit_for_model(model)

	warning_threshold = int(token_limit * TOKEN_WARNING_RATIO)

	# Block if session is already at limit or marked as Limit Reached
	if session["status"] == "Limit Reached" or total_tokens >= token_limit:
		if session["status"] != "Limit Reached":
			session_db.update_session(session_id, status="Limit Reached")
		return {
			"limit_reached": True,
			"error": ("This conversation has reached its context limit. Please continue in a new chat."),
		}

	# Parse attachments
	attachment_data = []
	if attachments:
		if isinstance(attachments, str):
			attachments = json.loads(attachments)
		for att in attachments:
			extracted = ""
			if att.get("file"):
				extracted = extract_file_content(att["file"])
			attachment_data.append(
				{
					"file": att.get("file", ""),
					"file_name": att.get("file_name", ""),
					"file_type": att.get("file_type", ""),
					"extracted_content": extracted,
				}
			)

	# Build content with file context
	content = message
	if attachment_data:
		file_texts = []
		for att in attachment_data:
			if att["extracted_content"]:
				file_texts.append(f"[File: {att['file_name']}]\n{att['extracted_content']}")
		if file_texts:
			content = content + "\n\n---\n" + "\n\n".join(file_texts)

	# Save user message
	msg = message_db.create_message(
		session_id=session_id,
		role="user",
		content=content,
		attachments=attachment_data if attachment_data else None,
	)

	# Auto-title the session if it's the first message
	if session["title"] == "New Chat":
		title = message[:50].strip()
		if len(message) > 50:
			title += "..."
		session_db.update_session(session_id, title=title)

	# Warn if approaching token limit
	token_warning = None
	if total_tokens >= warning_threshold:
		pct = int(total_tokens / token_limit * 100)
		token_warning = (
			f"This conversation is using {pct}% of its context window "
			f"({total_tokens:,} / {token_limit:,} tokens). "
			"Consider starting a new chat soon for best results."
		)
		frappe.publish_realtime(
			"nextassist_token_warning",
			{"session": session_id, "warning": token_warning, "pct": pct},
			user=frappe.session.user,
		)

	# Enqueue AI response as background job
	frappe.enqueue(
		stream_ai_response,
		session_name=session_id,
		user=frappe.session.user,
		queue="default",
		timeout=600,
	)

	return {
		"message_id": msg["id"],
		"session_id": session_id,
		"token_warning": token_warning,
	}


@frappe.whitelist()
@frappe.read_only()
def get_messages(session_id, limit=50, offset=0):
	"""Get messages for a session."""
	session = session_db.get_session(session_id)
	if not session:
		frappe.throw("Session not found.")
	if session["user_email"] != frappe.session.user and "System Manager" not in frappe.get_roles():
		frappe.throw("You can only view your own sessions.")

	messages = message_db.get_messages(session_id, int(limit), int(offset))

	# Map PG column names to what the frontend expects
	for m in messages:
		m["name"] = m["id"]
		m["session"] = m["session_id"]
		m["creation"] = m["created_at"]

	return messages
