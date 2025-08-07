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

const TextFormatter = {
    lowercaseWords: ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'],
    
    realTime(text) {
        if (!text || text.endsWith(' ')) return text;
        
        return text.split(' ').map(word => {
            if (!word || word === word.toUpperCase()) return word;
            const lower = word.toLowerCase();
            return this.lowercaseWords.includes(lower)
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

frappe.ui.form.on('Bank Account', {
    onload(frm) {
        // Set automation flag on new docs
        if (frm.is_new()) frm.set_value('custom_automate', 1);

        // Capture original values on load
        if (!frm._original_values) {
            frm._original_values = {};
            frm.meta.fields.forEach(field => {
                if (["Data", "Small Text", "Text", "Long Text", "Text Editor"].includes(field.fieldtype)) {
                    frm._original_values[field.fieldname] = frm.doc[field.fieldname];
                }
            });
        }

        // Track which fields have shown the popup already
        if (!frm._popup_shown_fields) {
            frm._popup_shown_fields = {};
        }
    },

    account_name: (frm) => FormHandler.handle(frm, 'account_name', 'enable_bank_automation', TextFormatter.full.bind(TextFormatter), TextFormatter.realTime.bind(TextFormatter)),

    validate(frm) {
        // Autocorrect change detection and prompt
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
        const change = changes[0];
        const fieldname = frm.meta.fields.find(f => {
            const old_val = frm._original_values[f.fieldname];
            const new_val = frm.doc[f.fieldname];
            return old_val && new_val && old_val.includes(change.original) && new_val.includes(change.corrected);
        })?.fieldname;

        if (fieldname && frm._popup_shown_fields?.[fieldname]) return;

        if (fieldname) frm._popup_shown_fields[fieldname] = true;

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

    before_save(frm) {
        FormHandler.cleanup(frm, ['account_name']);
        frm.set_value('custom_automate', 0);
    }
});
