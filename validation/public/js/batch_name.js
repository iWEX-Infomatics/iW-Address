frappe.ui.form.on('Batch', {
    onload: function(frm) {
        if (frm.is_new()) {
            console.log("Form is new. Initializing custom_automate.");
            frm.set_value('custom_automate', 1); // Enable custom_automate for new forms
        }
    },

    before_save: function(frm) {
        if (frm.doc.custom_automate === 1 && frm.doc.batch_id) {
            
           
            let corrected_batch_id = frm.doc.batch_id
                .toUpperCase()  
                .replace(/[^A-Z0-9\-\/]/g, '') 
                .slice(0, 16); 
            
            frm.set_value('batch_id', corrected_batch_id);
            console.log("batch_id:",corrected_batch_id)
        }
    }
});
