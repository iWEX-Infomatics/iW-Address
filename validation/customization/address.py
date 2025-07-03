import frappe
import requests

@frappe.whitelist()
def get_post_offices(pincode):
    """Fetch post offices + taluk (Block) + state + district (for county) for an Indian PIN using India Post API."""
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
