frappe.ui.form.on('*', {
    onload(frm) {
        frm._original_values = {};
    },

    refresh(frm) {
        console.log("******************** Global Autocorrect Loaded ********************");
        // Save original values on refresh
        frm._original_values = {};
        frm.meta.fields.forEach(field => {
            if (["Data", "Small Text", "Text", "Long Text", "Text Editor"].includes(field.fieldtype)) {
                frm._original_values[field.fieldname] = frm.doc[field.fieldname];
            }
        });
    },

    validate(frm) {
        let changes = [];

        frm.meta.fields.forEach(field => {
            if (["Data", "Small Text", "Text", "Long Text", "Text Editor"].includes(field.fieldtype)) {
                const old_val = frm._original_values[field.fieldname];
                const new_val = frm.doc[field.fieldname];

                if (old_val && new_val && old_val !== new_val) {
                    const old_words = old_val.split(/\s+/);
                    const new_words = new_val.split(/\s+/);

                    old_words.forEach((word, idx) => {
                        if (new_words[idx] && word !== new_words[idx]) {
                            changes.push({
                                original: word,
                                corrected: new_words[idx]
                            });
                        }
                    });
                }
            }
        });

        if (changes.length > 0) {
            const change = changes[0];  // show only first correction for now
            frappe.confirm(
                `You corrected "<b>${change.original}</b>" to "<b>${change.corrected}</b>".<br><br>Do you want to add it to your Private Dictionary?`,
                () => {
                    // YES
                    frappe.call({
                        method: "validation.validation.doctype.private_dictionary.private_dictionary.add_to_dictionary",
                        args: {
                            original: change.original,
                            corrected: change.corrected
                        },
                        callback: () => {
                            frappe.show_alert("Word added to Private Dictionary!");
                            frm.reload_doc();
                        }
                    });
                },
                () => {
                    // NO
                    frappe.show_alert("Skipped adding to dictionary.");
                }
            );
        }
    }

});
