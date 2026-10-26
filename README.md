# ControlSight

### Project Controls Intelligence Platform

**Live Demo:** https://controlsight.onrender.com

ControlSight is an end-to-end project controls application that transforms synthetic EPC-style cost, progress, schedule, procurement and data-quality information into management-ready intelligence.

It was built as more than a dashboard. The project includes a complete analytical workflow:

```text
Synthetic EPC Data
        ↓
Python ETL & Validation
        ↓
Data Quality / Quarantine
        ↓
SQLite Analytical Layer
        ↓
FastAPI REST API
        ↓
Rules-Based Project Controls Logic
        ↓
HTML / CSS / JavaScript Application
        ↓
Management Reporting & Decision Support
```

The application demonstrates how project-controls information can be combined into a single management layer for portfolio monitoring, project drill-down, exception management and reporting.

> All projects, vendors, costs, schedules and operational records used in ControlSight are synthetic and fictional.

---

## What ControlSight Does

ControlSight provides portfolio and project-level visibility across:

- approved budget
- actual and committed cost
- forecast at completion
- forecast variance
- planned and actual progress
- schedule risk
- procurement risk
- data quality
- change control
- risk and contingency
- cash-flow planning
- management actions
- project prioritisation
- historical reporting periods

The system supports both executive portfolio monitoring and detailed project investigation.

---

## Key Features

### 1. Portfolio Overview

The portfolio dashboard consolidates project-control information into management KPIs including:

- total approved budget
- actual cost to date
- forecast at completion
- forecast variance
- portfolio progress
- validation quality
- project status
- management-priority ranking

Users can change the active reporting period and the portfolio KPIs, exposure views, project metrics and Management Attention results update to the selected month.

---

### 2. Project Detail

Selecting a project opens a detailed controls view containing:

- approved budget
- actual cost
- committed cost
- FAC
- forecast variance
- planned progress
- actual progress
- progress variance
- cumulative cost trend
- progress S-curve
- schedule-risk detail
- procurement-risk detail
- forecast movement
- management insights
- workflow actions

This provides a direct path from portfolio-level exception identification to the underlying project drivers.

---

### 3. Historical Reporting

ControlSight supports reporting-period selection rather than only displaying the latest snapshot.

Historical selection updates:

- portfolio KPIs
- project portfolio values
- cost exposure
- project headline metrics
- cost and progress charts
- FAC movement
- Executive Intelligence
- Management Attention cost and progress inputs
- report packs

This allows management information to be reviewed as it would have appeared at a selected reporting date.

---

## Management Attention Index

ControlSight includes a transparent rules-based **Management Attention Index** that ranks projects requiring management review.

| Component | Maximum |
|---|---:|
| Cost | 30 |
| Progress | 25 |
| Critical Schedule | 25 |
| Procurement | 15 |
| Data Quality | 5 |
| **Total** | **100** |

The score is a prioritisation mechanism, not a probability of project failure.

It combines multiple dimensions so that a project is not assessed only through headline cost variance.

Typical outputs include:

- Critical
- Watch
- Review
- Stable

The dashboard also identifies the primary driver behind each project's score.

---

## Forecast Concern

ControlSight includes a secondary forecast cross-check called **Forecast Concern**.

The calculation compares reported FAC with a simple progress-implied completion-cost proxy:

```text
Progress-Implied EAC
=
Actual Cost to Date
÷
Actual Progress %
```

The difference between the progress-implied EAC and reported FAC is surfaced as a management concern indicator.

This is intentionally treated as a cross-check only.

It is **not formal Earned Value Management** and does not replace the reported FAC.

---

## Cost Control Logic

Forecast variance is calculated as:

```text
Forecast Variance
=
Approved Budget
-
Forecast at Completion
```

Therefore:

- negative variance = forecast overrun
- positive variance = forecast saving

The synthetic analytical model also applies the following control:

```text
Final FAC = max(
    Source FAC,
    Cumulative Actual Cost,
    Cumulative Committed Cost
)
```

This prevents a reporting snapshot from showing a forecast completion value below incurred or committed expenditure.

---

## Progress Control

Progress variance is reported in percentage points:

```text
Progress Variance
=
Actual Progress
-
Planned Progress
```

Example:

```text
Planned Progress: 86.4%
Actual Progress:  73.5%

Progress Variance: -12.9 pp
```

A negative result indicates that the project is behind plan.

---

## Executive Intelligence

Project-level Executive Intelligence converts deterministic project-control rules into concise management commentary.

It evaluates areas such as:

- cost overrun
- progress slippage
- schedule exposure
- procurement delay
- data-quality exceptions

The feature is deliberately rules-based and explainable rather than presented as generative AI.

---

## Workflow & Action Management

ControlSight includes a persistent workflow layer for project actions.

Users can:

- create management actions
- assign priority
- set status
- record ownership
- retain actions by reporting period
- update progress
- close or hold actions

