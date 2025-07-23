frappe.ui.form.on('Payment Terms Template', {
    onload(frm) {
        if (frm.is_new()) {
            console.log("New form - setting custom_automate to 1");
            frm.set_value('custom_automate', 1);
        }
    },

    template_name(frm) {
        if (!frm.doc.custom_automate) {
            console.log("custom_automate is disabled - skipping template_name formatting");
            return;
        }

        console.log("template_name changed - checking automation setting");

        checkAutomationEnabled('custom_payment_term_template', (isEnabled) => {
            if (isEnabled) {
                const formatted = formatText(frm.doc.template_name);
                frm.set_value('template_name', formatted);
                console.log("Formatted template_name:", formatted);
            }
        });
    },

    before_save(frm) {
        if (frm.doc.custom_automate === 1) {
            console.log("Before save - disabling custom_automate");
            frm.set_value('custom_automate', 0);
            // No need to call frm.save() here — Frappe will save this on its own
        }
    }
});

// Generic text formatting utility
function formatText(text) {
    if (!text) return '';

    const lowercaseWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'];

    return text
        .replace(/[^a-zA-Z\s]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[,\s]+$/, '')
        .replace(/\(/g, ' (')
        .split(' ')
        .map((word, i) => {
            if (word === word.toUpperCase()) return word;
            const lower = word.toLowerCase();
            if (lowercaseWords.includes(lower) && i !== 0) return lower;
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
}

// Reusable automation checker for any field
function checkAutomationEnabled(settingField, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: settingField
        },
        callback: (res) => {
            const isEnabled = !!res.message;
            console.log(`Automation (${settingField}) enabled?`, isEnabled);
            if (callback) callback(isEnabled);
        }
    });
}
