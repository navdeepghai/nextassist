import frappe

DEFAULT_MODELS = {
	"OpenAI": [
		"gpt-5.4-pro",
		"gpt-5.4",
		"gpt-4.1",
		"gpt-4.1-mini",
		"gpt-4.1-nano",
		"gpt-4o",
		"gpt-4o-mini",
		"o4-mini",
		"o3",
		"o3-mini",
	],
	"Anthropic": [
		"claude-opus-4-6",
		"claude-sonnet-4-6",
		"claude-haiku-4-5",
		"claude-opus-4-20250514",
		"claude-sonnet-4-20250514",
		"claude-haiku-4-5-20251001",
	],
	"Google": [
		"gemini-3.1-pro-preview",
		"gemini-3.1-flash-lite-preview",
		"gemini-3-flash-preview",
		"gemini-2.5-pro",
		"gemini-2.5-flash",
		"gemini-2.5-flash-lite",
		"gemini-2.0-flash",
		"gemini-2.0-flash-lite",
	],
}


def boot_session(bootinfo):
	if frappe.session.user == "Guest":
		return

	bootinfo["nextassist"] = {
		"version": frappe.get_attr("nextassist.__version__"),
		"default_models": DEFAULT_MODELS,
	}
