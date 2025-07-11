frappe.ui.form.on("Settings for Automation", {
    refresh(frm) {
        if (!frm.doc.__unsaved) {
            frm.set_value('enable_item_automation', 1);
            frm.set_value('enable_bank_automation', 1);
            frm.set_value('custom_customer_group', 1);
            frm.set_value('custom_supplier_group', 1);
            frm.set_value('enable_employee_automation', 1);
            frm.set_value('enable_brand_automation', 1);
            frm.set_value('custom_terms_and_conditions', 1);
            frm.set_value('custom_payment_term', 1);
            frm.set_value('custom_payment_term_template', 1);
            frm.set_value('enable_supplier_automation', 1);
            frm.set_value('enable_item_group_automation', 1);
            frm.set_value('enable_contact_automation', 1);
            frm.set_value('enable_address_automation', 1);
            frm.set_value('enable_customer_automation', 1);
        }
    },
});
