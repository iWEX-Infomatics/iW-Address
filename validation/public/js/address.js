frappe.ui.form.on('Address', {
    onload(frm) {
        if (frm.is_new()) {
            frm.set_value('custom_automate', 1);
        }

        check_automation_enabled(frm, () => {
            frm.trigger('set_address_title');
        });
    },

    links_on_form_rendered(frm) {
        frm.trigger('set_address_title');
    },

    set_address_title(frm) {
        const { address_title, city, links } = frm.doc;
        if (address_title || !city || !links?.length) return;

        const link = links.find(l => ['Customer', 'Supplier'].includes(l.link_doctype));
        if (link) {
            frm.set_value('address_title', `${city} - ${link.link_name}`);
        }
    },

    city: update_field('city'),
    address_line1: update_field('address_line1', true),
    address_title: update_field('address_title'),
    custom_post_office: update_field('custom_post_office'),
    custom_taluk: update_field('custom_taluk'),
    state: update_field('state'),

    pincode(frm) {
        const { pincode, country, custom_automate } = frm.doc;
        if (!pincode) {
            frm.set_value('custom_post_office', '');
            frm.set_value('custom_taluk', '');
            return;
        }

        if (custom_automate !== 1 || country !== 'India' || pincode.length !== 6) return;

        frappe.call({
            method: 'validation.customization.address.get_post_offices_api',
            args: { pincode },
            callback({ message: offices }) {
                if (!Array.isArray(offices)) return;

                if (offices.length === 1) {
                    const o = offices[0];
                    set_office_fields(frm, o);
                } else if (offices.length > 1) {
                    let options = offices.map((o, i) => ({ label: o.post_office, value: i }));

                    new frappe.ui.Dialog({
                        title: 'Select Post Office',
                        fields: [{ label: 'Post Office', fieldname: 'selected_po', fieldtype: 'Select', options }],
                        primary_action_label: 'Insert',
                        primary_action({ selected_po }) {
                            if (selected_po === undefined || selected_po === '') {
                                frappe.msgprint('Please select a Post Office.');
                                return;
                            }

                            set_office_fields(frm, offices[+selected_po]);
                            this.hide();
                        }
                    }).show();
                } else {
                    frappe.msgprint('No Post Office found for this Pincode');
                }
            }
        });
    },

    before_save: function(frm) {
        if (!frm.doc.custom_automate && !frm._auto_updated) {
            frappe.model.set_value(frm.doctype, frm.docname, 'custom_automate', 0)
                .then(() => {
                    frm._auto_updated = true;
                });
        }
    }
});

// ───────────────────────────
// Utility Functions
// ───────────────────────────

function update_field(fieldname, is_address_line1 = false) {
    return function (frm) {
        if (!frm.doc.custom_automate) return;

        check_automation_enabled(frm, is_enabled => {
            if (is_enabled) {
                frm.set_value(fieldname, format_text(frm.doc[fieldname], is_address_line1));
            }
        });
    };
}

function format_text(text, is_address_line1 = false) {
    if (!text) return '';

    const lowercaseWords = [
        'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor',
        'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with'
    ];

    const pattern = is_address_line1 ? /[^a-zA-Z0-9\s#(),\/-]/g : /[^a-zA-Z\s]/g;

    let clean = text
        .replace(pattern, '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[,\s]+$/, '');

    if (!is_address_line1) clean = clean.replace(/\(/g, ' (');

    return clean
        .split(' ')
        .map(word => {
            if (word === word.toUpperCase()) return word;

            const lower = word.toLowerCase();
            if (lowercaseWords.includes(lower)) return lower;
            return word.length >= 4
                ? lower.charAt(0).toUpperCase() + lower.slice(1)
                : lower;
        })
        .join(' ');
}

function check_automation_enabled(frm, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: 'enable_address_automation'
        },
        callback: ({ message }) => {
            callback(!!message);
        }
    });
}

function set_office_fields(frm, data) {
    frm.set_value('custom_post_office', data.post_office);
    frm.set_value('custom_taluk', data.taluk);
    frm.set_value('state', data.state);
    frm.set_value('county', `${data.district} DT`);
}
