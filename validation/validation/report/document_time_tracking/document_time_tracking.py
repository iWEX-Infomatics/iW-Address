import frappe
from frappe import _
from datetime import datetime, timedelta
from collections import defaultdict

def execute(filters=None):
    """
    Report to track time spent by users on documents
    Data sources: Activity Log, Version, Route History
    """
    # Check permission - only specific users can view this report
    allowed_users = ["ameerbabu@iwex.in", "support@iwex.in", "Administrator"]
    if frappe.session.user not in allowed_users:
        frappe.throw(_("You don't have permission to view this report"), frappe.PermissionError)
    
    if not filters:
        filters = {}
    
    consolidate = filters.get("consolidate", 0)
    
    if consolidate:
        columns = get_consolidated_columns()
        data = get_consolidated_data(filters)
    else:
        columns = get_columns()
        data = get_data(filters)
    
    return columns, data

def get_columns():
    """Define detailed report columns"""
    return [
        {
            "fieldname": "user",
            "label": _("User"),
            "fieldtype": "Link",
            "options": "User",
            "width": 200
        },
        {
            "fieldname": "document_type",
            "label": _("Document Type"),
            "fieldtype": "Data",
            "width": 200
        },
        {
            "fieldname": "document_name",
            "label": _("Document Name"),
            "fieldtype": "Dynamic Link",
            "options": "document_type",
            "width": 200
        },
        {
            "fieldname": "first_access",
            "label": _("First Access"),
            "fieldtype": "Datetime",
            "width": 200
        },
        {
            "fieldname": "last_access",
            "label": _("Last Access"),
            "fieldtype": "Datetime",
            "width": 200
        },
        {
            "fieldname": "total_time_minutes",
            "label": _("Total Time"),
            "fieldtype": "Data",
            "width": 150
        }
    ]

def get_consolidated_columns():
    """Define consolidated report columns"""
    return [
        {
            "fieldname": "user",
            "label": _("User"),
            "fieldtype": "Link",
            "options": "User",
            "width": 300
        },
        {
            "fieldname": "document_type",
            "label": _("Document Type"),
            "fieldtype": "Data",
            "width": 300
        },
        {
            "fieldname": "total_time_minutes",
            "label": _("Total Time"),
            "fieldtype": "Data",
            "width": 200
        }
    ]

