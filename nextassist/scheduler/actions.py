"""Action executors for scheduler runs.

Each action type receives a config dict and a list of matched ERPNext documents,
then performs the appropriate action (email, notification, webhook).

Security notes:
- custom_code action type is disabled from user-facing APIs
- Webhook URLs are validated against SSRF (no internal IPs)
- Jinja templates are rendered in a restricted context (doc fields only)
"""

import json

import frappe
import requests

from nextassist.security.script_validator import _validate_webhook_url


def execute_action(action_type: str, config: dict, matched_docs: list[dict]) -> dict:
	"""Dispatch to the correct action handler. Returns summary dict."""
	handlers = {
		"email": _execute_email,
		"notification": _execute_notification,
		"webhook": _execute_webhook,
		# custom_code is intentionally omitted — blocked from user-facing APIs.
		# It remains in the DB schema for potential admin-only use in future.
	}
	handler = handlers.get(action_type)
	if not handler:
		raise ValueError(f"Action type '{action_type}' is not allowed")
	return handler(config, matched_docs)


def _render(template: str, doc: dict) -> str:
	"""Render a Jinja template string with a restricted doc-only context.

	Only exposes doc fields. Does NOT expose frappe, request, or other globals.
	"""
	from jinja2 import BaseLoader, SandboxedEnvironment

	env = SandboxedEnvironment(loader=BaseLoader())
	tmpl = env.from_string(template)
	return tmpl.render(doc=doc)


def _execute_email(config: dict, docs: list[dict]) -> dict:
	"""Send email per matched doc using frappe.sendmail().

	Config shape:
		recipients_field: str — doc field containing the recipient email
		recipients: list[str] — static recipient list (fallback)
		subject: str — Jinja template
		message: str — Jinja template
	"""
	sent = 0
	skipped = 0

	for doc in docs:
		# Resolve recipients
		recipients = []
		if config.get("recipients_field"):
			email = doc.get(config["recipients_field"])
			if email:
				recipients = [email]
		if not recipients and config.get("recipients"):
			recipients = config["recipients"]
		if not recipients:
			skipped += 1
			continue

		subject = _render(config.get("subject", "Scheduler Alert"), doc)
		message = _render(config.get("message", ""), doc)

		frappe.sendmail(
			recipients=recipients,
			subject=subject,
			message=message,
			delayed=False,
		)
		sent += 1

	return {"sent": sent, "skipped": skipped}


def _execute_notification(config: dict, docs: list[dict]) -> dict:
	"""Create Notification Log entries per matched doc.

	Config shape:
		user_field: str — doc field containing the target user email
		subject: str — Jinja template
		message: str — Jinja template
	"""
	created = 0
	skipped = 0

	for doc in docs:
		user = None
		if config.get("user_field"):
			user = doc.get(config["user_field"])
		if not user:
			user = frappe.session.user

		subject = _render(config.get("subject", "Scheduler Notification"), doc)
		message = _render(config.get("message", ""), doc)

		notification = frappe.get_doc(
			{
				"doctype": "Notification Log",
				"for_user": user,
				"from_user": frappe.session.user,
				"subject": subject,
				"email_content": message,
				"type": "Alert",
				"document_type": doc.get("doctype"),
				"document_name": doc.get("name"),
			}
		)
		notification.insert()
		created += 1

	if created:
		frappe.db.commit()

	return {"created": created, "skipped": skipped}


def _execute_webhook(config: dict, docs: list[dict]) -> dict:
	"""Send HTTP requests per matched doc.

	Config shape:
		url: str — target URL
		method: str — HTTP method (default POST)
		headers: dict — custom headers
		body_template: str — Jinja template for request body (JSON)
	"""
	# SSRF prevention — validate URL before making any requests
	url = config.get("url", "")
	url_violations = _validate_webhook_url(url)
	if url_violations:
		return {"sent": 0, "errors": url_violations}

	sent = 0
	errors = []

	# Only allow safe HTTP methods
	method = (config.get("method") or "POST").upper()
	if method not in ("GET", "POST", "PUT", "PATCH"):
		return {"sent": 0, "errors": [f"HTTP method '{method}' is not allowed"]}

	headers = config.get("headers") or {"Content-Type": "application/json"}

	for doc in docs:
		body = _render(config.get("body_template", "{}"), doc)

		try:
			resp = requests.request(
				method=method,
				url=url,
				headers=headers,
				data=body,
				timeout=30,
				allow_redirects=False,  # Prevent redirect-based SSRF
			)
			resp.raise_for_status()
			sent += 1
		except Exception as e:
			errors.append(f"{doc.get('name')}: {e!s}")

	return {"sent": sent, "errors": errors}


## custom_code action type has been removed from the execution handlers.
## The DB schema still allows it for backwards compatibility, but execute_action()
## will reject it with "Action type 'custom_code' is not allowed".
