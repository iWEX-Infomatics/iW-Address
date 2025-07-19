frappe.ui.form.on('Item', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1); // Enabled custom_automate for new forms
        }
    },

    item_code: function(frm) {
        if (frm.doc.custom_automate) {
            console.log("ItemCode trigger activated and custom_automate is disabled");

            check_item_automation_settings(function(settings) {
                console.log("Automation Settings:", settings);
                
                if (settings.enable_item_automation && !settings.item_code_automation) {
                    const formatted_name = format_name(frm.doc.item_code);
                    console.log("Formatted Name:", formatted_name);
                    frm.set_value('item_code', formatted_name);
                } else {
                    console.log("Skipping formatting. Because either enable_item_automation is disabled or item_code_automation is enabled.");
                }
            });

        } else {
            console.log("custom_automate is enabled. Skipping Item Code trigger.");
        }
    },
    item_name: function(frm) {
        if (frm.doc.custom_automate) {
            console.log("Item Name trigger activated and custom_automate is enabled");

            check_item_automation_settings(function(settings) {
                console.log("Automation Settings:", settings);

                if (settings.enable_item_automation && !settings.item_name_automation) {
                    const formatted_name = format_item_name(frm.doc.item_name);
                    console.log("Formatted Item Name:", formatted_name);
                    frm.set_value('item_name', formatted_name);
                } else {
                    console.log("Skipping formatting. Because either enable_item_automation is disabled or item_name_automation is enabled.");
                }
            });

        } else {
            console.log("custom_automate is disabled. Skipping Item Name trigger.");
        }
    },

    description: function(frm) {
        if (frm.doc.custom_automate) {
            console.log("Description trigger activated and custom_automate is enabled");

            check_item_automation_settings(function(settings) {
                console.log("Automation Settings:", settings);

                if (settings.enable_item_automation && !settings.description_automation) {
                    const formatted_name = format_name(frm.doc.description);
                    console.log("Formatted Description:", formatted_name);
                    frm.set_value('description', formatted_name);
                } else {
                    console.log("Skipping formatting. Because either enable_item_automation is disabled or description_automation is enabled.");
                }
            });

        } else {
            console.log("custom_automate is disabled. Skipping Description trigger.");
        }
    },
    after_save: function(frm) {
        if (!frm.doc.custom_automate) {
            console.log("After Save: Enabling custom_automate");
            frm.set_value('custom_automate', 1); // Enable custom_automate after the first save

            // Save the form again to persist the change
            frm.save()
                .then(() => {
                    console.log("custom_automate has been enabled and saved.");
                })
                .catch((error) => {
                    console.error("Error while saving the form after enabling custom_automate:", error);
                });
        }
    }
});


async function format_item_name(name) {
    if (!name) return '';

    // Wait for 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    const lowercaseWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'];

    // Allow only letters, numbers, spaces, and hyphens
    let formattedName = name.replace(/[^a-zA-Z0-9\s\-]/g, '');

    // Trim start/end, normalize spaces
    formattedName = formattedName.trim().replace(/\s+/g, ' ');

    // Remove trailing comma or space
    formattedName = formattedName.replace(/[,\s]+$/, '');

    // Add space before opening bracket if needed
    formattedName = formattedName.replace(/\(/g, ' (');

    formattedName = formattedName.split(' ').map((word, index) => {
        if (word === word.toUpperCase()) {
            return word;
        }

        const lowerWord = word.toLowerCase();

        if (lowercaseWords.includes(lowerWord)) {
            return lowerWord;
        } else if (word.length >= 4) {
            return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
        }

        return lowerWord;
    }).join(' ');

    return formattedName;
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

        if (lowercaseWords.includes(lowerWord)) {
            return lowerWord;
        } else if (word.length >= 4) {
            return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
        }

        return lowerWord;
    }).join(' ');

    return formattedName;
}


function check_item_automation_settings(callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: 'enable_item_automation'
        },
        callback: function(response1) {
            const enable_item_automation = response1.message ? response1.message : 0;

            frappe.call({
                method: 'frappe.client.get_single_value',
                args: {
                    doctype: 'Settings for Automation',
                    field: 'item_code_automation'
                },
                callback: function(response2) {
                    const item_code_automation = response2.message ? response2.message : 0;

                    frappe.call({
                        method: 'frappe.client.get_single_value',
                        args: {
                            doctype: 'Settings for Automation',
                            field: 'item_name_automation'
                        },
                        callback: function(response3) {
                            const item_name_automation = response3.message ? response3.message : 0;

                            frappe.call({
                                method: 'frappe.client.get_single_value',
                                args: {
                                    doctype: 'Settings for Automation',
                                    field: 'description_automation'
                                },
                                callback: function(response4) {
                                    const description_automation = response4.message ? response4.message : 0;

                                    callback({
                                        enable_item_automation: enable_item_automation,
                                        item_code_automation: item_code_automation,
                                        item_name_automation: item_name_automation,
                                        description_automation: description_automation
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}


