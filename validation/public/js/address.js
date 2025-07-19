frappe.ui.form.on('Address', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1);
        }

        check_automation_enabled(frm, function(is_enabled) {
            console.log("Script loaded, Automation enabled:", is_enabled);
        });

        // Trigger setting address title on load
        frm.trigger('set_address_title');
    },

    city: function(frm) {
        frm.trigger('set_address_title');
    },

    links_on_form_rendered: function(frm) {
        frm.trigger('set_address_title');
    },

    set_address_title: function(frm) {
        if (frm.doc.address_title || !frm.doc.city || !frm.doc.links || !frm.doc.links.length) {
            return;
        }

        const city = frm.doc.city;
        const customer = frm.doc.links.find(link => link.link_doctype === "Customer");
        const supplier = frm.doc.links.find(link => link.link_doctype === "Supplier");

        if (customer) {
            frm.set_value('address_title', `${city} - ${customer.link_name}`);
        } else if (supplier) {
            frm.set_value('address_title', `${city} - ${supplier.link_name}`);
        }
    },

    address_line1: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    let formatted = format_address_line1(frm.doc.address_line1);
                    frm.set_value('address_line1', formatted);
                }
            });
        } else {
            console.log("custom_automate is disabled. Skipping address_line1 trigger.");
        }
    },


    city: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    frm.set_value('city', format_name(frm.doc.city));
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping city trigger.");
        }
    },
    address_title: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    frm.set_value('address_title', format_name(frm.doc.address_title));
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping address_title trigger.");
        }
    },
    custom_post_office: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    frm.set_value('custom_post_office', format_name(frm.doc.custom_post_office));
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping custom_post_office trigger.");
        }
    },

    custom_taluk: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    frm.set_value('custom_taluk', format_name(frm.doc.custom_taluk));
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping custom_taluk trigger.");
        }
    },
    state: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    frm.set_value('state', format_name(frm.doc.state));
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping state trigger.");
        }
    },
    pincode: function(frm) {
        console.log("Pincode changed. Checking for post office automation.");
        if (!frm.doc.pincode) {
            frm.set_value('custom_post_office', '');
            frm.set_value('custom_taluk', '');
            return;
        }
        if (frm.doc.custom_automate !== 1) {
            return;
        }        
        if (frm.doc.country === 'India' && frm.doc.pincode.length === 6) {
            frappe.call({
                method: 'validation.customization.address.get_post_offices_api',
                args: { pincode: frm.doc.pincode },
                callback: function(r) {
                    if (!r || r.exc || !Array.isArray(r.message)) {
                        return;
                    }
                    console.log("Post office API response:", r.message);
                    const offices = r.message || [];
                    console.log("Post offices fetched:", offices);

                    if (offices.length === 1) {
                        console.log("Single post office found:", offices[0]);
                        frm.set_value('custom_post_office', offices[0].post_office);
                        frm.set_value('custom_taluk', offices[0].taluk);
                        frm.set_value('state', offices[0].state);
                        frm.set_value('county', offices[0].district  + ' DT');
                    }
                    else if (offices.length > 1) {
                        console.log("Multiple post offices found:", offices);
                        let options = offices.map((o, i) => {
                            return { label: o.post_office, value: i };
                        });

                        let d = new frappe.ui.Dialog({
                            title: 'Select Post Office',
                            fields: [
                                {
                                    label: 'Post Office',
                                    fieldname: 'selected_po',
                                    fieldtype: 'Select',
                                    options: options
                                }
                            ],
                            primary_action_label: 'Insert',
                            primary_action(values) {
                                if (values.selected_po === undefined || values.selected_po === '') {
                                    frappe.msgprint('Please select a Post Office.');
                                    return;
                                }
                                const sel = offices[parseInt(values.selected_po)];
                                frm.set_value('custom_post_office', sel.post_office);
                                frm.set_value('custom_taluk', sel.taluk);
                                frm.set_value('state', sel.state);
                                frm.set_value('county', sel.district + ' DT');
                                d.hide();
                            }
                        });

                        d.show();
                    }
                    else {
                            frappe.msgprint('No Post Office found for this Pincode');
                    }
                }
            });
        }
    }
,
before_save: function(frm) {
    if (!frm.doc.custom_automate && !frm._auto_updated) {
        console.log("Before Save: Enabling custom_automate only once");
        frm.set_value('custom_automate', 1);
        frm._auto_updated = true; 
    }
}

})


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


function format_address_line1(name) {
    if (!name) return '';

    const lowercaseWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'];

    // Allow only A-Z, a-z, 0-9, space, # , / - ( )
    let formattedName = name.replace(/[^a-zA-Z0-9\s#(),\/-]/g, '');

    // Trim, normalize spaces, and remove trailing comma/space
    formattedName = formattedName.trim().replace(/\s+/g, ' ');
    formattedName = formattedName.replace(/[,\s]+$/, '');  // <-- added line

    // Capitalization logic
    formattedName = formattedName.split(' ').map((word, index) => {
        if (word === word.toUpperCase()) {
            // Preserve acronyms like "DLF", "USA"
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
            field: 'enable_address_automation'
        },
        callback: function(response) {
            const is_enabled = response.message ? response.message : false;
            console.log("Automation enabled?", is_enabled);
            if (callback) callback(is_enabled);
        }
    });
}