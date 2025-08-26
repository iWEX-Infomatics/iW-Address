// ================== Global Utilities ==================
const FormHandler = {
    timeouts: new Map(),
    lastValues: new Map(),

    async isAutomationEnabled(field) {
        try {
            const { message } = await frappe.call({
                method: 'frappe.client.get_single_value',
                args: { doctype: 'Settings for Automation', field }
            });
            return !!message;
        } catch (error) {
            console.error('Automation check failed:', error);
            return false;
        }
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
        }).catch(console.error);

        // Debounced formatting
        if (this.timeouts.has(fieldname)) {
            clearTimeout(this.timeouts.get(fieldname));
        }

        this.timeouts.set(fieldname, setTimeout(async () => {
            try {
                const enabled = await this.isAutomationEnabled(automationField);
                if (!enabled) return;

                const valueToFormat = frm.doc[fieldname] || '';
                if (this.lastValues.get(fieldname) === valueToFormat) return;

                const formatted = formatFunction(valueToFormat);
                this.lastValues.set(fieldname, formatted);
                if (valueToFormat !== formatted) frm.set_value(fieldname, formatted);
            } catch (error) {
                console.error('Format handling failed:', error);
            }
        }, 300));
    },

    cleanup(frm, fields) {
        // Clear all timeouts
        for (const timeout of this.timeouts.values()) {
            clearTimeout(timeout);
        }
        this.timeouts.clear();

        // Clean field values
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
    lowercaseWords: new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with']),

    capitalizeWord(word) {
        const lower = word.toLowerCase();
        return this.lowercaseWords.has(lower) ? lower : 
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

// ================== Constants ==================
const CONSTANTS = {
    COMPANY: "Auraspace Traders Pvt Ltd",
    ACCOUNT: "Debtors INR - AT",
    TEXT_FIELD_TYPES: new Set(["Data", "Small Text", "Text", "Long Text", "Text Editor"]),
    VALID_MOBILE_PREFIXES: new Set(['6', '7', '8', '9']),
    AUTOMATION_FIELDS: ['customer_name', 'customer_details']
};

// ================== Utility Functions ==================
const Utils = {
    async makeAPICall(method, args) {
        try {
            return await frappe.call({ method, args });
        } catch (error) {
            console.error(`API call failed: ${method}`, error);
            return { message: null };
        }
    },

    initializeFormValues(frm) {
        if (!frm._original_values) {
            frm._original_values = {};
            frm.meta.fields.forEach(field => {
                if (CONSTANTS.TEXT_FIELD_TYPES.has(field.fieldtype)) {
                    frm._original_values[field.fieldname] = frm.doc[field.fieldname];
                }
            });
        }
        frm._popup_shown_fields = frm._popup_shown_fields || {};
    },

    findOrCreateChildRow(frm, tableName, findCondition, defaultValues) {
        const table = frm.doc[tableName] || [];
        let existingRow = table.find(findCondition);
        
        if (!existingRow) {
            let emptyRow = table.find(row => Object.values(defaultValues).every(val => !row[Object.keys(defaultValues).find(key => defaultValues[key] === val)]));
            
            if (emptyRow) {
                Object.entries(defaultValues).forEach(([key, value]) => {
                    frappe.model.set_value(emptyRow.doctype, emptyRow.name, key, value);
                });
                existingRow = emptyRow;
            } else {
                existingRow = frm.add_child(tableName);
                Object.assign(existingRow, defaultValues);
            }
            
            frm.refresh_field(tableName);
        }
        
        return existingRow;
    },

    validateMobileNumber(mobile) {
        if (!mobile) return { isValid: true };
        
        const cleanMobile = String(mobile).replace(/\D/g, '');
        
        if (cleanMobile.length !== 10) {
            return {
                isValid: false,
                message: 'Mobile number must be exactly 10 digits for Individual customers.',
                indicator: 'red'
            };
        }
        
        if (!CONSTANTS.VALID_MOBILE_PREFIXES.has(cleanMobile[0])) {
            return {
                isValid: false,
                message: 'Mobile number should start with 6, 7, 8, or 9 for Indian numbers.',
                indicator: 'orange'
            };
        }
        
        return { isValid: true, cleanMobile: parseInt(cleanMobile) };
    }
};

// ================== Business Logic Functions ==================
const CustomerLogic = {
    async handleAddressUpdate(frm) {
        if (frm.doc.custom_automate !== 1 || !frm.doc.customer_primary_address) return;

        const { message: address } = await Utils.makeAPICall('frappe.client.get', {
            doctype: 'Address',
            name: frm.doc.customer_primary_address
        });
        
        if (!address || address.country !== "India") return;

        // Set currency and price list
        frm.set_value("default_currency", "INR");
        frm.set_value("default_price_list", "INR Selling");

        // Parallel API calls for better performance
        const [companyData, receivableAccounts, bankAccounts] = await Promise.all([
            Utils.makeAPICall("frappe.client.get_value", {
                doctype: "Company",
                filters: {},
                fieldname: "name"
            }),
            Utils.makeAPICall("frappe.client.get_list", {
                doctype: "Account",
                filters: {
                    company: address.company,
                    account_type: "Receivable",
                    root_type: "Asset",
                    is_group: 0
                },
                fields: ["name"],
                limit_page_length: 1
            }),
            Utils.makeAPICall("frappe.client.get_list", {
                doctype: "Bank Account",
                filters: {
                    company: address.company,
                    is_default: 1,
                    is_company_account: 1
                },
                fields: ["name"],
                limit_page_length: 1
            })
        ]);

        // Set accounts
        const company = companyData?.message?.name;
        if (company && (!frm.doc.accounts || !frm.doc.accounts.length)) {
            const row = frm.add_child("accounts");
            row.company = company;
            if (receivableAccounts.message?.length) {
                row.account = receivableAccounts.message[0].name;
            }
            frm.refresh_field("accounts");
        }

        // Set bank account
        if (bankAccounts.message?.length) {
            frm.set_value("default_bank_account", bankAccounts.message[0].name);
        }
    },

    handleValidationChanges(frm) {
        const changes = [];
        
        frm.meta.fields.forEach(field => {
            if (!CONSTANTS.TEXT_FIELD_TYPES.has(field.fieldtype) || 
                frm._popup_shown_fields[field.fieldname]) return;

            const oldVal = frm._original_values[field.fieldname];
            const newVal = frm.doc[field.fieldname];
            
            if (oldVal && newVal && oldVal !== newVal) {
                const oldWords = oldVal.split(/\s+/);
                const newWords = newVal.split(/\s+/);
                
                oldWords.forEach((word, idx) => {
                    if (newWords[idx] && word !== newWords[idx]) {
                        changes.push({
                            fieldname: field.fieldname,
                            original: word,
                            corrected: newWords[idx]
                        });
                    }
                });
            }
        });

        if (changes.length) {
            this.showDictionaryPrompt(frm, changes[0]);
        }
    },

    showDictionaryPrompt(frm, { fieldname, original, corrected }) {
        frm._popup_shown_fields[fieldname] = true;

        frappe.confirm(
            `You corrected "<b>${original}</b>" to "<b>${corrected}</b>".<br><br>Add to Private Dictionary?`,
            async () => {
                try {
                    await frappe.call({
                        method: "validation.validation.doctype.private_dictionary.private_dictionary.add_to_dictionary",
                        args: { original, corrected }
                    });
                    frappe.show_alert("Word added to Private Dictionary!");
                    frm.reload_doc();
                } catch (error) {
                    console.error('Dictionary addition failed:', error);
                    frappe.show_alert("Failed to add word to dictionary.");
                }
            },
            () => frappe.show_alert("Skipped adding to dictionary.")
        );
    },

    setCustomerGroup(frm) {
        if (frm.doc.customer_type === 'Individual') {
            frm.set_value('customer_group', 'Individual');
        }
    },

    async setTaxCategory(frm) {
        if (frm.doc.customer_type !== 'Individual' || !frm.doc.territory) return;

        try {
            const { message: territoryDoc } = await Utils.makeAPICall('frappe.client.get', {
                doctype: 'Territory',
                name: frm.doc.territory
            });
            
            if (territoryDoc) {
                const isInKerala = await this.checkTerritoryHierarchy(territoryDoc);
                frm.set_value('tax_category', isInKerala ? 'In-State' : 'Out-State');
            }
        } catch (error) {
            console.error('Tax category setting failed:', error);
        }
    },

    async checkTerritoryHierarchy(territoryDoc) {
        if (territoryDoc.name === 'Kerala') return true;
        
        if (territoryDoc.parent_territory && territoryDoc.parent_territory !== 'All Territories') {
            const { message: parentDoc } = await Utils.makeAPICall('frappe.client.get', {
                doctype: 'Territory',
                name: territoryDoc.parent_territory
            });
            
            if (parentDoc) {
                if (parentDoc.name === 'Kerala') return true;
                if (parentDoc.parent_territory && parentDoc.parent_territory !== 'All Territories') {
                    return await this.checkTerritoryHierarchy(parentDoc);
                }
            }
        }
        
        return false;
    },

    setDefaultAccountsAndLimits(frm) {
        if (frm.doc.customer_type !== 'Individual') return;

        // Set default accounts
        Utils.findOrCreateChildRow(
            frm,
            'accounts',
            row => row.company === CONSTANTS.COMPANY && row.account === CONSTANTS.ACCOUNT,
            { company: CONSTANTS.COMPANY, account: CONSTANTS.ACCOUNT }
        );

        // Set default credit limits
        Utils.findOrCreateChildRow(
            frm,
            'credit_limits',
            row => row.company === CONSTANTS.COMPANY,
            { company: CONSTANTS.COMPANY }
        );
    },

    validateMobile(frm) {
        if (frm.doc.customer_type !== 'Individual' || !frm.doc.custom_mobile) return true;

        const validation = Utils.validateMobileNumber(frm.doc.custom_mobile);
        
        if (!validation.isValid) {
            frappe.msgprint({
                title: __('Invalid Mobile Number'),
                indicator: validation.indicator,
                message: __(validation.message)
            });
            frm.set_focus('custom_mobile');
            return false;
        }

        // Update with clean number if needed
        if (validation.cleanMobile && String(frm.doc.custom_mobile) !== String(validation.cleanMobile)) {
            frm.set_value('custom_mobile', validation.cleanMobile);
        }

        return true;
    }
};

// ================== Form Event Handlers ==================
frappe.ui.form.on('Customer', {
    onload(frm) {
        if (frm.is_new()) frm.set_value('custom_automate', 1);
        Utils.initializeFormValues(frm);
        
        // Initialize individual customer settings
        CustomerLogic.setCustomerGroup(frm);
        CustomerLogic.setTaxCategory(frm);
        CustomerLogic.setDefaultAccountsAndLimits(frm);
    },

    refresh() {
        console.log("****************** Global Autocorrect Loaded ********************");
    },

    validate(frm) {
        CustomerLogic.handleValidationChanges(frm);
        return CustomerLogic.validateMobile(frm);
    },

    customer_primary_address(frm) {
        CustomerLogic.handleAddressUpdate(frm);
    },

    customer_type(frm) {
        CustomerLogic.setCustomerGroup(frm);
        CustomerLogic.setTaxCategory(frm);
        CustomerLogic.setDefaultAccountsAndLimits(frm);
    },

    territory(frm) {
        CustomerLogic.setTaxCategory(frm);
    },

    custom_mobile(frm) {
        CustomerLogic.validateMobile(frm);
    },

    customer_name(frm) {
        FormHandler.handle(
            frm,
            'customer_name',
            'enable_customer_automation',
            text => TextFormatter.full(text, true),
            text => TextFormatter.realTime(text)
        );
    },

    customer_details(frm) {
        FormHandler.handle(
            frm,
            'customer_details',
            'enable_customer_automation',
            text => TextFormatter.full(text, false),
            text => TextFormatter.realTime(text)
        );
    },

    before_save(frm) {
        FormHandler.cleanup(frm, CONSTANTS.AUTOMATION_FIELDS);
        if (frm.doc.custom_automate) frm.set_value('custom_automate', 0);
    }
});