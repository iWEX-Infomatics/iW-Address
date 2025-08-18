// ===== Global debounce handler - reusable across all forms =====
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
                    this.lastValues[fieldname] = formatted;
                    if (valueToFormat !== formatted) {
                        frm.set_value(fieldname, formatted);
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
        if (!callback) return;
        frappe.call({
            method: 'frappe.client.get_single_value',
            args: { doctype: 'Settings for Automation', field },
            callback: (res) => callback(!!res.message)
        });
    }
};

// ===== Text formatting utilities =====
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
            .filter(Boolean)
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

// ===== Item Group Events =====
frappe.ui.form.on('Item Group', {
    onload(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1);
        }
    },

    item_group_name(frm) {
        FormHandler.handle(
            frm,
            'item_group_name',
            'enable_item_group_automation',
            (text) => TextFormatter.full(text, false),
            (text) => TextFormatter.realTime(text, false)
        );
    },

    before_save(frm) {
        FormHandler.cleanup(frm, ['item_group_name']);
        if (frm.doc.custom_automate) {
            console.log("Before Save: Disabling custom_automate");
            frm.set_value('custom_automate', 0);
        }
    }
});

// ===== Compatibility function wrappers =====
function is_automation_allowed(frm, setting_field, callback) {
    if (!frm.doc.custom_automate) {
        console.log(`custom_automate is not enabled. Skipping automation.`);
        return;
    }
    FormHandler.checkAutomation(setting_field, (enabled) => {
        if (enabled) {
            console.log("Automation is enabled.");
            callback && callback();
        } else {
            console.log("Automation is disabled via settings.");
        }
    });
}

function format_name(name) {
    return TextFormatter.full(name || '', false);
}
