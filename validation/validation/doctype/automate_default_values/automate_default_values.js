frappe.ui.form.on('Automate Default Values', {
    onload: function(frm) {
        if (frm.doc.default_party_values && frm.doc.default_party_values.length) {
            frm.doc.default_party_values.forEach(row => {
                let cdt = 'Party Default Values';
                let cdn = row.name;

                set_customer_fields(frm, cdt, cdn);
                set_supplier_fields(frm, cdt, cdn);
                set_default_bank_account(frm, cdt, cdn);
             });
        }
    }
});

frappe.ui.form.on('Party Default Values', { 
    company: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.company) {
            frappe.db.get_value('Company', row.company, 'abbr')
                .then(r => {
                    if (r.message) {
                        console.log("Abbr set:", r.message.abbr);
                        frappe.model.set_value(cdt, cdn, 'abbr', r.message.abbr);
                        set_default_bank_account(frm, cdt, cdn);
                    }
                });
        } else {
            frappe.model.set_value(cdt, cdn, 'abbr', '');
        }
    },

    customer_currency: function(frm, cdt, cdn) {
        set_customer_fields(frm, cdt, cdn);
    },

    abbr: function(frm, cdt, cdn) {
        set_customer_fields(frm, cdt, cdn);
        set_supplier_fields(frm, cdt, cdn);
    },

    supplier_currency: function(frm, cdt, cdn) {
        set_supplier_fields(frm, cdt, cdn);
    }
});

// ========== CUSTOMER ==========
function set_customer_fields(frm, cdt, cdn) {
    let row = locals[cdt][cdn];

    if (row.customer_currency && row.abbr) {
        let account_name = `Debtors - ${row.abbr}`;

        frappe.db.exists('Account', account_name).then(exists => {
            if (exists) {
                frappe.model.set_value(cdt, cdn, 'customer_account', account_name);
            } else {
                frappe.msgprint(`Customer Account "${account_name}" does not exist.`);
                frappe.model.set_value(cdt, cdn, 'customer_account', '');
            }
        });
    }

    // Price List
    frappe.db.get_list('Price List', {
        filters: { selling: 1 },
        fields: ['name']
    }).then(result => {
        const options = result.map(pl => pl.name);
        frm.fields_dict.default_party_values.grid.update_docfield_property(
            'customer_price_list', 'options', options.join('\n')
        );

        if (!options.includes(row.customer_price_list)) {
            frappe.model.set_value(cdt, cdn, 'customer_price_list', options[0] || '');
        }
    });

}

// ========== SUPPLIER ==========
function set_supplier_fields(frm, cdt, cdn) {
    let row = locals[cdt][cdn];

    if (row.supplier_currency && row.abbr) {
        let account_name = `Creditors - ${row.abbr}`;

        frappe.db.exists('Account', account_name).then(exists => {
            if (exists) {
                frappe.model.set_value(cdt, cdn, 'supplier_account', account_name);
            } else {
                frappe.msgprint(`Supplier Account "${account_name}" does not exist.`);
                frappe.model.set_value(cdt, cdn, 'supplier_account', '');
            }
        });
    }

    // Price List
    frappe.db.get_list('Price List', {
        filters: { buying: 1 },
        fields: ['name']
    }).then(result => {
        const options = result.map(pl => pl.name);
        frm.fields_dict.default_party_values.grid.update_docfield_property(
            'supplier_price_list', 'options', options.join('\n')
        );

        if (!options.includes(row.supplier_price_list)) {
            frappe.model.set_value(cdt, cdn, 'supplier_price_list', options[0] || '');
        }
    });

}


function set_default_bank_account(frm, cdt, cdn) {
    let row = locals[cdt][cdn];

    if (!row.company) {
        console.warn("Company not selected.");
        return;
    }

    // Fetch a default & company-owned bank account
    frappe.db.get_list('Bank Account', {
        filters: {
            is_default: 1,
            is_company_account: 1,
            company: row.company
        },
        fields: ['name'],
        limit: 1
    }).then(result => {
        if (result.length) {
            let default_bank = result[0].name;

            frappe.model.set_value(cdt, cdn, 'default_receivables_bank_account', default_bank);

            frappe.model.set_value(cdt, cdn, 'default_bank_account', default_bank);
        } else {
            console.warn("No default + company bank account found for", row.company);
        }
    });
}





frappe.ui.form.on('Default Item Values', {
    item_group: function(frm, cdt, cdn) {
        set_defaults_based_on_item_group(frm, cdt, cdn);
    },
    allow_purchase: function(frm, cdt, cdn) {
        set_defaults_based_on_item_group(frm, cdt, cdn);
    },
    allow_sales: function(frm, cdt, cdn) {
        set_defaults_based_on_item_group(frm, cdt, cdn);
    }
});

function set_defaults_based_on_item_group(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    const is_service = row.item_group === "Is Service Item";

    if (!row.company) return;

    frappe.db.get_value("Company", row.company, "abbr").then(res => {
        if (!res.message) return;

        const abbr = res.message.abbr;
        const cost_center = `${row.company} - ${abbr}`;

        const get_price_list = (type) => {
            return frappe.db.get_list("Price List", {
                filters: {
                    [type]: 1,
                    currency: "INR"
                },
                limit: 1
            }).then(res => res.length ? res[0].name : '');
        };

        const get_account_exact = (account_prefix) => {
            const full_name = `${account_prefix} - ${abbr}`;
            return frappe.db.get_value("Account", full_name, "name")
                .then(res => res && res.message ? res.message.name : '');
        };

        let promises = [];

        if (is_service && row.allow_purchase && row.allow_sales) {
            // Service + Both checked
            promises = [
                get_price_list("selling"),
                get_account_exact("Service"),
                get_account_exact("Service")
            ];
        } else if (!is_service && row.allow_purchase && row.allow_sales) {
            // Not service + both checked
            promises = [
                get_price_list("selling"),
                get_account_exact("Cost of Goods Sold"),
                get_account_exact("Sales")
            ];
        } else if (!is_service && row.allow_purchase) {
            // Only purchase
            promises = [
                get_price_list("buying"),
                get_account_exact("Cost of Goods Sold"),
                get_account_exact("Sales")
            ];
        } else if (!is_service && row.allow_sales) {
            // Only sales
            promises = [
                get_price_list("buying"),
                get_account_exact("Cost of Goods Sold"),
                get_account_exact("Sales")
            ];
        }

        Promise.all(promises).then(([price_list, expense_account, income_account]) => {
            if (price_list) {
                frappe.model.set_value(cdt, cdn, "default_price_list", price_list);
            }

            if (expense_account) {
                frappe.model.set_value(cdt, cdn, "default_expense_account", expense_account);
            }

            if (income_account) {
                frappe.model.set_value(cdt, cdn, "default_income_account", income_account);
            }

            frappe.model.set_value(cdt, cdn, "default_buying_cost_center", cost_center);
            frappe.model.set_value(cdt, cdn, "default_selling_cost_center", cost_center);
        });
    });
}

