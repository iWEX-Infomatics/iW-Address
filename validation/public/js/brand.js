frappe.ui.form.on('Brand', {
    onload(frm) {
        if (frm.is_new()) {
            frm.set_value('custom_automate', 1);
        }
    },

    brand: (frm) => handle_field_automation(frm, 'brand'),
    description: (frm) => handle_field_automation(frm, 'description'),

    before_save(frm) {
        frm.set_value('custom_automate', 0);
    }
});

function handle_field_automation(frm, fieldname) {
    if (!frm.doc.custom_automate) return;

    check_automation_enabled('enable_brand_automation', (is_enabled) => {
        if (is_enabled) {
            const value = frm.doc[fieldname];
            const formatted = format_name(value);
            frm.set_value(fieldname, formatted);
        }
    });
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
        .map(word => {
            if (word === word.toUpperCase()) return word;

            const lower = word.toLowerCase();
            if (lowercaseWords.includes(lower)) return lower;
            if (word.length >= 4) return lower.charAt(0).toUpperCase() + lower.slice(1);
            return lower;
        })
        .join(' ');
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
