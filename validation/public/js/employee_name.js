frappe.ui.form.on('Employee', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1);
        }

        check_automation_enabled(frm, function(is_enabled) {
            console.log("Automation enabled:", is_enabled);
        });
    },

    custom_current_address: function(frm) {
        console.log("Triggered custom_current_address:", frm.doc.custom_current_address);
        update_address_display(frm, 'custom_current_address', 'custom_address_display');
    },

    custom_permanent_address: function(frm) {
        console.log("Triggered custom_permanent_address:", frm.doc.custom_permanent_address);
        update_address_display(frm, 'custom_permanent_address', 'custom_permanent_address_display');
    },

    refresh: function(frm) {
        if (frm.doc.custom_current_address) {
            frm.trigger('custom_current_address');
        }
        if (frm.doc.custom_permanent_address) {
            frm.trigger('custom_permanent_address');
        }
    },

    first_name: function(frm) {
        auto_format_field(frm, 'first_name', update_employee_name);
    },

    middle_name: function(frm) {
        auto_format_field(frm, 'middle_name', update_employee_name);
    },

    last_name: function(frm) {
        auto_format_field(frm, 'last_name', update_employee_name);
    },

    family_background: function(frm) {
        auto_format_field(frm, 'family_background');
    },

    health_details: function(frm) {
        auto_format_field(frm, 'health_details');
    },

    person_to_be_contacted: function(frm) {
        auto_format_field(frm, 'person_to_be_contacted');
    },

    relation: function(frm) {
        auto_format_field(frm, 'relation');
    },

    bio: function(frm) {
        auto_format_field(frm, 'bio');
    },

    employee_number: function(frm) {
        if (frm.doc.custom_automate === 1) {
            let corrected = frm.doc.employee_number
                .toUpperCase()
                .replace(/[^A-Z0-9\-\/]/g, '')
                .slice(0, 16);
            frm.set_value('employee_number', corrected);
        }
    },

    personal_email: function(frm) {
        auto_format_email(frm, 'personal_email');
    },

    company_email: function(frm) {
        auto_format_email(frm, 'company_email');
    },

    before_save: function(frm) {
        if (frm.doc.custom_automate) {
            console.log("Before Save: Enabling custom_automate");
            frm.set_value('custom_automate', 0);
        }
    }
});

function update_address_display(frm, source_field, target_display_field) {
    const address_name = frm.doc[source_field];
    if (!address_name) {
        frm.set_value(target_display_field, '');
        return;
    }

    frappe.db.get_doc('Address', address_name)
        .then(address => {
            const parts = [
                address.address_line1,
                address.custom_post_office,
                address.custom_taluk,
                address.county,
                (address.city || '') + (address.state ? ', ' + address.state : ''),
                (address.country || '') + (address.pincode ? ' - ' + address.pincode : '')
            ];

            const formatted = parts.filter(part => part && part.trim()).join('\n');
            frm.set_value(target_display_field, formatted);
        })
        .catch(err => {
            console.log(`Error fetching address (${source_field}):`, err);
            frm.set_value(target_display_field, '');
        });
}

function auto_format_field(frm, fieldname, callback) {
    if (frm.doc.custom_automate) {
        check_automation_enabled(frm, function(is_enabled) {
            if (is_enabled) {
                const formatted = format_name(frm.doc[fieldname]);
                frm.set_value(fieldname, formatted);
                if (typeof callback === 'function') callback(frm);
            }
        });
    }
}

function auto_format_email(frm, fieldname) {
    if (frm.doc.custom_automate && frm.doc[fieldname]) {
        check_automation_enabled(frm, function(is_enabled) {
            if (is_enabled) {
                const formatted_email = format_email(frm.doc[fieldname]);
                frm.set_value(fieldname, formatted_email);
            }
        });
    }
}

function format_email(email) {
    if (!email) return '';
    return email
        .toLowerCase()
        .replace(/[^a-z0-9@._\-]/g, '')
        .replace(/\s+/g, '')
        .replace(/@{2,}/g, '@')
        .trim();
}

function format_name(name) {
    if (!name) return '';
    const lowercaseWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'];

    return name
        .replace(/[^a-zA-Z\s]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[,\s]+$/, '')
        .replace(/\(/g, ' (')
        .split(' ')
        .map((word, index) => {
            if (word === word.toUpperCase()) return word;
            const lower = word.toLowerCase();
            if (lowercaseWords.includes(lower)) return lower;
            if (word.length >= 4) return lower.charAt(0).toUpperCase() + lower.slice(1);
            return lower;
        })
        .join(' ');
}

function update_employee_name(frm) {
    let full_name = [frm.doc.first_name, frm.doc.middle_name, frm.doc.last_name]
        .filter(Boolean)
        .join(' ');
    frm.set_value('employee_name', full_name);
}

function check_automation_enabled(frm, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: 'enable_employee_automation'
        },
        callback: function(res) {
            const enabled = !!res.message;
            console.log("Automation enabled?", enabled);
            if (callback) callback(enabled);
        }
    });
}
