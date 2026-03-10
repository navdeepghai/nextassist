import ast
import json
import math
import re
from collections import Counter, OrderedDict, defaultdict
from types import ModuleType

import frappe
from frappe.utils.safe_exec import safe_exec

from nextassist.ai.context_builder import get_model_for_session, get_provider_config, get_provider_for_session
from nextassist.ai.provider_factory import get_provider
from nextassist.ai.tools import execute_tool, get_tool_definitions
from nextassist.database import message_db, session_db, settings_db

# ── Safe globals injected into AI code execution environment ─────────────────
# RestrictedPython's safe_builtins may not include all standard Python builtins.
# Since _sanitize_ai_code strips import statements, we inject the commonly-used
# names so AI-generated code like `reversed(data)` or `math.ceil(x)` works.
#
# SECURITY: Only read-only, side-effect-free objects are included here.
# No I/O, no OS access, no code execution, no network access.
_SAFE_EXEC_GLOBALS = {
	# ─── Python builtins (fallback if missing from RestrictedPython) ───
	"reversed": reversed,
	"sorted": sorted,
	"enumerate": enumerate,
	"zip": zip,
	"map": map,
	"filter": filter,
	"sum": sum,
	"any": any,
	"all": all,
	"min": min,
	"max": max,
	"abs": abs,
	"round": round,
	"len": len,
	"range": range,
	"isinstance": isinstance,
	"list": list,
	"dict": dict,
	"tuple": tuple,
	"set": set,
	"frozenset": frozenset,
	"str": str,
	"int": int,
	"float": float,
	"bool": bool,
	"next": next,
	"iter": iter,
	"__name__": "__main__",
	# ─── Standard library modules (safe for data processing) ───
	"math": math,
	"re": re,
	# ─── Common imports (since import statements are stripped) ───
	"OrderedDict": OrderedDict,
	"Counter": Counter,
	"defaultdict": defaultdict,
	"ceil": math.ceil,
	"floor": math.floor,
	"sqrt": math.sqrt,
	# ─── json module (AI often writes `import json` which gets stripped) ───
	"json": json,
	# ─── Safe __import__ stub — prevents RestrictedPython NameError ───
	# AI-generated imports are stripped by _sanitize_ai_code, but if any slip
	# through, this returns a dummy module instead of crashing with '__import__'.
	"__import__": lambda name, *a, **kw: _SAFE_EXEC_GLOBALS.get(name) or ModuleType(name),
	# ─── frappe.utils date shortcuts (AI often omits the frappe.utils. prefix) ───
	"getdate": frappe.utils.getdate,
	"get_datetime": frappe.utils.get_datetime,
	"today": frappe.utils.today,
	"nowdate": frappe.utils.nowdate,
	"now_datetime": frappe.utils.now_datetime,
	"add_days": frappe.utils.add_days,
	"add_months": frappe.utils.add_months,
	"add_years": frappe.utils.add_years,
	"date_diff": frappe.utils.date_diff,
	"get_first_day": frappe.utils.get_first_day,
	"get_last_day": frappe.utils.get_last_day,
	"get_year_start": frappe.utils.get_year_start,
	"get_year_ending": frappe.utils.get_year_ending,
	"format_date": frappe.utils.format_date,
}


