// ----------------- Global Debounce Handler -----------------
const FormHandler = {
    timeouts: {},
    lastValues: {},

    handle(frm, fieldname, automationField, formatFunction, realTimeFunction) {
        if (!frm.doc.custom_automate) return;

        const currentValue = frm.doc[fieldname] || '';

        // Real-time formatting
        this.checkAutomation(automationField, enabled => {
            if (enabled) {
                const formatted = realTimeFunction(currentValue);
                if (currentValue !== formatted) {
                    return frm.set_value(fieldname, formatted);
                }
            }
        });

        // Debounced formatting
        clearTimeout(this.timeouts[fieldname]);
        this.timeouts[fieldname] = setTimeout(() => {
            this.checkAutomation(automationField, enabled => {
                if (!enabled) return;

                const valueToFormat = frm.doc[fieldname] || '';
                if (this.lastValues[fieldname] === valueToFormat) return;

                const formatted = formatFunction(valueToFormat);
                this.lastValues[fieldname] = formatted;

                if (valueToFormat !== formatted) {
                    frm.set_value(fieldname, formatted);
                }

                checkForManualCorrection(frm, fieldname);
            });
        }, 300);
    },

    cleanup(frm, fields) {
        Object.values(this.timeouts).forEach(clearTimeout);
        this.timeouts = {};

        fields.forEach(fieldname => {
            const cleaned = (frm.doc[fieldname] || '').replace(/[,\s]+$/, '').trim();
            if (frm.doc[fieldname] !== cleaned) {
                frm.set_value(fieldname, cleaned);
            }
        });
    },

    checkAutomation(field, callback) {
        frappe.call({
            method: 'frappe.client.get_single_value',
            args: { doctype: 'Settings for Automation', field },
            callback: res => callback(Boolean(res.message))
        });
    }
};

// ----------------- Text Formatting Utilities -----------------
const TextFormatter = {
    lowercaseWords: ['a','an','the','and','but','or','for','nor','on','at','to','from','by','in','of','with'],

    realTime(text) {
        if (!text || text.endsWith(' ')) return text;
        return this.capitalizeWords(text.split(' '));
    },

    full(text, allowNumbers = false) {
        if (!text || text.endsWith(' ')) return text;

        const regex = allowNumbers ? /[^a-zA-Z0-9\s]/g : /[^a-zA-Z\s]/g;
        const cleaned = text
            .replace(regex, '')
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[,\s]+$/, '')
            .replace(/\(/g, ' (');

        return this.capitalizeWords(cleaned.split(' ').filter(Boolean));
    },

    capitalizeWords(words) {
        return words.map((word, index) => {
            if (word === word.toUpperCase()) return word;
            const lower = word.toLowerCase();
            if (this.lowercaseWords.includes(lower) && index !== 0) return lower;
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        }).join(' ');
    }
};

// ----------------- Form Events -----------------
frappe.ui.form.on('Terms and Conditions', {
    onload(frm) {
        if (frm.is_new()) {
            console.log("New form - setting custom_automate to 1");
            frm.set_value('custom_automate', 1);
        }
        frm._original_values = {};
        frm._popup_shown_fields = {};
    },

    refresh(frm) {
        ['title', 'terms'].forEach(field => {
            frm._original_values[field] = frm.doc[field];
        });
    },

    title(frm) {
        FormHandler.handle(
            frm, 'title', 'custom_terms_and_conditions',
            text => TextFormatter.full(text, false),
            text => TextFormatter.realTime(text, false)
        );
    },

    terms(frm) {
        FormHandler.handle(
            frm, 'terms', 'custom_terms_and_conditions',
            text => TextFormatter.full(text, false),
            text => TextFormatter.realTime(text, false)
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

// ----------------- Manual Correction & Dictionary Popup -----------------
function checkForManualCorrection(frm, fieldname) {
    if (!frm._original_values || frm._popup_shown_fields?.[fieldname]) return;

    const oldVal = frm._original_values[fieldname] || '';
    const newVal = frm.doc[fieldname] || '';

    if (oldVal && newVal && oldVal !== newVal) {
        const oldWords = oldVal.split(/\s+/);
        const newWords = newVal.split(/\s+/);

        for (let i = 0; i < oldWords.length; i++) {
            if (newWords[i] && oldWords[i] !== newWords[i]) {
                const original = oldWords[i], corrected = newWords[i];
                frm._popup_shown_fields[fieldname] = true;

                frappe.confirm(
                    `You corrected "<b>${original}</b>" to "<b>${corrected}</b>".<br><br>Do you want to add it to your Private Dictionary?`,
                    () => {
                        frappe.call({
                            method: "validation.validation.doctype.private_dictionary.private_dictionary.add_to_dictionary",
                            args: { original, corrected },
                            callback: () => {
                                frappe.show_alert("Word added to Private Dictionary!");
                                frm._original_values[fieldname] = newVal;
                            }
                        });
                    },
                    () => {
                        frappe.show_alert("Skipped adding to dictionary.");
                        frm._original_values[fieldname] = newVal;
                    }
                );
                break;
            }
        }
    }
}
