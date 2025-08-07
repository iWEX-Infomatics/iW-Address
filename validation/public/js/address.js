// Debounce timeouts for each field
const debounceTimeouts = {};
// Store last processed values to avoid unnecessary formatting
const lastProcessedValues = {};

frappe.ui.form.on('Address', {
    onload(frm) {
        if (frm.is_new()) {
            frm.set_value('custom_automate', 1);
        }

        check_automation_enabled(frm, () => {
            frm.trigger('set_address_title');
        });
    },

    links_on_form_rendered(frm) {
        frm.trigger('set_address_title');
    },

    set_address_title(frm) {
        const { address_title, city, links } = frm.doc;
        if (address_title || !city || !links?.length) return;

        const link = links.find(l => ['Customer', 'Supplier'].includes(l.link_doctype));
        if (link) {
            frm.set_value('address_title', `${city} - ${link.link_name}`);
        }
    },

    city: (frm) => handle_address_field(frm, 'city'),
    address_line1: (frm) => handle_address_field(frm, 'address_line1', true),
    address_title: (frm) => handle_address_field(frm, 'address_title'),
    custom_post_office: (frm) => handle_address_field(frm, 'custom_post_office'),
    custom_taluk: (frm) => handle_address_field(frm, 'custom_taluk'),
    state: (frm) => handle_address_field(frm, 'state'),

    pincode(frm) {
        const { pincode, country, custom_automate } = frm.doc;
        if (!pincode) {
            frm.set_value('custom_post_office', '');
            frm.set_value('custom_taluk', '');
            return;
        }

        if (custom_automate !== 1 || country !== 'India' || pincode.length !== 6) return;

        frappe.call({
            method: 'validation.customization.address.get_post_offices_api',
            args: { pincode },
            callback({ message: offices }) {
                if (!Array.isArray(offices)) return;

                if (offices.length === 1) {
                    const o = offices[0];
                    set_office_fields(frm, o);
                } else if (offices.length > 1) {
                    let options = offices.map((o, i) => ({ label: o.post_office, value: i }));

                    new frappe.ui.Dialog({
                        title: 'Select Post Office',
                        fields: [{ label: 'Post Office', fieldname: 'selected_po', fieldtype: 'Select', options }],
                        primary_action_label: 'Insert',
                        primary_action({ selected_po }) {
                            if (selected_po === undefined || selected_po === '') {
                                frappe.msgprint('Please select a Post Office.');
                                return;
                            }

                            set_office_fields(frm, offices[+selected_po]);
                            this.hide();
                        }
                    }).show();
                } else {
                    frappe.msgprint('No Post Office found for this Pincode');
                }
            }
        });
    },

    before_save(frm) {
        // Clear all pending timeouts before save
        Object.values(debounceTimeouts).forEach(timeout => clearTimeout(timeout));
        
        // Clean up trailing commas and spaces before save
        ['city', 'address_line1', 'address_title', 'custom_post_office', 'custom_taluk', 'state'].forEach(fieldname => {
            const value = frm.doc[fieldname];
            if (value) {
                const cleaned = value.replace(/[,\s]+$/, '').trim();
                if (value !== cleaned) {
                    frm.set_value(fieldname, cleaned);
                }
            }
        });

        if (!frm.doc.custom_automate && !frm._auto_updated) {
            frappe.model.set_value(frm.doctype, frm.docname, 'custom_automate', 0)
                .then(() => {
                    frm._auto_updated = true;
                });
        }
    }
});

// ───────────────────────────
// Field Handler with Debouncing
// ───────────────────────────

function handle_address_field(frm, fieldname, is_address_line1 = false) {
    if (!frm.doc.custom_automate) return;
    
    const currentValue = frm.doc[fieldname] || '';
    
    check_automation_enabled(frm, (is_enabled) => {
        if (is_enabled) {
            // Real-time formatting for 4+ character words
            const realTimeFormatted = format_text_realtime(currentValue, is_address_line1);
            
            if (currentValue !== realTimeFormatted) {
                frm.set_value(fieldname, realTimeFormatted);
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
        check_automation_enabled(frm, (is_enabled) => {
            if (is_enabled) {
                const valueToFormat = frm.doc[fieldname] || '';
                
                // Skip if value hasn't changed since last processing
                if (lastProcessedValues[fieldname] === valueToFormat) {
                    return;
                }
                
                const formatted = format_text(valueToFormat, is_address_line1);
                
                // Only update if formatting actually changed something
                if (valueToFormat !== formatted) {
                    lastProcessedValues[fieldname] = formatted;
                    frm.set_value(fieldname, formatted);
                } else {
                    lastProcessedValues[fieldname] = valueToFormat;
                }
            }
        });
    }, 300);
}

// ───────────────────────────
// Formatting Functions
// ───────────────────────────

function format_text_realtime(text, is_address_line1 = false) {
    if (!text) return '';

    // Don't format if user is still typing (ends with space)
    if (text.endsWith(' ')) {
        return text;
    }

    const lowercaseWords = [
        'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor',
        'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'
    ];

    return text
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


function format_text(text, is_address_line1 = false) {
    if (!text) return '';

    if (text.endsWith(' ')) {
        return text;
    }

    const lowercaseWords = [
        'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor',
        'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'
    ];

    const pattern = is_address_line1 ? /[^a-zA-Z0-9\s#(),\/-]/g : /[^a-zA-Z\s]/g;

    let clean = text
        .replace(pattern, '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[,\s]+$/, '');

    if (!is_address_line1) clean = clean.replace(/\(/g, ' (');

    return clean
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


function check_automation_enabled(frm, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: 'enable_address_automation'
        },
        callback: ({ message }) => {
            callback(!!message);
        }
    });
}

function set_office_fields(frm, data) {
    frm.set_value('custom_post_office', data.post_office);
    frm.set_value('custom_taluk', data.taluk);
    frm.set_value('state', data.state);
    frm.set_value('county', `${data.district} DT`);
}