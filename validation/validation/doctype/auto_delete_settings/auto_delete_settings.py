# Copyright (c) 2025, Ameer Babu and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, add_days

class AutoDeleteSettings(Document):
	pass
@frappe.whitelist()
def execute():
    settings = frappe.get_single("Auto Delete Settings")
    print("Executing Auto Delete Settings...")

    for row in settings.get("documents_to_clear") or []:
        doctype = row.get("ref_doctype")
        days_to_keep = row.get("days_to_keep")

        if not doctype or not days_to_keep:
            frappe.log_error(f"Skipping row: {doctype}, {days_to_keep}", "Auto Delete Skipped")
            continue

        threshold_date = add_days(now_datetime(), -int(days_to_keep))
        frappe.log_error(f"Checking {doctype} before {threshold_date}", "Auto Delete")

        old_docs = frappe.get_all(
            doctype,
            filters={"creation": ("<", threshold_date)},
            pluck="name"
        )
        frappe.log_error(f"Found {len(old_docs)} old {doctype} records", "Auto Delete")

        for name in old_docs:
            frappe.delete_doc(doctype, name, force=1, ignore_permissions=True)
            frappe.log_error(f"Deleted {doctype} record: {name}", "Auto Delete")
