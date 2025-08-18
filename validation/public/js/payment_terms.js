// ---------- Global Debounce & Formatting Handler ----------
const FormHandler = {
    timeouts: {},
    lastValues: {},

    handle(frm, fieldname, automationField, formatFn, realTimeFn) {
        if (!frm.doc.custom_automate) return;
        const val = frm.doc[fieldname] || '';

        // Real-time formatting
        this.checkAutomation(automationField, enabled => {
            if (enabled) {
                const rtFormatted = realTimeFn(val);
                if (val !== rtFormatted) return frm.set_value(fieldname, rtFormatted);
            }
        });

        // Debounced full formatting
        clearTimeout(this.timeouts[fieldname]);
        this.timeouts[fieldname] = setTimeout(() => {
            this.checkAutomation(automationField, enabled => {
                if (!enabled) return;
                const newVal = frm.doc[fieldname] || '';
                if (this.lastValues[fieldname] === newVal) return;

                const formatted = formatFn(newVal);
                this.lastValues[fieldname] = formatted;
                if (newVal !== formatted) frm.set_value(fieldname, formatted);

                checkForManualCorrection(frm, fieldname);
            });
        }, 300);
    },

    cleanup(frm, fields) {
        Object.values(this.timeouts).forEach(clearTimeout);
        this.timeouts = {};
        fields.forEach(f => {
            const val = frm.doc[f];
            if (val) {
                const cleaned = val.replace(/[,\s]+$/, '').trim();
                if (val !== cleaned) frm.set_value(f, cleaned);
            }
        });
    },

    checkAutomation(field, cb) {
        frappe.call({
            method: 'frappe.client.get_single_value',
            args: { doctype: 'Settings for Automation', field },
            callback: res => cb(!!res.message)
        });
    }
};

// ---------- Text Formatting ----------
const TextFormatter = {
    lowercaseWords: ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'],

    realTime(text, allowNumbers = false) {
        if (!text || text.endsWith(' ')) return text;
        return text.split(' ').map((word, i) => {
            if (!word || word === word.toUpperCase()) return word;
            const lower = word.toLowerCase();
            return (this.lowercaseWords.includes(lower) && i !== 0)
                ? lower
                : lower.charAt(0).toUpperCase() + lower.slice(1);
        }).join(' ');
    },

    full(text, allowNumbers = false) {
        if (!text || text.endsWith(' ')) return text;
        const regex = allowNumbers ? /[^a-zA-Z0-9\s]/g : /[^a-zA-Z\s]/g;
        return text.replace(regex, '')
            .trim().replace(/\s+/g, ' ').replace(/[,\s]+$/, '')
            .replace(/\(/g, ' (')
            .split(' ')
            .filter(Boolean)
            .map((word, i) => {
                if (word === word.toUpperCase()) return word;
                const lower = word.toLowerCase();
                return (this.lowercaseWords.includes(lower) && i !== 0)
                    ? lower
                    : lower.charAt(0).toUpperCase() + lower.slice(1);
            })
            .join(' ');
    }
};

// ---------- Payment Term Form Logic ----------
frappe.ui.form.on('Payment Term', {
    onload(frm) {
        if (frm.is_new()) frm.set_value('custom_automate', 1);
        frm._original_values = {};
        frm._popup_shown_fields = {};
    },

    refresh(frm) {
        ['payment_term_name', 'description'].forEach(f => {
            frm._original_values[f] = frm.doc[f];
        });
        frm._popup_shown_fields = {};
    },

    payment_term_name(frm) {
        FormHandler.handle(frm, 'payment_term_name', 'custom_payment_term',
            t => TextFormatter.full(t, false),
            t => TextFormatter.realTime(t, false)
        );
    },

    description(frm) {
        FormHandler.handle(frm, 'description', 'custom_payment_term',
            t => TextFormatter.full(t, false),
            t => TextFormatter.realTime(t, false)
        );
    },

    before_save(frm) {
        FormHandler.cleanup(frm, ['payment_term_name', 'description']);
        if (frm.doc.custom_automate === 1) frm.set_value('custom_automate', 0);
    }
});

// ---------- Manual Correction Popup ----------
function checkForManualCorrection(frm, fieldname) {
    if (!frm._original_values || frm._popup_shown_fields[fieldname]) return;
    const oldVal = frm._original_values[fieldname] || '';
    const newVal = frm.doc[fieldname] || '';
    if (!oldVal || !newVal || oldVal === newVal) return;

    const oldWords = oldVal.split(/\s+/);
    const newWords = newVal.split(/\s+/);

    for (let i = 0; i < oldWords.length; i++) {
        if (newWords[i] && oldWords[i] !== newWords[i]) {
            frm._popup_shown_fields[fieldname] = true;
            frappe.confirm(
                `You corrected "<b>${oldWords[i]}</b>" to "<b>${newWords[i]}</b>".<br><br>Do you want to add it to your Private Dictionary?`,
                () => {
                    frappe.call({
                        method: "validation.validation.doctype.private_dictionary.private_dictionary.add_to_dictionary",
                        args: { original: oldWords[i], corrected: newWords[i] },
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
