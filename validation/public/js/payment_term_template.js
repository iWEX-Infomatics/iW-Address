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

                    // After formatting, check for manual corrections
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

        return text
            .split(' ')
            .map((word, i) => {
                if (!word || word === word.toUpperCase()) return word;

                const lower = word.toLowerCase();

                if (this.lowercaseWords.includes(lower) && i !== 0) return lower;

                return lower.charAt(0).toUpperCase() + lower.slice(1);
            })
            .join(' ');
    },
    
    full(text, allowNumbers = false) {
        if (!text || text.endsWith(' ')) return text;

        const regex = allowNumbers ? /[^a-zA-Z0-9\s]/g : /[^a-zA-Z\s]/g;

        return text
            .replace(regex, '')                         // Remove unwanted characters
            .trim()                                     // Trim leading/trailing spaces
            .replace(/\s+/g, ' ')                       // Collapse multiple spaces
            .replace(/[,\s]+$/, '')                     // Remove trailing commas/spaces
            .replace(/\(/g, ' (')                       // Add space before "("
            .split(' ')                                 // Split into words
            .filter(word => word.length > 0)            // Remove empty entries
            .map((word, i) => {
                if (word === word.toUpperCase()) return word;  // Preserve acronyms

                const lower = word.toLowerCase();

                // Keep lowercaseWords lowercase (except first word)
                if (this.lowercaseWords.includes(lower) && i !== 0) return lower;

                // Capitalize everything else (no 4-char rule)
                return lower.charAt(0).toUpperCase() + lower.slice(1);
            })
            .join(' ');
    }
};

// Track original values on form load and refresh for manual correction detection
frappe.ui.form.on('Payment Terms Template', {
    onload(frm) {
        if (frm.is_new()) {
            console.log("New form - setting custom_automate to 1");
            frm.set_value('custom_automate', 1);
        }
        // Initialize original values store
        frm._original_values = {};
        // Initialize popup shown tracker
        frm._popup_shown_fields = {};
    },

    refresh(frm) {
        // Store original values for text fields to detect manual changes later
        frm._original_values['template_name'] = frm.doc.template_name;

        // Reset popup shown tracker on refresh so popup can appear again on fresh edits
        frm._popup_shown_fields = {};
    },


    // Using debounced FormHandler for template_name
    template_name(frm) {
        FormHandler.handle(
            frm, 
            'template_name', 
            'custom_payment_term_template', 
            (text) => TextFormatter.full(text, false), // allowNumbers = false
            (text) => TextFormatter.realTime(text, false)
        );
    },

    before_save(frm) {
        // Clean up any trailing spaces/commas before saving
        FormHandler.cleanup(frm, ['template_name']);
        
        if (frm.doc.custom_automate === 1) {
            console.log("Before save - disabling custom_automate");
            frm.set_value('custom_automate', 0);
            // No need to call frm.save() here — Frappe will save this on its own
        }
    }
});

// Check for manual corrections and ask user to add to Private Dictionary
function checkForManualCorrection(frm, fieldname) {
    if (!frm._original_values) return;
    if (!frm._popup_shown_fields) frm._popup_shown_fields = {};

    // Agar is field ke liye popup pehle hi dikh chuka hai to return
    if (frm._popup_shown_fields[fieldname]) return;

    const oldVal = frm._original_values[fieldname] || '';
    const newVal = frm.doc[fieldname] || '';

    if (oldVal && newVal && oldVal !== newVal) {
        const oldWords = oldVal.split(/\s+/);
        const newWords = newVal.split(/\s+/);

        for (let i = 0; i < oldWords.length; i++) {
            if (newWords[i] && oldWords[i] !== newWords[i]) {
                const original = oldWords[i];
                const corrected = newWords[i];

                // Mark popup as shown for this field
                frm._popup_shown_fields[fieldname] = true;

                frappe.confirm(
                    `You corrected "<b>${original}</b>" to "<b>${corrected}</b>".<br><br>Do you want to add it to your Private Dictionary?`,
                    () => {
                        frappe.call({
                            method: "validation.validation.doctype.private_dictionary.private_dictionary.add_to_dictionary",
                            args: { original, corrected },
                            callback: () => {
                                frappe.show_alert("Word added to Private Dictionary!");
                                // Update original values to avoid repeated popup
                                frm._original_values[fieldname] = newVal;
                            }
                        });
                    },
                    () => {
                        frappe.show_alert("Skipped adding to dictionary.");
                        // Update original values to avoid repeated popup
                        frm._original_values[fieldname] = newVal;
                    }
                );

                break; // Only one popup at a time
            }
        }
    }
}

