frappe.ui.form.on('Customer', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1); //Enable custom_automate for new forms
        }
    },
    customer_primary_address: function(frm) {
        if (frm.doc.custom_automate !== 1 || !frm.doc.customer_primary_address) return;

        // Get Address document
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Address',
                name: frm.doc.customer_primary_address
            },
            callback: function(res) {
                if (res.message) {
                    const address = res.message;
                    const country = address.country;
                    console.log("Country from primary address:", country);

                    if (country === "India") {
                        frm.set_value("default_currency", "INR");
                        frm.set_value("default_price_list", "Standard Selling");

                        // Get default company
                        frappe.call({
                            method: "frappe.client.get_value",
                            args: {
                                doctype: "Company",
                                filters: {},
                                fieldname: "name"
                            },
                            callback: function(r) {
                                if (r.message) {
                                    let company = r.message.name;

                                    // Add a row to accounts if not present
                                    if (!frm.doc.accounts || frm.doc.accounts.length === 0) {
                                        let row = frm.add_child("accounts");
                                        row.company = company;

                                        // Get Receivable Account
                                        frappe.call({
                                            method: "frappe.client.get_list",
                                            args: {
                                                doctype: "Account",
                                                filters: {
                                                    company: company,
                                                    account_type: "Receivable",
                                                    root_type: "Asset",
                                                    is_group: 0
                                                },
                                                fields: ["name"],
                                                limit_page_length: 1
                                            },
                                            callback: function(res2) {
                                                if (res2.message && res2.message.length > 0) {
                                                    row.account = res2.message[0].name;
                                                    frm.refresh_field("accounts");
                                                }
                                            }
                                        });
                                    }
                                }
                            }
                        });
                    }
                }
            }
        });
    },
    customer_name: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    const formatted_name = format_name(frm.doc.customer_name);
                    frm.set_value('customer_name', formatted_name);
                }
            });
        } else {
            console.log("custom_automate is enabled.  Customer Name trigger.");
        }
    },

    customer_details: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    const formatted_name = format_name(frm.doc.customer_details);
                    frm.set_value('customer_details', formatted_name);
                }
            });
        } else {
            console.log("custom_automate is enabled. Customer Details trigger.");
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
            fieldname: 'enable_customer_automation'
        },
        callback: function(response) {
            console.log("Automation Settings response:", response);
            const is_enabled = response.message ? response.message.enable_customer_automation : false;
            callback(is_enabled);
        }
    });
}
