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

                                    // Get Default Bank Account
                                    frappe.call({
                                        method: "frappe.client.get_list",
                                        args: {
                                            doctype: "Bank Account",
                                            filters: {
                                                company: company,
                                                is_default: 1,
                                                is_company_account: 1
                                            },
                                            fields: ["name"],
                                            limit_page_length: 1
                                        },
                                        callback: function(bank_res) {
                                            if (bank_res.message && bank_res.message.length > 0) {
                                                frm.set_value("default_bank_account", bank_res.message[0].name);
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    }
                }
            }
        });
    }
,
    customer_name: function(frm) {
        if (frm.doc.custom_automate) {
            check_automation_enabled(frm, function(is_enabled) {
                if (is_enabled) {
                    const formatted_name = format_name_with_numbers(frm.doc.customer_name);
                    frm.set_value('customer_name', formatted_name);
                }
            });
        } else {
            console.log("custom_automate is enabled. Customer Name trigger.");
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

function format_name_with_numbers(name) {
    if (!name) return '';

    const lowercaseWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'];

    // Allow letters, numbers, and spaces
    let formattedName = name.replace(/[^a-zA-Z0-9\s]/g, '');

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
            field: 'enable_customer_automation'
        },
        callback: function(response) {
            const is_enabled = response.message ? response.message : false;
            console.log("Automation enabled?", is_enabled);
            if (callback) callback(is_enabled);
        }
    });
}
