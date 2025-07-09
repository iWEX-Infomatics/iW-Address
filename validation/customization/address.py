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
    try:
        resp = requests.get(url, timeout=5)
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

