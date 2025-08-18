// ================== Global Utilities ==================
const FormHandler = {
    timeouts: {},
    lastValues: {},

    async isAutomationEnabled(field) {
        const res = await frappe.call({
            method: 'frappe.client.get_single_value',
            args: { doctype: 'Settings for Automation', field }
        });
        return !!res.message;
    },

    handle(frm, fieldname, automationField, formatFunction, realTimeFunction) {
        if (!frm.doc.custom_automate) return;

        const currentValue = frm.doc[fieldname] || '';

        // Real-time formatting
        this.isAutomationEnabled(automationField).then(enabled => {
            if (enabled) {
                const formatted = realTimeFunction(currentValue);
                if (currentValue !== formatted) {
                    frm.set_value(fieldname, formatted);
                }
            }
        });

        // Debounced formatting
        clearTimeout(this.timeouts[fieldname]);
        this.timeouts[fieldname] = setTimeout(async () => {
            const enabled = await this.isAutomationEnabled(automationField);
            if (!enabled) return;

            const valueToFormat = frm.doc[fieldname] || '';
            if (this.lastValues[fieldname] === valueToFormat) return;

            const formatted = formatFunction(valueToFormat);
            this.lastValues[fieldname] = formatted;
            if (valueToFormat !== formatted) frm.set_value(fieldname, formatted);
        }, 300);
    },

    cleanup(frm, fields) {
        Object.values(this.timeouts).forEach(clearTimeout);
        this.timeouts = {};

        fields.forEach(fieldname => {
            const value = frm.doc[fieldname];
            if (value) {
                const cleaned = value.replace(/[,\s]+$/, '').trim();
                if (value !== cleaned) frm.set_value(fieldname, cleaned);
            }
        });
    }
};

const TextFormatter = {
    lowercaseWords: ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'],

    capitalizeWord(word) {
        const lower = word.toLowerCase();
        return this.lowercaseWords.includes(lower) ? lower :
            lower.charAt(0).toUpperCase() + lower.slice(1);
    },

    realTime(text) {
        if (!text || text.endsWith(' ')) return text;
        return text.split(' ').map(word =>
            !word || word === word.toUpperCase() ? word : this.capitalizeWord(word)
        ).join(' ');
    },

    full(text, allowNumbers = false) {
        if (!text || text.endsWith(' ')) return text;
        const regex = allowNumbers ? /[^a-zA-Z0-9\s]/g : /[^a-zA-Z\s]/g;
        return text
            .replace(regex, '')
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[,\s]+$/, '')
            .replace(/\(/g, ' (')
            .split(' ')
            .filter(Boolean)
            .map(word => word === word.toUpperCase() ? word : this.capitalizeWord(word))
            .join(' ');
    }
};

// ================== Customer Form Events ==================
frappe.ui.form.on('Customer', {
    onload(frm) {
        if (frm.is_new()) frm.set_value('custom_automate', 1);

        // Save original values for text fields
        if (!frm._original_values) {
            frm._original_values = {};
            frm.meta.fields.forEach(f => {
                if (["Data", "Small Text", "Text", "Long Text", "Text Editor"].includes(f.fieldtype)) {
                    frm._original_values[f.fieldname] = frm.doc[f.fieldname];
                }
            });
        }

        frm._popup_shown_fields = {};
    },

    refresh() {
        console.log("****************** Global Autocorrect Loaded ********************");
    },

    validate(frm) {
        const changes = [];

        frm.meta.fields.forEach(f => {
            const fieldname = f.fieldname;
            if (!["Data", "Small Text", "Text", "Long Text", "Text Editor"].includes(f.fieldtype)) return;
            if (frm._popup_shown_fields[fieldname]) return;

            const old_val = frm._original_values[fieldname];
            const new_val = frm.doc[fieldname];
            if (old_val && new_val && old_val !== new_val) {
                old_val.split(/\s+/).forEach((word, idx) => {
                    if (new_val.split(/\s+/)[idx] && word !== new_val.split(/\s+/)[idx]) {
                        changes.push({ fieldname, original: word, corrected: new_val.split(/\s+/)[idx] });
                    }
                });
            }
        });

        if (changes.length) {
            const { fieldname, original, corrected } = changes[0];
            frm._popup_shown_fields[fieldname] = true;

            frappe.confirm(
                `You corrected "<b>${original}</b>" to "<b>${corrected}</b>".<br><br>Add to Private Dictionary?`,
                async () => {
                    await frappe.call({
                        method: "validation.validation.doctype.private_dictionary.private_dictionary.add_to_dictionary",
                        args: { original, corrected }
                    });
                    frappe.show_alert("Word added to Private Dictionary!");
                    frm.reload_doc();
                },
                () => frappe.show_alert("Skipped adding to dictionary.")
            );
        }
    },

    async customer_primary_address(frm) {
        if (frm.doc.custom_automate !== 1 || !frm.doc.customer_primary_address) return;

        const { message: address } = await frappe.call({
            method: 'frappe.client.get',
            args: { doctype: 'Address', name: frm.doc.customer_primary_address }
        });
        if (!address || address.country !== "India") return;

        frm.set_value("default_currency", "INR");
        frm.set_value("default_price_list", "INR Selling");

        const [{ message: companyData }, receivableAccounts, bankAccounts] = await Promise.all([
            frappe.call({ method: "frappe.client.get_value", args: { doctype: "Company", filters: {}, fieldname: "name" } }),
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Account",
                    filters: { company: address.company, account_type: "Receivable", root_type: "Asset", is_group: 0 },
                    fields: ["name"], limit_page_length: 1
                }
            }),
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Bank Account",
                    filters: { company: address.company, is_default: 1, is_company_account: 1 },
                    fields: ["name"], limit_page_length: 1
                }
            })
        ]);

        const company = companyData?.name;
        if (company && (!frm.doc.accounts || !frm.doc.accounts.length)) {
            let row = frm.add_child("accounts");
            row.company = company;
            if (receivableAccounts.message?.length) {
                row.account = receivableAccounts.message[0].name;
                frm.refresh_field("accounts");
            }
        }

        if (bankAccounts.message?.length) {
            frm.set_value("default_bank_account", bankAccounts.message[0].name);
        }
    },

    customer_name(frm) {
        FormHandler.handle(
            frm,
            'customer_name',
            'enable_customer_automation',
            (text) => TextFormatter.full(text, true),
            (text) => TextFormatter.realTime(text, true)
        );
    },

    customer_details(frm) {
        FormHandler.handle(
            frm,
            'customer_details',
            'enable_customer_automation',
            (text) => TextFormatter.full(text, false),
            (text) => TextFormatter.realTime(text, false)
        );
    },

    before_save(frm) {
        FormHandler.cleanup(frm, ['customer_name', 'customer_details']);
        if (frm.doc.custom_automate) frm.set_value('custom_automate', 0);
    }
});
