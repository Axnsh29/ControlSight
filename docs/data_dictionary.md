# ControlSight Data Dictionary

## 1. projects.csv

Contains one row per project.

| Column | Description |
|---|---|
| project_code | Unique project identifier |
| project_name | Project name |
| project_type | Type of project |
| region | Project location |
| start_date | Project start date |
| planned_end_date | Planned project completion date |
| approved_budget | Approved total project budget |
| project_manager | Responsible project manager |
| status | Current project status |
| currency | Reporting currency |

---

## 2. vendors.csv

Contains supplier master data.

| Column | Description |
|---|---|
| vendor_id | Unique vendor identifier |
| vendor_name | Supplier name |
| vendor_category | Supplier specialism |
| country | Supplier country |

---

## 3. cost_packages.csv

Contains the cost breakdown structure for each project.

| Column | Description |
|---|---|
| package_code | Unique package identifier |
| project_code | Parent project identifier |
| package_name | Package description |
| cost_category | Cost discipline/category |
| package_budget | Approved package budget |

---

## 4. cost_monthly.csv

Contains monthly financial performance records.

| Column | Description |
|---|---|
| cost_record_id | Unique cost record identifier |
| project_code | Project identifier |
| package_code | Cost package identifier |
| cost_category | Cost discipline |
| report_month | Reporting month |
| planned_cost | Planned expenditure for the period |
| actual_cost | Actual expenditure for the period |
| committed_cost | Committed financial value |
| forecast_at_completion | Expected final cost of the package |
| currency | Reporting currency |
| source_system | Source operational system |

---

## 5. progress_updates.csv

Contains monthly project progress reporting.

| Column | Description |
|---|---|
| project_code | Project identifier |
| report_month | Reporting month |
| planned_progress_pct | Planned percentage completion |
| actual_progress_pct | Actual percentage completion |
| reported_by | Reporting team/function |
| source_system | Source operational system |

---

## 6. schedule_activities.csv

Contains detailed project schedule activities.

| Column | Description |
|---|---|
| activity_id | Unique schedule activity identifier |
| project_code | Project identifier |
| wbs_code | Work Breakdown Structure code |
| activity_name | Activity description |
| discipline | Activity discipline/category |
| planned_start | Planned start date |
| planned_finish | Planned finish date |
| actual_start | Actual start date |
| actual_finish | Actual finish date |
| percent_complete | Activity completion percentage |
| status | Activity status |
| is_critical | Indicates whether the activity is critical |
| source_system | Source operational system |

---

## 7. procurement_packages.csv

Contains procurement and delivery records.

| Column | Description |
|---|---|
| procurement_id | Unique procurement record |
| project_code | Project identifier |
| package_code | Associated cost package |
| vendor_id | Supplier identifier |
| category | Procurement category |
| rfq_date | Request for quotation date |
| po_date | Purchase order date |
| planned_delivery_date | Planned delivery date |
| actual_delivery_date | Actual delivery date |
| package_value | Procurement package value |
| status | Procurement status |
| criticality | Procurement criticality |
| source_system | Source operational system |