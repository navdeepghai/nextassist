import secrets


def new_id() -> str:
	"""Return a 10-char lowercase hex string, matching Frappe's hash naming convention."""
	return secrets.token_hex(5)