def get_data(filters):
    """Get detailed time tracking data from multiple sources"""
    if not filters:
        filters = {}
    
    user_filter = filters.get("user")
    from_date = filters.get("from_date")
    to_date = filters.get("to_date")
    document_type = filters.get("document_type")
    
    # Dictionary to store aggregated data
    user_doc_data = defaultdict(lambda: {
        "first_access": None,
        "last_access": None,
        "activities": []
    })
    
    # 1. Get data from Activity Log
    activity_conditions = ["reference_doctype IS NOT NULL", "reference_name IS NOT NULL"]
    if user_filter:
        activity_conditions.append(f"owner = {frappe.db.escape(user_filter, percent=False)}")
    if from_date:
        activity_conditions.append(f"creation >= {frappe.db.escape(str(from_date), percent=False)}")
    if to_date:
        activity_conditions.append(f"creation <= {frappe.db.escape(str(to_date), percent=False)}")
    if document_type:
        activity_conditions.append(f"reference_doctype = {frappe.db.escape(document_type, percent=False)}")
    
    try:
        activity_data = frappe.db.sql(f"""
            SELECT 
                owner as user,
                reference_doctype as doctype,
                reference_name as docname,
                creation,
                operation
            FROM `tabActivity Log`
            WHERE {' AND '.join(activity_conditions)}
            ORDER BY creation
        """, as_dict=1)
    except Exception as e:
        frappe.log_error(f"Error fetching activity log: {str(e)}")
        activity_data = []
    
    for activity in activity_data:
        if not activity.user or not activity.doctype or not activity.docname:
            continue
            
        key = (activity.user, activity.doctype, activity.docname)
        user_doc_data[key]["activities"].append(activity.creation)
        
        if not user_doc_data[key]["first_access"] or activity.creation < user_doc_data[key]["first_access"]:
            user_doc_data[key]["first_access"] = activity.creation
        if not user_doc_data[key]["last_access"] or activity.creation > user_doc_data[key]["last_access"]:
            user_doc_data[key]["last_access"] = activity.creation
    
    # 2. Get data from Version (document modifications)
    version_conditions = ["ref_doctype IS NOT NULL", "docname IS NOT NULL"]
    if user_filter:
        version_conditions.append(f"owner = {frappe.db.escape(user_filter, percent=False)}")
    if from_date:
        version_conditions.append(f"creation >= {frappe.db.escape(str(from_date), percent=False)}")
    if to_date:
        version_conditions.append(f"creation <= {frappe.db.escape(str(to_date), percent=False)}")
    if document_type:
        version_conditions.append(f"ref_doctype = {frappe.db.escape(document_type, percent=False)}")
    
    where_clause = f"WHERE {' AND '.join(version_conditions)}"
    
    try:
        version_data = frappe.db.sql(f"""
            SELECT 
                owner as user,
                ref_doctype as doctype,
                docname,
                creation
            FROM `tabVersion`
            {where_clause}
            ORDER BY creation
        """, as_dict=1)
    except Exception as e:
        frappe.log_error(f"Error fetching version data: {str(e)}")
        version_data = []
    
    for version in version_data:
        if not version.user or not version.doctype or not version.docname:
            continue
            
        key = (version.user, version.doctype, version.docname)
        user_doc_data[key]["activities"].append(version.creation)
        
        if not user_doc_data[key]["first_access"] or version.creation < user_doc_data[key]["first_access"]:
            user_doc_data[key]["first_access"] = version.creation
        if not user_doc_data[key]["last_access"] or version.creation > user_doc_data[key]["last_access"]:
            user_doc_data[key]["last_access"] = version.creation
    
    # 3. Get data from Route History (if available)
    try:
        route_conditions = ["route IS NOT NULL", "user IS NOT NULL"]
        if user_filter:
            route_conditions.append(f"user = {frappe.db.escape(user_filter, percent=False)}")
        if from_date:
            route_conditions.append(f"creation >= {frappe.db.escape(str(from_date), percent=False)}")
        if to_date:
            route_conditions.append(f"creation <= {frappe.db.escape(str(to_date), percent=False)}")
        
        where_clause = f"WHERE {' AND '.join(route_conditions)}"
        
        route_data = frappe.db.sql(f"""
            SELECT 
                user,
                route,
                creation
            FROM `tabRoute History`
            {where_clause}
            ORDER BY creation
        """, as_dict=1)
        
        for route in route_data:
            # Parse route to get doctype and docname
            route_parts = route.route.strip('/').split('/')
            if len(route_parts) >= 3 and route_parts[0] == 'app':
                doctype = route_parts[1].replace('-', ' ').title()
                docname = route_parts[2]
                
                if document_type and doctype != document_type:
                    continue
                
                key = (route.user, doctype, docname)
                user_doc_data[key]["activities"].append(route.creation)
                
                if not user_doc_data[key]["first_access"] or route.creation < user_doc_data[key]["first_access"]:
                    user_doc_data[key]["first_access"] = route.creation
                if not user_doc_data[key]["last_access"] or route.creation > user_doc_data[key]["last_access"]:
                    user_doc_data[key]["last_access"] = route.creation
    except Exception as e:
        # Route History table might not exist
        pass
    
    # 4. Calculate time spent and prepare final data
    result = []
    for (user, doctype, docname), data in user_doc_data.items():
        # Calculate time spent based on activity timestamps
        total_minutes = calculate_time_spent(data["activities"])
        
        # Format time with h, m, or s suffix
        time_display = format_time_display(total_minutes)
        
        result.append({
            "user": user,
            "document_type": doctype,
            "document_name": docname,
            "first_access": data["first_access"],
            "last_access": data["last_access"],
            "total_time_minutes": time_display,
            "_total_minutes": total_minutes
        })
    
    # Sort by user and total time
    result.sort(key=lambda x: (x["user"] or "", -x.get("_total_minutes", 0)))
    
    # Remove the hidden sorting field
    for row in result:
        row.pop("_total_minutes", None)
    
    return result

