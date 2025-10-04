frappe.query_reports["Document Time Tracking"] = {
    "filters": [
        {
            "fieldname": "consolidate",
            "label": __("Consolidate"),
            "fieldtype": "Check",
            "default": 0
        },
        {
            "fieldname": "user",
            "label": __("User"),
            "fieldtype": "Link",
            "options": "User"
        },
        {
            "fieldname": "document_type",
            "label": __("Document Type"),
            "fieldtype": "Link",
            "options": "DocType",
            "get_query": function() {
                return {
                    query: "validation.stock.report.document_time_tracking.document_time_tracking.get_doctype_list"
                };
            }
        },
        {
            "fieldname": "from_date",
            "label": __("From Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.add_days(frappe.datetime.get_today(), -30)
        },
        {
            "fieldname": "to_date",
            "label": __("To Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today()
        }
    ]
};