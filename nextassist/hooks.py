from . import __version__ as app_version

app_name = "nextassist"
app_title = "NextAssist"
app_publisher = "Navdeep Singh"
app_description = "AI Chatbot Assistant"
app_email = "navdeepghai1@gmail.com"
app_license = "mit"

app_include_js = "/assets/nextassist/js/nextassist.bundle.js"

app_logo = "/assets/nextassist/icons/nextassist-logo.svg"
app_logo_url = "/assets/nextassist/icons/nextassist-logo.svg"

add_to_apps_screen = [
	{
		"name": "nextassist",
		"logo": "/assets/nextassist/icons/nextassist-logo.svg",
		"title": "NextAssist",
		"route": "/nextassist",
		"has_permission": "nextassist.permissions.check_app_permission",
	}
]

extend_bootinfo = "nextassist.boot.boot_session"

after_install = "nextassist.install.after_install"

website_route_rules = [
	{"from_route": "/nextassist/userguide", "to_route": "userguide"},
	{"from_route": "/nextassist/<path:app_path>", "to_route": "nextassist"},
]

export_python_type_annotations = True

scheduler_events = {
	"cron": {
		"* * * * *": ["nextassist.scheduler.dispatcher.dispatch_due_schedulers"],
	},
}
