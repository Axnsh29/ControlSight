# ControlSight

**Project Controls Intelligence Platform**

ControlSight is a web-based project controls and performance intelligence platform designed to demonstrate how cost, progress, schedule, procurement and data-quality information can be transformed into management-ready intelligence through a custom analytics application.

The platform combines a Python ETL and validation pipeline, a relational SQLite reporting layer, a FastAPI backend and a native HTML/CSS/JavaScript dashboard.

Rather than reproducing a conventional BI report, ControlSight demonstrates an API-driven approach in which project-control calculations, validation rules, exception logic and management insights are handled within a controlled analytical architecture.

> **Portfolio Project:** ControlSight uses synthetic EPC-style project data created specifically for demonstration purposes. It does not contain confidential or proprietary company information.

---

## 1. Business Problem

Large engineering and construction projects generate information across multiple operational areas, including:

- project cost
- progress reporting
- schedule activities
- procurement packages
- vendor performance
- forecasts
- project budgets
- data-quality exceptions

These datasets are often maintained across different systems and reporting processes.

The challenge is therefore not simply visualising data. A useful project-controls solution must also:

1. validate incoming records;
2. establish consistent reporting structures;
3. calculate reliable performance indicators;
4. identify exceptions and emerging risks;
5. prioritise projects requiring management attention; and
6. present the results through a clear management interface.

ControlSight was built as an end-to-end demonstration of this process.

---

## 2. Architecture

```text
Synthetic ERP / Project-Control Data
                │
                ▼
        Python ETL Pipeline
                │
                ▼
     Validation & Data Quality
                │
                ▼
      Controlled SQLite Layer
                │
                ▼
          FastAPI Backend
                │
                ▼
       REST API Endpoints
                │
                ▼
      HTML / CSS / JavaScript
                │
                ▼
            ControlSight
     Management Intelligence UI
```

The architecture separates source data, transformation logic, analytical storage, API delivery and presentation.

This allows business logic to remain independent from the user interface and makes the application easier to test, extend and integrate with other systems.

---

## 3. Core Capabilities

### Portfolio Overview

The executive portfolio view provides consolidated indicators including:

- total approved budget;
- actual cost to date;
- forecast at completion;
- forecast variance;
- portfolio progress; and
- validation pass rate.

Portfolio progress is budget weighted so that larger projects contribute proportionally to the overall portfolio indicator.

---

### Project Portfolio

The portfolio table provides project-level comparison across:

- approved budget;
- actual cost;
- forecast at completion;
- forecast variance;
- actual progress;
- progress variance; and
- performance status.

Projects can be searched and filtered by performance status.

Performance status represents the headline cost and progress position of each project.

---

### Management Prioritisation

ControlSight includes a transparent rules-based **Management Attention Index**.

Projects are prioritised using five control dimensions:

- forecast cost pressure;
- progress slippage;
- critical schedule delays;
- procurement exposure; and
- data-quality exceptions.

The resulting score is a management prioritisation mechanism rather than a statistical probability of project failure.

This separates two related but different concepts:

**Performance Status**  
Headline cost and progress position.

**Management Attention**  
Broader exception severity incorporating cost, progress, schedule, procurement and data quality.

---

## 4. Project-Level Intelligence

Selecting a project opens a detailed control view containing:

- approved budget;
- actual cost;
- forecast at completion;
- forecast variance;
- planned progress;
- actual progress;
- progress variance;
- delayed activities;
- critical schedule delays;
- automated management insights;
- cumulative cost performance;
- progress S-curve;
- schedule risk; and
- procurement delivery risk.

This allows users to move from portfolio-level prioritisation into the underlying project-control drivers.

---

## 5. Cost Performance

Cost reporting distinguishes between **period movements** and **forecast snapshots**.

Actual and planned costs are treated as monthly flows and accumulated through time.

Forecast at Completion (FAC), however, is treated as a reporting-date snapshot rather than summed across historical periods.

This prevents repeated forecast values from being incorrectly accumulated.

The dashboard compares cumulative planned and actual expenditure and highlights source-data anomalies requiring investigation.