This moves the application beyond passive reporting into basic management follow-up.

---

## Data Upload & Validation

The application includes staging CSV uploads for:

- cost
- progress
- schedule
- procurement

Uploaded files are validated before acceptance.

The staging process records:

- source rows
- accepted rows
- quarantined rows
- validation issues
- audit metadata

Invalid test records are quarantined rather than silently entering the analytical model.

The upload layer is intentionally isolated from the production analytical database.

---

## Data Quality & Governance

ControlSight treats data quality as a project-control issue rather than hiding errors during transformation.

The core principle is:

> Invalid records are isolated. Suspicious but plausible observations are retained, flagged and investigated.

Current synthetic validation metrics include:

```text
Source Records:       2,415
Accepted Records:     2,405
Quarantined Records:     10
Issue Events:            13
Validation Pass Rate: 99.59%
```

Issue events and quarantined rows are reported separately because one source row can generate multiple validation observations.

---

## Change Control

A dedicated change-control layer tracks project budget movement.

The model distinguishes between:

- original budget
- approved changes
- pending changes
- current budget
- potential budget

Conceptually:

```text
Current Budget
=
Original Budget
+
Approved Changes
```

and:

```text
Potential Budget
=
Current Budget
+
Pending Changes
```

This gives management a clearer view of approved versus potential commercial exposure.

---

## Risk, Contingency & Cash Flow

ControlSight also includes project-level controls for:

- contingency baseline
- risk drawdown
- contingency position
- cash-flow periods
- planned cash flow
- actual cash flow

Cash-flow information is kept separate from cost/FAC reporting to avoid mixing different control concepts.

Where information has not been configured, the UI displays **Not configured** rather than treating missing data as zero.

---

## Report Packs

ControlSight generates project report packs in:

- PDF
- Excel

Report packs follow the selected reporting period and contain project-control metrics such as:

- budget
- actual cost
- committed cost
- FAC
- forecast variance
- planned progress
- actual progress
- progress variance
- Forecast Concern

Historical report packs have been checked to ensure prior-period values are not replaced by the latest snapshot.

---

## Architecture

```text
┌───────────────────────────────┐
│ Synthetic EPC-Style Data      │
│ Cost / Progress / Schedule    │
│ Procurement / Vendors         │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Python ETL & Validation       │
│ Rules / Quarantine / Audit    │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ SQLite Analytical Layer       │
│ Reporting Tables & Metrics    │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ FastAPI Backend               │
│ APIs / Business Rules         │
│ Workflow / Reporting          │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Native Web Application        │
│ HTML / CSS / JavaScript       │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Management Intelligence       │
│ Portfolio → Project → Action  │
└───────────────────────────────┘
```

---

## Technology Stack

**Data & Analytics**
- Python
- pandas
- SQL
- SQLite

**Backend**
- FastAPI
- REST APIs
- Python

**Frontend**
- HTML5
- CSS3
- JavaScript
- SVG-based visualisations

**Reporting**
- PDF report generation
- Excel report generation

**Engineering**
- Git / GitHub
- automated regression testing
- data-validation checks
- API smoke tests
- Render deployment

---

## Quality Assurance

ControlSight includes an automated regression suite covering key API and analytical functionality.

The project has also been manually tested across:

- historical reporting periods
- project drill-down
- portfolio KPI reconciliation
- Management Attention
- Executive Intelligence
- CSV validation
- action persistence
- PDF report generation
- Excel report generation
- deployment behaviour

The final desktop reporting paths were checked for internal consistency across portfolio, attention, project detail and report outputs.

---

## Deployment

ControlSight is deployed on Render.

**Live Application**

https://controlsight.onrender.com

The free hosting instance may require a short cold start after inactivity.

---

## What ControlSight Is — and Is Not

ControlSight is a focused project-controls and reporting application.

It is **not** intended to replace:

- enterprise ERP platforms
- Primavera
- SAP
- Oracle
- Procore
- InEight
- Power BI

A realistic enterprise architecture would place ControlSight as an analytical and management layer above operational source systems:

```text
ERP / Primavera / Procurement Systems
                ↓
ControlSight Integration & Validation
                ↓
Unified Controls Analytics
                ↓
Management Reporting & Exceptions
```

The purpose of the project is to demonstrate how project controls, analytics, data engineering and software delivery can be connected into one traceable application.

---

## Project Objective

ControlSight was built to demonstrate capability across:

**project controls + cost analysis + data engineering + analytics + backend development + frontend delivery + management reporting**

The main goal was not to create charts.

It was to build the full path from:

```text
Raw Data
   ↓
Validation
   ↓
Analytical Model
   ↓
Business Rules
   ↓
API
   ↓
User Interface
   ↓
Management Action
```

---

## Disclaimer

All project names, financial values, vendors, schedules, procurement records and operational observations used in ControlSight are synthetic and fictional.

No confidential company or client information is used.
