// ======================= Utility: Debounce Form Handler =======================
const FormHandler = {
    timeouts: {},
    lastValues: {},

    handle(frm, fieldname, automationField, formatFn, realtimeFn) {
        if (!frm.doc.custom_automate) return;

        const currentValue = frm.doc[fieldname] || '';

        // Realtime formatting
        this.checkAutomation(automationField, (enabled) => {
            if (enabled) {
                const formatted = realtimeFn(currentValue);
                if (currentValue !== formatted) {
                    frm.set_value(fieldname, formatted);
                    return;
                }
            }
        });

        // Debounced full formatting
        clearTimeout(this.timeouts[fieldname]);
        this.timeouts[fieldname] = setTimeout(() => {
            this.checkAutomation(automationField, (enabled) => {
                if (!enabled) return;

                const valueToFormat = frm.doc[fieldname] || '';
                if (this.lastValues[fieldname] === valueToFormat) return;

                const formatted = formatFn(valueToFormat);
                this.lastValues[fieldname] = formatted;
                if (valueToFormat !== formatted) {
                    frm.set_value(fieldname, formatted);
                }

                // Manual correction check moved to before_save
            });
        }, 300);
    },

    cleanup(frm, fields) {
        Object.values(this.timeouts).forEach(clearTimeout);
        this.timeouts = {};
        fields.forEach((field) => {
            const value = frm.doc[field];
            if (value) {
                const cleaned = value.replace(/[,\s]+$/, '').trim();
                if (value !== cleaned) frm.set_value(field, cleaned);
            }
        });
    },

    checkAutomation(field, callback) {
        frappe.call({
            method: 'frappe.client.get_single_value',
            args: { doctype: 'Settings for Automation', field },
            callback: (res) => callback(!!res.message)
        });
    }
};

// ======================= Utility: Text Formatter =======================
const TextFormatter = {
    lowercaseWords: [
        'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor',
        'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'
    ],

    capitalizeWord(word, index) {
        if (!word || word === word.toUpperCase()) return word;
        const lower = word.toLowerCase();
        return (this.lowercaseWords.includes(lower) && index !== 0)
            ? lower
            : lower.charAt(0).toUpperCase() + lower.slice(1);
    },

    realTime(text, allowNumbers = false) {
        if (!text || text.endsWith(' ')) return text;
        return text.split(' ').map((w, i) => this.capitalizeWord(w, i)).join(' ');
    },

    full(text, allowNumbers = false) {
        if (!text) return '';
        const regex = allowNumbers ? /[^a-zA-Z0-9\s]/g : /[^a-zA-Z\s]/g;
        return text
            .replace(regex, '')
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[,\s]+$/, '')
            .replace(/\(/g, ' (')
            .split(' ')
            .filter(Boolean)
            .map((w, i) => this.capitalizeWord(w, i))
            .join(' ');
    }
};

// ======================= Supplier Form Events =======================
frappe.ui.form.on('Supplier', {
    onload(frm) {
        if (frm.is_new()) frm.set_value('custom_automate', 1);
        frm._original_values = {};
        frm._popup_shown_fields = {};
    },

    refresh(frm) {
        frm._original_values['supplier_name'] = frm.doc.supplier_name;
        frm._original_values['supplier_details'] = frm.doc.supplier_details;
        frm._popup_shown_fields = {};
    },

    supplier_primary_address(frm) {
        if (frm.doc.custom_automate !== 1 || !frm.doc.supplier_primary_address) return;
        frappe.call({
            method: 'frappe.client.get',
            args: { doctype: 'Address', name: frm.doc.supplier_primary_address },
            callback(res) {
                if (res.message?.country === 'India') setIndianDefaults(frm, 'Receivable');
            }
        });
    },

    country(frm) {
        if (frm.doc.custom_automate !== 1 || !frm.doc.country) return;
        if (frm.doc.country === 'India') setIndianDefaults(frm, 'Payable');
    },

    supplier_name(frm) {
        FormHandler.handle(
            frm,
            'supplier_name',
            'enable_supplier_automation',
            (t) => TextFormatter.full(t, false),
            (t) => TextFormatter.realTime(t, false)
        );
    },

    supplier_details(frm) {
        FormHandler.handle(
            frm,
            'supplier_details',
            'enable_supplier_automation',
            (t) => TextFormatter.full(t, false),
            (t) => TextFormatter.realTime(t, false)
        );
    },

    before_save(frm) {
        const fields = ['supplier_name', 'supplier_details'];
        FormHandler.cleanup(frm, fields);
        fields.forEach(field => checkForManualCorrection(frm, field));
        if (frm.doc.custom_automate) frm.set_value('custom_automate', 0);
    }
});

