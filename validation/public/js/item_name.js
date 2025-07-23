// Helper function to get all automation settings in one call
function getAutomationSettings(callback) {
    frappe.call({
        method: 'frappe.client.get',
        args: {
            doctype: 'Settings for Automation',
            name: 'Settings for Automation' // Adjust this if your single doctype has a different name
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
                // Fallback to individual calls if single doc fetch fails
                console.log("Falling back to individual API calls for automation settings");
                getAutomationSettingsIndividual(callback);
            }
        }
    });
}

// Fallback function for individual API calls
function getAutomationSettingsIndividual(callback) {
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

// Unified formatting function
function formatText(text, isItemName = false) {
    if (!text) return '';

    const lowercaseWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'];
    
    // Remove unwanted characters (keep underscore for item_name)
    let formattedText = isItemName ? 
        text.replace(/[^a-zA-Z0-9\s\-_]/g, '') : 
        text.replace(/[^a-zA-Z0-9\s\-]/g, '');

    // Clean up spaces and punctuation
    formattedText = formattedText.trim().replace(/\s+/g, ' ');
    formattedText = formattedText.replace(/[,\s]+$/, '');
    formattedText = formattedText.replace(/\(/g, ' (');

    // Apply capitalization rules
    formattedText = formattedText.split(' ').map((word, index) => {
        // For non-item-name formatting, preserve all-uppercase words
        if (!isItemName && word === word.toUpperCase()) {
            return word;
        }

        const lowerWord = word.toLowerCase();

        // Keep small words lowercase (except first word for item names)
        if (lowercaseWords.includes(lowerWord) && !(isItemName && index === 0)) {
            return lowerWord;
        }

        // Capitalize words with 4+ characters, or all words for item names
        if (word.length >= 4 || isItemName) {
            return word.charAt(0).toUpperCase() + (isItemName ? word.slice(1) : lowerWord.slice(1));
        }

        return isItemName ? word : lowerWord;
    }).join(' ');

    return formattedText;
}

// Helper function to handle field formatting
function handleFieldFormatting(frm, fieldName, settingKey, isItemName = false) {
    if (!frm.doc.custom_automate) {
        console.log(`${fieldName} trigger activated but custom_automate is disabled. Skipping.`);
        return;
    }

    console.log(`${fieldName} trigger activated and custom_automate is enabled`);

    getAutomationSettings(function(settings) {
        console.log("Automation Settings:", settings);

        const shouldFormat = settings.enable_item_automation && !settings[settingKey];
        
        if (shouldFormat) {
            const originalValue = frm.doc[fieldName.toLowerCase().replace(' ', '_')];
            const formattedValue = formatText(originalValue, isItemName);
            console.log(`Formatted ${fieldName}:`, formattedValue);
            frm.set_value(fieldName.toLowerCase().replace(' ', '_'), formattedValue);
            console.log(`${fieldName} has been formatted and set.`);
        } else {
            console.log(`Skipping formatting. Either enable_item_automation is disabled or ${settingKey} is enabled.`);
        }
    });
}

// Helper functions for tax handling
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

// Main form handler
frappe.ui.form.on('Item', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate to enabled (1).");
            frm.set_value('custom_automate', 1);
        }
    },

    item_code: function(frm) {
        handleFieldFormatting(frm, 'Item Code', 'item_code_automation', false);
    },

    item_name: function(frm) {
        handleFieldFormatting(frm, 'Item Name', 'item_name_automation', true);
    },

    description: function(frm) {
        handleFieldFormatting(frm, 'Description', 'description_automation', false);
    },

    custom_item_tax_percentage: function(frm) {
        // Skip if automation is disabled
        if (!frm.doc.custom_automate) {
            console.log("Tax automation skipped - custom_automate is disabled");
            return;
        }

        console.log("custom_item_tax_percentage field changed!");
        const perc = frm.doc.custom_item_tax_percentage;
        console.log("Selected Tax Percentage:", perc);

        // Handle 0% tax case
        if (perc === '0%') {
            console.log("Handling 0% tax...");
            clearNonEmptyTaxRows(frm);
            return;
        }

        // Handle other tax percentages
        const taxPercentages = ['5%', '12%', '18%', '28%'];
        if (taxPercentages.includes(perc)) {
            console.log(`Handling ${perc} tax...`);
            setupTaxRows(frm, perc);
        }
    },

    validate: function(frm) {
        // Skip validation if automation is disabled
        if (!frm.doc.custom_automate) {
            console.log("Validation skipped - custom_automate is disabled");
            return;
        }

        console.log("Validating Item Defaults...");
        
        const itemDefaultsTable = frm.doc.item_defaults || [];

        // Add your validation logic here if needed
        /*
        itemDefaultsTable.forEach((row, index) => {
            if (!row.default_warehouse) {
                frappe.throw(__("Row {0}: Default Warehouse is mandatory.", [index + 1]));
            }
            if (!row.income_account) {
                frappe.throw(__("Row {0}: Income Account is mandatory.", [index + 1]));
            }
        });
        */

        frm.refresh_field('item_defaults');
    },

    before_save: function(frm) {
        // Disable automation after first save to prevent repeated processing
        if (frm.doc.custom_automate === 1) {
            console.log("After Save: Disabling custom_automate to prevent re-processing");
            frm.set_value('custom_automate', 0);
            // Note: Not saving again to avoid infinite loop
            // The flag will be saved with the next manual save
        }
    }
});
