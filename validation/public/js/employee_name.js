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
            return this.lowercaseWords.includes(lower)
                ? lower
                : lower.charAt(0).toUpperCase() + lower.slice(1);
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

// Email formatting utilities
const EmailFormatter = {
    realTime(email) {
        if (!email) return email;
        return email.toLowerCase();
    },

    full(email) {
        if (!email) return '';
        return email
            .toLowerCase()
            .replace(/[^a-z0-9@._\-]/g, '')
            .replace(/\s+/g, '')
            .replace(/@{2,}/g, '@')
            .trim();
    }
};

frappe.ui.form.on('Employee', {

    onload(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1);
        }
        // Initialize original values object
        frm._original_values = {};
    },

    refresh(frm) {
        console.log("******************** Global Autocorrect Loaded ********************");

        // Save original values of text-like fields for comparison on validate
        frm._original_values = {};
        frm.meta.fields.forEach(field => {
            if (["Data", "Small Text", "Text", "Long Text", "Text Editor"].includes(field.fieldtype)) {
                frm._original_values[field.fieldname] = frm.doc[field.fieldname];
            }
        });

        if (frm.doc.custom_current_address) {
            frm.trigger('custom_current_address');
        }
        if (frm.doc.custom_permanent_address) {
            frm.trigger('custom_permanent_address');
        }
    },

    validate(frm) {
        // Detect corrections done manually by user
        let changes = [];

        frm.meta.fields.forEach(field => {
            if (["Data", "Small Text", "Text", "Long Text", "Text Editor"].includes(field.fieldtype)) {
                const old_val = frm._original_values[field.fieldname];
                const new_val = frm.doc[field.fieldname];

                if (old_val && new_val && old_val !== new_val) {
                    const old_words = old_val.split(/\s+/);
                    const new_words = new_val.split(/\s+/);

                    old_words.forEach((word, idx) => {
                        if (new_words[idx] && word !== new_words[idx]) {
                            changes.push({
                                original: word,
                                corrected: new_words[idx]
                            });
                        }
                    });
                }
            }
        });

        if (changes.length > 0) {
            const change = changes[0];  // only first correction
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
    },

    // Address fields display update
    custom_current_address(frm) {
        update_address_display(frm, 'custom_current_address', 'custom_address_display');
    },

    custom_permanent_address(frm) {
        update_address_display(frm, 'custom_permanent_address', 'custom_permanent_address_display');
    },

    // Debounced FormHandler for name fields
    first_name(frm) {
        FormHandler.handle(
            frm,
            'first_name',
            'enable_employee_automation',
            (text) => TextFormatter.full(text, false),
            (text) => TextFormatter.realTime(text, false)
        );
        setTimeout(() => update_employee_name(frm), 350);
    },

    middle_name(frm) {
        FormHandler.handle(
            frm,
            'middle_name',
            'enable_employee_automation',
            (text) => TextFormatter.full(text, false),
            (text) => TextFormatter.realTime(text, false)
        );
        setTimeout(() => update_employee_name(frm), 350);
    },

    last_name(frm) {
        FormHandler.handle(
            frm,
            'last_name',
            'enable_employee_automation',
            (text) => TextFormatter.full(text, false),
            (text) => TextFormatter.realTime(text, false)
        );
        setTimeout(() => update_employee_name(frm), 350);
    },

    // Debounced FormHandler for other text fields
    family_background(frm) {
        FormHandler.handle(
            frm,
            'family_background',
            'enable_employee_automation',
            (text) => TextFormatter.full(text, false),
            (text) => TextFormatter.realTime(text, false)
        );
    },

    health_details(frm) {
        FormHandler.handle(
            frm,
            'health_details',
            'enable_employee_automation',
            (text) => TextFormatter.full(text, false),
            (text) => TextFormatter.realTime(text, false)
        );
    },

    person_to_be_contacted(frm) {
        FormHandler.handle(
            frm,
            'person_to_be_contacted',
            'enable_employee_automation',
            (text) => TextFormatter.full(text, false),
            (text) => TextFormatter.realTime(text, false)
        );
    },

    relation(frm) {
        FormHandler.handle(
            frm,
            'relation',
            'enable_employee_automation',
            (text) => TextFormatter.full(text, false),
            (text) => TextFormatter.realTime(text, false)
        );
    },

    bio(frm) {
        FormHandler.handle(
            frm,
            'bio',
            'enable_employee_automation',
            (text) => TextFormatter.full(text, false),
            (text) => TextFormatter.realTime(text, false)
        );
    },

    // Debounced FormHandler for email fields
    personal_email(frm) {
        FormHandler.handle(
            frm,
            'personal_email',
            'enable_employee_automation',
            (email) => EmailFormatter.full(email),
            (email) => EmailFormatter.realTime(email)
        );
    },

    company_email(frm) {
        FormHandler.handle(
            frm,
            'company_email',
            'enable_employee_automation',
            (email) => EmailFormatter.full(email),
            (email) => EmailFormatter.realTime(email)
        );
    },

    // Employee number formatting (immediate, no debounce needed)
    employee_number(frm) {
        if (frm.doc.custom_automate === 1 && frm.doc.employee_number) {
            let corrected = frm.doc.employee_number
                .toUpperCase()
                .replace(/[^A-Z0-9\-\/]/g, '')
                .slice(0, 16);
            frm.set_value('employee_number', corrected);
        }
    },

    before_save(frm) {
        FormHandler.cleanup(frm, [
            'first_name', 'middle_name', 'last_name',
            'family_background', 'health_details',
            'person_to_be_contacted', 'relation', 'bio'
        ]);

        if (frm.doc.custom_automate) {
            console.log("Before Save: Disabling custom_automate");
            frm.set_value('custom_automate', 0);
        }
    }
});

