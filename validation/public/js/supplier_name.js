frappe.ui.form.on('Supplier', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 0); // Disable custom_automate for new forms
        }
    },

    supplier_name: function(frm) {
        if (!frm.doc.custom_automate) {
            console.log("Supplier Name trigger activated and custom_automate is disabled");
            check_automation_enabled(frm, function(is_enabled) {
                console.log("Automation check result:", is_enabled);
                if (is_enabled) {
                    const formatted_name = format_name(frm.doc.supplier_name);
                    console.log("Formatted Name:", formatted_name);
                    frm.set_value('supplier_name', formatted_name);
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping Supplier Name trigger.");
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

function format_name(name) {
    if (!name) return '';

    console.log("Formatting name:", name);

    // Remove all characters except letters, spaces, and hyphens
    let formattedName = name.replace(/[^a-zA-Z\s\-]/g, ''); // Keep letters, spaces, and hyphens

    // Trim, lowercase, capitalize the first letter of each word, and remove extra spaces
    formattedName = formattedName.trim().toLowerCase().replace(/\b(\w)/g, function(match) {
        return match.toUpperCase();
    });

    // Remove any extra spaces between words
    formattedName = formattedName.replace(/\s+/g, ' ');

    console.log("Formatted name:", formattedName);

    return formattedName;
}

function check_automation_enabled(frm, callback) {
    console.log("Checking automation enabled status");
    frappe.call({
        method: 'frappe.client.get_value',
        args: {
            doctype: 'Automation Settings',
            fieldname: 'enable_supplier_automation'
        },
        callback: function(response) {
            console.log("Automation Settings response:", response);
            const is_enabled = response.message ? response.message.enable_supplier_automation : false;
            callback(is_enabled);
        }
    });
}
