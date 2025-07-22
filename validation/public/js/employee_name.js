frappe.ui.form.on('Employee', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1); // Set custom_automate to Enabled for new forms
        }

        check_automation_enabled(frm, function(is_enabled) {
            console.log("Automation enabled:", is_enabled);
        });
    },
    custom_current_address: function(frm) {
        console.log("Triggered custom_current_address with value: ", frm.doc.custom_current_address);

        if (!frm.doc.custom_current_address) {
            frm.set_value('custom_address_display', '');
            return;
        }

        frappe.db.get_doc('Address', frm.doc.custom_current_address)
            .then(address => {
                console.log("Fetched address: ", address);

                const parts = [
                    address.address_line1,
                    address.custom_post_office,
                    address.custom_taluk,
                    address.county,
                    (address.city || '') + (address.state ? ', ' + address.state : ''),
                    (address.country || '') + (address.pincode ? ' - ' + address.pincode : '')
                ];

                const formatted = parts
                    .filter(part => part && part.trim())  // Remove empty/null
                    .join('\n');

                frm.set_value('custom_address_display', formatted);
            })
            .catch(err => {
                console.log("Error fetching address: ", err);
                frm.set_value('custom_address_display', '');
            });
    },
    custom_permanent_address: function(frm) {
        console.log("Triggered custom_permanent_address with value: ", frm.doc.custom_permanent_address);

        if (!frm.doc.custom_permanent_address) {
            frm.set_value('custom_permanent_address_display', '');
            return;
        }

        frappe.db.get_doc('Address', frm.doc.custom_permanent_address)
            .then(address => {
                console.log("Fetched address: ", address);

                const parts = [
                    address.address_line1,
                    address.custom_post_office,
                    address.custom_taluk,
                    address.county,
                    (address.city || '') + (address.state ? ', ' + address.state : ''),
                    (address.country || '') + (address.pincode ? ' - ' + address.pincode : '')
                ];

                const formatted = parts
                    .filter(part => part && part.trim())  // Remove empty/null
                    .join('\n');

                frm.set_value('custom_permanent_address_display', formatted);
            })
            .catch(err => {
                console.log("Error fetching address: ", err);
                frm.set_value('custom_permanent_address_display', '');
            });
    },

    refresh: function(frm) {
        if (frm.doc.custom_current_address) {
            frm.trigger('custom_current_address');
        }
        if (frm.doc.custom_permanent_address) {
            frm.trigger('custom_permanent_address');
        }
    },
    first_name: function(frm) {
        if (frm.doc.custom_automate) {
            console.log("First Name trigger executed");
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    frm.set_value('first_name', format_name(frm.doc.first_name));
                    update_employee_name(frm);
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping First Name trigger.");
        }
    },

    middle_name: function(frm) {
        if (frm.doc.custom_automate) {
            console.log("Middle Name trigger executed");
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    frm.set_value('middle_name', format_name(frm.doc.middle_name));
                    update_employee_name(frm);
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping Middle Name trigger.");
        }
    },

    last_name: function(frm) {
        if (frm.doc.custom_automate) {
            console.log("Last Name trigger executed");
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    frm.set_value('last_name', format_name(frm.doc.last_name));
                    update_employee_name(frm);
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping Last Name trigger.");
        }
    },

    family_background: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    const formatted_name = format_name(frm.doc.family_background);
                    frm.set_value('family_background', formatted_name);
                }
            });
        } else {
            console.log("custom_automate is enabled.  Customer Name trigger.");
        }
    },

    health_details: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    const formatted_name = format_name(frm.doc.health_details);
                    frm.set_value('health_details', formatted_name);
                }
            });
        } else {
            console.log("custom_automate is enabled.  Customer Name trigger.");
        }
    },
    person_to_be_contacted: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    const formatted_name = format_name(frm.doc.person_to_be_contacted);
                    frm.set_value('person_to_be_contacted', formatted_name);
                }
            });
        } else {
            console.log("custom_automate is enabled.  Customer Name trigger.");
        }
    },
    relation: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    const formatted_name = format_name(frm.doc.relation);
                    frm.set_value('relation', formatted_name);
                }
            });
        } else {
            console.log("custom_automate is enabled.  Customer Name trigger.");
        }
    },
    bio: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    const formatted_name = format_name(frm.doc.bio);
                    frm.set_value('bio', formatted_name);
                }
            });
        } else {
            console.log("custom_automate is enabled.  Customer Name trigger.");
        }
    },
    employee_number: function(frm) {
        if (frm.doc.custom_automate === 1) {
            
           
            let corrected_batch_id = frm.doc.employee_number
                .toUpperCase()  
                .replace(/[^A-Z0-9\-\/]/g, '') 
                .slice(0, 16); 
            
            frm.set_value('employee_number', corrected_batch_id);
        }
    },
    personal_email: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled && frm.doc.personal_email) {
                    const formatted_email = format_email(frm.doc.personal_email);
                    frm.set_value('personal_email', formatted_email);
                }
            });
        } else {
            console.log("custom_automate is disabled. Skipping Personal Email trigger.");
        }
    },
    company_email: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled && frm.doc.company_email) {
                    const formatted_email = format_email(frm.doc.company_email);
                    frm.set_value('company_email', formatted_email);
                }
            });
        } else {
            console.log("custom_automate is disabled. Skipping Company Email trigger.");
        }
    },

    // after_save: function(frm) {
    //     if (!frm.doc.custom_automate) {
    //         console.log("After Save: Enabling custom_automate");
    //         frm.set_value('custom_automate', 1); // Enable custom_automate after the first save

    //         // Save the form again to persist the change
    //         frm.save()
    //             .then(() => {
    //                 console.log("custom_automate has been enabled and saved.");
    //             })
    //             .catch((error) => {
    //                 console.error("Error while saving the form after enabling custom_automate:", error);
    //             });
    //     }
    // }
});

function format_email(email) {
    if (!email) return '';
    return email
    .toLowerCase()
    .replace(/[^a-z0-9@._\-]/g, '')  // Keep only valid characters for email
    .replace(/\s+/g, '')              // Remove spaces
    .replace(/@{2,}/g, '@')           // Replace multiple @ with single @
    .trim();
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


function update_employee_name(frm) {
    let employee_name = [frm.doc.first_name, frm.doc.middle_name, frm.doc.last_name]
        .filter(name => name) // Remove undefined or null values
        .join(' ');
    frm.set_value('employee_name', employee_name);
}

function check_automation_enabled(frm, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: 'enable_employee_automation'
        },
        callback: function(response) {
            const is_enabled = response.message ? response.message : false;
            console.log("Automation enabled?", is_enabled);
            if (callback) callback(is_enabled);
        }
    });
}