def get_consolidated_data(filters):
    """Get consolidated time tracking data grouped by user and document type"""
    if not filters:
        filters = {}
    
    user_filter = filters.get("user")
    from_date = filters.get("from_date")
    to_date = filters.get("to_date")
    document_type = filters.get("document_type")
    
    # Dictionary to store activities by user and doctype
    user_doctype_activities = defaultdict(list)
    
    # 1. Get data from Activity Log
    activity_conditions = ["reference_doctype IS NOT NULL", "reference_name IS NOT NULL"]
    if user_filter:
        activity_conditions.append(f"owner = {frappe.db.escape(user_filter, percent=False)}")
    if from_date:
        activity_conditions.append(f"creation >= {frappe.db.escape(str(from_date), percent=False)}")
    if to_date:
        activity_conditions.append(f"creation <= {frappe.db.escape(str(to_date), percent=False)}")
    if document_type:
        activity_conditions.append(f"reference_doctype = {frappe.db.escape(document_type, percent=False)}")
    
    try:
        activity_data = frappe.db.sql(f"""
            SELECT 
                owner as user,
                reference_doctype as doctype,
                creation
            FROM `tabActivity Log`
            WHERE {' AND '.join(activity_conditions)}
            ORDER BY creation
        """, as_dict=1)
        
        for activity in activity_data:
            if not activity.user or not activity.doctype:
                continue
            key = (activity.user, activity.doctype)
            user_doctype_activities[key].append(activity.creation)
    except Exception as e:
        frappe.log_error(f"Error fetching activity log: {str(e)}")
    
    # 2. Get data from Version
    version_conditions = ["ref_doctype IS NOT NULL", "docname IS NOT NULL"]
    if user_filter:
        version_conditions.append(f"owner = {frappe.db.escape(user_filter, percent=False)}")
    if from_date:
        version_conditions.append(f"creation >= {frappe.db.escape(str(from_date), percent=False)}")
    if to_date:
        version_conditions.append(f"creation <= {frappe.db.escape(str(to_date), percent=False)}")
    if document_type:
        version_conditions.append(f"ref_doctype = {frappe.db.escape(document_type, percent=False)}")
    
    try:
        version_data = frappe.db.sql(f"""
            SELECT 
                owner as user,
                ref_doctype as doctype,
                creation
            FROM `tabVersion`
            WHERE {' AND '.join(version_conditions)}
            ORDER BY creation
        """, as_dict=1)
        
        for version in version_data:
            if not version.user or not version.doctype:
                continue
            key = (version.user, version.doctype)
            user_doctype_activities[key].append(version.creation)
    except Exception as e:
        frappe.log_error(f"Error fetching version data: {str(e)}")
    
    # 3. Get data from Route History
    try:
        route_conditions = ["route IS NOT NULL", "user IS NOT NULL"]
        if user_filter:
            route_conditions.append(f"user = {frappe.db.escape(user_filter, percent=False)}")
        if from_date:
            route_conditions.append(f"creation >= {frappe.db.escape(str(from_date), percent=False)}")
        if to_date:
            route_conditions.append(f"creation <= {frappe.db.escape(str(to_date), percent=False)}")
        
        route_data = frappe.db.sql(f"""
            SELECT 
                user,
                route,
                creation
            FROM `tabRoute History`
            WHERE {' AND '.join(route_conditions)}
            ORDER BY creation
        """, as_dict=1)
        
        for route in route_data:
            route_parts = route.route.strip('/').split('/')
            if len(route_parts) >= 3 and route_parts[0] == 'app':
                doctype = route_parts[1].replace('-', ' ').title()
                
                if document_type and doctype != document_type:
                    continue
                
                key = (route.user, doctype)
                user_doctype_activities[key].append(route.creation)
    except Exception as e:
        pass
    
    # Calculate consolidated time and prepare result
    result = []
    for (user, doctype), activities in user_doctype_activities.items():
        total_minutes = calculate_time_spent(activities)
        time_display = format_time_display(total_minutes)
        
        result.append({
            "user": user,
            "document_type": doctype,
            "total_time_minutes": time_display,
            "_total_minutes": total_minutes
        })
    
    # Sort by total time (highest first) in consolidated view
    result.sort(key=lambda x: -x.get("_total_minutes", 0))
    
    # Remove the hidden sorting field
    for row in result:
        row.pop("_total_minutes", None)
    
    return result

def format_time_display(total_minutes):
    """
    Format time with appropriate suffix (h for hours, m for minutes, s for seconds)
    """
    if total_minutes >= 60:
        hours = total_minutes / 60
        if hours >= 10:
            return f"{round(hours, 1)}h"
        else:
            return f"{round(hours, 2)}h"
    elif total_minutes >= 1:
        return f"{round(total_minutes, 2)}m"
    else:
        seconds = total_minutes * 60
        return f"{round(seconds, 1)}s"

def calculate_time_spent(activities):
    """
    Calculate time spent based on activity timestamps
    Assumes: If activities are within 30 minutes, user was actively working
             If gap > 30 minutes, start new session
    """
    if not activities:
        return 0
    
    activities = sorted(activities)
    total_minutes = 0
    session_timeout = timedelta(minutes=30)
    
    for i in range(len(activities) - 1):
        time_diff = activities[i + 1] - activities[i]
        
        if time_diff <= session_timeout:
            total_minutes += time_diff.total_seconds() / 60
        else:
            total_minutes += 2
    
    # Add minimum 2 minutes for the last activity
    total_minutes += 2
    
    return total_minutes

