frappe.ui.form.on('Supplier Group', {
    onload(frm) {
        if (frm.is_new()) {
            console.log("New form - setting custom_automate to 1");
            frm.set_value('custom_automate', 1);
        }
    },

    supplier_group_name(frm) {
        handleFormattingAutomation(frm, 'supplier_group_name', 'custom_supplier_group');
    },

    before_save(frm) {
        if (frm.doc.custom_automate === 1) {
            console.log("Before save - disabling custom_automate");
            frm.set_value('custom_automate', 0);
            // No need to force save manually — Frappe will handle saving
        }
    }
});

// 🔁 Shared formatting handler
function handleFormattingAutomation(frm, fieldName, automationField) {
    if (!frm.doc.custom_automate) {
        console.log(`custom_automate is disabled — skipping ${fieldName}`);
        return;
    }

    checkAutomationEnabled(automationField, (isEnabled) => {
        if (isEnabled) {
            const original = frm.doc[fieldName];
            const formatted = formatText(original);
            frm.set_value(fieldName, formatted);
            console.log(`Formatted ${fieldName}:`, formatted);
        }
    });
}

// 🔁 Text formatter utility
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
        .map((word, index) => {
            if (word === word.toUpperCase()) return word;
            const lower = word.toLowerCase();
            if (lowercaseWords.includes(lower) && index !== 0) return lower;
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
}

// 🔁 Automation flag checker
function checkAutomationEnabled(fieldName, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: fieldName
        },
        callback(res) {
            const isEnabled = !!res.message;
            console.log(`${fieldName} automation enabled?`, isEnabled);
            if (callback) callback(isEnabled);
        }
    });
}
