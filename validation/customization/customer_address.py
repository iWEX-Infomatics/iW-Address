import frappe

@frappe.whitelist()
def update_customer_territory_from_address(doc, method):
    linked_customers = [link.link_name for link in doc.links if link.link_doctype == "Customer"]

    for customer_name in linked_customers:
        customer = frappe.get_doc("Customer", customer_name)
        customer.territory = doc.custom_post_office
        customer.save(ignore_permissions=True)

    if linked_customers:
        customer_name = linked_customers[0]  
        title = customer_name
        if doc.city:
            title += f", {doc.city}"

        if doc.address_title != title:
            doc.address_title = title
            doc.flags.ignore_validate_update_after_submit = True
            doc.save(ignore_permissions=True)