def stream_ai_response(session_name: str, user: str):
	"""
	Main entry point for streaming AI responses. Called via frappe.enqueue().

	1. Build message context from session history
	2. Get the appropriate provider
	3. Stream the response, publishing realtime events
	4. Handle tool calls if needed
	5. Save the final assistant message
	"""
	frappe.set_user(user)

	try:
		frappe.publish_realtime(
			"nextassist_thinking",
			{"session": session_name, "status": "thinking"},
			user=user,
		)

		settings = settings_db.get_settings()
		provider_name = get_provider_for_session(session_name)
		provider = get_provider(provider_name)
		model = get_model_for_session(session_name)
		config = get_provider_config(session_name)

		# Get the latest user message content for context building
		latest_message = message_db.get_latest_user_message(session_name)
		if not latest_message:
			return

		# Build tool definitions if enabled (global toggle stays in settings)
		tools = None
		if settings.get("enable_tool_calling"):
			tool_defs = get_tool_definitions()
			if tool_defs:
				tools = tool_defs

		# Build messages from history (the user message is already saved)
		messages = _build_messages_from_history(session_name, config)

		# Stream with tool call loop
		_stream_with_tools(
			session_name=session_name,
			messages=messages,
			provider=provider,
			model=model,
			config=config,
			tools=tools,
			user=user,
			max_tool_rounds=5,
		)

	except Exception as e:
		error_msg = str(e)
		is_limit_reached = False

		# Detect context window / token limit errors from AI providers
		limit_keywords = [
			"context_length_exceeded",
			"context window",
			"maximum context length",
			"max_tokens",
			"too many tokens",
			"token limit",
			"input is too long",
			"request too large",
			"prompt is too long",
		]
		error_lower = error_msg.lower()
		if any(kw in error_lower for kw in limit_keywords):
			is_limit_reached = True
			error_msg = (
				"This conversation has exceeded the model's context window. Please continue in a new chat."
			)
		elif "404" in error_msg and "model" in error_msg:
			error_msg = "The configured AI model was not found. Please check your provider settings."
		elif "401" in error_msg or "authentication" in error_lower:
			error_msg = "Authentication failed with the AI provider. Please check your API key."
		elif "429" in error_msg or "rate" in error_lower:
			error_msg = "Rate limit exceeded. Please wait a moment and try again."
		elif "timeout" in error_lower:
			error_msg = "The AI provider took too long to respond. Please try again."

		# Mark session as Limit Reached if applicable
		if is_limit_reached:
			try:
				session_db.update_session(session_name, status="Limit Reached")
			except Exception:
				pass

		# Save error as an assistant message so it persists in chat history
		try:
			message_db.create_message(
				session_id=session_name,
				role="assistant",
				content=error_msg,
				is_error=True,
			)
		except Exception:
			pass

		# Publish the appropriate event
		if is_limit_reached:
			frappe.publish_realtime(
				"nextassist_limit_reached",
				{"session": session_name, "error": error_msg},
				user=user,
			)
		else:
			frappe.publish_realtime(
				"nextassist_error",
				{"session": session_name, "error": error_msg},
				user=user,
			)

		frappe.log_error(
			title="NextAssist streaming error",
			message=f"Session: {session_name}\nUser: {user}\nError: {e}",
		)


def _build_messages_from_history(session_name: str, config: dict) -> list[dict]:
	"""Build messages from session history.

	Returns the system prompt + the latest N messages, ensuring:
	- Latest messages are included (not oldest)
	- Empty assistant messages (without tool_calls) are excluded
	- The last message is always a user message (required by Anthropic)
	- Tool call pairs are kept intact: if a tool result is included,
	  its matching assistant message with tool_calls must also be present
	"""
	messages = []

	# System prompt
	system_prompt = config.get("system_prompt", "")
	if system_prompt:
		messages.append({"role": "system", "content": system_prompt})

	# Fetch the latest N messages in chronological order
	max_context = config.get("max_context_messages", 20)
	history = message_db.get_recent_messages(session_name, max_context)

	for msg in history:
		# Skip error messages
		if msg.get("is_error"):
			continue

		# Parse tool_calls
		tc = msg.get("tool_calls")
		if tc and isinstance(tc, str):
			try:
				tc = json.loads(tc)
			except json.JSONDecodeError, TypeError:
				tc = None
		has_tool_calls = bool(tc and isinstance(tc, list) and len(tc) > 0)

		# Skip empty assistant messages that have no tool_calls
		if msg["role"] == "assistant" and not (msg.get("content") or "").strip() and not has_tool_calls:
			continue

		entry = {"role": msg["role"], "content": msg.get("content") or ""}

		if has_tool_calls:
			entry["tool_calls"] = tc

		if msg.get("tool_call_id"):
			entry["tool_call_id"] = msg["tool_call_id"]

		messages.append(entry)

	# Collect all tool_use IDs present in assistant messages
	tool_use_ids = set()
	for m in messages:
		for tc in m.get("tool_calls", []):
			tc_id = tc.get("id", "")
			if tc_id:
				tool_use_ids.add(tc_id)

	# Remove any orphaned tool result messages (tool_call_id not in any assistant message)
	messages = [
		m
		for m in messages
		if not (m["role"] == "tool" and m.get("tool_call_id") and m["tool_call_id"] not in tool_use_ids)
	]

	# Ensure the last non-system message is a user message.
	# Remove trailing assistant/tool messages to satisfy API requirements.
	while len(messages) > 1 and messages[-1]["role"] in ("assistant", "tool"):
		messages.pop()

	return messages


