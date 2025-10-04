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
                    query: "validation.validation.report.document_time_tracking.document_time_tracking.get_doctype_list"
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
    ],

    onload: function(report) {
        report.page.add_inner_button(__('✖'), function() {
            report.set_filter_value('consolidate', 0);
            report.set_filter_value('user', '');
            report.set_filter_value('document_type', '');
            report.set_filter_value('from_date', frappe.datetime.add_days(frappe.datetime.get_today(), -30));
            report.set_filter_value('to_date', frappe.datetime.get_today());

            report.refresh();  
        });
    }
};
