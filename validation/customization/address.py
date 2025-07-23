import frappe
import requests

# For Doc Event Hook (Address after_insert)
def fetch_post_offices_on_save(doc, method):
    if doc.pincode:
        post_offices = get_post_offices_api(doc.pincode)

@frappe.whitelist()
def get_post_offices_api(pincode):
    if not pincode:
        return []

    url = f"https://api.postalpincode.in/pincode/{pincode}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64;x64)"
        }
    try:
        resp = requests.get(url, timeout=5, headers=headers)
        data = resp.json()
    except Exception:
        frappe.logger().error(f"Error fetching pincodes: {frappe.get_traceback()}")
        return []

    if not data or data[0].get("Status") != "Success":
        return []

    result = []
    for po in data[0].get("PostOffice", []):
        result.append({
            "post_office": po.get("Name"),
            "taluk":       po.get("Block"),
            "state":       po.get("State"),
            "district":    po.get("District")
        })
    return result




def validate_address(doc, method):
    matched = False
    country_matched = False

    # Get all child table rows from Automate Default Values
    child_rows = frappe.get_all(
        "Party Default Values",
        fields=["country", "state"],
        filters={"parenttype": "Automate Default Values"}
    )

    for row in child_rows:
        if row.country == doc.country:
            if row.state and row.state == doc.state:
                doc.tax_category = "In-State"
                matched = True
                break
            else:
                country_matched = True

    if not matched:
        if country_matched:
            doc.tax_category = "Out-State"
        else:
            doc.tax_category = "Overseas"
    
    doc.custom_automate = 0



def validate(doc, method=None):
    for link in doc.links:
        if link.link_doctype in ["Customer", "Supplier"]:
            doc.is_shipping_address = 1
            doc.is_primary_address = 1
            break 
