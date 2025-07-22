frappe.ui.form.on('Batch', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1); // Enable custom_automate for new forms
        }
    },

    batch_id: function(frm) {
        if (frm.doc.custom_automate === 1 && frm.doc.batch_id) {
            
           
            let corrected_batch_id = frm.doc.batch_id
                .toUpperCase()  
                .replace(/[^A-Z0-9\-\/]/g, '') 
                .slice(0, 16); 
            
            frm.set_value('batch_id', corrected_batch_id);
            console.log("batch_id:",corrected_batch_id)
        }
    },
    // after_save: function(frm) {
    //     if (!frm.doc.custom_automate) {
    //         frm.set_value('custom_automate', 1); // Enable custom_automate after the first save

    //         // Save the form again to persist the change
    //         frm.save()
    //             .then(() => {
    //                 console.log("custom_automate has been enabled and saved.");
    //             })
    //             .catch((error) => {
    //                 console.error("Error while saving the form after enabling custom_automate:", error);
    //             });
    //     }
    // }
});