---

## 6. Progress Performance

Progress reporting compares planned and actual completion over time.

Progress variance is calculated as:

```text
Progress Variance =
Actual Progress - Planned Progress
```

Because this represents the difference between two percentages, ControlSight reports the result in **percentage points (pp)**.

For example:

```text
Planned Progress = 79.2%
Actual Progress  = 72.0%

Progress Variance = -7.2 pp
```

Negative values indicate progress behind plan.

---

## 7. Portfolio Progress Methodology

Portfolio progress is calculated using approved project budget as the weighting factor:

```text
                     Σ(Project Progress × Approved Budget)
Portfolio Progress = ─────────────────────────────────────
                              Σ Approved Budget
```

This avoids treating a small project and a major capital project as equally significant when calculating portfolio performance.

The current synthetic portfolio produces:

```text
Weighted Planned Progress: 78.33%
Weighted Actual Progress:  73.71%
Progress Variance:         -4.62 pp
```

---

## 8. Schedule Risk

Schedule analytics identify:

- total activities;
- critical activities;
- delayed activities;
- critical delayed activities;
- activity completion; and
- delay duration.

Critical-path delays are surfaced separately because they can represent a materially different management risk from delays to non-critical activities.

---

## 9. Procurement Risk

Procurement analytics monitor:

- procurement packages;
- delayed deliveries;
- critical delivery delays;
- average delivery delay;
- delayed package value; and
- vendor information.

This allows procurement exceptions to be considered alongside cost, progress and schedule performance.

---

## 10. Data Quality & Governance

ControlSight deliberately treats data quality as part of project controls rather than silently cleaning problematic records.

The validation pipeline follows four stages:

```text
Source Data
    ↓
Validation
    ↓
Quarantine / Exception Handling
    ↓
Controlled Analytical Reporting
```

Structurally invalid records are isolated from the analytical layer.

Plausible but suspicious observations can instead be retained and explicitly flagged for investigation.

This preserves auditability while preventing known invalid records from contaminating management reporting.

---

## 11. Validation Pass Rate

The portfolio dashboard reports a **Validation Pass Rate** rather than a generic data-quality score.

It is calculated as:

```text
                       Accepted Analytical Records
Validation Pass Rate = ─────────────────────────── × 100
                         Source Records Evaluated
```

For the current synthetic dataset:

```text
Source operational records evaluated: 2,415
Accepted analytical records:          2,405
Validation Pass Rate:                  99.59%
```

Logged data-quality issues are maintained separately because:

1. one source record can generate more than one validation issue; and
2. some suspicious records are intentionally retained for investigation.

Therefore, the number of logged issues is not incorrectly treated as the number of rejected records.

---

## 12. Data Quality Control Centre

The dashboard provides a dedicated governance view containing:

- logged validation exceptions;
- issue type distribution;
- issues by source dataset;
- validation register;
- affected fields;
- source values; and
- validation messages.

Example exception types include:

- missing values;
- invalid values;
- duplicate records;
- invalid references;
- invalid formats;
- logical errors; and
- statistical/business-rule anomalies.

---

## 13. Anomaly Handling

ControlSight does not automatically delete every unusual observation.

For example, a cost observation that is structurally valid but materially exceeds its planned value can remain in the analytical dataset while receiving an anomaly flag.

This allows management reporting to expose the issue rather than hiding it.

The principle is:

> **Invalid records are isolated. Suspicious but plausible records are retained, flagged and investigated.**

---

## 14. Automated Management Insights

Project-level management insights are generated using deterministic project-control rules.

The logic evaluates indicators such as:

- forecast cost overruns;
- progress slippage;
- critical schedule delays;
- procurement delays; and
- data anomalies.

The feature is intentionally described as **rules-based exception analytics**, not artificial intelligence.

This keeps the methodology transparent and explainable to users.

---

## 15. Quality Assurance

ControlSight includes an independent QA script:

```text
src/analytics/qa_checks.py
```

The QA layer reconciles analytical outputs against underlying database records and independently validates key calculations.

