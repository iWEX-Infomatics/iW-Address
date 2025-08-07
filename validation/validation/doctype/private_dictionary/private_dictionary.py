# private_dictionary.py

import frappe
import re
from frappe.model.document import Document


class PrivateDictionary(Document):
    pass


def apply_private_dictionary(value):
    dictionary_doc = frappe.get_single('Private Dictionary')
    replace_map = {}
    replacements_made = {}

    for row in dictionary_doc.dictionary:
        if row.original_name and row.suggested_name:
            replace_map[row.original_name] = row.suggested_name

    for original, suggested in replace_map.items():
        pattern = r'\b' + re.escape(original) + r'\b'
        if re.search(pattern, value, flags=re.IGNORECASE):
            value = re.sub(pattern, suggested, value, flags=re.IGNORECASE)
            replacements_made[suggested] = original  # Track replacements

    return value, replacements_made


def global_validate_replacement(doc, method):
    text_field_types = ['Data', 'Small Text', 'Text', 'Long Text', 'Text Editor']

    doc._auto_replacements = []

    for field in doc.meta.fields:
        if field.fieldtype in text_field_types:
            val = doc.get(field.fieldname)
            if val and isinstance(val, str):
                new_val, replacements = apply_private_dictionary(val)
                if new_val != val:
                    doc.set(field.fieldname, new_val)
                    doc._auto_replacements.append({
                        "fieldname": field.fieldname,
                        "original_value": val,
                        "corrected_value": new_val,
                        "replacements": replacements
                    })

@frappe.whitelist()
def add_to_dictionary(original, corrected):
    if not original or not corrected:
        frappe.throw("Original and corrected words are required.")

    dictionary_doc = frappe.get_single('Private Dictionary')
    
    # Check if entry already exists in child table `dictionary`
    for row in dictionary_doc.dictionary:
        if row.original_name == original and row.suggested_name == corrected:
            return "Already exists."

    # Append new child row
    dictionary_doc.append("dictionary", {
        "original_name": original,
        "suggested_name": corrected
    })
    dictionary_doc.save(ignore_permissions=True)

    return "Inserted"


