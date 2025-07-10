frappe.ui.form.on('Address', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1); //Enable custom_automate for new forms
        }

        check_automation_enabled(frm, function(is_enabled) {
            console.log("Script loaded, Automation enabled:", is_enabled);
        });

        if (!frm.doc.address_title && frm.doc.links) {
            let customer = frm.doc.links.find(link => link.link_doctype === "Customer");
            if (customer) {
                frm.set_value('address_title', customer.link_name);
            }
        }
    },
    
    address_line1: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    frm.set_value('address_line1', format_name(frm.doc.address_line1));
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping address_line1 trigger.");
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

    // New fields added here
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
                    const offices = r.message || [];

                    if (offices.length === 1) {
                        frm.set_value('custom_post_office', offices[0].post_office);
                        frm.set_value('custom_taluk', offices[0].taluk);
                        frm.set_value('state', offices[0].state);
                        frm.set_value('county', offices[0].district  + ' DT');
                    }
                    else if (offices.length > 1) {
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

    let formattedName = name.replace(/[^a-zA-Z\s]/g, ''); 
    formattedName = formattedName.trim().toLowerCase().replace(/\b(\w)/g, function(match) {
        return match.toUpperCase();
    });
    formattedName = formattedName.replace(/\s+/g, ' ');
    formattedName = formattedName.replace(/\(/g, ' (');

    return formattedName;
}

function check_automation_enabled(frm, callback) {
    frappe.call({
        method: 'frappe.client.get_value',
        args: {
            doctype: 'Automation Settings',
            fieldname: 'enable_address_automation'
        },
        callback: function(response) {
            const is_enabled = response.message ? response.message.enable_address_automation : false;
            callback(is_enabled);
        }
    });
}
