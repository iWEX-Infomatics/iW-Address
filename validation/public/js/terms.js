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

                    // Check manual correction after formatting
                    checkForManualCorrection(frm, fieldname);
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

frappe.ui.form.on('Terms and Conditions', {
    onload(frm) {
        if (frm.is_new()) {
            console.log("New form - setting custom_automate to 1");
            frm.set_value('custom_automate', 1);
        }
        frm._original_values = {};
    },

    refresh(frm) {
        // Store original values to detect manual edits
        frm._original_values['title'] = frm.doc.title;
        frm._original_values['terms'] = frm.doc.terms;
    },

    title(frm) {
        FormHandler.handle(
            frm,
            'title',
            'custom_terms_and_conditions',
            (text) => TextFormatter.full(text, false),
            (text) => TextFormatter.realTime(text, false)
        );
    },

    terms(frm) {
        FormHandler.handle(
            frm,
            'terms',
            'custom_terms_and_conditions',
            (text) => TextFormatter.full(text, false),
            (text) => TextFormatter.realTime(text, false)
        );
    },

    before_save(frm) {
        FormHandler.cleanup(frm, ['title', 'terms']);

        if (frm.doc.custom_automate === 1) {
            console.log("Before save - disabling custom_automate");
            frm.set_value('custom_automate', 0);
        }
    }
});

// Manual correction detection and popup for Private Dictionary
function checkForManualCorrection(frm, fieldname) {
    if (!frm._original_values) return;

    const oldVal = frm._original_values[fieldname] || '';
    const newVal = frm.doc[fieldname] || '';

    if (oldVal && newVal && oldVal !== newVal) {
        const oldWords = oldVal.split(/\s+/);
        const newWords = newVal.split(/\s+/);

        for (let i = 0; i < oldWords.length; i++) {
            if (newWords[i] && oldWords[i] !== newWords[i]) {
                const original = oldWords[i];
                const corrected = newWords[i];

                frappe.confirm(
                    `You corrected "<b>${original}</b>" to "<b>${corrected}</b>".<br><br>Do you want to add it to your Private Dictionary?`,
                    () => {
                        frappe.call({
                            method: "validation.validation.doctype.private_dictionary.private_dictionary.add_to_dictionary",
                            args: { original, corrected },
                            callback: () => {
                                frappe.show_alert("Word added to Private Dictionary!");
                                frm._original_values[fieldname] = newVal; // update to avoid repeat popup
                            }
                        });
                    },
                    () => {
                        frappe.show_alert("Skipped adding to dictionary.");
                        frm._original_values[fieldname] = newVal; // update to avoid repeat popup
                    }
                );

                break; // only one popup per change
            }
        }
    }
}

// ========== Legacy Functions (kept for compatibility) ==========

function handle_automation_for_field(frm, fieldname) {
    if (frm.doc.custom_automate) {
        console.log(`${fieldname} trigger activated and custom_automate is disabled`);
        check_automation_enabled(frm, function(is_enabled) {
            console.log("Automation check result:", is_enabled);
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

function format_name(name) {
    if (!name) return '';

    const lowercaseWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'];

    let formattedName = name.replace(/[^a-zA-Z\s]/g, '');
    formattedName = formattedName.trim().replace(/\s+/g, ' ');
    formattedName = formattedName.replace(/[,\s]+$/, '');
    formattedName = formattedName.replace(/\(/g, ' (');

    formattedName = formattedName.split(' ').map((word, index) => {
        if (word === word.toUpperCase()) {
            return word;
        }

        const lowerWord = word.toLowerCase();

        if (lowercaseWords.includes(lowerWord) && index !== 0) {
            return lowerWord;
        }

        return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
    }).join(' ');

    return formattedName;
}

function check_automation_enabled(frm, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: 'custom_terms_and_conditions'
        },
        callback: function(response) {
            const is_enabled = response.message ? response.message : false;
            console.log("Automation enabled?", is_enabled);
            if (callback) callback(is_enabled);
        }
    });
}
