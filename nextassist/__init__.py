__version__ = "0.0.1"


def _patch_orjson_large_int():
	"""Workaround for orjson failing on integers > 2^64 (Python 3.14 + Frappe).

	Falls back to stdlib json so error responses can still be serialized.
	"""
	import json as _json

	import frappe.utils.data as _frappe_data

	_original = _frappe_data.orjson_dumps

	def _safe_orjson_dumps(obj, default=None, option=None, decode=True):
		try:
			return _original(obj, default, option, decode)
		except TypeError as e:
			if "Integer exceeds 64-bit range" in str(e):
				from frappe.utils.response import json_handler

				value = _json.dumps(obj, default=default or json_handler)
				return value if decode else value.encode()
			raise

	_frappe_data.orjson_dumps = _safe_orjson_dumps


_patch_orjson_large_int()
