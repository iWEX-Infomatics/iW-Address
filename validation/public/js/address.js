// Global State & Constants

const debounceTimeouts = {};
const lastProcessedValues = {};
const lowercaseWords = [
    'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor',
    'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'
];

// Address Form Events

frappe.ui.form.on('Address', {
    onload(frm) {
        if (frm.is_new()) frm.set_value('custom_automate', 1);

        if (!frm._original_values) {
            frm._original_values = {};
            frm.meta.fields
                .filter(f => ["Data", "Small Text", "Text", "Long Text", "Text Editor"].includes(f.fieldtype))
                .forEach(f => frm._original_values[f.fieldname] = frm.doc[f.fieldname]);
        }

        frm._popup_shown_fields = {};

        check_automation_enabled(frm, () => frm.trigger('set_address_title'));
    },

    links_on_form_rendered: frm => frm.trigger('set_address_title'),

    set_address_title(frm) {
        const { address_title, city, links } = frm.doc;
        if (address_title || !city || !links?.length) return;

        const link = links.find(l => ['Customer', 'Supplier'].includes(l.link_doctype));
        if (link) frm.set_value('address_title', `${city} - ${link.link_name}`);
    },

    city: frm => handle_address_field(frm, 'city'),
    address_line1: frm => handle_address_field(frm, 'address_line1', true),
    address_title: frm => handle_address_field(frm, 'address_title'),
    custom_post_office: frm => handle_address_field(frm, 'custom_post_office'),
    custom_taluk: frm => handle_address_field(frm, 'custom_taluk'),
    state: frm => handle_address_field(frm, 'state'),

    pincode(frm) {
        const { pincode, country, custom_automate } = frm.doc;
        if (!pincode) return ['custom_post_office', 'custom_taluk'].forEach(f => frm.set_value(f, ''));

        if (custom_automate !== 1 || country !== 'India' || pincode.length !== 6) return;

        frappe.call({
            method: 'validation.customization.address.get_post_offices_api',
            args: { pincode },
            callback({ message: offices }) {
                if (!Array.isArray(offices) || !offices.length) {
                    return frappe.msgprint('No Post Office found for this Pincode');
                }

                if (offices.length === 1) {
                    set_office_fields(frm, offices[0]);
                } else {
                    const options = offices.map((o, i) => ({ label: o.post_office, value: i }));
                    new frappe.ui.Dialog({
                        title: 'Select Post Office',
                        fields: [{ label: 'Post Office', fieldname: 'selected_po', fieldtype: 'Select', options }],
                        primary_action_label: 'Insert',
                        primary_action({ selected_po }) {
                            if (!selected_po) return frappe.msgprint('Please select a Post Office.');
                            set_office_fields(frm, offices[+selected_po]);
                            this.hide();
                        }
                    }).show();
                }
            }
        });
    },

    before_save(frm) {
        Object.values(debounceTimeouts).forEach(clearTimeout);

        ['city', 'address_line1', 'address_title', 'custom_post_office', 'custom_taluk', 'state']
            .forEach(fieldname => {
                const cleaned = frm.doc[fieldname]?.replace(/[,\s]+$/, '').trim();
                if (cleaned && frm.doc[fieldname] !== cleaned) frm.set_value(fieldname, cleaned);
            });

        if (!frm.doc.custom_automate && !frm._auto_updated) {
            frappe.model.set_value(frm.doctype, frm.docname, 'custom_automate', 0)
                .then(() => frm._auto_updated = true);
        }

        // 🔁 Move dictionary popup to before_save
        const changes = frm.meta.fields
            .filter(f => ["Data", "Small Text", "Text", "Long Text", "Text Editor"].includes(f.fieldtype))
            .flatMap(f => {
                const { fieldname } = f;
                if (frm._popup_shown_fields?.[fieldname]) return [];
                const old_val = frm._original_values?.[fieldname];
                const new_val = frm.doc[fieldname];
                if (!(old_val && new_val && old_val !== new_val)) return [];

                return old_val.split(/\s+/)
                    .map((word, idx) => new_val.split(/\s+/)[idx] && word !== new_val.split(/\s+/)[idx]
                        ? { fieldname, original: word, corrected: new_val.split(/\s+/)[idx] }
                        : null
                    ).filter(Boolean);
            });

        if (changes.length) {
            const { fieldname, original, corrected } = changes[0];
            frm._popup_shown_fields[fieldname] = true;

            frappe.confirm(
                `You corrected "<b>${original}</b>" to "<b>${corrected}</b>".<br><br>Do you want to add it to your Private Dictionary?`,
                () => frappe.call({
                    method: "validation.validation.doctype.private_dictionary.private_dictionary.add_to_dictionary",
                    args: { original, corrected },
                    callback: () => {
                        frappe.show_alert("Word added to Private Dictionary!");
                        frm.reload_doc();
                    }
                }),
                () => frappe.show_alert("Skipped adding to dictionary.")
            );
        }
    }
});

// Helpers

function handle_address_field(frm, fieldname, is_address_line1 = false) {
    if (!frm.doc.custom_automate) return;

    const currentValue = frm.doc[fieldname] || '';
    check_automation_enabled(frm, is_enabled => {
        if (is_enabled) {
            const formattedRealtime = format_text_realtime(currentValue);
            if (currentValue !== formattedRealtime) return frm.set_value(fieldname, formattedRealtime);
        }
    });

    clearTimeout(debounceTimeouts[fieldname]);
    debounceTimeouts[fieldname] = setTimeout(() => {
        check_automation_enabled(frm, is_enabled => {
            if (!is_enabled) return;
            const valueToFormat = frm.doc[fieldname] || '';
            if (lastProcessedValues[fieldname] === valueToFormat) return;

            const formatted = format_text(valueToFormat, is_address_line1);
            lastProcessedValues[fieldname] = formatted;
            if (formatted !== valueToFormat) frm.set_value(fieldname, formatted);
        });
    }, 300);
}

function capitalize_words(words) {
    return words.map(word => {
        if (!word) return word;
        if (word === word.toUpperCase()) return word;
        const lower = word.toLowerCase();
        return lowercaseWords.includes(lower) ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    });
}

function format_text_realtime(text) {
    if (!text || text.endsWith(' ')) return text;
    return capitalize_words(text.split(' ')).join(' ');
}

function format_text(text, is_address_line1 = false) {
    if (!text || text.endsWith(' ')) return text;

    const pattern = is_address_line1 ? /[^a-zA-Z0-9\s#(),\/-]/g : /[^a-zA-Z\s]/g;
    let clean = text.replace(pattern, '').trim().replace(/\s+/g, ' ').replace(/[,\s]+$/, '');
    if (!is_address_line1) clean = clean.replace(/\(/g, ' (');

    return capitalize_words(clean.split(' ').filter(Boolean)).join(' ');
}

function check_automation_enabled(frm, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: { doctype: 'Settings for Automation', field: 'enable_address_automation' },
        callback: ({ message }) => callback(!!message)
    });
}

function set_office_fields(frm, data) {
    frm.set_value('custom_post_office', data.post_office);
    frm.set_value('custom_taluk', data.taluk);
    frm.set_value('state', data.state);
    frm.set_value('county', `${data.district} DT`);
}