def _fix_augmented_subscript_assignments(code: str) -> str:
	"""Transform d[key] += value into d[key] = d[key] + value.

	RestrictedPython forbids augmented assignment on subscripts (e.g., d["x"] += 1)
	but allows regular subscript assignment (d["x"] = d["x"] + 1). This AST
	transformation rewrites the former into the latter.
	"""
	try:
		tree = ast.parse(code)
	except SyntaxError:
		return code  # Return as-is; safe_exec will report the syntax error

	class AugAssignFixer(ast.NodeTransformer):
		def visit_AugAssign(self, node):
			self.generic_visit(node)
			if isinstance(node.target, ast.Subscript):
				# Build a read copy of the subscript target: d[key] (Load context)
				read_target = ast.Subscript(
					value=ast.copy_location(
						ast.Name(id=node.target.value.id, ctx=ast.Load())
						if isinstance(node.target.value, ast.Name)
						else node.target.value,
						node.target.value,
					),
					slice=node.target.slice,
					ctx=ast.Load(),
				)
				ast.copy_location(read_target, node.target)
				# Build: d[key] = d[key] + value
				new_node = ast.Assign(
					targets=[node.target],
					value=ast.BinOp(
						left=read_target,
						op=node.op,
						right=node.value,
					),
				)
				return ast.copy_location(new_node, node)
			return node

	tree = AugAssignFixer().visit(tree)
	ast.fix_missing_locations(tree)
	return ast.unparse(tree)


def _sanitize_ai_code(code: str) -> str:
	"""Strip import statements and rewrite datetime/module patterns to use frappe.utils."""
	# Strip all import lines (including indented ones inside functions/if-blocks)
	code = re.sub(r"^[ \t]*(import\s+.+|from\s+\S+\s+import\s+.+)\s*$", "", code, flags=re.MULTILINE)

	# Strip semicolon-chained imports: `x = 1; import json; y = 2` → `x = 1;  y = 2`
	code = re.sub(r";\s*(import\s+\S+|from\s+\S+\s+import\s+\S+)", "", code)

	# Strip direct __import__() calls: `json = __import__('json')` → ``
	code = re.sub(r"\w+\s*=\s*__import__\s*\([^)]*\)\s*", "", code)
	code = re.sub(r"__import__\s*\([^)]*\)", "None", code)

	# Rewrite datetime patterns to frappe.utils equivalents
	code = re.sub(r"\bdatetime\.datetime\.now\(\)", "frappe.utils.now_datetime()", code)
	code = re.sub(r"\bdatetime\.now\(\)", "frappe.utils.now_datetime()", code)
	code = re.sub(r"\bdatetime\.datetime\.today\(\)", "frappe.utils.today()", code)
	code = re.sub(r"\bdatetime\.today\(\)", "frappe.utils.today()", code)
	code = re.sub(r"\bdate\.today\(\)", "frappe.utils.today()", code)
	code = re.sub(
		r"\bdatetime\.datetime\.strptime\(([^,]+),\s*[^)]+\)", r"frappe.utils.get_datetime(\1)", code
	)
	code = re.sub(r"\bdatetime\.strptime\(([^,]+),\s*[^)]+\)", r"frappe.utils.get_datetime(\1)", code)
	code = re.sub(r"\btimedelta\(days=(\d+)\)", r"frappe.utils.to_timedelta(days=\1)", code)
	code = re.sub(r"\bdatetime\.date\(", "frappe.utils.getdate(str(", code)

	# NOTE: We intentionally do NOT replace frappe.has_permission() with True.
	# That was a security bypass. Let safe_exec enforce permission checks naturally.

	return code


def _execute_ai_code(content: str) -> dict | None:
	"""Extract Python code block from AI response, validate, and execute via safe_exec."""
	from nextassist.security.script_validator import validate_ai_code

	match = re.search(r"```python\n(.*?)```", content, re.DOTALL)
	if not match:
		return None

	code = match.group(1)
	code = _sanitize_ai_code(code)
	code = _fix_augmented_subscript_assignments(code)

	# Security validation BEFORE execution
	violations = validate_ai_code(code)
	if violations:
		violation_msg = "; ".join(violations)
		frappe.log_error(
			title="NextAssist: AI code blocked by security validator",
			message=f"Violations: {violation_msg}\n\nCode:\n{code}",
		)
		return {
			"data": [],
			"format": "table",
			"chart": None,
			"files": [],
			"error": f"Code blocked by security policy: {violation_msg}",
		}

	try:
		exec_globals, _exec_locals = safe_exec(
			code,
			_globals=_SAFE_EXEC_GLOBALS.copy(),
			restrict_commit_rollback=True,
		)
		result = exec_globals.get("result")
		if isinstance(result, dict):
			return result
		frappe.log_error(
			title="NextAssist: Code executed but no result dict",
			message=f"Code:\n{code}\n\nexec_globals keys: {list(exec_globals.keys())[:20]}",
		)
		return {
			"data": [],
			"format": "table",
			"chart": None,
			"files": [],
			"error": "Code executed but did not produce a valid result.",
		}
	except Exception as e:
		frappe.log_error(
			title="NextAssist: Code execution error",
			message=f"Error: {e}\n\nCode:\n{code}",
		)
		return {"data": [], "format": "table", "chart": None, "files": [], "error": str(e)}


