frappe.ui.form.on('Item Group', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1); // Enabled custom_automate for new forms
        }
    },

    item_group_name: function(frm) {
        if (frm.doc.custom_automate) {
            console.log("Item Group Name trigger activated and custom_automate is disabled");
            check_automation_enabled(frm, function(is_enabled) {
                console.log("Automation check result:", is_enabled);
                if (is_enabled) {
                    const formatted_name = format_name(frm.doc.item_group_name);
                    console.log("Formatted Name:", formatted_name);
                    frm.set_value('item_group_name', formatted_name);
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

    let formattedName = name.replace(/[^a-zA-Z\s]/g, '');

    formattedName = formattedName.trim().toLowerCase().replace(/\s+/g, ' ');
    formattedName = formattedName.replace(/\(/g, ' (');

    formattedName = formattedName.split(' ').map(word => {
        if (word.length >= 3) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }
        return word;
    }).join(' ');

    return formattedName;
}

function check_automation_enabled(frm, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: 'enable_item_group_automation'
        },
        callback: function(response) {
            const is_enabled = response.message ? response.message : false;
            console.log("Automation enabled?", is_enabled);
            if (callback) callback(is_enabled);
        }
    });
}
