frappe.ui.form.on('Contact', {
    onload(frm) {
        if (frm.is_new()) {
            frm.set_value('custom_automate', 1);
        }

        check_automation_enabled('enable_contact_automation', (is_enabled) => {
            console.log("Automation enabled:", is_enabled);
        });
    },

    first_name: (frm) => handle_name_field(frm, 'first_name'),
    middle_name: (frm) => handle_name_field(frm, 'middle_name'),
    last_name: (frm) => handle_name_field(frm, 'last_name'),

    before_save(frm) {
        frm.set_value('custom_automate', 0);
    }
});

function handle_name_field(frm, fieldname) {
    if (!frm.doc.custom_automate) return;

    check_automation_enabled('enable_contact_automation', (is_enabled) => {
        if (is_enabled) {
            const formatted = format_name(frm.doc[fieldname]);
            frm.set_value(fieldname, formatted);
            update_full_name(frm);
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
