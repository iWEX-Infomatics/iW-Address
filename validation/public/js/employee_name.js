// ===== Constants =====
const TEXT_FIELD_TYPES = ["Data", "Small Text", "Text", "Long Text", "Text Editor"];
const LOWERCASE_WORDS = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'];

// ===== Utility Objects =====
const FormHandler = {
    timeouts: {},
    lastValues: {},

    handle(frm, fieldname, automationField, formatFunction, realTimeFunction) {
        if (!frm.doc.custom_automate) return;
        const val = frm.doc[fieldname] || '';

        this.checkAutomation(automationField, (enabled) => {
            if (enabled) {
                const rtFormatted = realTimeFunction(val);
                if (val !== rtFormatted) {
                    frm.set_value(fieldname, rtFormatted);
                    return;
                }
            }
        });

        clearTimeout(this.timeouts[fieldname]);
        this.timeouts[fieldname] = setTimeout(() => {
            this.checkAutomation(automationField, (enabled) => {
                if (enabled) {
                    const valueToFormat = frm.doc[fieldname] || '';
                    if (this.lastValues[fieldname] === valueToFormat) return;
                    const formatted = formatFunction(valueToFormat);
                    this.lastValues[fieldname] = formatted;
                    if (valueToFormat !== formatted) frm.set_value(fieldname, formatted);
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

    checkAutomation(field, cb) {
        frappe.call({
            method: 'frappe.client.get_single_value',
            args: { doctype: 'Settings for Automation', field },
            callback: (res) => cb(!!res.message)
        });
    }
};

const TextFormatter = {
    realTime(text) {
        if (!text || text.endsWith(' ')) return text;
        return text.split(' ').map(word => {
            if (!word || word === word.toUpperCase()) return word;
            const lower = word.toLowerCase();
            return LOWERCASE_WORDS.includes(lower)
                ? lower
                : lower.charAt(0).toUpperCase() + lower.slice(1);
        }).join(' ');
    },
    full(text) {
        if (!text || text.endsWith(' ')) return text;
        return text
            .replace(/[^a-zA-Z\s]/g, '')
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[,\s]+$/, '')
            .replace(/\(/g, ' (')
            .split(' ')
            .filter(Boolean)
            .map(word => {
                if (word === word.toUpperCase()) return word;
                const lower = word.toLowerCase();
                return LOWERCASE_WORDS.includes(lower)
                    ? lower
                    : lower.charAt(0).toUpperCase() + lower.slice(1);
            }).join(' ');
    }
};

const EmailFormatter = {
    realTime: (email) => email ? email.toLowerCase() : email,
    full(email) {
        return (email || '')
            .toLowerCase()
            .replace(/[^a-z0-9@._\-]/g, '')
            .replace(/\s+/g, '')
            .replace(/@{2,}/g, '@')
            .trim();
    }
};

// ===== Helper Functions =====
function update_address_display(frm, source_field, target_display_field) {
    const address_name = frm.doc[source_field];
    if (!address_name) return frm.set_value(target_display_field, '');
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
            frm.set_value(target_display_field, parts.filter(Boolean).join('\n'));
        })
        .catch(() => frm.set_value(target_display_field, ''));
}

function update_employee_name(frm) {
    frm.set_value('employee_name', [frm.doc.first_name, frm.doc.middle_name, frm.doc.last_name].filter(Boolean).join(' '));
}

function addPrivateDictionary(original, corrected) {
    frappe.call({
        method: "validation.validation.doctype.private_dictionary.private_dictionary.add_to_dictionary",
        args: { original, corrected },
        callback: () => frappe.show_alert("Word added to Private Dictionary!")
    });
}

// ===== Field Configurations =====
const textFields = [
    'first_name', 'middle_name', 'last_name',
    'family_background', 'health_details',
    'person_to_be_contacted', 'relation', 'bio'
];
const emailFields = ['personal_email', 'company_email'];

// ===== Main Form Events =====
frappe.ui.form.on('Employee', {
    onload(frm) {
        if (frm.is_new()) frm.set_value('custom_automate', 1);
        frm._original_values = {};
    },

    refresh(frm) {
        frm._original_values = {};
        frm.meta.fields.forEach(f => {
            if (TEXT_FIELD_TYPES.includes(f.fieldtype))
                frm._original_values[f.fieldname] = frm.doc[f.fieldname];
        });
        if (frm.doc.custom_current_address) frm.trigger('custom_current_address');
        if (frm.doc.custom_permanent_address) frm.trigger('custom_permanent_address');
    },

    validate(frm) {
        frm._popup_shown_fields = frm._popup_shown_fields || {};
        let changes = [];
        frm.meta.fields.forEach(field => {
            if (!TEXT_FIELD_TYPES.includes(field.fieldtype)) return;
            const fieldname = field.fieldname;
            if (frm._popup_shown_fields[fieldname]) return;
            const old_val = frm._original_values[fieldname];
            const new_val = frm.doc[fieldname];
            if (old_val && new_val && old_val !== new_val) {
                const old_words = old_val.split(/\s+/);
                const new_words = new_val.split(/\s+/);
                old_words.forEach((word, idx) => {
                    if (new_words[idx] && word !== new_words[idx]) {
                        changes.push({ fieldname, original: word, corrected: new_words[idx] });
                    }
                });
            }
        });

        if (changes.length) {
            const { fieldname, original, corrected } = changes[0];
            frm._popup_shown_fields[fieldname] = true;
            frappe.confirm(
                `You corrected "<b>${original}</b>" to "<b>${corrected}</b>".<br><br>Do you want to add it to your Private Dictionary?`,
                () => addPrivateDictionary(original, corrected),
                () => frappe.show_alert("Skipped adding to dictionary.")
            );
        }
    },

    custom_current_address(frm) {
        update_address_display(frm, 'custom_current_address', 'custom_address_display');
    },
    custom_permanent_address(frm) {
        update_address_display(frm, 'custom_permanent_address', 'custom_permanent_address_display');
    },

    employee_number(frm) {
        if (frm.doc.custom_automate && frm.doc.employee_number) {
            frm.set_value('employee_number',
                frm.doc.employee_number.toUpperCase().replace(/[^A-Z0-9\-\/]/g, '').slice(0, 16)
            );
        }
    },

    before_save(frm) {
        FormHandler.cleanup(frm, textFields);
        if (frm.doc.custom_automate) frm.set_value('custom_automate', 0);
    }
});

// ===== Bind Format Handlers Dynamically =====
textFields.forEach(field => {
    frappe.ui.form.on('Employee', {
        [field](frm) {
            FormHandler.handle(frm, field, 'enable_employee_automation',
                TextFormatter.full, TextFormatter.realTime);
            if (['first_name', 'middle_name', 'last_name'].includes(field))
                setTimeout(() => update_employee_name(frm), 350);
        }
    });
});

emailFields.forEach(field => {
    frappe.ui.form.on('Employee', {
        [field](frm) {
            FormHandler.handle(frm, field, 'enable_employee_automation',
                EmailFormatter.full, EmailFormatter.realTime);
        }
    });
});
