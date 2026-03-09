import frappe


def check_app_permission():
	if frappe.session.user == "Administrator":
		return True
	return "System Manager" in frappe.get_roles(frappe.session.user)
