frappe.ui.form.on('Supplier', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1);
        }
    },

    supplier_primary_address: function(frm) {
        if (frm.doc.custom_automate !== 1 || !frm.doc.supplier_primary_address) return;

        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Address',
                name: frm.doc.supplier_primary_address
            },
            callback: function(res) {
                if (res.message && res.message.country === "India") {
                    console.log("Primary address country is India");
                    set_indian_defaults(frm, "Receivable");
                }
            }
        });
    },

    country: function(frm) {
        if (frm.doc.custom_automate !== 1 || !frm.doc.country) return;

        if (frm.doc.country === "India") {
            console.log("Country is India");
            set_indian_defaults(frm, "Payable");
        }
    },

    supplier_name: function(frm) {
        handle_format_field(frm, 'supplier_name');
    },

    supplier_details: function(frm) {
        handle_format_field(frm, 'supplier_details');
    },

    before_save: function(frm) {
        if (frm.doc.custom_automate) {
            console.log("Before Save: Enabling custom_automate");
            frm.set_value('custom_automate', 0);
        }
    }
});

// --------------------- Utility Functions ----------------------

function handle_format_field(frm, fieldname) {
    if (frm.doc.custom_automate) {
        check_automation_enabled(frm, function(is_enabled) {
            if (is_enabled) {
                const formatted_value = format_name(frm.doc[fieldname]);
                console.log(`Formatted ${fieldname}:`, formatted_value);
                frm.set_value(fieldname, formatted_value);
            }
        });
    } else {
        console.log(`custom_automate is enabled. Skipping ${fieldname} trigger.`);
    }
}

function set_indian_defaults(frm, account_type) {
    frm.set_value("default_currency", "INR");
    frm.set_value("default_price_list", "Standard Buying");

    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Company",
            filters: {},
            fieldname: "name"
        },
        callback: function(r) {
            if (r.message) {
                let company = r.message.name;

                // Add or update accounts
                if (!frm.doc.accounts || frm.doc.accounts.length === 0) {
                    add_account_row(frm, company, account_type);
                } else {
                    frm.doc.accounts.forEach(row => {
                        row.company = company;
                        get_account_name(company, account_type, function(account_name) {
                            if (account_name) {
                                row.account = account_name;
                                frm.refresh_field("accounts");
                            }
                        });
                    });
                }

                // Set default bank account (only once)
                if (account_type === "Receivable") {
                    frappe.call({
                        method: "frappe.client.get_list",
                        args: {
                            doctype: "Bank Account",
                            filters: {
                                company: company,
                                is_default: 1,
                                is_company_account: 1
                            },
                            fields: ["name"],
                            limit_page_length: 1
                        },
                        callback: function(bank_res) {
                            if (bank_res.message && bank_res.message.length > 0) {
                                frm.set_value("default_bank_account", bank_res.message[0].name);
                            }
                        }
                    });
                }
            }
        }
    });
}

function add_account_row(frm, company, account_type) {
    let row = frm.add_child("accounts");
    row.company = company;

    get_account_name(company, account_type, function(account_name) {
        if (account_name) {
            row.account = account_name;
            frm.refresh_field("accounts");
        }
    });
}

function get_account_name(company, account_type, callback) {
    const root_type = account_type === "Receivable" ? "Asset" : "Liability";

    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Account",
            filters: {
                company: company,
                account_type: account_type,
                root_type: root_type,
                is_group: 0
            },
            fields: ["name"],
            limit_page_length: 1
        },
        callback: function(res) {
            if (res.message && res.message.length > 0) {
                callback(res.message[0].name);
            }
        }
    });
}

function check_automation_enabled(frm, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: 'enable_supplier_automation'
        },
        callback: function(response) {
            const is_enabled = response.message ? response.message : false;
            callback(is_enabled);
        }
    });
}

function format_name(name) {
    if (!name) return '';

    const lowercaseWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'];

    let formattedName = name.replace(/[^a-zA-Z\s]/g, '');
    formattedName = formattedName.trim().replace(/\s+/g, ' ').replace(/[,\s]+$/, '').replace(/\(/g, ' (');

    formattedName = formattedName.split(' ').map((word, index) => {
        if (word === word.toUpperCase()) return word;
        const lower = word.toLowerCase();
        if (lowercaseWords.includes(lower)) return lower;
        return lower.length >= 4 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    }).join(' ');

    return formattedName;
}
