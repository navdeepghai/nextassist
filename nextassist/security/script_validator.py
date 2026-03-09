"""Script validation for AI-generated code and scheduler query conditions.

This module provides security validation before any code is executed in NextAssist.
It blocks dangerous patterns, restricts operations to read-only where required,
and prevents common attack vectors like data mutation, file access, and network calls.
"""

import ast
import re

# ── Blocked AST node types (never allowed in any context) ──────────────────────
# These represent operations that should never appear in user/AI-generated code.
_DANGEROUS_NODE_TYPES = (
	ast.Delete,  # del statements
	ast.Global,  # global declarations
	ast.Nonlocal,  # nonlocal declarations
	ast.AsyncFunctionDef,
	ast.AsyncFor,
	ast.AsyncWith,
)

# ── Blocked function/attribute calls ──────────────────────────────────────────
# These are dangerous functions that must never be called in generated code.
_BLOCKED_CALLS = frozenset(
	{
		# Code execution
		"eval",
		"exec",
		"compile",
		"execfile",
		"__import__",
		# OS / process
		"system",
		"popen",
		"popen2",
		"popen3",
		"popen4",
		"spawn",
		"spawnl",
		"spawnle",
		"spawnlp",
		"spawnlpe",
		"spawnv",
		"spawnve",
		"spawnvp",
		"spawnvpe",
		"fork",
		"forkpty",
		"kill",
		"killpg",
		"execv",
		"execve",
		"execvp",
		"execvpe",
		# File system
		"remove",
		"unlink",
		"rmdir",
		"rmtree",
		"makedirs",
		"mkdir",
		"chmod",
		"chown",
		"chroot",
		"symlink",
		"link",
		# Network
		"urlopen",
		"urlretrieve",
		"Request",
		# Subprocess
		"check_call",
		"check_output",
		"Popen",
		# Dangerous builtins
		"breakpoint",
		"exit",
		"quit",
		# Frappe dangerous methods
		"db_commit",
		"db_rollback",
		"db_truncate",
		"get_attr",
	}
)

# ── Specific dangerous full-path function calls ────────────────────────────
# These are checked by full dotted name (not just the last part).
_BLOCKED_FULL_PATHS = frozenset(
	{
		"frappe.db.commit",
		"frappe.db.rollback",
		"frappe.db.truncate",
		"frappe.db.set_value",
		"frappe.new_doc",
		"frappe.get_attr",
	}
)

# ── SQL write statement keywords (blocked in frappe.db.sql calls) ─────────
# frappe.db.sql() is allowed for read queries only. These keywords at the
# start of a SQL statement indicate a write/destructive operation.
_SQL_WRITE_KEYWORDS = re.compile(
	r"^\s*("
	r"INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|"
	r"RENAME|MERGE|UPSERT|CALL|EXEC|EXECUTE|SET|LOCK|UNLOCK|LOAD|"
	r"INTO\s+OUTFILE|INTO\s+DUMPFILE"
	r")\b",
	re.IGNORECASE,
)

# Secondary patterns: write keywords that may appear after WITH/CTE or as subqueries
_SQL_WRITE_ANYWHERE = re.compile(
	r"\b("
	r"INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|DROP\s+TABLE|DROP\s+DATABASE|"
	r"DROP\s+INDEX|DROP\s+VIEW|ALTER\s+TABLE|TRUNCATE\s+TABLE|"
	r"CREATE\s+TABLE|CREATE\s+DATABASE|CREATE\s+INDEX|CREATE\s+VIEW|"
	r"GRANT\s+\w|REVOKE\s+\w|RENAME\s+TABLE"
	r")\b",
	re.IGNORECASE,
)

# ── Blocked attribute access patterns ────────────────────────────────────────
_BLOCKED_ATTR_PATTERNS = [
	r"__\w+__",  # Dunder attributes (e.g. __class__, __globals__, __subclasses__)
	r"_\w*private",  # Conventionally private internals
]

_BLOCKED_ATTR_COMPILED = [re.compile(p) for p in _BLOCKED_ATTR_PATTERNS]

