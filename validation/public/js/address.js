frappe.ui.form.on('Address', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 0); // Disable custom_automate for new forms
        }

        check_automation_enabled(frm, function(is_enabled) {
            console.log("Script loaded, Automation enabled:", is_enabled);
        });
    },
    address_line1: function(frm) {
        if (!frm.doc.custom_automate) {
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
        if (!frm.doc.custom_automate) {
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
        if (!frm.doc.custom_automate) {
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
        if (!frm.doc.custom_automate) {
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
        if (!frm.doc.custom_automate) {
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
    if (frm.doc.country === 'India' && frm.doc.pincode) {
        frappe.call({
            method: 'validation.customization.address.get_post_offices',
            args: { pincode: frm.doc.pincode },
            callback: function(r) {
                const offices = r.message || [];

                if (offices.length === 1) {
                    frm.set_value('custom_post_office', offices[0].post_office);
                    frm.set_value('custom_taluk',       offices[0].taluk);
                    frm.set_value('state',       offices[0].state);
                    frm.set_value('county',      offices[0].district);
                    // frappe.msgprint(`Post Office set to ${offices[0].post_office}, Taluk: ${offices[0].taluk}, City: ${offices[0].city}, State: ${offices[0].state}`);
                }
                else if (offices.length > 1) {
                    let html = `
                        <style>
                            .po-table { width:100%; border-collapse: collapse; }
                            .po-table th, .po-table td { border:1px solid #ddd; padding:8px; }
                            .po-table th { background:#f2f2f2; }
                        </style>
                        <table class="po-table">
                            <thead>
                                <tr>
                                    <th style="width:50px">Select</th>
                                    <th>Post Office</th>
                                    <th>Taluk</th>
                                    <th>State</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${offices.map((o, i) => `
                                    <tr>
                                        <td>
                                            <input type="radio" id="po_${i}" name="po" value="${i}">
                                        </td>
                                        <td><label for="po_${i}">${o.post_office}</label></td>
                                        <td>${o.taluk || ''}</td>
                                        <td>${o.state || ''}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                    let d = new frappe.ui.Dialog({
                        title: 'Select Post Office',
                        fields: [
                            { fieldtype: 'HTML', fieldname: 'table_html', options: html }
                        ],
                        primary_action_label: 'Set',
                        primary_action() {
                            const wrapper = d.get_field('table_html').$wrapper;
                            const selectedIndex = wrapper.find('input[name="po"]:checked').val();
                            if (selectedIndex === undefined) {
                                frappe.msgprint('Please select a Post Office.');
                                return;
                            }
                            const sel = offices[parseInt(selectedIndex)];
                            frm.set_value('custom_post_office', sel.post_office);
                            frm.set_value('custom_taluk',       sel.taluk);
                            frm.set_value('state',       sel.state);
                            frm.set_value('county', sel.district);
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


function format_name(name, custom_autoname) {
    if (!name) return '';

    if (!custom_autoname) {
        // Agar custom_autoname 0 ho to jo user ne dala waisa hi wapas do
        return name;
    }

    // custom_autoname 1 hai to existing formatting karo
    let formattedName = name.replace(/[^a-zA-Z\s]/g, ''); // Keep only letters and spaces
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
