frappe.ui.form.on('Cleanup Settings', {
    delete_now: function(frm) {
            if (!frm.doc.manual_doctype || !frm.doc.created_before) {
                frappe.msgprint("Please select Manual Doctype and Created Before date");
                return;
            }

            frappe.call({
                method: 'validation.validation.doctype.cleanup_settings.cleanup_settings.delete_manual_docs',
                args: {
                    doctype: frm.doc.manual_doctype,
                    created_before: frm.doc.created_before,
                    docstatus: frm.doc.doc_status || 0
                },
                callback: function(r) {
                    frappe.msgprint(r.message);
                }
            });
    },
    clear_all: function(frm) {
            frm.set_value('manual_doctype', '');
            frm.set_value('created_before', '');
            frm.set_value('created_by', '')
            frm.set_value('doc_status', "");
    },
    preview_count(frm) {
        if (!frm.doc.manual_doctype || !frm.doc.created_before) {
            frappe.msgprint(__('Please select Manual Doctype and Created Before date.'));
            return;
        }

        let filters = [
            ['creation', '<=', frm.doc.created_before]
        ];

        if (frm.doc.created_by) {
            filters.push(['owner', '=', frm.doc.created_by]);
        }

        if (frm.doc.doc_status !== undefined && frm.doc.doc_status !== null && frm.doc.doc_status !== '') {
            filters.push(['docstatus', '=', frm.doc.doc_status]);
        }

        frappe.call({
            method: 'frappe.desk.reportview.get_count',
            args: {
                doctype: frm.doc.manual_doctype,
                filters: filters
            },
            callback: function(r) {
                if (r.message !== undefined) {
                    frm.fields_dict.more_info.$wrapper.html(
                        `<div style="margin-top: 10px;color:green;"><b>Total Documents:</b> ${r.message}</div>`
                    );
                }
            }
        });
    }
});
