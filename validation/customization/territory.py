# app_name/address_hooks.py

import frappe
from frappe.model.document import Document

@frappe.whitelist()
def ensure_territory_from_address(doc, method):
    # your territory creation code ...
    territory_chain = ["India"]
    if doc.state:
        territory_chain.append(doc.state.strip())
    if doc.county:
        territory_chain.append(doc.county.strip())
    if doc.custom_taluk:
        territory_chain.append(doc.custom_taluk.strip())
    if doc.custom_post_office:
        territory_chain.append(doc.custom_post_office.strip())

    if len(territory_chain) < 2:
        frappe.throw("At least State and Post Office must be set to generate Territory.")

    parent = "All Territories"
    for territory in territory_chain:
        existing = frappe.db.exists("Territory", territory)
        if not existing:
            new_territory = frappe.get_doc({
                "doctype": "Territory",
                "territory_name": territory,
                "parent_territory": parent,
                "is_group": 1
            })
            if territory == territory_chain[-1]:
                new_territory.is_group = 0
            new_territory.save(ignore_permissions=True)
            parent = new_territory.name
        else:
            parent = territory

    doc.territory = territory_chain[-1]

    linked_customers = frappe.get_all(
        "Dynamic Link",
        filters={
            "link_doctype": "Customer",
            "parenttype": "Address",
            "parent": doc.name
        },
        fields=["link_name"]
    )

    for link in linked_customers:
        customer = frappe.get_doc("Customer", link.link_name)
        customer.territory = doc.territory
        customer.save(ignore_permissions=True)
     