// Helper functions
function update_address_display(frm, source_field, target_display_field) {
    const address_name = frm.doc[source_field];
    if (!address_name) {
        frm.set_value(target_display_field, '');
        return;
    }

    frappe.db.get_doc('Address', address_name)
        .then(address => {
            const parts = [
                address.address_line1,
                address.custom_post_office,
                address.custom_taluk,
                address.county,
                (address.city || '') + (address.state ? ', ' + address.state : ''),
                (address.country || '') + (address.pincode ? ' - ' + address.pincode : '')
            ];

            const formatted = parts.filter(part => part && part.trim()).join('\n');
            frm.set_value(target_display_field, formatted);
        })
        .catch(err => {
            console.log(`Error fetching address (${source_field}):`, err);
            frm.set_value(target_display_field, '');
        });
}

function update_employee_name(frm) {
    let full_name = [frm.doc.first_name, frm.doc.middle_name, frm.doc.last_name]
        .filter(Boolean)
        .join(' ');
    frm.set_value('employee_name', full_name);
}

// ========== Legacy Functions (kept for compatibility) ==========

function auto_format_field(frm, fieldname, callback) {
    if (frm.doc.custom_automate) {
        check_automation_enabled(frm, function(is_enabled) {
            if (is_enabled) {
                const formatted = format_name(frm.doc[fieldname]);
                frm.set_value(fieldname, formatted);
                if (typeof callback === 'function') callback(frm);
            }
        });
    }
}

function auto_format_email(frm, fieldname) {
    if (frm.doc.custom_automate && frm.doc[fieldname]) {
        check_automation_enabled(frm, function(is_enabled) {
            if (is_enabled) {
                const formatted_email = format_email(frm.doc[fieldname]);
                frm.set_value(fieldname, formatted_email);
            }
        });
    }
}

function format_email(email) {
    if (!email) return '';
    return email
        .toLowerCase()
        .replace(/[^a-z0-9@._\-]/g, '')
        .replace(/\s+/g, '')
        .replace(/@{2,}/g, '@')
        .trim();
}

function format_name(name) {
    if (!name) return '';
    const lowercaseWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'];

    return name
        .replace(/[^a-zA-Z\s]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[,\s]+$/, '')
        .replace(/\(/g, ' (')
        .split(' ')
        .map((word, index) => {
            if (word === word.toUpperCase()) return word;
            const lower = word.toLowerCase();
            return lowercaseWords.includes(lower)
                ? lower
                : lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
}

function check_automation_enabled(frm, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: 'enable_employee_automation'
        },
        callback: function(res) {
            const enabled = !!res.message;
            console.log("Automation enabled?", enabled);
            if (callback) callback(enabled);
        }
    });
}
