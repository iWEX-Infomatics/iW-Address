frappe.ui.form.on('Customer', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1);
        }
    },

    customer_primary_address: function(frm) {
        if (frm.doc.custom_automate !== 1 || !frm.doc.customer_primary_address) return;

        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Address',
                name: frm.doc.customer_primary_address
            },
            callback: function(res) {
                const address = res.message;
                if (!address) return;

                const country = address.country;
                console.log("Country from primary address:", country);

                if (country === "India") {
                    frm.set_value("default_currency", "INR");
                    frm.set_value("default_price_list", "Standard Selling");

                    // Get default company
                    frappe.call({
                        method: "frappe.client.get_value",
                        args: {
                            doctype: "Company",
                            filters: {},
                            fieldname: "name"
                        },
                        callback: function(r) {
                            const company = r.message?.name;
                            if (!company) return;

                            // Add account row if not exists
                            if (!frm.doc.accounts || frm.doc.accounts.length === 0) {
                                let row = frm.add_child("accounts");
                                row.company = company;

                                // Get Receivable Account
                                frappe.call({
                                    method: "frappe.client.get_list",
                                    args: {
                                        doctype: "Account",
                                        filters: {
                                            company,
                                            account_type: "Receivable",
                                            root_type: "Asset",
                                            is_group: 0
                                        },
                                        fields: ["name"],
                                        limit_page_length: 1
                                    },
                                    callback: function(res2) {
                                        if (res2.message?.length) {
                                            row.account = res2.message[0].name;
                                            frm.refresh_field("accounts");
                                        }
                                    }
                                });
                            }

                            // Get Default Bank Account
                            frappe.call({
                                method: "frappe.client.get_list",
                                args: {
                                    doctype: "Bank Account",
                                    filters: {
                                        company,
                                        is_default: 1,
                                        is_company_account: 1
                                    },
                                    fields: ["name"],
                                    limit_page_length: 1
                                },
                                callback: function(bank_res) {
                                    if (bank_res.message?.length) {
                                        frm.set_value("default_bank_account", bank_res.message[0].name);
                                    }
                                }
                            });
                        }
                    });
                }
            }
        });
    },

    customer_name: function(frm) {
        run_formatting_if_enabled(frm, 'customer_name', true);
    },

    customer_details: function(frm) {
        run_formatting_if_enabled(frm, 'customer_details', false);
    },

    before_save: function(frm) {
        if (frm.doc.custom_automate) {
            console.log("Before Save: Enabling custom_automate");
            frm.set_value('custom_automate', 0);
        }
    }
});

// ========== Utility Functions ==========

function run_formatting_if_enabled(frm, fieldname, allowNumbers = false) {
    if (!frm.doc.custom_automate) {
        console.log(`custom_automate is not enabled. Skipping ${fieldname} trigger.`);
        return;
    }

    check_automation_enabled(enabled => {
        if (enabled) {
            const formatted = format_name_generic(frm.doc[fieldname], allowNumbers);
            frm.set_value(fieldname, formatted);
        }
    });
}

function check_automation_enabled(callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: 'enable_customer_automation'
        },
        callback: function(res) {
            const is_enabled = !!res.message;
            console.log("Automation enabled?", is_enabled);
            callback(is_enabled);
        }
    });
}

function format_name_generic(name, allowNumbers = false) {
    if (!name) return '';

    const lowercaseWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'];

    let regex = allowNumbers ? /[^a-zA-Z0-9\s]/g : /[^a-zA-Z\s]/g;
    let formatted = name.replace(regex, '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[,\s]+$/, '')
        .replace(/\(/g, ' (');

    return formatted.split(' ').map((word, index) => {
        if (word === word.toUpperCase()) return word;

        const lw = word.toLowerCase();
        if (lowercaseWords.includes(lw)) return lw;

        return lw.length >= 4 ? lw.charAt(0).toUpperCase() + lw.slice(1) : lw;
    }).join(' ');
}
