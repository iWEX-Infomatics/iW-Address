// Global debounce handler - reusable across all forms
const FormHandler = {
    timeouts: {},
    lastValues: {},

    handle(frm, fieldname, automationField, formatFunction, realTimeFunction) {
        if (!frm.doc.custom_automate) return;

        const currentValue = frm.doc[fieldname] || '';

        this.checkAutomation(automationField, (enabled) => {
            if (enabled) {
                const formatted = realTimeFunction(currentValue);
                if (currentValue !== formatted) {
                    frm.set_value(fieldname, formatted);
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

    handleItemField(frm, fieldname, settingKey, formatFunction, realTimeFunction) {
        if (!frm.doc.custom_automate) return;

        const currentValue = frm.doc[fieldname] || '';

        this.getItemAutomationSettings((settings) => {
            const shouldFormat = settings.enable_item_automation && !settings[settingKey];
            if (shouldFormat) {
                const formatted = realTimeFunction(currentValue);
                if (currentValue !== formatted) {
                    frm.set_value(fieldname, formatted);
                    return;
                }
            }
        });

        clearTimeout(this.timeouts[fieldname]);
        this.timeouts[fieldname] = setTimeout(() => {
            this.getItemAutomationSettings((settings) => {
                const shouldFormat = settings.enable_item_automation && !settings[settingKey];
                if (shouldFormat) {
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
    },

    getItemAutomationSettings(callback) {
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Settings for Automation',
                name: 'Settings for Automation'
            },
            callback: function(response) {
                if (response.message) {
                    callback({
                        enable_item_automation: response.message.enable_item_automation || 0,
                        item_code_automation: response.message.item_code_automation || 0,
                        item_name_automation: response.message.item_name_automation || 0,
                        description_automation: response.message.description_automation || 0
                    });
                } else {
                    FormHandler.getItemAutomationSettingsIndividual(callback);
                }
            }
        });
    },

    getItemAutomationSettingsIndividual(callback) {
        const settings = {};
        const fields = ['enable_item_automation', 'item_code_automation', 'item_name_automation', 'description_automation'];
        let completed = 0;

        fields.forEach(field => {
            frappe.call({
                method: 'frappe.client.get_single_value',
                args: {
                    doctype: 'Settings for Automation',
                    field: field
                },
                callback: function(response) {
                    settings[field] = response.message || 0;
                    completed++;
                    if (completed === fields.length) {
                        callback(settings);
                    }
                }
            });
        });
    }
};

// Text formatting utilities for Item
const ItemTextFormatter = {
    lowercaseWords: ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'],

    realTime(text, isItemName = false) {
        if (!text || text.endsWith(' ')) return text;

        return text.split(' ').map((word, index) => {
            if (!word) return word;
            if (!isItemName && word === word.toUpperCase()) return word;

            const lowerWord = word.toLowerCase();

            if (this.lowercaseWords.includes(lowerWord) && !(isItemName && index === 0)) {
                return lowerWord;
            }

            if (word.length >= 4 || isItemName) {
                return word.charAt(0).toUpperCase() + (isItemName ? word.slice(1) : lowerWord.slice(1));
            }

            return isItemName ? word : lowerWord;
        }).join(' ');
    },

    full(text, isItemName = false) {
        if (!text || text.endsWith(' ')) return text;

        let formattedText = isItemName ? 
            text.replace(/[^a-zA-Z0-9\s\-_]/g, '') : 
            text.replace(/[^a-zA-Z0-9\s\-]/g, '');

        formattedText = formattedText.trim().replace(/\s+/g, ' ');
        formattedText = formattedText.replace(/[,\s]+$/, '');
        formattedText = formattedText.replace(/\(/g, ' (');

        return formattedText
            .split(' ')
            .filter(word => word.length > 0)
            .map((word, index) => {
                if (!isItemName && word === word.toUpperCase()) return word;

                const lowerWord = word.toLowerCase();

                if (this.lowercaseWords.includes(lowerWord) && !(isItemName && index === 0)) {
                    return lowerWord;
                }

                return word.charAt(0).toUpperCase() + (isItemName ? word.slice(1) : lowerWord.slice(1));
            })
            .join(' ');
    }
};

// Store original values
let original_values = {};

// Main form events
frappe.ui.form.on('Item', {
    onload(frm) {
        if (frm.is_new()) {
            frm.set_value('custom_automate', 1);
        }

        original_values = {};
        ['item_code', 'item_name', 'description'].forEach(field => {
            original_values[field] = frm.doc[field] || '';
        });

        frm._popup_shown_fields = {};
        frm._correction_checked = false;  // ✅ Reset lock
    },

    refresh(frm) {
        ['item_code', 'item_name', 'description'].forEach(field => {
            original_values[field] = frm.doc[field] || '';
        });

        frm._popup_shown_fields = {};
        frm._correction_checked = false;  // ✅ Reset lock
    },

    item_code(frm) {
        FormHandler.handleItemField(
            frm, 
            'item_code', 
            'item_code_automation',
            (text) => ItemTextFormatter.full(text, false),
            (text) => ItemTextFormatter.realTime(text, false)
        );
    },

    item_name(frm) {
        FormHandler.handleItemField(
            frm, 
            'item_name', 
            'item_name_automation',
            (text) => ItemTextFormatter.full(text, true),
            (text) => ItemTextFormatter.realTime(text, true)
        );

        setTimeout(() => {
            if (frm.doc.item_name) {
                frm.set_value('description', frm.doc.item_name);
            }
        }, 350);
    },

    description(frm) {
        FormHandler.handleItemField(
            frm, 
            'description', 
            'description_automation',
            (text) => ItemTextFormatter.full(text, false),
            (text) => ItemTextFormatter.realTime(text, false)
        );
    },

    item_group(frm) {
        frm.set_value("is_stock_item", frm.doc.item_group === "Services" ? 0 : 1);
    },

    custom_item_tax_percentage(frm) {
        if (!frm.doc.custom_automate) return;

        const perc = frm.doc.custom_item_tax_percentage;
        if (perc === '0%') {
            clearNonEmptyTaxRows(frm);
            return;
        }

        const taxPercentages = ['5%', '12%', '18%', '28%'];
        if (taxPercentages.includes(perc)) {
            setupTaxRows(frm, perc);
        }
    },

    validate(frm) {
        if (!frm.doc.custom_automate) return;
        frm.refresh_field('item_defaults');
    },

    before_save(frm) {
        FormHandler.cleanup(frm, ['item_code', 'item_name', 'description']);

        if (frm.doc.custom_automate === 1) {
            frm.set_value('custom_automate', 0);
        }

        // ✅ Only run once per save cycle
        if (!frm._correction_checked) {
            ['item_code', 'item_name', 'description'].forEach(field => {
                checkForManualCorrection(frm, field);
            });
            frm._correction_checked = true;  // Lock it
        }
    }
});

// Private Dictionary Popup Handler
function checkForManualCorrection(frm, fieldname) {
    if (!frm._popup_shown_fields) frm._popup_shown_fields = {};
    if (frm._popup_shown_fields[fieldname]) return;

    const oldVal = original_values[fieldname] || '';
    const newVal = frm.doc[fieldname] || '';

    if (oldVal && newVal && oldVal !== newVal) {
        const oldWords = oldVal.split(/\s+/);
        const newWords = newVal.split(/\s+/);

        for (let i = 0; i < Math.min(oldWords.length, newWords.length); i++) {
            if (oldWords[i] !== newWords[i]) {
                const originalWord = oldWords[i];
                const correctedWord = newWords[i];

                frm._popup_shown_fields[fieldname] = true; // ✅ block repeat

                frappe.confirm(
                    `You changed "<b>${originalWord}</b>" to "<b>${correctedWord}</b>" in <b>${fieldname.replace('_',' ')}</b>.<br><br>Do you want to add this to your Private Dictionary?`,
                    () => {
                        frappe.call({
                            method: "validation.validation.doctype.private_dictionary.private_dictionary.add_to_dictionary",
                            args: {
                                original: originalWord,
                                corrected: correctedWord
                            },
                            callback: () => {
                                frappe.show_alert("Added to Private Dictionary");
                                original_values[fieldname] = frm.doc[fieldname];
                            }
                        });
                    },
                    () => {
                        original_values[fieldname] = frm.doc[fieldname];
                    }
                );
                break;
            }
        }
    }
}


// Tax setup
function clearNonEmptyTaxRows(frm) {
    const taxTable = frm.doc.taxes || [];
    for (let i = taxTable.length - 1; i >= 0; i--) {
        if (taxTable[i].field_name !== '') {
            frm.get_field("taxes").grid.grid_rows[i].remove();
        }
    }
}

function setupTaxRows(frm, percentage) {
    frm.clear_table("taxes");
    frm.refresh_field("taxes");

    const taxCategories = [
        'In-State',
        'Out-State',
        'Reverse Charge In-State',
        'Reverse Charge Out-State'
    ];

    taxCategories.forEach(category => {
        const child = frm.add_child("taxes");
        child.item_tax_template = `GST ${percentage} - AT`;
        child.tax_category = category;
    });

    frm.refresh_field("taxes");
}
