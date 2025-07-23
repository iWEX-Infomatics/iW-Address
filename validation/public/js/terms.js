frappe.ui.form.on('Terms and Conditions', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1); // Enable for new forms
        }
    },

    title: function(frm) {
        handle_automation_for_field(frm, 'title');
    },

    terms: function(frm) {
        handle_automation_for_field(frm, 'terms');
    },

    before_save: function(frm) {
        if (frm.doc.custom_automate) {
            console.log("Before Save: Enabling custom_automate");
            frm.set_value('custom_automate', 0);

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

// Reusable helper function for title and terms field
function handle_automation_for_field(frm, fieldname) {
    if (frm.doc.custom_automate) {
        console.log(`${fieldname} trigger activated and custom_automate is disabled`);
        check_automation_enabled(frm, function(is_enabled) {
            console.log("Automation check result:", is_enabled);
            if (is_enabled) {
                const formatted_value = format_name(frm.doc[fieldname]);
                console.log(`Formatted ${fieldname}:`, formatted_value);
                frm.set_value(fieldname, formatted_value);
            }
        });
    } else {
        console.log(`custom_automate is enabled. Skipping ${fieldname} trigger.`);
    }
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

function check_automation_enabled(frm, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: 'custom_terms_and_conditions'
        },
        callback: function(response) {
            const is_enabled = response.message ? response.message : false;
            console.log("Automation enabled?", is_enabled);
            if (callback) callback(is_enabled);
        }
    });
}