# ── Blocked module access ────────────────────────────────────────────────────
_BLOCKED_MODULES = frozenset(
	{
		"os",
		"sys",
		"subprocess",
		"shutil",
		"socket",
		"http",
		"urllib",
		"requests",
		"pathlib",
		"glob",
		"tempfile",
		"signal",
		"ctypes",
		"multiprocessing",
		"threading",
		"pickle",
		"shelve",
		"marshal",
		"importlib",
		"builtins",
		"__builtin__",
		"code",
		"codeop",
		"compileall",
		"py_compile",
	}
)

# ── Frappe-specific write methods ────────────────────────────────────────────
# These method names are ONLY used in Frappe — no legitimate Python builtin
# or standard library usage exists. Safe to block by base name alone.
_FRAPPE_WRITE_METHODS = frozenset(
	{
		"submit",
		"cancel",
		"amend",
		"db_set",
		"set_value",
		"bulk_insert",
		"rename_doc",
		"delete_doc",
		"add_comment",
		"sendmail",
		"send_email",
		"enqueue",
		"enqueue_doc",
		"run_doc_method",
	}
)

# ── Ambiguous methods that overlap with Python builtins ─────────────────────
# These are Frappe writes when called with 0 positional args (doc.insert()),
# but legitimate Python operations with 2+ args (list.insert(i, x)).
# We use arg-count heuristics to distinguish them.
_AMBIGUOUS_WRITE_METHODS = frozenset(
	{
		"insert",  # doc.insert() vs list.insert(i, x)
		"save",  # doc.save() — no common Python builtin equivalent
		"delete",  # doc.delete() vs dict.pop(key) (different name, but cautious)
	}
)


class ScriptValidationError(Exception):
	"""Raised when a script fails security validation."""

	def __init__(self, message: str, violations: list[str] | None = None):
		self.violations = violations or []
		super().__init__(message)


def validate_ai_code(code: str) -> list[str]:
	"""Validate AI-generated Python code before execution.

	This is called BEFORE safe_exec() as an additional security layer.
	Returns a list of violation messages. Empty list = code is safe.

	Checks:
	- No import statements
	- No dangerous function calls (eval, exec, os.system, etc.)
	- No dunder attribute access (__class__, __globals__, etc.)
	- No blocked module access (os, sys, subprocess, etc.)
	- No write operations (insert, save, submit, delete, etc.)
	- No file I/O operations (open, read, write)
	- No dangerous AST node types
	"""
	violations = []

	# 1. Check for import statements (should already be stripped, but double-check)
	if re.search(r"^\s*(import\s+|from\s+\S+\s+import\s+)", code, re.MULTILINE):
		violations.append("Import statements are not allowed")

	# 2. Parse AST
	try:
		tree = ast.parse(code)
	except SyntaxError as e:
		violations.append(f"Syntax error: {e}")
		return violations

	# 3. Walk AST nodes
	for node in ast.walk(tree):
		# Block dangerous node types
		if isinstance(node, _DANGEROUS_NODE_TYPES):
			violations.append(f"Forbidden statement: {type(node).__name__}")

		# Check function calls
		if isinstance(node, ast.Call):
			call_name = _get_call_name(node)
			if call_name:
				base_name = call_name.split(".")[-1]

				# Block dangerous function names
				if base_name in _BLOCKED_CALLS:
					violations.append(f"Blocked function call: {call_name}")

				# Block specific dangerous full-path calls
				if call_name in _BLOCKED_FULL_PATHS:
					violations.append(f"Blocked operation: {call_name}")

				# Allow frappe.db.sql but only for read-only (SELECT) queries
				if call_name == "frappe.db.sql":
					sql_str = _extract_sql_from_call(node)
					if sql_str is None:
						# Cannot statically determine SQL — block for safety
						violations.append(
							"frappe.db.sql() requires a static SQL string as "
							"first argument (no variables). Use string literals "
							"or f-strings."
						)
					else:
						sql_violations = _validate_sql_statement(sql_str)
						violations.extend(sql_violations)

				# Block open() for file I/O
				if base_name == "open":
					violations.append("File I/O via open() is not allowed")

				# Block Frappe-specific write methods (unambiguous — no Python equivalent)
				if base_name in _FRAPPE_WRITE_METHODS:
					violations.append(f"Write operation not allowed: {call_name}")

				# Block ambiguous write methods using arg-count heuristic:
				# doc.insert() has 0 positional args, list.insert(i, x) has 2
				if base_name in _AMBIGUOUS_WRITE_METHODS:
					positional_arg_count = len(node.args)
					if positional_arg_count < 2:
						violations.append(f"Write operation not allowed: {call_name}")

				# Block module access
				parts = call_name.split(".")
				if parts[0] in _BLOCKED_MODULES:
					violations.append(f"Access to blocked module: {parts[0]}")

		# Check attribute access
		if isinstance(node, ast.Attribute):
			attr = node.attr
			# Block dunder access
			if any(p.match(attr) for p in _BLOCKED_ATTR_COMPILED):
				violations.append(f"Blocked attribute access: {attr}")

			# Block .commit(), .rollback() on db
			if attr in ("commit", "rollback", "truncate"):
				violations.append(f"Database mutation not allowed: .{attr}()")

		# Check Name nodes for blocked modules used as variables
		if isinstance(node, ast.Name) and node.id in _BLOCKED_MODULES:
			violations.append(f"Access to blocked module: {node.id}")

	return violations


