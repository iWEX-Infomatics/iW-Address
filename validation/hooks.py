app_name = "validation"
app_title = "Validation"
app_publisher = "Ameer Babu"
app_description = "An App for Validation for Name Fields"
app_email = "emails@iwex.in"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "validation",
# 		"logo": "/assets/validation/logo.png",
# 		"title": "Validation",
# 		"route": "/validation",
# 		"has_permission": "validation.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/validation/css/validation.css"
# app_include_js = "/assets/validation/js/address.js"

# include js, css files in header of web template
# web_include_css = "/assets/validation/css/validation.css"
# web_include_js = "/assets/validation/js/validation.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "validation/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
    "Address" : "public/js/address.js",
    "Supplier" : "public/js/supplier_name.js",
    "Customer" : "public/js/customer_name.js",
    "Contact" : "public/js/contact_name.js",
    "Batch" : "public/js/batch_name.js",
    "Employee" : "public/js/employee_name.js",
    "Item" : "public/js/item_name.js",
    "Item Group" : "public/js/item_group.js",
    "Customer Group" : "public/js/customer_group.js",
    "Supplier Group" : "public/js/supplier_group.js",
    "Brand" : "public/js/brand.js",
    "Terms and Conditions" : "public/js/terms.js",
    "Payment Term" : "public/js/payment_terms.js",
    "Payment Terms Template" : "public/js/payment_term_template.js"
}

# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "validation/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "validation.utils.jinja_methods",
# 	"filters": "validation.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "validation.install.before_install"
# after_install = "validation.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "validation.uninstall.before_uninstall"
# after_uninstall = "validation.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "validation.utils.before_app_install"
# after_app_install = "validation.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "validation.utils.before_app_uninstall"
# after_app_uninstall = "validation.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "validation.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"validation.tasks.all"
# 	],
# 	"daily": [
# 		"validation.tasks.daily"
# 	],
# 	"hourly": [
# 		"validation.tasks.hourly"
# 	],
# 	"weekly": [
# 		"validation.tasks.weekly"
# 	],
# 	"monthly": [
# 		"validation.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "validation.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "validation.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "validation.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["validation.utils.before_request"]
# after_request = ["validation.utils.after_request"]

# Job Events
# ----------
# before_job = ["validation.utils.before_job"]
# after_job = ["validation.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"validation.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

doc_events = {
    "Address": {
        "after_insert": "validation.customization.address.fetch_post_offices_on_save",
        "validate": "validation.customization.territory.ensure_territory_from_address",
        "on_update": "validation.customization.customer_address.update_customer_territory_from_address"
   }
}

fixtures = [    
    {
        "doctype": "Custom Field",
        "filters": [
            ["module", "=", "Validation"],
        ]
    },
        {
        "doctype": "Property Setter",
        "filters": [
            ["module", "=", "Validation"],
        ]
    }
]