// ======================= Helpers =======================
function setIndianDefaults(frm, accountType) {
    frm.set_value('default_currency', 'INR');
    frm.set_value('default_price_list', 'INR Buying');

    frappe.call({
        method: 'frappe.client.get_value',
        args: { doctype: 'Company', filters: {}, fieldname: 'name' },
        callback(r) {
            if (!r.message) return;
            const company = r.message.name;

            if (!frm.doc.accounts?.length) {
                addAccountRow(frm, company, accountType);
            } else {
                frm.doc.accounts.forEach((row) => {
                    row.company = company;
                    getAccountName(company, accountType, (accName) => {
                        if (accName) {
                            row.account = accName;
                            frm.refresh_field('accounts');
                        }
                    });
                });
            }

            if (accountType === 'Receivable') {
                frappe.call({
                    method: 'frappe.client.get_list',
                    args: {
                        doctype: 'Bank Account',
                        filters: { company, is_default: 1, is_company_account: 1 },
                        fields: ['name'],
                        limit_page_length: 1
                    },
                    callback(bankRes) {
                        if (bankRes.message?.length) {
                            frm.set_value('default_bank_account', bankRes.message[0].name);
                        }
                    }
                });
            }
        }
    });
}

function addAccountRow(frm, company, accountType) {
    const row = frm.add_child('accounts');
    row.company = company;
    getAccountName(company, accountType, (accName) => {
        if (accName) {
            row.account = accName;
            frm.refresh_field('accounts');
        }
    });
}

function getAccountName(company, accountType, callback) {
    const rootType = accountType === 'Receivable' ? 'Asset' : 'Liability';
    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: 'Account',
            filters: { company, account_type: accountType, root_type: rootType, is_group: 0 },
            fields: ['name'],
            limit_page_length: 1
        },
        callback(res) {
            if (res.message?.length) callback(res.message[0].name);
        }
    });
}

function checkForManualCorrection(frm, fieldname) {
    if (!frm._original_values || frm._popup_shown_fields[fieldname]) return;

    const oldVal = frm._original_values[fieldname] || '';
    const newVal = frm.doc[fieldname] || '';
    if (!oldVal || !newVal || oldVal === newVal) return;

    const oldWords = oldVal.split(/\s+/);
    const newWords = newVal.split(/\s+/);

    for (let i = 0; i < oldWords.length; i++) {
        if (newWords[i] && oldWords[i] !== newWords[i]) {
            const original = oldWords[i];
            const corrected = newWords[i];
            frm._popup_shown_fields[fieldname] = true;

            frappe.confirm(
                `You corrected "<b>${original}</b>" to "<b>${corrected}</b>".<br><br>Do you want to add it to your Private Dictionary?`,
                () => {
                    frappe.call({
                        method: 'validation.validation.doctype.private_dictionary.private_dictionary.add_to_dictionary',
                        args: { original, corrected },
                        callback: () => {
                            frappe.show_alert('Word added to Private Dictionary!');
                            frm._original_values[fieldname] = newVal;
                        }
                    });
                },
                () => {
                    frappe.show_alert('Skipped adding to dictionary.');
                    frm._original_values[fieldname] = newVal;
                }
            );
            break;
        }
    }
}
