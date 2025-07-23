frappe.ui.form.on('Customer Group', {
    onload(frm) {
        if (frm.is_new()) {
            frm.set_value('custom_automate', 1);
        }
    },

    customer_group_name(frm) {
        handle_field_formatting(frm, 'customer_group_name', 'custom_customer_group');
    },

    before_save(frm) {
        frm.set_value('custom_automate', 0);
    }
});

// Reusable formatter
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
        .map(word => {
            if (word === word.toUpperCase()) return word;
            const lower = word.toLowerCase();
            return lowercaseWords.includes(lower) ? lower : (word.length >= 4 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower);
        })
        .join(' ');
}

// Reusable automation checker
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

// General handler for formatted fields
function handle_field_formatting(frm, fieldname, automation_field) {
    if (!frm.doc.custom_automate) return;

    check_automation_enabled(automation_field, (is_enabled) => {
        if (is_enabled) {
            const formatted = format_name(frm.doc[fieldname]);
            frm.set_value(fieldname, formatted);
        }
    });
}
