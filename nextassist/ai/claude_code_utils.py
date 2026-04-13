import shutil
from pathlib import Path


def find_claude_cli() -> str | None:
	"""Find the Claude Code CLI binary.

	Checks PATH first, then falls back to common installation locations.
	This is needed because Frappe's gunicorn/worker processes may not have
	~/.local/bin in their PATH even though the CLI is installed there.
	"""
	# 1. Check PATH
	path = shutil.which("claude")
	if path:
		return path

	# 2. Fallback locations (same as the SDK checks)
	home = Path.home()
	locations = [
		home / ".local/bin/claude",
		home / ".npm-global/bin/claude",
		Path("/usr/local/bin/claude"),
		home / "node_modules/.bin/claude",
		home / ".yarn/bin/claude",
	]

	for loc in locations:
		if loc.exists() and loc.is_file():
			return str(loc)

	return None
