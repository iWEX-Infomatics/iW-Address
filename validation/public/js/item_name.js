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

    // Special handler for Item automation with complex settings
    handleItemField(frm, fieldname, settingKey, formatFunction, realTimeFunction) {
        if (!frm.doc.custom_automate) return;

        const currentValue = frm.doc[fieldname] || '';

        // Real-time formatting
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

        // Debounced full formatting
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
                    console.log("Falling back to individual API calls for automation settings");
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

            // For non-item-name formatting, preserve all-uppercase words
            if (!isItemName && word === word.toUpperCase()) {
                return word;
            }

            const lowerWord = word.toLowerCase();

            // Keep small words lowercase (except first word for item names)
            if (this.lowercaseWords.includes(lowerWord) && !(isItemName && index === 0)) {
                return lowerWord;
            }

            // Capitalize words with 4+ characters, or all words for item names
            if (word.length >= 4 || isItemName) {
                return word.charAt(0).toUpperCase() + (isItemName ? word.slice(1) : lowerWord.slice(1));
            }

            return isItemName ? word : lowerWord;
        }).join(' ');
    },

    full(text, isItemName = false) {
        if (!text || text.endsWith(' ')) return text;

        // Remove unwanted characters (keep underscore for item_name)
        let formattedText = isItemName ? 
            text.replace(/[^a-zA-Z0-9\s\-_]/g, '') : 
            text.replace(/[^a-zA-Z0-9\s\-]/g, '');

        // Clean up spaces and punctuation
        formattedText = formattedText.trim().replace(/\s+/g, ' ');
        formattedText = formattedText.replace(/[,\s]+$/, '');
        formattedText = formattedText.replace(/\(/g, ' (');

        // Apply capitalization rules
        return formattedText
            .split(' ')
            .filter(word => word.length > 0)
            .map((word, index) => {
                // For non-item-name formatting, preserve all-uppercase words
                if (!isItemName && word === word.toUpperCase()) {
                    return word;
                }

                const lowerWord = word.toLowerCase();

                // Keep small words lowercase (except first word for item names)
                if (this.lowercaseWords.includes(lowerWord) && !(isItemName && index === 0)) {
                    return lowerWord;
                }

                // Capitalize all words (no length condition)
                return word.charAt(0).toUpperCase() + (isItemName ? word.slice(1) : lowerWord.slice(1));
            })
            .join(' ');
    }
};

// Variables to store original values for manual correction detection
let original_values = {};

// Main form events
frappe.ui.form.on('Item', {
    onload(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate to enabled (1).");
            frm.set_value('custom_automate', 1);
        }
        // Store original values on load
        original_values = {};
        ['item_code', 'item_name', 'description'].forEach(field => {
            original_values[field] = frm.doc[field] || '';
        });
    },

    refresh(frm) {
        // Update original values on refresh too
        ['item_code', 'item_name', 'description'].forEach(field => {
            original_values[field] = frm.doc[field] || '';
        });
    },

    item_code(frm) {
        FormHandler.handleItemField(
            frm, 
            'item_code', 
            'item_code_automation',
            (text) => ItemTextFormatter.full(text, false),
            (text) => ItemTextFormatter.realTime(text, false)
        );
        checkForManualCorrection(frm, 'item_code');
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
        checkForManualCorrection(frm, 'item_name');
    },

    description(frm) {
        FormHandler.handleItemField(
            frm, 
            'description', 
            'description_automation',
            (text) => ItemTextFormatter.full(text, false),
            (text) => ItemTextFormatter.realTime(text, false)
        );
        checkForManualCorrection(frm, 'description');
    },

    // Add your other triggers here (item_group, custom_item_tax_percentage, validate, before_save)
    item_group(frm) {
        if (frm.doc.item_group === "Services") {
            frm.set_value("is_stock_item", 0);
        } else {
            frm.set_value("is_stock_item", 1);
        }
    },

    custom_item_tax_percentage(frm) {
        if (!frm.doc.custom_automate) {
            console.log("Tax automation skipped - custom_automate is disabled");
            return;
        }

        console.log("custom_item_tax_percentage field changed!");
        const perc = frm.doc.custom_item_tax_percentage;
        console.log("Selected Tax Percentage:", perc);

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
        if (!frm.doc.custom_automate) {
            console.log("Validation skipped - custom_automate is disabled");
            return;
        }

        console.log("Validating Item Defaults...");
        frm.refresh_field('item_defaults');
    },

    before_save(frm) {
        FormHandler.cleanup(frm, ['item_code', 'item_name', 'description']);
        if (frm.doc.custom_automate === 1) {
            console.log("Before Save: Disabling custom_automate to prevent re-processing");
            frm.set_value('custom_automate', 0);
        }
    }
});

// Manual correction detection and popup for adding to Private Dictionary
function checkForManualCorrection(frm, fieldname) {
    const oldVal = original_values[fieldname] || '';
    const newVal = frm.doc[fieldname] || '';

    if (oldVal && newVal && oldVal !== newVal) {
        const oldWords = oldVal.split(/\s+/);
        const newWords = newVal.split(/\s+/);

        for (let i = 0; i < Math.min(oldWords.length, newWords.length); i++) {
            if (oldWords[i] !== newWords[i]) {
                const originalWord = oldWords[i];
                const correctedWord = newWords[i];

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
                                original_values[fieldname] = frm.doc[fieldname]; // update to avoid repeat popup
                            }
                        });
                    },
                    () => {
                        original_values[fieldname] = frm.doc[fieldname]; // update anyway to avoid repeat popup
                    }
                );
                break;
            }
        }
    }
}

// Tax helper functions
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
