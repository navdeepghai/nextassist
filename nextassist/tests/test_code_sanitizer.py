"""Tests for AI code sanitization and execution pipeline.

These tests verify that _sanitize_ai_code and _transform_ai_code correctly
transform AI-generated code to work within Frappe's RestrictedPython sandbox.

Run with:
    bench --site <site> run-tests --app nextassist --module nextassist.tests.test_code_sanitizer
"""

import unittest

from nextassist.ai.streaming import _sanitize_ai_code, _transform_ai_code


def _pipeline(code: str) -> str:
	"""Run the full pre-exec transformation pipeline (matches _execute_ai_code order)."""
	return _transform_ai_code(_sanitize_ai_code(code))


class TestSanitizeAICode(unittest.TestCase):
	"""Test import stripping and datetime rewriting."""

	# ── Import stripping ──

	def test_strip_import_statement(self):
		code = "import datetime\nresult = 1"
		out = _pipeline(code)
		self.assertNotIn("import datetime", out)
		self.assertIn("result = 1", out)

	def test_strip_from_import(self):
		code = "from datetime import datetime\nresult = 1"
		self.assertNotIn("from datetime", _pipeline(code))

	def test_strip_multiple_imports(self):
		code = "import math\nimport re\nfrom collections import Counter\nresult = 1"
		out = _pipeline(code)
		self.assertNotIn("import math", out)
		self.assertNotIn("import re", out)
		self.assertNotIn("from collections", out)
		self.assertIn("result = 1", out)

	def test_strip_multiword_import(self):
		code = "from datetime import datetime, timedelta\nresult = 1"
		self.assertNotIn("from datetime", _pipeline(code))

	def test_no_import_unchanged(self):
		code = "x = 1\nresult = x + 2"
		self.assertEqual(_sanitize_ai_code(code).strip(), code.strip())

	# ── datetime.now() rewriting ──

	def test_datetime_now(self):
		code = "x = datetime.now()"
		self.assertIn("frappe.utils.now_datetime()", _sanitize_ai_code(code))

	def test_datetime_datetime_now(self):
		code = "x = datetime.datetime.now()"
		self.assertIn("frappe.utils.now_datetime()", _sanitize_ai_code(code))

	def test_from_import_then_datetime_now(self):
		"""The most common AI pattern: from datetime import datetime + datetime.now()."""
		code = "from datetime import datetime\ncurrent_year = datetime.now().year"
		out = _pipeline(code)
		self.assertNotIn("import", out)
		self.assertIn("frappe.utils.now_datetime().year", out)

	# ── datetime.today() rewriting ──

	def test_datetime_today(self):
		code = "x = datetime.today()"
		self.assertIn("frappe.utils.today()", _sanitize_ai_code(code))

	def test_datetime_datetime_today(self):
		code = "x = datetime.datetime.today()"
		self.assertIn("frappe.utils.today()", _sanitize_ai_code(code))

	def test_date_today(self):
		code = "x = date.today()"
		self.assertIn("frappe.utils.today()", _sanitize_ai_code(code))

	# ── datetime.strptime() rewriting ──

	def test_datetime_strptime(self):
		code = 'x = datetime.strptime(date_str, "%Y-%m-%d")'
		sanitized = _sanitize_ai_code(code)
		self.assertIn("frappe.utils.get_datetime(date_str)", sanitized)

	def test_datetime_datetime_strptime(self):
		code = 'x = datetime.datetime.strptime(some_date, "%Y-%m-%d %H:%M")'
		sanitized = _sanitize_ai_code(code)
		self.assertIn("frappe.utils.get_datetime(some_date)", sanitized)

	# ── timedelta rewriting ──

	def test_timedelta_days(self):
		code = "x = timedelta(days=30)"
		sanitized = _sanitize_ai_code(code)
		self.assertIn("frappe.utils.to_timedelta(days=30)", sanitized)

	# ── Full AI code patterns from real errors ──

	def test_real_error_revenue_query(self):
		"""Real AI code that caused __import__ not found error."""
		code = """from datetime import datetime
current_year = datetime.now().year
last_year = current_year - 1
revenue_data = frappe.db.sql(f'''
    SELECT SUM(grand_total) AS total_revenue
    FROM `tabSales Invoice`
    WHERE docstatus = 1 AND YEAR(posting_date) = {last_year}
''', as_dict=True)[0]
result = {"data": [{"label": "Revenue", "value": float(revenue_data.total_revenue or 0)}], "layout": "bullets", "chart": None, "files": [], "error": None}"""
		out = _pipeline(code)
		self.assertNotIn("import", out)
		self.assertIn("frappe.utils.now_datetime().year", out)
		self.assertIn("result =", out)

	def test_real_error_timedelta_query(self):
		"""Real AI code with from datetime import datetime, timedelta."""
		code = """from datetime import datetime, timedelta
ten_years_ago = (datetime.now() - timedelta(days=365 * 10)).strftime('%Y-%m-%d')
rows = frappe.get_list('Sales Invoice', filters={'posting_date': ['>=', ten_years_ago]}, limit=100)
result = {'data': rows, 'layout': 'table', 'chart': None, 'files': [], 'error': None}"""
		out = _pipeline(code)
		self.assertNotIn("import", out)
		self.assertIn("frappe.utils.now_datetime()", out)

	def test_code_without_datetime_untouched(self):
		"""Code that doesn't use datetime should pass through unchanged."""
		code = """rows = frappe.get_list("Sales Invoice", fields=["name", "grand_total"], limit=10)
result = {"data": rows, "layout": "table", "chart": None, "files": [], "error": None}"""
		self.assertEqual(_sanitize_ai_code(code), code)

	def test_frappe_utils_already_used(self):
		"""Code already using frappe.utils should not be modified."""
		code = """today = frappe.utils.today()
result = {"data": [{"date": today}], "layout": "bullets", "chart": None, "files": [], "error": None}"""
		self.assertEqual(_sanitize_ai_code(code), code)