def get_chart_data(data, filters):
    """Generate chart for time tracking"""
    if not data:
        return None
    
    consolidate = filters.get("consolidate", 0)
    
    if consolidate:
        labels = []
        values = []
        for row in data:
            label = f"{row['user']} - {row['document_type']}"
            labels.append(label)
            time_str = row['total_time_minutes']
            values.append(parse_time_to_minutes(time_str))
        
        return {
            "data": {
                "labels": labels,
                "datasets": [
                    {
                        "name": "Total Time (Minutes)",
                        "values": values
                    }
                ]
            },
            "type": "bar",
            "colors": ["#7cd6fd"],
            "barOptions": {
                "stacked": 0
            }
        }
    else:
        user_time = defaultdict(float)
        for row in data:
            time_str = row['total_time_minutes']
            user_time[row["user"]] += parse_time_to_minutes(time_str)
        
        return {
            "data": {
                "labels": list(user_time.keys()),
                "datasets": [
                    {
                        "name": "Total Time (Minutes)",
                        "values": list(user_time.values())
                    }
                ]
            },
            "type": "bar",
            "colors": ["#7cd6fd"],
            "barOptions": {
                "stacked": 0
            }
        }

def parse_time_to_minutes(time_str):
    """Convert time string (e.g., '2.5h', '45m', '30s') to minutes"""
    if not time_str:
        return 0
    
    time_str = str(time_str).strip()
    if time_str.endswith('h'):
        return float(time_str[:-1]) * 60
    elif time_str.endswith('m'):
        return float(time_str[:-1])
    elif time_str.endswith('s'):
        return float(time_str[:-1]) / 60
    return 0

@frappe.whitelist()
def get_doctype_list(doctype, txt, searchfield, start, page_len, filters):
    """
    Get list of doctypes sorted by usage frequency (total time spent)
    """
    # Get date range from current user's session or use defaults
    from_date = frappe.utils.add_days(frappe.utils.today(), -30)
    to_date = frappe.utils.today()
    
    # Dictionary to store time per doctype
    doctype_time = defaultdict(float)
    
    # Get data from Activity Log
    try:
        activity_data = frappe.db.sql("""
            SELECT 
                reference_doctype as doctype,
                creation
            FROM `tabActivity Log`
            WHERE reference_doctype IS NOT NULL 
                AND reference_name IS NOT NULL
                AND creation >= %s
                AND creation <= %s
            ORDER BY creation
        """, (from_date, to_date), as_dict=1)
        
        # Group by doctype and calculate time
        doctype_activities = defaultdict(list)
        for activity in activity_data:
            if activity.doctype:
                doctype_activities[activity.doctype].append(activity.creation)
        
        for doctype_name, activities in doctype_activities.items():
            doctype_time[doctype_name] += calculate_time_spent(activities)
    except:
        pass
    
    # Get data from Version
    try:
        version_data = frappe.db.sql("""
            SELECT 
                ref_doctype as doctype,
                creation
            FROM `tabVersion`
            WHERE ref_doctype IS NOT NULL 
                AND docname IS NOT NULL
                AND creation >= %s
                AND creation <= %s
            ORDER BY creation
        """, (from_date, to_date), as_dict=1)
        
        doctype_activities = defaultdict(list)
        for version in version_data:
            if version.doctype:
                doctype_activities[version.doctype].append(version.creation)
        
        for doctype_name, activities in doctype_activities.items():
            doctype_time[doctype_name] += calculate_time_spent(activities)
    except:
        pass
    
    # Get data from Route History
    try:
        route_data = frappe.db.sql("""
            SELECT 
                route,
                creation
            FROM `tabRoute History`
            WHERE route IS NOT NULL 
                AND user IS NOT NULL
                AND creation >= %s
                AND creation <= %s
            ORDER BY creation
        """, (from_date, to_date), as_dict=1)
        
        doctype_activities = defaultdict(list)
        for route in route_data:
            route_parts = route.route.strip('/').split('/')
            if len(route_parts) >= 3 and route_parts[0] == 'app':
                doctype_name = route_parts[1].replace('-', ' ').title()
                doctype_activities[doctype_name].append(route.creation)
        
        for doctype_name, activities in doctype_activities.items():
            doctype_time[doctype_name] += calculate_time_spent(activities)
    except:
        pass
    
    # Sort doctypes by time spent (descending)
    sorted_doctypes = sorted(doctype_time.items(), key=lambda x: -x[1])
    
    # Filter by search text if provided
    if txt:
        sorted_doctypes = [(dt, time) for dt, time in sorted_doctypes if txt.lower() in dt.lower()]
    
    # Get only doctype names
    result = [[dt] for dt, time in sorted_doctypes]
    
    # Apply pagination
    return result[start:start + page_len] if result else []