frappe.ui.form.on('Contact', {
    onload(frm) {
        if (frm.is_new()) frm.set_value('custom_automate', 1);

        // Store original values for autocorrect tracking
        const textFields = get_text_fields(frm);
        if (!frm._original_values) {
            frm._original_values = Object.fromEntries(
                textFields.map(f => [f.fieldname, frm.doc[f.fieldname]])
            );
        }

        // Cache automation setting for faster checks
        check_automation_enabled('enable_contact_automation', enabled => {
            frm._automation_enabled = enabled;
            console.log("Automation enabled:", enabled);
        });
    },

    first_name: frm => handle_name_field(frm, 'first_name'),
    middle_name: frm => handle_name_field(frm, 'middle_name'),
    last_name: frm => handle_name_field(frm, 'last_name'),

    validate(frm) {
        if (!frm._confirmed_fields) frm._confirmed_fields = {};
        const changes = detect_word_changes(frm);

        if (changes.length) {
            const { original, corrected, fieldname } = changes[0];
            frappe.confirm(
                `You corrected "<b>${original}</b>" to "<b>${corrected}</b>".<br><br>Do you want to add it to your Private Dictionary?`,
                () => { // YES
                    frappe.call({
                        method: "validation.validation.doctype.private_dictionary.private_dictionary.add_to_dictionary",
                        args: { original, corrected },
                        callback: () => {
                            frappe.show_alert("Word added to Private Dictionary!");
                            frm.reload_doc();
                        }
                    });
                    frm._confirmed_fields[fieldname] = true;
                },
                () => { // NO
                    frappe.show_alert("Skipped adding to dictionary.");
                    frm._confirmed_fields[fieldname] = true;
                }
            );
        }
    },

    before_save(frm) {
        // Cancel pending debounce timers
        Object.values(debounceTimeouts).forEach(clearTimeout);

        // Clean trailing commas/spaces
        ['first_name', 'middle_name', 'last_name'].forEach(f => {
            const val = frm.doc[f];
            if (val) {
                const cleaned = val.replace(/[,\s]+$/, '').trim();
                if (val !== cleaned) frm.set_value(f, cleaned);
            }
        });

        frm.set_value('custom_automate', 0);
    }
});

// ------------------ Constants & Helpers ------------------
const TEXT_TYPES = ["Data", "Small Text", "Text", "Long Text", "Text Editor"];
const LOWERCASE_WORDS = [
    'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor',
    'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'
];

const debounceTimeouts = {};
const lastProcessedValues = {};

function get_text_fields(frm) {
    return frm.meta.fields.filter(f => TEXT_TYPES.includes(f.fieldtype));
}

function detect_word_changes(frm) {
    const changes = [];
    get_text_fields(frm).forEach(({ fieldname }) => {
        const oldVal = frm._original_values[fieldname];
        const newVal = frm.doc[fieldname];
        if (oldVal && newVal && oldVal !== newVal) {
            const oldWords = oldVal.split(/\s+/);
            const newWords = newVal.split(/\s+/);
            oldWords.forEach((word, i) => {
                if (newWords[i] && word !== newWords[i] && !frm._confirmed_fields[fieldname]) {
                    changes.push({ original: word, corrected: newWords[i], fieldname });
                }
            });
        }
    });
    return changes;
}

function handle_name_field(frm, fieldname) {
    if (!frm.doc.custom_automate) return;

    const currentValue = frm.doc[fieldname] || '';

    if (frm._automation_enabled) {
        const rtFormatted = format_name(currentValue, true);
        if (currentValue !== rtFormatted) {
            frm.set_value(fieldname, rtFormatted);
            return update_full_name(frm);
        }
    }

    clearTimeout(debounceTimeouts[fieldname]);
    debounceTimeouts[fieldname] = setTimeout(() => {
        if (frm._automation_enabled) {
            const val = frm.doc[fieldname] || '';
            if (lastProcessedValues[fieldname] === val) return;

            const formatted = format_name(val);
            if (val !== formatted) {
                lastProcessedValues[fieldname] = formatted;
                frm.set_value(fieldname, formatted);
                update_full_name(frm);
            } else {
                lastProcessedValues[fieldname] = val;
            }
        }
    }, 300);
}

function format_name(name, realtime = false) {
    if (!name || name.endsWith(' ')) return name || '';

    let cleaned = name;
    if (!realtime) {
        cleaned = name
            .replace(/[^a-zA-Z\s]/g, '')
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[,\s]+$/, '')
            .replace(/\(/g, ' (');
    }

    return cleaned
        .split(' ')
        .filter(Boolean)
        .map(word => {
            if (word === word.toUpperCase()) return word;
            const lower = word.toLowerCase();
            return LOWERCASE_WORDS.includes(lower)
                ? lower
                : lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
}

function update_full_name(frm) {
    const full = ['first_name', 'middle_name', 'last_name']
        .map(f => frm.doc[f])
        .filter(Boolean)
        .join(' ');
    frm.set_value('full_name', full);
}

function check_automation_enabled(fieldname, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: { doctype: 'Settings for Automation', field: fieldname },
        callback: r => callback(!!r.message)
    });
}
