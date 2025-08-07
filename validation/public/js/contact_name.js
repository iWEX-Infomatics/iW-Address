frappe.ui.form.on('Contact', {
    onload(frm) {
        if (frm.is_new()) {
            frm.set_value('custom_automate', 1);
        }

        // Capture original values for autocorrect tracking
        if (!frm._original_values) {
            frm._original_values = {};
            frm.meta.fields.forEach(field => {
                if (["Data", "Small Text", "Text", "Long Text", "Text Editor"].includes(field.fieldtype)) {
                    frm._original_values[field.fieldname] = frm.doc[field.fieldname];
                }
            });
        }

        check_automation_enabled('enable_contact_automation', (is_enabled) => {
            console.log("Automation enabled:", is_enabled);
        });
    },

    first_name: (frm) => handle_name_field(frm, 'first_name'),
    middle_name: (frm) => handle_name_field(frm, 'middle_name'),
    last_name: (frm) => handle_name_field(frm, 'last_name'),

    validate(frm) {
        if (!frm._confirmed_fields) {
            frm._confirmed_fields = {};
        }

        // Detect manual corrections and prompt to add to private dictionary
        let changes = [];

        frm.meta.fields.forEach(field => {
            if (["Data", "Small Text", "Text", "Long Text", "Text Editor"].includes(field.fieldtype)) {
                const old_val = frm._original_values[field.fieldname];
                const new_val = frm.doc[field.fieldname];

                if (old_val && new_val && old_val !== new_val) {
                    const old_words = old_val.split(/\s+/);
                    const new_words = new_val.split(/\s+/);

                    old_words.forEach((word, idx) => {
                        if (new_words[idx] && word !== new_words[idx]) {
                            // Only prompt if not already confirmed for this field
                            if (!frm._confirmed_fields[field.fieldname]) {
                                changes.push({
                                    original: word,
                                    corrected: new_words[idx],
                                    fieldname: field.fieldname
                                });
                            }
                        }
                    });
                }
            }
        });

        if (changes.length > 0) {
            const change = changes[0]; // Prompt only for the first detected correction

            frappe.confirm(
                `You corrected "<b>${change.original}</b>" to "<b>${change.corrected}</b>".<br><br>Do you want to add it to your Private Dictionary?`,
                () => {
                    // YES
                    frappe.call({
                        method: "validation.validation.doctype.private_dictionary.private_dictionary.add_to_dictionary",
                        args: {
                            original: change.original,
                            corrected: change.corrected
                        },
                        callback: () => {
                            frappe.show_alert("Word added to Private Dictionary!");
                            frm.reload_doc();
                        }
                    });
                    // Mark this field as confirmed
                    frm._confirmed_fields[change.fieldname] = true;
                },
                () => {
                    // NO
                    frappe.show_alert("Skipped adding to dictionary.");
                    // Also mark confirmed to avoid repeated popups for this field
                    frm._confirmed_fields[change.fieldname] = true;
                }
            );
        }
    },


    before_save(frm) {
        // Clear all pending timeouts before save
        Object.values(debounceTimeouts).forEach(timeout => clearTimeout(timeout));
        
        // Clean up trailing commas and spaces before save
        ['first_name', 'middle_name', 'last_name'].forEach(fieldname => {
            const value = frm.doc[fieldname];
            if (value) {
                const cleaned = value.replace(/[,\s]+$/, '').trim();
                if (value !== cleaned) {
                    frm.set_value(fieldname, cleaned);
                }
            }
        });

        frm.set_value('custom_automate', 0);
    }
});

// Debounce timeouts for each field — to avoid formatting too early
const debounceTimeouts = {};
// Store last processed values to avoid unnecessary formatting
const lastProcessedValues = {};

function handle_name_field(frm, fieldname) {
    if (!frm.doc.custom_automate) return;
    
    const currentValue = frm.doc[fieldname] || '';
    
    check_automation_enabled('enable_contact_automation', (is_enabled) => {
        if (is_enabled) {
            // Real-time formatting for 4+ character words
            const realTimeFormatted = format_name_realtime(currentValue);
            
            if (currentValue !== realTimeFormatted) {
                frm.set_value(fieldname, realTimeFormatted);
                update_full_name(frm);
                return;
            }
        }
    });
    
    // Clear any previous timeout set for this field
    if (debounceTimeouts[fieldname]) {
        clearTimeout(debounceTimeouts[fieldname]);
    }
    
    // Set a new timeout for full formatting after typing has paused
    debounceTimeouts[fieldname] = setTimeout(() => {
        check_automation_enabled('enable_contact_automation', (is_enabled) => {
            if (is_enabled) {
                const valueToFormat = frm.doc[fieldname] || '';
                
                // Skip if value hasn't changed since last processing
                if (lastProcessedValues[fieldname] === valueToFormat) {
                    return;
                }
                
                const formatted = format_name(valueToFormat);
                
                // Only update if formatting actually changed something
                if (valueToFormat !== formatted) {
                    lastProcessedValues[fieldname] = formatted;
                    frm.set_value(fieldname, formatted);
                    update_full_name(frm);
                } else {
                    lastProcessedValues[fieldname] = valueToFormat;
                }
            }
        });
    }, 300);
}

function format_name_realtime(name) {
    if (!name) return '';
    if (name.endsWith(' ')) return name;

    const lowercaseWords = [
        'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor',
        'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'
    ];

    return name
        .split(' ')
        .map(word => {
            if (!word) return word;
            if (word === word.toUpperCase()) return word;

            const lower = word.toLowerCase();
            return lowercaseWords.includes(lower)
                ? lower
                : lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
}

function format_name(name) {
    if (!name) return '';
    if (name.endsWith(' ')) return name;

    const lowercaseWords = [
        'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor',
        'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'
    ];

    return name
        .replace(/[^a-zA-Z\s]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[,\s]+$/, '')
        .replace(/\(/g, ' (')
        .split(' ')
        .filter(word => word.length > 0)
        .map(word => {
            if (word === word.toUpperCase()) return word;

            const lower = word.toLowerCase();
            return lowercaseWords.includes(lower)
                ? lower
                : lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
}

function update_full_name(frm) {
    const full_name = ['first_name', 'middle_name', 'last_name']
        .map(field => frm.doc[field])
        .filter(Boolean)
        .join(' ');
    frm.set_value('full_name', full_name);
}

function check_automation_enabled(fieldname, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: fieldname
        },
        callback(res) {
            callback(!!res.message);
        }
    });
}
