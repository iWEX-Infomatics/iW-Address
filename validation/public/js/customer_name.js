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

        return text.split(' ').map(word => {
            if (!word || word === word.toUpperCase()) return word;
            const lower = word.toLowerCase();
            return this.lowercaseWords.includes(lower) ? lower :
                word.length >= 4 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
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
            .map(word => {
                if (word === word.toUpperCase()) return word;
                const lower = word.toLowerCase();
                return this.lowercaseWords.includes(lower)
                    ? lower
                    : lower.charAt(0).toUpperCase() + lower.slice(1);
            })
            .join(' ');
    }
};

frappe.ui.form.on('Customer', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1);
        }

        // Save original field values
        if (!frm._original_values) {
            frm._original_values = {};
            frm.meta.fields.forEach(field => {
                if (["Data", "Small Text", "Text", "Long Text", "Text Editor"].includes(field.fieldtype)) {
                    frm._original_values[field.fieldname] = frm.doc[field.fieldname];
                }
            });
        }

        // Track shown popups
        frm._popup_shown_fields = {};
    },

    refresh(frm) {
        console.log("****************** Global Autocorrect Loaded ********************");
    },

    validate(frm) {
        if (!frm._popup_shown_fields) {
            frm._popup_shown_fields = {};
        }

        let changes = [];

        frm.meta.fields.forEach(field => {
            const fieldname = field.fieldname;

            if (["Data", "Small Text", "Text", "Long Text", "Text Editor"].includes(field.fieldtype)) {
                const old_val = frm._original_values[fieldname];
                const new_val = frm.doc[fieldname];

                // Agar is field ka popup pehle hi dikha chuka hai to skip kar do
                if (frm._popup_shown_fields[fieldname]) return;

                if (old_val && new_val && old_val !== new_val) {
                    const old_words = old_val.split(/\s+/);
                    const new_words = new_val.split(/\s+/);

                    old_words.forEach((word, idx) => {
                        if (new_words[idx] && word !== new_words[idx]) {
                            changes.push({
                                fieldname,
                                original: word,
                                corrected: new_words[idx]
                            });
                        }
                    });
                }
            }
        });

        if (changes.length > 0) {
            const change = changes[0];
            const fieldname = change.fieldname;

            // Mark popup as shown for this field
            frm._popup_shown_fields[fieldname] = true;

            frappe.confirm(
                `You corrected "<b>${change.original}</b>" to "<b>${change.corrected}</b>".<br><br>Do you want to add it to your Private Dictionary?`,
                () => {
                    frappe.call({
                        method: "validation.validation.doctype.private_dictionary.private_dictionary.add_to_dictionary",
                        args: {
                            original: change.original,
                            corrected: change.corrected
                        },
                        callback: () => {
                            frappe.show_alert("Word added to Private Dictionary!");
                            frm.reload_doc();
                        }
                    });
                },
                () => {
                    frappe.show_alert("Skipped adding to dictionary.");
                }
            );
        }
    }
,

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
                    frm.set_value("default_price_list", "INR Selling");

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

                            if (!frm.doc.accounts || frm.doc.accounts.length === 0) {
                                let row = frm.add_child("accounts");
                                row.company = company;

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
        FormHandler.handle(
            frm,
            'customer_name',
            'enable_customer_automation',
            (text) => TextFormatter.full(text, true),
            (text) => TextFormatter.realTime(text, true)
        );
    },

    customer_details: function(frm) {
        FormHandler.handle(
            frm,
            'customer_details',
            'enable_customer_automation',
            (text) => TextFormatter.full(text, false),
            (text) => TextFormatter.realTime(text, false)
        );
    },

    before_save: function(frm) {
        FormHandler.cleanup(frm, ['customer_name', 'customer_details']);

        if (frm.doc.custom_automate) {
            console.log("Before Save: Disabling custom_automate");
            frm.set_value('custom_automate', 0);
        }
    }
});

// ========== Legacy Functions (kept for compatibility) ==========

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

    const lowercaseWords = ['a', 'an',  'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'];
    let regex = allowNumbers ? /[^a-zA-Z0-9\s]/g : /[^a-zA-Z\s]/g;

    let formatted = name.replace(regex, '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[,\s]+$/, '')
        .replace(/\(/g, ' (');

    return formatted.split(' ').map(word => {
        if (word === word.toUpperCase()) return word;
        const lw = word.toLowerCase();
        if (lowercaseWords.includes(lw)) return lw;
        return lw.length >= 4 ? lw.charAt(0).toUpperCase() + lw.slice(1) : lw;
    }).join(' ');
}
