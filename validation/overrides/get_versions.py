import frappe
from frappe.utils.change_log import get_versions as original_get_versions

@frappe.whitelist()
def custom_get_app_versions():
    apps = original_get_versions()
    # Remove "validation" app from the dict
    apps.pop("validation", None)
    return apps