def validate_scheduler_condition(condition: str) -> list[str]:
	"""Validate a scheduler query_condition expression before it's stored/executed.

	Scheduler conditions are Python expressions evaluated per document.
	They MUST be read-only boolean expressions — no assignments, no calls
	that mutate state, no access to dangerous modules.

	Returns a list of violation messages. Empty list = condition is safe.
	"""
	violations = []

	if not condition or not condition.strip():
		return violations

	# 1. Must be a single expression, not multiple statements
	# Wrap in a fake expression to test
	try:
		tree = ast.parse(condition, mode="eval")
	except SyntaxError:
		# Try as statement — if it parses, it's not a pure expression
		try:
			ast.parse(condition, mode="exec")
			violations.append(
				"Condition must be a single expression, not a statement. "
				"Use comparison expressions like: doc.get('status') == 'Open'"
			)
		except SyntaxError as e:
			violations.append(f"Syntax error in condition: {e}")
		return violations

	# 2. Walk AST for dangerous patterns
	for node in ast.walk(tree):
		# No function calls except safe ones
		if isinstance(node, ast.Call):
			call_name = _get_call_name(node)
			if call_name:
				if not _is_safe_condition_call(call_name):
					violations.append(
						f"Unsafe function call in condition: {call_name}. "
						"Only doc.get(), str(), int(), float(), len(), "
						"and frappe.utils.* date functions are allowed."
					)
			else:
				# Lambda calls, etc.
				violations.append("Dynamic function calls are not allowed in conditions")

		# No attribute access to dangerous modules
		if isinstance(node, ast.Attribute):
			if any(p.match(node.attr) for p in _BLOCKED_ATTR_COMPILED):
				violations.append(f"Blocked attribute in condition: {node.attr}")

		# No Name references to dangerous modules
		if isinstance(node, ast.Name) and node.id in _BLOCKED_MODULES:
			violations.append(f"Access to blocked module in condition: {node.id}")

		# No comprehensions with side effects
		if isinstance(node, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
			violations.append("Comprehensions are not allowed in conditions")

		# No lambda
		if isinstance(node, ast.Lambda):
			violations.append("Lambda expressions are not allowed in conditions")

	return violations


def validate_scheduler_config(
	action_type: str,
	action_config: dict,
	query_condition: str | None = None,
) -> list[str]:
	"""Full validation of a scheduler's configuration before save.

	Validates:
	- action_type is in the allowed list (no custom_code from user API)
	- query_condition is a safe expression
	- action_config doesn't contain dangerous patterns
	- webhook URLs don't target internal networks
	"""
	violations = []

	# 1. Block custom_code action type from user-facing creation
	allowed_actions = {"email", "notification", "webhook"}
	if action_type not in allowed_actions:
		violations.append(
			f"Action type '{action_type}' is not allowed. Allowed types: {', '.join(sorted(allowed_actions))}"
		)

	# 2. Validate query_condition
	if query_condition:
		condition_violations = validate_scheduler_condition(query_condition)
		violations.extend(condition_violations)

	# 3. Validate webhook URL (SSRF prevention)
	if action_type == "webhook":
		url = action_config.get("url", "")
		url_violations = _validate_webhook_url(url)
		violations.extend(url_violations)

	# 4. Check Jinja templates for dangerous patterns
	for field in ("subject", "message", "body_template"):
		template = action_config.get(field, "")
		if template:
			tpl_violations = _validate_jinja_template(template)
			violations.extend(tpl_violations)

	return violations


def _get_call_name(node: ast.Call) -> str | None:
	"""Extract the full dotted name from a Call node (e.g., 'frappe.utils.today')."""
	if isinstance(node.func, ast.Name):
		return node.func.id
	elif isinstance(node.func, ast.Attribute):
		parts = []
		current = node.func
		while isinstance(current, ast.Attribute):
			parts.append(current.attr)
			current = current.value
		if isinstance(current, ast.Name):
			parts.append(current.id)
		parts.reverse()
		return ".".join(parts)
	return None


# Safe function calls allowed in scheduler conditions
_SAFE_CONDITION_CALLS = frozenset(
	{
		"doc.get",
		"str",
		"int",
		"float",
		"bool",
		"len",
		"abs",
		"min",
		"max",
		"round",
		"frappe.utils.today",
		"frappe.utils.now",
		"frappe.utils.now_datetime",
		"frappe.utils.nowdate",
		"frappe.utils.nowtime",
		"frappe.utils.add_days",
		"frappe.utils.add_months",
		"frappe.utils.add_years",
		"frappe.utils.add_to_date",
		"frappe.utils.date_diff",
		"frappe.utils.time_diff",
		"frappe.utils.time_diff_in_hours",
		"frappe.utils.time_diff_in_seconds",
		"frappe.utils.get_datetime",
		"frappe.utils.getdate",
		"frappe.utils.get_time",
		"frappe.utils.flt",
		"frappe.utils.cint",
		"frappe.utils.cstr",
	}
)


def _is_safe_condition_call(call_name: str) -> bool:
	"""Check if a function call is safe for use in scheduler conditions."""
	if call_name in _SAFE_CONDITION_CALLS:
		return True

	# Allow frappe.utils.* date/time functions
	if call_name.startswith("frappe.utils."):
		return True

	# Allow .get() on any object (dict access)
	if call_name.endswith(".get"):
		return True

	# Allow .lower(), .upper(), .strip() etc. string methods
	safe_str_methods = {"lower", "upper", "strip", "startswith", "endswith", "replace", "split"}
	last_part = call_name.split(".")[-1]
	if last_part in safe_str_methods:
		return True

	return False


def _validate_sql_statement(sql: str) -> list[str]:
	"""Validate that a SQL string is read-only (SELECT only).

	Returns a list of violation messages. Empty list = SQL is safe.
	Used to validate the first argument of frappe.db.sql() calls.
	"""
	violations = []
	if not sql or not sql.strip():
		return violations

	stripped = sql.strip()

	# Check if statement starts with a write keyword
	if _SQL_WRITE_KEYWORDS.match(stripped):
		violations.append(
			f"Write SQL not allowed in frappe.db.sql(): statement starts with '{stripped.split()[0].upper()}'"
		)

	# Check for write operations embedded anywhere (e.g. inside CTEs, subqueries)
	match = _SQL_WRITE_ANYWHERE.search(stripped)
	if match and not violations:
		violations.append(f"Write SQL not allowed in frappe.db.sql(): contains '{match.group(0).strip()}'")

	return violations


def _extract_sql_from_call(node: ast.Call) -> str | None:
	"""Try to extract a static SQL string from a frappe.db.sql() call node.

	Returns the SQL string if it can be statically determined (string literal
	or f-string with a recognizable prefix), or None if it's dynamic.
	"""
	if not node.args:
		return None

	first_arg = node.args[0]

	# Simple string literal: frappe.db.sql("SELECT ...")
	if isinstance(first_arg, ast.Constant) and isinstance(first_arg.value, str):
		return first_arg.value

	# f-string: frappe.db.sql(f"SELECT ... WHERE name = {name}")
	if isinstance(first_arg, ast.JoinedStr):
		# Reconstruct the static parts of the f-string to check the SQL prefix
		parts = []
		for value in first_arg.values:
			if isinstance(value, ast.Constant) and isinstance(value.value, str):
				parts.append(value.value)
			else:
				parts.append("?")  # placeholder for dynamic parts
		return "".join(parts)

	return None


def _validate_webhook_url(url: str) -> list[str]:
	"""Validate that a webhook URL doesn't target internal/private networks (SSRF prevention)."""
	violations = []
	if not url:
		violations.append("Webhook URL is required")
		return violations

	from urllib.parse import urlparse

	try:
		parsed = urlparse(url)
	except Exception:
		violations.append(f"Invalid webhook URL: {url}")
		return violations

	# Must be http or https
	if parsed.scheme not in ("http", "https"):
		violations.append(f"Webhook URL must use http or https, got: {parsed.scheme}")

	hostname = (parsed.hostname or "").lower()

	# Block localhost
	if hostname in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
		violations.append("Webhook URL cannot target localhost")

	# Block private IP ranges
	_private_patterns = [
		r"^10\.",  # 10.0.0.0/8
		r"^172\.(1[6-9]|2[0-9]|3[01])\.",  # 172.16.0.0/12
		r"^192\.168\.",  # 192.168.0.0/16
		r"^169\.254\.",  # Link-local
		r"^fc[0-9a-f]{2}:",  # IPv6 ULA
		r"^fd[0-9a-f]{2}:",  # IPv6 ULA
		r"^fe80:",  # IPv6 link-local
	]
	for pattern in _private_patterns:
		if re.match(pattern, hostname):
			violations.append(f"Webhook URL cannot target private/internal networks: {hostname}")
			break

	# Block cloud metadata endpoints
	metadata_hosts = {"metadata.google.internal", "metadata", "169.254.169.254"}
	if hostname in metadata_hosts:
		violations.append("Webhook URL cannot target cloud metadata endpoints")

	return violations


def _validate_jinja_template(template: str) -> list[str]:
	"""Validate Jinja template strings for dangerous patterns."""
	violations = []

	# Block dangerous Jinja constructs
	dangerous_patterns = [
		(r"\{\%.*import.*\%\}", "Jinja import statements are not allowed"),
		(r"\{\{.*__class__.*\}\}", "Access to __class__ in templates is not allowed"),
		(r"\{\{.*__globals__.*\}\}", "Access to __globals__ in templates is not allowed"),
		(r"\{\{.*__subclasses__.*\}\}", "Access to __subclasses__ in templates is not allowed"),
		(r"\{\{.*__builtins__.*\}\}", "Access to __builtins__ in templates is not allowed"),
		(r"\{\{.*\.__init__.*\}\}", "Access to __init__ in templates is not allowed"),
		(r"\{\{.*\.mro\(\).*\}\}", "Access to .mro() in templates is not allowed"),
		(r"\{\{.*config.*\}\}", "Access to config in templates is not allowed"),
		(r"\{\%\s*set\s+.*\s*=.*os\.", "OS access in templates is not allowed"),
		(r"\{\{.*lipsum.*\}\}", "Jinja lipsum is not allowed"),
		(r"\{\{.*cycler.*\}\}", "Jinja cycler is not allowed"),
		(r"\{\{.*joiner.*\}\}", "Jinja joiner is not allowed"),
		(r"\{\{.*namespace.*\}\}", "Jinja namespace is not allowed"),
	]

	for pattern, msg in dangerous_patterns:
		if re.search(pattern, template, re.IGNORECASE):
			violations.append(msg)

	return violations