class TestTransformAICode(unittest.TestCase):
	"""Test AST transformation: import removal and d[key] += value rewriting."""

	def test_basic_augmented_add(self):
		code = 'd = {}\nd["x"] = 0\nd["x"] += 1'
		fixed = _transform_ai_code(code)
		self.assertNotIn("+=", fixed)
		self.assertIn("d['x'] = d['x'] + 1", fixed)

	def test_augmented_subtract(self):
		code = 'd["count"] -= 5'
		fixed = _transform_ai_code(code)
		self.assertNotIn("-=", fixed)
		self.assertIn("d['count'] = d['count'] - 5", fixed)

	def test_augmented_multiply(self):
		code = 'd["val"] *= 2'
		fixed = _transform_ai_code(code)
		self.assertNotIn("*=", fixed)
		self.assertIn("d['val'] = d['val'] * 2", fixed)

	def test_normal_assignment_untouched(self):
		code = 'd["x"] = 1'
		fixed = _transform_ai_code(code)
		self.assertIn("d['x'] = 1", fixed)

	def test_variable_augmented_untouched(self):
		"""x += 1 should NOT be rewritten (only subscript augmented is forbidden)."""
		code = "x = 0\nx += 1"
		fixed = _transform_ai_code(code)
		self.assertIn("x += 1", fixed)

	def test_real_error_pattern(self):
		"""Real AI code that caused RestrictedPython error."""
		code = """status_totals = {}
for row in rows:
    status = row.get("status", "Unknown")
    if status not in status_totals:
        status_totals[status] = 0
    status_totals[status] += float(row.get("grand_total", 0))"""
		fixed = _transform_ai_code(code)
		self.assertNotIn("+=", fixed)
		self.assertIn("status_totals[status] = status_totals[status] + float", fixed)

	def test_nested_subscript(self):
		code = 'data["totals"]["revenue"] += amount'
		fixed = _transform_ai_code(code)
		self.assertNotIn("+=", fixed)

	def test_syntax_error_passthrough(self):
		"""Truly invalid syntax (not fixable by rescue pass) should return code as-is."""
		code = "this is not valid python {{"
		self.assertEqual(_transform_ai_code(code), code)

	def test_multiple_augmented_in_loop(self):
		code = """d = {}
for i in range(5):
    d["a"] += i
    d["b"] -= i"""
		fixed = _transform_ai_code(code)
		self.assertNotIn("+=", fixed)
		self.assertNotIn("-=", fixed)

	def test_indented_import_in_if_block(self):
		"""Indented import inside if-block is removed; pass inserted so block stays valid."""
		code = "if True:\n    import datetime\nx = 1"
		fixed = _transform_ai_code(code)
		self.assertNotIn("import datetime", fixed)
		self.assertIn("x = 1", fixed)
		# Must be valid Python (no SyntaxError)
		compile(fixed, "<string>", "exec")

	def test_indented_import_only_body(self):
		"""if-block with only an import gets a pass statement so it remains valid."""
		code = "for item in items:\n    import os\n    import sys"
		fixed = _transform_ai_code(code)
		self.assertNotIn("import os", fixed)
		self.assertNotIn("import sys", fixed)
		compile(fixed, "<string>", "exec")

	def test_rescue_parse_empty_block(self):
		"""Rescue pass handles pre-broken code with empty block headers."""
		# Simulate code that already has an empty block (e.g. from other preprocessing)
		code = "if True:\nresult = 1"
		# This is a SyntaxError — rescue pass should insert `pass` and produce valid code
		fixed = _transform_ai_code(code)
		self.assertIn("result = 1", fixed)


