frappe.ui.form.on('Contact', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 0); // Set custom_automate to Enabled for new forms
        }

        check_automation_enabled(frm, function(is_enabled) {
            console.log("Automation enabled:", is_enabled);
        });
    },

    first_name: function(frm) {
        if (!frm.doc.custom_automate) {
            console.log("First Name trigger executed");
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    frm.set_value('first_name', format_name(frm.doc.first_name));
                    update_full_name(frm);
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping First Name trigger.");
        }
    },

    middle_name: function(frm) {
        if (!frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    frm.set_value('middle_name', format_name(frm.doc.middle_name));
                    update_full_name(frm);
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping Middle Name trigger.");
        }
    },

    last_name: function(frm) {
        if (!frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    frm.set_value('last_name', format_name(frm.doc.last_name));
                    update_full_name(frm);
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping Last Name trigger.");
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

function update_full_name(frm) {
    let full_name = [frm.doc.first_name, frm.doc.middle_name, frm.doc.last_name]
        .filter(name => name) // Remove undefined or null values
        .join(' ');
    frm.set_value('full_name', full_name);
}

function check_automation_enabled(frm, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: 'enable_contact_automation'
        },
        callback: function(response) {
            const is_enabled = response.message ? response.message : false;
            console.log("Automation enabled?", is_enabled);
            if (callback) callback(is_enabled);
        }
    });
}

