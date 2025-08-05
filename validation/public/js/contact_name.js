frappe.ui.form.on('Contact', {
    onload(frm) {
        if (frm.is_new()) {
            frm.set_value('custom_automate', 1);
        }
        check_automation_enabled('enable_contact_automation', (is_enabled) => {
            console.log("Automation enabled:", is_enabled);
        });
    },
    first_name: (frm) => handle_name_field(frm, 'first_name'),
    middle_name: (frm) => handle_name_field(frm, 'middle_name'),
    last_name: (frm) => handle_name_field(frm, 'last_name'),
    before_save(frm) {
        // Clear all pending timeouts before save
        Object.values(debounceTimeouts).forEach(timeout => clearTimeout(timeout));
        
        // Clean up trailing commas and spaces before save
        ['first_name', 'middle_name', 'last_name'].forEach(fieldname => {
            const value = frm.doc[fieldname];
            if (value) {
                const cleaned = value.replace(/[,\s]+$/, '').trim();
                if (value !== cleaned) {
                    frm.set_value(fieldname, cleaned);
                }
            }
        });
        
        frm.set_value('custom_automate', 0);
    }
});

// Debounce timeouts for each field — to avoid formatting too early
const debounceTimeouts = {};
// Store last processed values to avoid unnecessary formatting
const lastProcessedValues = {};

function handle_name_field(frm, fieldname) {
    if (!frm.doc.custom_automate) return;
    
    const currentValue = frm.doc[fieldname] || '';
    
    check_automation_enabled('enable_contact_automation', (is_enabled) => {
        if (is_enabled) {
            // Real-time formatting for 4+ character words
            const realTimeFormatted = format_name_realtime(currentValue);
            
            if (currentValue !== realTimeFormatted) {
                frm.set_value(fieldname, realTimeFormatted);
                update_full_name(frm);
                return;
            }
        }
    });
    
    // Clear any previous timeout set for this field
    if (debounceTimeouts[fieldname]) {
        clearTimeout(debounceTimeouts[fieldname]);
    }
    
    // Set a new timeout for full formatting after typing has paused
    debounceTimeouts[fieldname] = setTimeout(() => {
        check_automation_enabled('enable_contact_automation', (is_enabled) => {
            if (is_enabled) {
                const valueToFormat = frm.doc[fieldname] || '';
                
                // Skip if value hasn't changed since last processing
                if (lastProcessedValues[fieldname] === valueToFormat) {
                    return;
                }
                
                const formatted = format_name(valueToFormat);
                
                // Only update if formatting actually changed something
                if (valueToFormat !== formatted) {
                    lastProcessedValues[fieldname] = formatted;
                    frm.set_value(fieldname, formatted);
                    update_full_name(frm);
                } else {
                    lastProcessedValues[fieldname] = valueToFormat;
                }
            }
        });
    }, 300);
}

function format_name_realtime(name) {
    if (!name) return '';
    
    // Don't format if user is still typing (ends with space)
    if (name.endsWith(' ')) {
        return name;
    }
    
    const lowercaseWords = [
        'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to',
        'from', 'by', 'in', 'of', 'with'
    ];
    
    return name
        .split(' ')
        .map(word => {
            if (!word) return word;
            if (word === word.toUpperCase()) return word; // Keep all caps words as they are
            const lower = word.toLowerCase();
            if (lowercaseWords.includes(lower)) return lower; // Keep small words lowercase
            if (word.length >= 4) return lower.charAt(0).toUpperCase() + lower.slice(1); // Capitalize immediately when 4+ chars
            return lower; // Keep short words lowercase
        })
        .join(' ');
}

function format_name(name) {
    if (!name) return '';
    
    // Don't format if user is still typing (ends with space)
    if (name.endsWith(' ')) {
        return name;
    }
    
    const lowercaseWords = [
        'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to',
        'from', 'by', 'in', 'of', 'with'
    ];
    
    return name
        .replace(/[^a-zA-Z\s]/g, '') // Remove special characters
        .trim() // Remove leading/trailing spaces
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/[,\s]+$/, '') // Remove trailing commas and spaces
        .replace(/\(/g, ' (') // Add space before opening parenthesis
        .split(' ')
        .filter(word => word.length > 0) // Remove empty words
        .map(word => {
            if (word === word.toUpperCase()) return word; // Keep all caps words as they are
            const lower = word.toLowerCase();
            if (lowercaseWords.includes(lower)) return lower; // Keep small words lowercase
            if (word.length >= 4) return lower.charAt(0).toUpperCase() + lower.slice(1); // Capitalize first letter of long words
            return lower; // Keep short words lowercase
        })
        .join(' ');
}

function update_full_name(frm) {
    const full_name = ['first_name', 'middle_name', 'last_name']
        .map(field => frm.doc[field])
        .filter(Boolean)
        .join(' ');
    frm.set_value('full_name', full_name);
}

function check_automation_enabled(fieldname, callback) {
    frappe.call({
        method: 'frappe.client.get_single_value',
        args: {
            doctype: 'Settings for Automation',
            field: fieldname
        },
        callback(res) {
            callback(!!res.message);
        }
    });
}