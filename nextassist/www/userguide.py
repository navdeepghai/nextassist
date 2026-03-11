import frappe

no_cache = 1


def get_context(context):
	context.no_cache = 1
	context.title = "NextAssist User Guide"
	context.no_header = True
	context.no_breadcrumbs = True
	context.show_sidebar = False
	context.full_width = True