def _stream_with_tools(
	session_name: str,
	messages: list[dict],
	provider,
	model: str,
	config: dict,
	tools: list[dict] | None,
	user: str,
	max_tool_rounds: int = 5,
):
	"""Stream a response, handling tool calls recursively up to max_tool_rounds."""
	for _round in range(max_tool_rounds):
		content_buffer = ""
		tool_calls = []
		usage = {}

		for chunk in provider.stream_chat_completion(
			messages=messages,
			model=model,
			temperature=config.get("temperature", 0.7),
			max_tokens=config.get("max_tokens", 4096),
			tools=tools,
		):
			if chunk["type"] == "token":
				token = chunk["content"]
				content_buffer += token
				frappe.publish_realtime(
					"nextassist_token",
					{"session": session_name, "content": token},
					user=user,
				)
			elif chunk["type"] == "tool_call":
				tool_calls.append(chunk)
			elif chunk["type"] == "done":
				usage = chunk.get("usage", {})
			elif chunk["type"] == "error":
				frappe.publish_realtime(
					"nextassist_error",
					{"session": session_name, "error": chunk["message"]},
					user=user,
				)
				return

		if not tool_calls:
			# Guard against empty responses
			if not content_buffer.strip():
				frappe.log_error(
					title="NextAssist: Empty AI response",
					message=f"Session: {session_name}\nModel returned empty content.\nUsage: {usage}",
				)
				frappe.publish_realtime(
					"nextassist_error",
					{
						"session": session_name,
						"error": "The AI returned an empty response. Please try again.",
					},
					user=user,
				)
				return

			# No tool calls — execute any AI-generated code and save
			structured_result = _execute_ai_code(content_buffer)

			metadata = None
			if structured_result:
				metadata = {"structured_result": structured_result}

			msg = message_db.create_message(
				session_id=session_name,
				role="assistant",
				content=content_buffer,
				provider=provider.provider_doc.provider_name,
				model=model,
				token_count=usage.get("total_tokens", 0),
				metadata=metadata,
			)

			# Send structured result to frontend
			if structured_result:
				frappe.publish_realtime(
					"nextassist_result",
					{
						"session": session_name,
						"message_id": msg["id"],
						"result": structured_result,
					},
					user=user,
				)

			frappe.publish_realtime(
				"nextassist_complete",
				{
					"session": session_name,
					"message_id": msg["id"],
					"full_content": content_buffer,
					"token_count": usage.get("total_tokens", 0),
				},
				user=user,
			)
			return

		# Handle tool calls
		# Save assistant message with tool_calls
		tc_data = [
			{
				"id": tc["id"],
				"type": "function",
				"function": {"name": tc["name"], "arguments": tc["arguments"]},
			}
			for tc in tool_calls
		]
		message_db.create_message(
			session_id=session_name,
			role="assistant",
			content=content_buffer,
			provider=provider.provider_doc.provider_name,
			model=model,
			tool_calls=tc_data,
		)

		# Add assistant message to context
		messages.append(
			{
				"role": "assistant",
				"content": content_buffer,
				"tool_calls": tc_data,
			}
		)

		# Execute each tool call
		for tc in tool_calls:
			frappe.publish_realtime(
				"nextassist_tool_call",
				{
					"session": session_name,
					"tool": tc["name"],
					"tool_call_id": tc["id"],
					"status": "calling",
				},
				user=user,
			)

			try:
				args = json.loads(tc["arguments"]) if isinstance(tc["arguments"], str) else tc["arguments"]
			except json.JSONDecodeError:
				args = {}

			result = execute_tool(tc["name"], args)

			# Attach session_id to newly created schedulers
			if tc["name"] == "create_scheduler" and result.get("scheduler_id"):
				try:
					from nextassist.database import scheduler_db

					scheduler_db.update_scheduler(result["scheduler_id"], session_id=session_name)
				except Exception:
					pass

			result_str = json.dumps(result, default=str)

			# Save tool result message
			message_db.create_message(
				session_id=session_name,
				role="tool",
				content=result_str,
				tool_call_id=tc["id"],
			)

			# Add tool result to context
			messages.append(
				{
					"role": "tool",
					"content": result_str,
					"tool_call_id": tc["id"],
				}
			)

			frappe.publish_realtime(
				"nextassist_tool_call",
				{
					"session": session_name,
					"tool": tc["name"],
					"tool_call_id": tc["id"],
					"status": "done",
					"result_preview": result_str[:200],
				},
				user=user,
			)

		# Loop back to get the assistant's response after tool calls

	# If we exhausted max_tool_rounds
	frappe.publish_realtime(
		"nextassist_error",
		{"session": session_name, "error": "Maximum tool call rounds exceeded."},
		user=user,
	)