Current QA result:

```text
Checks Executed: 130
PASS:            129
WARN:              1
FAIL:              0

RESULT: QA PASSED
```

The single warning relates to a deliberately retained source cost anomaly and is expected behaviour.

QA checks include:

- portfolio budget reconciliation;
- actual cost reconciliation;
- FAC reconciliation;
- forecast variance;
- project-level KPIs;
- weighted portfolio progress;
- validation pass rate;
- schedule indicators;
- procurement indicators; and
- retained anomaly detection.

---

## 16. Technology Stack

### Data & Analytics

- Python
- pandas
- SQL
- SQLite
- Jupyter

### Backend

- FastAPI
- Python
- REST API architecture

### Frontend

- HTML5
- CSS3
- JavaScript
- Native SVG visualisations

### Engineering & QA

- Git
- Automated analytical QA checks
- Data validation and exception logging
- Relational analytical modelling

---

## 17. Repository Structure

```text
ControlSight/
│
├── data/
│   ├── raw/
│   ├── processed/
│   └── database/
│
├── docs/
│   └── data_dictionary.md
│
├── src/
│   │
│   ├── analytics/
│   │   ├── metrics.ipynb
│   │   └── qa_checks.py
│   │
│   ├── backend/
│   │   ├── build_database.ipynb
│   │   ├── main.ipynb
│   │   └── main.py
│   │
│   ├── data_generation/
│   │   └── generate_raw_data.ipynb
│   │
│   ├── etl/
│   │   └── clean_data.ipynb
│   │
│   └── frontend/
│       ├── index.html
│       ├── css/
│       │   └── styles.css
│       └── js/
│           └── dashboard.js
│
├── .gitignore
├── README.md
└── requirements.txt
```

---

## 18. API Layer

The FastAPI backend exposes analytical information to the frontend through REST endpoints.

Key endpoints include:

```text
/api/kpis
/api/projects
/api/data-quality
/api/cost-anomalies

/api/projects/{project_code}/overview
/api/projects/{project_code}/cost-trend
/api/projects/{project_code}/progress-trend
/api/projects/{project_code}/schedule-risk
/api/projects/{project_code}/procurement-risk
/api/projects/{project_code}/management-insights

/api/portfolio/attention-ranking
```

FastAPI also provides interactive API documentation when the application is running.

---

## 19. Running ControlSight Locally

From the project root, install the required Python packages:

```bash
pip install -r requirements.txt
```

Start the FastAPI application:

```bash
python -m uvicorn src.backend.main:app --reload
```

Open the dashboard:

```text
http://127.0.0.1:8000
```

Interactive API documentation is available at:

```text
http://127.0.0.1:8000/docs
```

---

## 20. Why a Custom Web Dashboard?

ControlSight is not intended to demonstrate that HTML dashboards are universally better than traditional BI platforms.

Instead, it demonstrates where a custom web analytics layer can add value.

A native application can provide:

- fully customised user experience;
- API-driven integration;
- bespoke project-control workflows;
- transparent business rules;
- custom drill-down behaviour;
- application-level validation;
- tailored management prioritisation;
- integration with operational systems; and
- greater control over how analytical functionality is delivered.

A conventional BI platform could still be highly appropriate for many reporting requirements.

The purpose of ControlSight is to demonstrate the additional flexibility available when analytical reporting is delivered as a web application.

---

## 21. Project Objective

ControlSight was developed as a portfolio project to demonstrate the ability to connect:

**business understanding + project controls + data engineering + analytics + backend development + frontend delivery.**

The objective was not simply to create a visually attractive dashboard.

The objective was to build a small but complete analytical system in which:

```text
Source Data
     ↓
Validation
     ↓
Transformation
     ↓
Analytical Model
     ↓
Business Logic
     ↓
API
     ↓
Management Interface
     ↓
Decision Support
```

can be traced from end to end.

---

## Disclaimer

All project names, financial values, schedules, procurement records, vendors and operational observations used in ControlSight are **synthetic and fictional**.

The dataset was created solely for software, analytics and portfolio demonstration purposes.