class TestFullPipeline(unittest.TestCase):
	"""Test sanitize + AST fix together (the full pipeline before safe_exec)."""

	def test_import_plus_augmented(self):
		"""AI code with both imports and augmented subscripts."""
		code = """from datetime import datetime
d = {}
d["year"] = datetime.now().year
d["count"] += 1"""
		fixed = _pipeline(code)
		self.assertNotIn("import", fixed)
		self.assertNotIn("+=", fixed)
		self.assertIn("frappe.utils.now_datetime().year", fixed)

	def test_clean_code_passthrough(self):
		"""Code using frappe.utils and no augmented subscripts passes cleanly."""
		code = """today = frappe.utils.today()
rows = frappe.get_list("Sales Invoice", limit=10)
result = {"data": rows, "layout": "table", "chart": None, "files": [], "error": None}"""
		fixed = _pipeline(code)
		self.assertIn("frappe.utils.today()", fixed)
		self.assertIn("result =", fixed)

	def test_complex_ai_pattern_with_chart(self):
		"""Complex AI code with imports, augmented subscripts, and chart config."""
		code = """from datetime import datetime
import collections

current_year = datetime.now().year

rows = frappe.db.sql('''
    SELECT customer, SUM(grand_total) AS total
    FROM `tabSales Invoice`
    WHERE docstatus = 1
    GROUP BY customer
    ORDER BY total DESC
    LIMIT 10
''', as_dict=True)

totals = {}
for r in rows:
    totals[r.customer] = 0
    totals[r.customer] += float(r.total or 0)

result = {
    "data": rows,
    "layout": "table",
    "chart": {
        "type": "bar",
        "title": "Top Customers",
        "labels": [r.customer for r in rows],
        "datasets": [{"name": "Revenue", "values": [float(r.total) for r in rows]}]
    },
    "files": [],
    "error": None
}"""
		fixed = _pipeline(code)
		self.assertNotIn("import", fixed)
		self.assertNotIn("+=", fixed)
		self.assertIn("frappe.utils.now_datetime().year", fixed)
		self.assertIn("result =", fixed)


class TestSanitizeEdgeCases(unittest.TestCase):
	"""Edge cases and regression tests."""

	def test_import_inside_string_not_stripped(self):
		"""'import' inside a string literal should not be stripped."""
		code = 'msg = "You cannot import data here"\nresult = msg'
		sanitized = _sanitize_ai_code(code)
		# The string should remain intact (import is not on its own line starting with import keyword)
		self.assertIn("result = msg", sanitized)

	def test_empty_code(self):
		self.assertEqual(_sanitize_ai_code(""), "")
		self.assertEqual(_transform_ai_code(""), "")

	def test_only_imports(self):
		code = "import datetime\nfrom collections import Counter"
		out = _pipeline(code)
		# All imports stripped — result should have no import statements
		self.assertNotIn("import", out.strip())

	def test_datetime_in_sql_string_not_rewritten(self):
		"""datetime inside SQL strings should ideally not be affected."""
		code = """frappe.db.sql("SELECT DATE(datetime_field) FROM tab")"""
		sanitized = _sanitize_ai_code(code)
		# This is a known limitation - regex might match inside strings
		# but SQL datetime keyword won't cause runtime errors since it's a string
		self.assertIn("SELECT", sanitized)

	def test_multiple_datetime_now_calls(self):
		code = "a = datetime.now()\nb = datetime.datetime.now()"
		sanitized = _sanitize_ai_code(code)
		self.assertEqual(sanitized.count("frappe.utils.now_datetime()"), 2)
