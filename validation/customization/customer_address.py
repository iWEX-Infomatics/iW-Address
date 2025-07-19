import frappe

@frappe.whitelist()
def update_customer_territory_from_address(doc, method):
    linked_customers = [link.link_name for link in doc.links if link.link_doctype == "Customer"]
    linked_suppliers = [link.link_name for link in doc.links if link.link_doctype == "Supplier"]

    # Update customer territory
    for customer_name in linked_customers:
        customer = frappe.get_doc("Customer", customer_name)
        customer.territory = doc.custom_post_office
        customer.save(ignore_permissions=True)

    # Prepare address_title
    name = None
    if linked_customers:
        name = linked_customers[0]
    elif linked_suppliers:
        name = linked_suppliers[0]

    if name:
        title = name
        if doc.city:
            title += f", {doc.city}"

        if doc.address_title != title:
            doc.address_title = title
            doc.flags.ignore_validate_update_after_submit = True
            doc.save(ignore_permissions=True)
