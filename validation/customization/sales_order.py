
import frappe
from frappe import _
from frappe.utils import flt

def validate_packed_items_stock(doc, method):
    """
    Validate stock availability for items in packed_items child table before submit
    """
    if not doc.packed_items:
        return
    
    insufficient_items = []
    
    for item in doc.packed_items:
        if not item.item_code:
            continue
            
        # Get warehouse - you can modify this based on your requirement
        warehouse = item.warehouse or doc.set_warehouse
        
        if not warehouse:
            frappe.throw(_("Warehouse not set for item {0} in packed items").format(item.item_code))
        
        # Get available stock
        available_qty = frappe.db.get_value("Bin", 
            {"item_code": item.item_code, "warehouse": warehouse}, 
            "actual_qty") or 0
        
        required_qty = flt(item.qty)
        
        # Check if stock is insufficient
        if available_qty < required_qty:
            insufficient_items.append({
                "item_code": item.item_code,
                "item_name": item.item_name or item.item_code,
                "required": required_qty,
                "available": available_qty,
                "warehouse": warehouse
            })
    
    # If there are insufficient items, throw error
    if insufficient_items:
        error_msg = _("<b>Insufficient Stock</b><br><br>")
        
        for item in insufficient_items:
            error_msg += _(
                "{0} units of <b>{1}</b> needed in <b>{2}</b> to complete this transaction.<br>"
                "Available: {3} units<br><br>"
            ).format(
                item["required"],
                item["item_name"],
                item["warehouse"],
                item["available"]
            )
        
        frappe.throw(error_msg, title=_("Insufficient Stock"))