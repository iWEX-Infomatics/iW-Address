frappe.ui.form.on('Bank Account', {
    onload(frm) {
        if (frm.is_new()) {
            frm.set_value('custom_automate', 1);
        }
    },

    account_name(frm) {
        if (!frm.doc.custom_automate) return;

        check_automation_enabled(frm, function(is_enabled) {
            if (is_enabled) {
                frm.set_value('account_name', format_name(frm.doc.account_name));
            }
        });
    },

    before_save(frm) {
        // Always disable automation before save
        frm.set_value('custom_automate', 0);
    }
});


function format_name(name) {
    if (!name) return '';

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
        .map(word => {
            if (word === word.toUpperCase()) return word;

            const lower = word.toLowerCase();
            if (lowercaseWords.includes(lower)) return lower;
            if (word.length >= 4) return lower.charAt(0).toUpperCase() + lower.slice(1);
            return lower;
        })
        .join(' ');
}

function check_automation_enabled(frm, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: 'enable_bank_automation'
        },
        callback(response) {
            callback(!!response.message);
        }
    });
}
