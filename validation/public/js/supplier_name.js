frappe.ui.form.on('Supplier', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1); // Enable custom_automate for new forms
        }
    },
    country: function(frm) {
        if (frm.doc.custom_automate !== 1 || !frm.doc.country) return;

        if (frm.doc.country === "India") {
            frm.set_value("default_currency", "INR");
            frm.set_value("default_price_list", "Standard Buying");

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

                        if (!frm.doc.accounts || frm.doc.accounts.length === 0) {
                            let row = frm.add_child("accounts");
                            row.company = company;

                            frappe.call({
                                method: "frappe.client.get_list",
                                args: {
                                    doctype: "Account",
                                    filters: {
                                        company: company,
                                        account_type: "Payable",
                                        root_type: "Liability",
                                        is_group: 0
                                    },
                                    fields: ["name"],
                                    limit_page_length: 1
                                },
                                callback: function(res) {
                                    if (res.message && res.message.length > 0) {
                                        row.account = res.message[0].name;
                                        frm.refresh_field("accounts");
                                    }
                                }
                            });
                        } else {
                            frm.doc.accounts.forEach((row) => {
                                row.company = company;

                                frappe.call({
                                    method: "frappe.client.get_list",
                                    args: {
                                        doctype: "Account",
                                        filters: {
                                            company: company,
                                            account_type: "Payable",
                                            root_type: "Liability",
                                            is_group: 0
                                        },
                                        fields: ["name"],
                                        limit_page_length: 1
                                    },
                                    callback: function(res) {
                                        if (res.message && res.message.length > 0) {
                                            row.account = res.message[0].name;
                                            frm.refresh_field("accounts");
                                        }
                                    }
                                });
                            });
                        }
                    }
                }
            });
        }
    },

    supplier_name: function(frm) {
        if (frm.doc.custom_automate) {
            console.log("Supplier Name trigger activated and custom_automate is disabled");
            check_automation_enabled(frm, function(is_enabled) {
                console.log("Automation check result:", is_enabled);
                if (is_enabled) {
                    const formatted_name = format_name(frm.doc.supplier_name);
                    console.log("Formatted Name:", formatted_name);
                    frm.set_value('supplier_name', formatted_name);
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping Supplier Name trigger.");
        }
    },
    supplier_details: function(frm) {
        if (frm.doc.custom_automate) {
            console.log("Supplier Name trigger activated and custom_automate is disabled");
            check_automation_enabled(frm, function(is_enabled) {
                console.log("Automation check result:", is_enabled);
                if (is_enabled) {
                    const formatted_name = format_name(frm.doc.supplier_details);
                    console.log("Formatted Name:", formatted_name);
                    frm.set_value('supplier_details', formatted_name);
                }
            });
        } else {
            console.log("custom_automate is enabled. Skipping Supplier Details trigger.");
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
    formattedName = formattedName.replace(/\(/g, ' (');

    formattedName = formattedName.split(' ').map((word, index) => {
        if (word === word.toUpperCase()) {
            // Manually typed in ALL CAPS — keep it
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
            field: 'enable_supplier_automation'
        },
        callback: function(response) {
            const is_enabled = response.message ? response.message : false;
            console.log("Automation enabled?", is_enabled);
            if (callback) callback(is_enabled);
        }
    });
}