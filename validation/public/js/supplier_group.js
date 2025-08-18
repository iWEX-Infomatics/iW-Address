// ======================= Utility: Debounce Form Handler =======================
const FormHandler = {
    timeouts: {},
    lastValues: {},

    handle(frm, fieldname, automationField, formatFn, realtimeFn) {
        if (!frm.doc.custom_automate) return;

        const currentValue = frm.doc[fieldname] || '';

        // Realtime formatting
        this.checkAutomation(automationField, (enabled) => {
            if (enabled) {
                const formatted = realtimeFn(currentValue);
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
                if (!enabled) return;

                const valueToFormat = frm.doc[fieldname] || '';
                if (this.lastValues[fieldname] === valueToFormat) return;

                const formatted = formatFn(valueToFormat);
                this.lastValues[fieldname] = formatted;
                if (valueToFormat !== formatted) {
                    frm.set_value(fieldname, formatted);
                }
            });
        }, 300);
    },

    cleanup(frm, fields) {
        Object.values(this.timeouts).forEach(clearTimeout);
        this.timeouts = {};

        fields.forEach((field) => {
            const value = frm.doc[field];
            if (value) {
                const cleaned = value.replace(/[,\s]+$/, '').trim();
                if (value !== cleaned) frm.set_value(field, cleaned);
            }
        });
    },

    checkAutomation(field, callback) {
        frappe.call({
            method: 'frappe.client.get_single_value',
            args: {
                doctype: 'Settings for Automation',
                field
            },
            callback: (res) => callback(!!res.message)
        });
    }
};

// ======================= Utility: Text Formatting =======================
const TextFormatter = {
    lowercaseWords: [
        'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor',
        'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'
    ],

    capitalizeWord(word, index) {
        if (word === word.toUpperCase()) return word; // Acronyms
        const lower = word.toLowerCase();
        return (this.lowercaseWords.includes(lower) && index !== 0)
            ? lower
            : lower.charAt(0).toUpperCase() + lower.slice(1);
    },

    realTime(text) {
        if (!text || text.endsWith(' ')) return text;
        return text.split(' ').map((w, i) => this.capitalizeWord(w, i)).join(' ');
    },

    full(text, allowNumbers = false) {
        if (!text) return '';
        const regex = allowNumbers ? /[^a-zA-Z0-9\s]/g : /[^a-zA-Z\s]/g;

        return text
            .replace(regex, '')
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[,\s]+$/, '')
            .replace(/\(/g, ' (')
            .split(' ')
            .filter(Boolean)
            .map((w, i) => this.capitalizeWord(w, i))
            .join(' ');
    }
};

// ======================= Supplier Group Form Script =======================
frappe.ui.form.on('Supplier Group', {
    onload(frm) {
        if (frm.is_new()) {
            frm.set_value('custom_automate', 1);
        }
    },

    supplier_group_name(frm) {
        FormHandler.handle(
            frm,
            'supplier_group_name',
            'custom_supplier_group',
            (txt) => TextFormatter.full(txt, false),
            (txt) => TextFormatter.realTime(txt)
        );
    },

    before_save(frm) {
        FormHandler.cleanup(frm, ['supplier_group_name']);
        if (frm.doc.custom_automate === 1) {
            frm.set_value('custom_automate', 0);
        }
    }
});
