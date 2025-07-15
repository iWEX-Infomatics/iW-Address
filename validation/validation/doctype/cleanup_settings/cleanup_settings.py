# Copyright (c) 2025, Ameer Babu and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime, add_days, getdate

class CleanupSettings(Document):
    pass

@frappe.whitelist()
def delete_manual_docs(doctype, created_before, docstatus=None, created_by=None):
    """Manually delete documents matching the selected filters."""

    if not doctype or not created_before:
        frappe.throw(_("Please select Doctype and Created Before date"))

    filters = {
        "creation": ["<", getdate(created_before)]
    }

    if created_by:
        filters["owner"] = created_by

    if docstatus is not None and docstatus != "":
        filters["docstatus"] = int(docstatus)

    docs = frappe.get_all(doctype, filters=filters, pluck="name")

    deleted = []
    skipped = []

    for name in docs:
        try:
            doc = frappe.get_doc(doctype, name)
            doc.delete()
            deleted.append(name)
            frappe.log_error(f"Deleted {doctype} record: {name}", "Manual Cleanup Success")
        except Exception as e:
            skipped.append(name)
            frappe.log_error(
                title=f"Delete Error: {doctype} {name}",
                message=str(e)[:130]
            )

    return f"✅ Deleted {len(deleted)} documents from {doctype}. ❌ Skipped: {len(skipped)}."


@frappe.whitelist()
def execute():
    """Scheduled auto-cleanup for documents based on Cleanup Settings config."""
    settings = frappe.get_single("Cleanup Settings")

    # ✅ Global enable/disable check
    if not settings.enable_automatic_cleanup:
        frappe.log_error("Automatic cleanup is disabled in Cleanup Settings.", "Auto Delete Skipped")
        return

    frappe.log_error("Executing Cleanup Settings Scheduler...", "Auto Delete")

    for row in settings.get("cleanup_document_list") or []:
        if not row.get("enable_schedule"):
            continue

        doctype = row.get("ref_doctype")
        days_to_keep = row.get("clear_logs_after")
        created_by = row.get("created_by")
        doc_status = row.get("doc_status")

        if not doctype or days_to_keep in (None, ""):
            frappe.log_error(f"Skipping row due to missing doctype or days: {doctype}, {days_to_keep}", "Auto Delete Skipped")
            continue

        try:
            days_to_keep = int(days_to_keep)
        except (ValueError, TypeError):
            frappe.log_error(f"Invalid clear_logs_after value for {doctype}: {days_to_keep}", "Auto Delete Skipped")
            continue

        threshold_date = add_days(now_datetime(), -days_to_keep)
        frappe.log_error(f"Checking {doctype} before {threshold_date}", "Auto Delete")

        filters = {
            "creation": ("<", threshold_date)
        }

        if created_by:
            filters["owner"] = created_by

        if doc_status is not None and doc_status != "":
            filters["docstatus"] = int(doc_status)

        old_docs = frappe.get_all(doctype, filters=filters, pluck="name")
        frappe.log_error(f"Found {len(old_docs)} old {doctype} records", "Auto Delete")

        for name in old_docs:
            try:
                frappe.delete_doc(doctype, name, force=1, ignore_permissions=True)
                frappe.log_error(f"Deleted {doctype} record: {name}", "Auto Delete Success")
            except Exception as e:
                frappe.log_error(f"Failed to delete {doctype} record: {name}. Error: {str(e)}", "Auto Delete Error")
