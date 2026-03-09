import frappe
from cryptography.fernet import Fernet

_fernet_cache: dict[str, Fernet] = {}


def _get_fernet() -> Fernet:
	"""Get a Fernet instance using the site's encryption key from site_config."""
	site = frappe.local.site
	if site not in _fernet_cache:
		from frappe.utils.password import get_encryption_key

		key = get_encryption_key()
		_fernet_cache[site] = Fernet(key.encode())
	return _fernet_cache[site]


def encrypt_value(plaintext: str) -> str:
	"""Encrypt a string using the site's Fernet encryption key."""
	return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
	"""Decrypt a string using the site's Fernet encryption key."""
	return _get_fernet().decrypt(ciphertext.encode()).decode()
