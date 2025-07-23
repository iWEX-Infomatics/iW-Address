frappe.ui.form.on('Item Group', {
    onload(frm) {
        if (frm.is_new()) {
            frm.set_value('custom_automate', 1);
        }
    },

    item_group_name(frm) {
        is_automation_allowed(frm, 'enable_item_group_automation', () => {
            const formatted = format_name(frm.doc.item_group_name);
            frm.set_value('item_group_name', formatted);
        });
    },

    before_save(frm) {
        if (frm.doc.custom_automate) {
            frm.set_value('custom_automate', 0);
            frm.save()
                .then(() => console.log("custom_automate saved."))
                .catch(err => console.error("Error saving form:", err));
        }
    }
});

function is_automation_allowed(frm, setting_field, callback) {
    if (!frm.doc.custom_automate) {
        return;
    }

    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: setting_field
        },
        callback(res) {
            if (res.message) {
                console.log("Automation is enabled.");
                callback();
            } else {
                console.log("Automation is disabled via settings.");
            }
        }
    });
}

function format_name(name) {
    if (!name) return '';

    const lowercaseWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'];
    let formattedName = name.replace(/[^a-zA-Z\s]/g, '').trim().replace(/\s+/g, ' ').replace(/[,\s]+$/, '').replace(/\(/g, ' (');

    return formattedName.split(' ').map((word, index) => {
        if (word === word.toUpperCase()) return word;
        const lower = word.toLowerCase();
        return lowercaseWords.includes(lower) ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join(' ');
}
