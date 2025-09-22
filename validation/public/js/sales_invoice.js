frappe.ui.form.on("Sales Invoice", {
    refresh: function(frm) {
        // collect items with actual_qty == 0
        let zero_qty_items = frm.doc.items.filter(i => i.actual_qty == 0);

        if (zero_qty_items.length > 0) {
            frm.add_custom_button(__('Create Product Bundle'), function() {
                open_product_bundle_dialog(frm, zero_qty_items);
            });
        }
    }
});


function open_product_bundle_dialog(frm, zero_qty_items) {
    let parent_item_options = zero_qty_items.map(i => i.item_code);

    let dialog = new frappe.ui.Dialog({
        title: "Create Product Bundle",
        size: "large",
        fields: [
            {
                label: "Parent Item",
                fieldname: "parent_item",
                fieldtype: "Select",
                options: parent_item_options,
                reqd: 1,
                onchange: function() {
                    let selected_item = zero_qty_items.find(i => i.item_code === dialog.get_value("parent_item"));
                    if (selected_item) {
                        dialog.set_value("parent_description", selected_item.description);
                    }
                }
            },
            {
                label: "Description",
                fieldname: "parent_description",
                fieldtype: "Small Text",
                read_only: 1
            },
            {
                fieldtype: "Section Break"
            },
            {
                fieldname: "bundle_items",
                fieldtype: "Table",
                label: "Bundle Items",
                cannot_add_rows: false,
                in_place_edit: true,
                fields: [
                    {
                        fieldname: "item_code",
                        label: "Item Code",
                        fieldtype: "Link",
                        options: "Item",
                        in_list_view: 1,
                        reqd: 1,
                        change: function(e) {
                            let row = e.grid_row.doc;
                            if (row.item_code) {
                                frappe.db.get_doc("Item", row.item_code).then(item_doc => {
                                    frappe.model.set_value(row.doctype, row.name, "description", item_doc.description);
                                    frappe.model.set_value(row.doctype, row.name, "uom", item_doc.stock_uom);
                                });
                            }
                        }
                    },
                    {
                        fieldname: "qty",
                        label: "Qty",
                        fieldtype: "Float",
                        in_list_view: 1,
                        reqd: 1
                    },
                    {
                        fieldname: "description",
                        label: "Description",
                        fieldtype: "Small Text",
                        in_list_view: 1
                    },
                    {
                        fieldname: "uom",
                        label: "UOM",
                        fieldtype: "Data",
                        in_list_view: 1
                    }
                ]
            }
        ],
        primary_action_label: "Create Product Bundle",
        primary_action(values) {
            if (!values.parent_item) {
                frappe.msgprint("Parent Item is required");
                return;
            }

            frappe.call({
                method: "frappe.client.insert",
                args: {
                    doc: {
                        doctype: "Product Bundle",
                        new_item_code: values.parent_item,
                        description: values.parent_description,
                        items: values.bundle_items || []
                    }
                },
                callback: function(r) {
                    if (!r.exc) {
                        frappe.msgprint("Product Bundle Created: " + r.message.name);
                        dialog.hide();
                        frm.reload_doc();
                    }
                }
            });
        }
    });

    // Add Create New Item button next to Create
    dialog.set_secondary_action(function() {
        window.open(`/app/item/new-item-1`, "_blank");
    });
    dialog.set_secondary_action_label("Create New Item");

    // Set default parent description (first item)
    if (parent_item_options.length > 0) {
        dialog.set_value("parent_item", parent_item_options[0]);
        dialog.set_value("parent_description", zero_qty_items[0].description);
    }

    dialog.show();
}
