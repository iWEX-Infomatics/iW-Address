frappe.ui.form.on('Payment Term', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1); // Enabled custom_automate for new forms
        }
    },

    payment_term_name: function(frm) {
        if (frm.doc.custom_automate) {
            console.log("Item Group Name trigger activated and custom_automate is disabled");
            check_automation_enabled(frm, function(is_enabled) {
                console.log("Automation check result:", is_enabled);
                if (is_enabled) {
                    const formatted_name = format_name(frm.doc.payment_term_name);
                    console.log("Formatted Name:", formatted_name);
                    frm.set_value('payment_term_name', formatted_name);
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping Item Group Name trigger.");
        }
    },
    description: function(frm) {
        if (frm.doc.custom_automate) {
            console.log("Item Group Name trigger activated and custom_automate is disabled");
            check_automation_enabled(frm, function(is_enabled) {
                console.log("Automation check result:", is_enabled);
                if (is_enabled) {
                    const formatted_name = format_name(frm.doc.description);
                    console.log("Formatted Name:", formatted_name);
                    frm.set_value('description', formatted_name);
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping Item Group Name trigger.");
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

    let formattedName = name.replace(/[\.-\/,0-9]/g, '');
    formattedName = formattedName.trim().toLowerCase().replace(/\b(\w)/g, function(match) {
        return match.toUpperCase();
    });
    formattedName = formattedName.replace(/\s+/g, ' ');
    formattedName = formattedName.replace(/\(/g, ' (');

    return formattedName;
}

function check_automation_enabled(frm, callback) {
    console.log("Checking automation enabled status");
    frappe.call({
        method: 'frappe.client.get_value',
        args: {
            doctype: 'Automation Settings',
            fieldname: 'custom_payment_term'
        },
        callback: function(response) {
            console.log("Automation Settings response:", response);
            const is_enabled = response.message ? response.message.custom_payment_term : false;
            callback(is_enabled);
        }
    });
}
