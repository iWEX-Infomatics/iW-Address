# Copyright (c) 2025, Ameer Babu and contributors
# For license information, please see license.txt

import frappe
import re
from frappe.model.document import Document


class PrivateDictionary(Document):
	pass


def apply_private_dictionary(value):
    dictionary_doc = frappe.get_single('Private Dictionary')
    replace_map = {}
    for row in dictionary_doc.dictionary:
        if row.original_name and row.suggested_name:
            replace_map[row.original_name] = row.suggested_name

    for original, suggested in replace_map.items():
        value = re.sub(re.escape(original), suggested, value, flags=re.IGNORECASE)
    return value

def global_validate_replacement(doc, method):
    # List field types on which you want to apply replacements
    text_field_types = ['Data', 'Small Text', 'Text', 'Long Text','Text Editor']

    for field in doc.meta.fields:
        if field.fieldtype in text_field_types:
            val = doc.get(field.fieldname)
            if val and isinstance(val, str):
                new_val = apply_private_dictionary(val)
                if new_val != val:
                    doc.set(field.fieldname, new_val)
