// Global debounce handler - reusable across all forms
const FormHandler = {
    timeouts: {},
    lastValues: {},

    handle(frm, fieldname, automationField, formatFunction, realTimeFunction) {
        if (!frm.doc.custom_automate) return;

        const currentValue = frm.doc[fieldname] || '';

        // Real-time formatting check
        this.checkAutomation(automationField, (enabled) => {
            if (enabled) {
                const formatted = realTimeFunction(currentValue);
                if (currentValue !== formatted) {
                    frm.set_value(fieldname, formatted);
                    return;
                }
            }
        });

        // Debounced full formatting
        clearTimeout(this.timeouts[fieldname]);
        this.timeouts[fieldname] = setTimeout(() => {
            this.checkAutomation(automationField, (enabled) => {
                if (enabled) {
                    const valueToFormat = frm.doc[fieldname] || '';
                    if (this.lastValues[fieldname] === valueToFormat) return;

                    const formatted = formatFunction(valueToFormat);
                    if (valueToFormat !== formatted) {
                        this.lastValues[fieldname] = formatted;
                        frm.set_value(fieldname, formatted);
                    } else {
                        this.lastValues[fieldname] = valueToFormat;
                    }
                }
            });
        }, 300);
    },

    cleanup(frm, fields) {
        Object.values(this.timeouts).forEach(clearTimeout);
        this.timeouts = {};

        fields.forEach(fieldname => {
            const value = frm.doc[fieldname];
            if (value) {
                const cleaned = value.replace(/[,\s]+$/, '').trim();
                if (value !== cleaned) frm.set_value(fieldname, cleaned);
            }
        });
    },

    checkAutomation(field, callback) {
        frappe.call({
            method: 'frappe.client.get_single_value',
            args: {
                doctype: 'Settings for Automation',
                field: field
            },
            callback: (res) => callback(!!res.message)
        });
    }
};

// Text formatting utilities
const TextFormatter = {
    lowercaseWords: ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'],

    realTime(text, allowNumbers = false) {
        if (!text || text.endsWith(' ')) return text;

        return text.split(' ').map((word, index) => {
            if (!word || word === word.toUpperCase()) return word;
            const lower = word.toLowerCase();
            if (this.lowercaseWords.includes(lower) && index !== 0) return lower;
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        }).join(' ');
    },

    full(text, allowNumbers = false) {
        if (!text || text.endsWith(' ')) return text;

        const regex = allowNumbers ? /[^a-zA-Z0-9\s]/g : /[^a-zA-Z\s]/g;

        return text
            .replace(regex, '')
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[,\s]+$/, '')
            .replace(/\(/g, ' (')
            .split(' ')
            .filter(word => word.length > 0)
            .map((word, index) => {
                if (word === word.toUpperCase()) return word;
                const lower = word.toLowerCase();
                if (this.lowercaseWords.includes(lower) && index !== 0) return lower;
                return lower.charAt(0).toUpperCase() + lower.slice(1);
            })
            .join(' ');
    }
};

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
        FormHandler.handle(
            frm,
            'supplier_name',
            'enable_supplier_automation',
            (text) => TextFormatter.full(text, false),
            (text) => TextFormatter.realTime(text, false)
        );
    },

    supplier_details: function(frm) {
        FormHandler.handle(
            frm,
            'supplier_details',
            'enable_supplier_automation',
            (text) => TextFormatter.full(text, false),
            (text) => TextFormatter.realTime(text, false)
        );
    },

    before_save: function(frm) {
        FormHandler.cleanup(frm, ['supplier_name', 'supplier_details']);

        if (frm.doc.custom_automate) {
            console.log("Before Save: Disabling custom_automate");
            frm.set_value('custom_automate', 0);
        }
    }
});

// --------------------- Utility Functions ----------------------

function set_indian_defaults(frm, account_type) {
    frm.set_value("default_currency", "INR");
    frm.set_value("default_price_list", "INR Buying");

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

// ========== Legacy Functions (kept for compatibility) ==========

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
        console.log(`custom_automate is disabled. Skipping ${fieldname} trigger.`);
    }
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
        if (lowercaseWords.includes(lower) && index !== 0) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join(' ');

    return formattedName;
}
