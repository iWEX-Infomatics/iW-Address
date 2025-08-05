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
        
        return text.split(' ').map((word, index) => {
            if (!word || word === word.toUpperCase()) return word;
            const lower = word.toLowerCase();
            if (this.lowercaseWords.includes(lower) && index !== 0) return lower;
            return word.length >= 4 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
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
                return word.length >= 4 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
            })
            .join(' ');
    }
};

frappe.ui.form.on('Supplier Group', {
    onload(frm) {
        if (frm.is_new()) {
            console.log("New form - setting custom_automate to 1");
            frm.set_value('custom_automate', 1);
        }
    },

    // Using debounced FormHandler for supplier_group_name
    supplier_group_name(frm) {
        FormHandler.handle(
            frm, 
            'supplier_group_name', 
            'custom_supplier_group', 
            (text) => TextFormatter.full(text, false), // allowNumbers = false
            (text) => TextFormatter.realTime(text, false)
        );
    },

    before_save(frm) {
        // Clean up any trailing spaces/commas before saving
        FormHandler.cleanup(frm, ['supplier_group_name']);
        
        if (frm.doc.custom_automate === 1) {
            console.log("Before save - disabling custom_automate");
            frm.set_value('custom_automate', 0);
            // No need to force save manually — Frappe will handle saving
        }
    }
});

// ========== Legacy Functions (kept for compatibility) ==========

function handleFormattingAutomation(frm, fieldName, automationField) {
    if (!frm.doc.custom_automate) {
        console.log(`custom_automate is disabled — skipping ${fieldName}`);
        return;
    }

    checkAutomationEnabled(automationField, (isEnabled) => {
        if (isEnabled) {
            const original = frm.doc[fieldName];
            const formatted = formatText(original);
            frm.set_value(fieldName, formatted);
            console.log(`Formatted ${fieldName}:`, formatted);
        }
    });
}

function formatText(text) {
    if (!text) return '';

    const lowercaseWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'];

    return text
        .replace(/[^a-zA-Z\s]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[,\s]+$/, '')
        .replace(/\(/g, ' (')
        .split(' ')
        .map((word, index) => {
            if (word === word.toUpperCase()) return word;
            const lower = word.toLowerCase();
            if (lowercaseWords.includes(lower) && index !== 0) return lower;
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
}

function checkAutomationEnabled(fieldName, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: fieldName
        },
        callback(res) {
            const isEnabled = !!res.message;
            console.log(`${fieldName} automation enabled?`, isEnabled);
            if (callback) callback(isEnabled);
        }
    });
}