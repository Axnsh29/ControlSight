/* ============================================================
   CONTROLSIGHT
   CONTINGENCY / RISK / CASH-FLOW UI
   v1.0.0
   ============================================================ */

const RC_API_BASE = "/api/risk-cashflow";

let rcInitialised = false;
let rcSelectedProject = null;
let rcPortfolio = null;
let rcConfig = null;


/* ============================================================
   HELPERS
   ============================================================ */

function rcEscape(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "—";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function rcMoney(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "£0";
    }

    return new Intl.NumberFormat(
        "en-GB",
        {
            style: "currency",
            currency: "GBP",
            maximumFractionDigits: 0
        }
    ).format(number);
}


function rcSignedMoney(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "£0";
    }

    if (number > 0) {
        return `+${rcMoney(number)}`;
    }

    return rcMoney(number);
}


function rcPercent(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "0.0%";
    }

    return `${number.toFixed(1)}%`;
}


function rcDate(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }

    return new Intl.DateTimeFormat(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    ).format(date);
}


async function rcFetchJson(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            options
        );

    if (!response.ok) {

        let detail =
            `Request failed with HTTP ${response.status}`;

        try {

            const body =
                await response.json();

            if (
                typeof body?.detail ===
                "string"
            ) {
                detail = body.detail;

            } else if (
                body?.detail
            ) {
                detail =
                    JSON.stringify(
                        body.detail
                    );
            }

        } catch {
            // ignore
        }

        throw new Error(
            detail
        );
    }

    return response.json();
}


/* ============================================================
   STYLES
   ============================================================ */

function installRCStyles() {

    if (
        document.getElementById(
            "controlsight-risk-cashflow-styles"
        )
    ) {
        return;
    }

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "controlsight-risk-cashflow-styles";

    style.textContent = `

        #risk-cashflow {
            scroll-margin-top: 90px;
        }

        .rc-shell {
            display: grid;
            gap: 18px;
        }

        .rc-hero {

            display: flex;
            justify-content: space-between;
            align-items: flex-start;

            gap: 20px;

            padding: 20px 22px;

            background:
                linear-gradient(
                    135deg,
                    #111827,
                    #1f3b4d
                );

            color: white;

            border-radius: 12px;

            box-shadow:
                0 10px 28px
                rgba(15, 23, 42, 0.15);
        }

        .rc-eyebrow {

            display: block;

            margin-bottom: 6px;

            color: #67e8f9;

            font-size: 10px;
            font-weight: 850;

            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .rc-hero h2 {

            margin: 0;

            color: white;

            font-size: 22px;
            font-weight: 850;
        }

        .rc-hero p {

            max-width: 760px;

            margin: 8px 0 0;

            color: #cbd5e1;

            font-size: 11px;
            line-height: 1.6;
        }

        .rc-badge {

            flex: 0 0 auto;

            padding: 8px 11px;

            color: #cffafe;

            background:
                rgba(6, 182, 212, 0.12);

            border:
                1px solid
                rgba(103, 232, 249, 0.25);

            border-radius: 999px;

            font-size: 9px;
            font-weight: 850;
        }

        .rc-panel {

            padding: 20px;

            background: white;

            border:
                1px solid
                #e5e7eb;

            border-radius: 11px;

            box-shadow:
                0 2px 8px
                rgba(15, 23, 42, 0.05);
        }

        .rc-header {

            display: flex;
            justify-content: space-between;
            align-items: flex-start;

            gap: 16px;

            margin-bottom: 16px;
        }

        .rc-header h3 {

            margin: 0;

            color: #0f172a;

            font-size: 16px;
            font-weight: 850;
        }

        .rc-header p {

            margin: 5px 0 0;

            color: #64748b;

            font-size: 10px;
            line-height: 1.5;
        }

        .rc-project-select {

            min-width: 280px;

            padding: 9px 11px;

            color: #0f172a;

            background: white;

            border:
                1px solid
                #cbd5e1;

            border-radius: 7px;

            font-family: inherit;

            font-size: 10px;
            font-weight: 750;
        }

        .rc-kpi-grid {

            display: grid;

            grid-template-columns:
                repeat(6, minmax(0, 1fr));

            gap: 10px;
        }

        .rc-kpi {

            padding: 14px;

            background: #f8fafc;

            border:
                1px solid
                #e5eaf1;

            border-radius: 8px;
        }

        .rc-kpi span {

            display: block;

            color: #64748b;

            font-size: 8px;
            font-weight: 750;
        }

        .rc-kpi strong {

            display: block;

            margin-top: 5px;

            color: #0f172a;

            font-size: 16px;
            font-weight: 850;
        }

        .rc-kpi.remaining strong {
            color: #166534;
        }

        .rc-kpi.exposure strong {
            color: #b45309;
        }

        .rc-kpi.drawn strong {
            color: #b91c1c;
        }

        .rc-status {

            display: inline-flex;

            margin-top: 5px;

            padding: 4px 7px;

            border-radius: 999px;

            font-size: 8px;
            font-weight: 850;
        }

        .rc-status.available,
        .rc-status.normal {

            color: #166534;
            background: #dcfce7;
        }

        .rc-status.watch,
        .rc-status.high-utilisation {

            color: #92400e;
            background: #fef3c7;
        }

        .rc-status.exceeded,
        .rc-status.material-variance {

            color: #991b1b;
            background: #fee2e2;
        }

        .rc-utilisation {

            margin-top: 14px;
        }

        .rc-utilisation-head {

            display: flex;
            justify-content: space-between;

            gap: 10px;

            margin-bottom: 5px;

            color: #475569;

            font-size: 8px;
            font-weight: 800;
        }

        .rc-track {

            height: 8px;

            overflow: hidden;

            background: #e2e8f0;

            border-radius: 999px;
        }

        .rc-fill {

            height: 100%;

            background:
                linear-gradient(
                    90deg,
                    #0ea5e9,
                    #2563eb
                );

            border-radius: 999px;
        }

        .rc-grid-two {

            display: grid;

            grid-template-columns:
                minmax(0, 1fr)
                minmax(0, 1fr);

            gap: 16px;
        }

        .rc-form-grid {

            display: grid;

            grid-template-columns:
                repeat(3, minmax(0, 1fr));

            gap: 10px;
        }

        .rc-field {

            display: grid;
            gap: 5px;
        }

        .rc-field.full {
            grid-column: 1 / -1;
        }

        .rc-field label {

            color: #475569;

            font-size: 8px;
            font-weight: 800;
        }

        .rc-input,
        .rc-select,
        .rc-textarea {

            width: 100%;

            box-sizing: border-box;

            padding: 9px 10px;

            color: #0f172a;

            background: white;

            border:
                1px solid
                #dbe3ec;

            border-radius: 7px;

            font-family: inherit;

            font-size: 10px;
        }

        .rc-textarea {

            min-height: 72px;

            resize: vertical;
        }

        .rc-button-row {

            display: flex;
            flex-wrap: wrap;

            gap: 8px;

            margin-top: 14px;
        }

        .rc-button {

            appearance: none;

            padding: 8px 11px;

            border-radius: 6px;

            font-family: inherit;

            font-size: 9px;
            font-weight: 850;

            cursor: pointer;
        }

        .rc-primary {

            color: white;

            background: #2563eb;

            border:
                1px solid
                #2563eb;
        }

        .rc-secondary {

            color: #334155;

            background: white;

            border:
                1px solid
                #cbd5e1;
        }

        .rc-success {

            color: #166534;

            background: #f0fdf4;

            border:
                1px solid
                #bbf7d0;
        }

        .rc-warning {

            color: #92400e;

            background: #fffbeb;

            border:
                1px solid
                #fde68a;
        }

        .rc-danger {

            color: #991b1b;

            background: #fef2f2;

            border:
                1px solid
                #fecaca;
        }

        .rc-feedback {

            display: none;

            margin-top: 12px;

            padding: 9px 11px;

            border-radius: 7px;

            font-size: 9px;
        }

        .rc-feedback.visible {
            display: block;
        }

        .rc-feedback.success {

            color: #166534;

            background: #f0fdf4;

            border:
                1px solid
                #bbf7d0;
        }

        .rc-feedback.error {

            color: #991b1b;

            background: #fef2f2;

            border:
                1px solid
                #fecaca;
        }

        .rc-table-wrap {

            overflow-x: auto;

            border:
                1px solid
                #e5eaf1;

            border-radius: 8px;
        }

        .rc-table {

            width: 100%;

            min-width: 1000px;

            border-collapse: collapse;

            font-size: 9px;
        }

        .rc-table th {

            padding: 10px;

            text-align: left;

            color: #64748b;

            background: #f8fafc;

            border-bottom:
                1px solid
                #e5eaf1;

            font-size: 8px;
            font-weight: 850;

            text-transform: uppercase;
        }

        .rc-table td {

            padding: 11px 10px;

            color: #334155;

            border-bottom:
                1px solid
                #eef2f7;

            vertical-align: top;
        }

        .rc-risk-status {

            display: inline-flex;

            padding: 5px 7px;

            border-radius: 999px;

            font-size: 8px;
            font-weight: 850;
        }

        .rc-risk-status.proposed {

            color: #92400e;
            background: #fef3c7;
        }

        .rc-risk-status.approved {

            color: #1d4ed8;
            background: #dbeafe;
        }

        .rc-risk-status.drawn {

            color: #991b1b;
            background: #fee2e2;
        }

        .rc-risk-status.rejected,
        .rc-risk-status.cancelled {

            color: #475569;
            background: #e2e8f0;
        }

        .rc-row-actions {

            display: flex;
            flex-wrap: wrap;

            gap: 5px;
        }

        .rc-row-button {

            appearance: none;

            padding: 5px 7px;

            border-radius: 5px;

            font-family: inherit;

            font-size: 7px;
            font-weight: 800;

            cursor: pointer;
        }

        .rc-cash-summary {

            display: grid;

            grid-template-columns:
                repeat(4, minmax(0, 1fr));

            gap: 9px;

            margin-bottom: 14px;
        }

        .rc-cash-card {

            padding: 12px;

            background: #f8fafc;

            border:
                1px solid
                #e5eaf1;

            border-radius: 8px;
        }

        .rc-cash-card span {

            display: block;

            color: #64748b;

            font-size: 8px;
            font-weight: 750;
        }

        .rc-cash-card strong {

            display: block;

            margin-top: 4px;

            color: #0f172a;

            font-size: 15px;
            font-weight: 850;
        }

        .rc-chart {

            width: 100%;
            min-height: 260px;

            padding: 10px;

            box-sizing: border-box;

            background: #fbfdff;

            border:
                1px solid
                #e5eaf1;

            border-radius: 8px;
        }

        .rc-chart svg {

            width: 100%;
            height: 250px;

            overflow: visible;
        }

        .rc-chart-label {

            fill: #64748b;

            font-size: 10px;
        }

        .rc-chart-grid {

            stroke: #e2e8f0;

            stroke-width: 1;
        }

        .rc-chart-line-forecast {

            fill: none;

            stroke: #2563eb;

            stroke-width: 3;
        }

        .rc-chart-line-actual {

            fill: none;

            stroke: #0f766e;

            stroke-width: 3;
        }

        .rc-chart-dot-forecast {
            fill: #2563eb;
        }

        .rc-chart-dot-actual {
            fill: #0f766e;
        }

        .rc-chart-legend {

            display: flex;
            gap: 16px;

            margin-bottom: 8px;

            color: #475569;

            font-size: 9px;
            font-weight: 750;
        }

        .rc-legend-dot {

            display: inline-block;

            width: 8px;
            height: 8px;

            margin-right: 5px;

            border-radius: 50%;
        }

        .rc-legend-forecast {
            background: #2563eb;
        }

        .rc-legend-actual {
            background: #0f766e;
        }

        .rc-note {

            margin-top: 12px;

            padding: 10px 11px;

            color: #475569;

            background: #f8fafc;

            border:
                1px solid
                #e2e8f0;

            border-radius: 7px;

            font-size: 8px;
            line-height: 1.5;
        }

        .rc-note strong {
            color: #0f172a;
        }

        .rc-empty {

            padding: 28px;

            text-align: center;

            color: #64748b;

            font-size: 10px;
        }

        @media (max-width: 1150px) {

            .rc-kpi-grid {

                grid-template-columns:
                    repeat(3, minmax(0, 1fr));
            }

            .rc-grid-two {
                grid-template-columns: 1fr;
            }

            .rc-form-grid {

                grid-template-columns:
                    repeat(2, minmax(0, 1fr));
            }
        }

        @media (max-width: 720px) {

            .rc-hero,
            .rc-header {

                flex-direction: column;
            }

            .rc-project-select {
                width: 100%;
                min-width: 0;
            }

            .rc-kpi-grid,
            .rc-cash-summary,
            .rc-form-grid {

                grid-template-columns: 1fr;
            }

            .rc-field.full {
                grid-column: auto;
            }
        }
    `;

    document.head.appendChild(
        style
    );
}


/* ============================================================
   PAGE
   ============================================================ */

function installRCPage() {

    if (
        document.getElementById(
            "risk-cashflow"
        )
    ) {
        return;
    }

    const main =
        document.querySelector("main")
        ||
        document.querySelector(".main-content")
        ||
        document.body;

    const section =
        document.createElement(
            "section"
        );

    section.id =
        "risk-cashflow";

    section.className =
        "dashboard-section";

    section.innerHTML = `

        <div class="rc-shell">

            <div class="rc-hero">

                <div>

                    <span class="rc-eyebrow">
                        Risk & Funding Control
                    </span>

                    <h2>
                        Contingency, Risk Drawdown & Cash Flow
                    </h2>

                    <p>
                        Track contingency capacity,
                        proposed risk exposure,
                        approved drawdowns and project
                        cash-flow independently from
                        accounting cost and FAC.
                    </p>

                </div>

                <div class="rc-badge">
                    Cost ≠ Cash
                </div>

            </div>


            <div class="rc-panel">

                <div class="rc-header">

                    <div>

                        <h3>
                            Project Contingency Position
                        </h3>

                        <p>
                            Proposed risks remain exposure
                            until formally approved.
                        </p>

                    </div>

                    <select
                        id="rc-project-select"
                        class="rc-project-select"
                    ></select>

                </div>


                <div
                    id="rc-contingency-kpis"
                    class="rc-kpi-grid"
                ></div>


                <div
                    id="rc-utilisation"
                    class="rc-utilisation"
                ></div>

            </div>


            <div class="rc-grid-two">

                <div class="rc-panel">

                    <div class="rc-header">

                        <div>

                            <h3>
                                Add Risk / Drawdown
                            </h3>

                            <p>
                                Capture potential and
                                approved contingency exposure.
                            </p>

                        </div>

                    </div>


                    <div class="rc-form-grid">

                        <div class="rc-field">

                            <label>
                                Risk Reference
                            </label>

                            <input
                                id="rc-risk-reference"
                                class="rc-input"
                                placeholder="RISK-006-002"
                            >

                        </div>


                        <div class="rc-field">

                            <label>
                                Category
                            </label>

                            <select
                                id="rc-risk-category"
                                class="rc-select"
                            ></select>

                        </div>


                        <div class="rc-field">

                            <label>
                                Status
                            </label>

                            <select
                                id="rc-risk-status"
                                class="rc-select"
                            ></select>

                        </div>


                        <div class="rc-field">

                            <label>
                                Amount (£)
                            </label>

                            <input
                                id="rc-risk-amount"
                                class="rc-input"
                                type="number"
                                step="1000"
                            >

                        </div>


                        <div class="rc-field">

                            <label>
                                Owner
                            </label>

                            <input
                                id="rc-risk-owner"
                                class="rc-input"
                                placeholder="Commercial Manager"
                            >

                        </div>


                        <div class="rc-field">

                            <label>
                                Event Date
                            </label>

                            <input
                                id="rc-risk-date"
                                class="rc-input"
                                type="date"
                            >

                        </div>


                        <div class="rc-field full">

                            <label>
                                Title
                            </label>

                            <input
                                id="rc-risk-title"
                                class="rc-input"
                                placeholder="Describe the risk"
                            >

                        </div>


                        <div class="rc-field full">

                            <label>
                                Description
                            </label>

                            <textarea
                                id="rc-risk-description"
                                class="rc-textarea"
                            ></textarea>

                        </div>

                    </div>


                    <div class="rc-button-row">

                        <button
                            id="rc-create-risk"
                            class="
                                rc-button
                                rc-primary
                            "
                            type="button"
                        >
                            Add Risk
                        </button>

                        <button
                            id="rc-clear-risk"
                            class="
                                rc-button
                                rc-secondary
                            "
                            type="button"
                        >
                            Clear
                        </button>

                    </div>


                    <div
                        id="rc-risk-feedback"
                        class="rc-feedback"
                    ></div>

                </div>


                <div class="rc-panel">

                    <div class="rc-header">

                        <div>

                            <h3>
                                Add / Update Cash-Flow Period
                            </h3>

                            <p>
                                Maintain monthly forecast,
                                actual and committed cash.
                            </p>

                        </div>

                    </div>


                    <div class="rc-form-grid">

                        <div class="rc-field">

                            <label>
                                Reporting Period
                            </label>

                            <input
                                id="rc-cash-period"
                                class="rc-input"
                                type="month"
                            >

                        </div>


                        <div class="rc-field">

                            <label>
                                Forecast Cash (£)
                            </label>

                            <input
                                id="rc-cash-forecast"
                                class="rc-input"
                                type="number"
                                step="1000"
                            >

                        </div>


                        <div class="rc-field">

                            <label>
                                Actual Cash (£)
                            </label>

                            <input
                                id="rc-cash-actual"
                                class="rc-input"
                                type="number"
                                step="1000"
                            >

                        </div>


                        <div class="rc-field">

                            <label>
                                Committed Cash (£)
                            </label>

                            <input
                                id="rc-cash-committed"
                                class="rc-input"
                                type="number"
                                step="1000"
                            >

                        </div>


                        <div class="rc-field full">

                            <label>
                                Notes
                            </label>

                            <textarea
                                id="rc-cash-notes"
                                class="rc-textarea"
                            ></textarea>

                        </div>

                    </div>


                    <div class="rc-button-row">

                        <button
                            id="rc-save-cashflow"
                            class="
                                rc-button
                                rc-primary
                            "
                            type="button"
                        >
                            Save Period
                        </button>

                    </div>


                    <div
                        id="rc-cash-feedback"
                        class="rc-feedback"
                    ></div>

                </div>

            </div>


            <div class="rc-panel">

                <div class="rc-header">

                    <div>

                        <h3>
                            Risk & Contingency Register
                        </h3>

                        <p>
                            Proposed → Approved → Drawn
                            lifecycle with contingency impact.
                        </p>

                    </div>

                    <button
                        id="rc-refresh-risk"
                        class="
                            rc-button
                            rc-secondary
                        "
                        type="button"
                    >
                        Refresh
                    </button>

                </div>


                <div id="rc-risk-register">
                    Loading...
                </div>

            </div>


            <div class="rc-panel">

                <div class="rc-header">

                    <div>

                        <h3>
                            Cash-Flow Forecast
                        </h3>

                        <p>
                            Monthly and cumulative cash position.
                        </p>

                    </div>

                </div>


                <div
                    id="rc-cash-summary"
                    class="rc-cash-summary"
                ></div>


                <div
                    id="rc-cash-chart"
                    class="rc-chart"
                ></div>


                <div
                    id="rc-cash-table"
                    style="margin-top:14px;"
                ></div>


                <div class="rc-note">

                    <strong>
                        Methodology:
                    </strong>

                    cash-flow values are maintained
                    as a separate planning dataset.
                    ControlSight does not assume
                    accounting cost or FAC equals cash paid.

                </div>

            </div>

        </div>
    `;

    main.appendChild(
        section
    );
}


/* ============================================================
   NAVIGATION
   ============================================================ */

function installRCNavigation() {

    const nav =
        document.querySelector(
            ".sidebar-nav"
        );

    if (!nav) {
        return;
    }

    if (
        nav.querySelector(
            'a[href="#risk-cashflow"]'
        )
    ) {
        return;
    }

    const link =
        document.createElement(
            "a"
        );

    link.href =
        "#risk-cashflow";

    link.className =
        "nav-item";

    link.innerHTML = `

        <span class="nav-icon">
            ◇
        </span>

        <span>
            Risk & Cash Flow
        </span>
    `;

    link.addEventListener(
        "click",
        event => {

            event.preventDefault();

            document
                .getElementById(
                    "risk-cashflow"
                )
                ?.scrollIntoView(
                    {
                        behavior: "smooth",
                        block: "start"
                    }
                );
        }
    );

    nav.appendChild(
        link
    );
}


/* ============================================================
   CONFIG
   ============================================================ */

async function loadRCConfig() {

    rcConfig =
        await rcFetchJson(
            `${RC_API_BASE}/config`
        );

    const category =
        document.getElementById(
            "rc-risk-category"
        );

    const status =
        document.getElementById(
            "rc-risk-status"
        );


    category.innerHTML =
        rcConfig
            .risk_categories
            .map(
                item => `

                    <option value="${rcEscape(item)}">
                        ${rcEscape(item)}
                    </option>
                `
            )
            .join("");


    status.innerHTML =
        rcConfig
            .risk_statuses
            .map(
                item => `

                    <option
                        value="${rcEscape(item)}"
                        ${
                            item === "Proposed"
                                ? "selected"
                                : ""
                        }
                    >
                        ${rcEscape(item)}
                    </option>
                `
            )
            .join("");
}


/* ============================================================
   PORTFOLIO / PROJECT SELECTOR
   ============================================================ */

async function loadRCPortfolio() {

    rcPortfolio =
        await rcFetchJson(
            `${RC_API_BASE}/portfolio/contingency`
        );

    const projects =
        rcPortfolio.projects || [];

    const select =
        document.getElementById(
            "rc-project-select"
        );


    select.innerHTML =
        projects
            .map(
                project => `

                    <option
                        value="${rcEscape(
                            project.project_code
                        )}"
                    >
                        ${rcEscape(
                            project.project_code
                        )}
                        ·
                        ${rcEscape(
                            project.project_name
                        )}
                    </option>
                `
            )
            .join("");


    const sharedProject =
        sessionStorage.getItem(
            "controlsight:selected-project"
        );


    if (
        !rcSelectedProject
        &&
        sharedProject
        &&
        projects.some(
            project =>
                project.project_code ===
                sharedProject
        )
    ) {

        rcSelectedProject =
            sharedProject;
    }


    if (
        !rcSelectedProject
        &&
        projects.length
    ) {

        rcSelectedProject =
            projects[0]
                .project_code;
    }


    if (
        rcSelectedProject
    ) {

        select.value =
            rcSelectedProject;

        await loadRCProject();
    }
}


/* ============================================================
   LOAD PROJECT
   ============================================================ */

async function loadRCProject() {

    if (!rcSelectedProject) {
        return;
    }

    const [
        contingency,
        risks,
        cashflow
    ] = await Promise.all([

        rcFetchJson(
            `${RC_API_BASE}/projects/${encodeURIComponent(
                rcSelectedProject
            )}/contingency`
        ),

        rcFetchJson(
            `${RC_API_BASE}/projects/${encodeURIComponent(
                rcSelectedProject
            )}/risks`
        ),

        rcFetchJson(
            `${RC_API_BASE}/projects/${encodeURIComponent(
                rcSelectedProject
            )}/cashflow`
        )
    ]);


    renderRCContingency(
        contingency
    );

    renderRCRisks(
        risks.risks || []
    );

    renderRCCashflow(
        cashflow
    );
}


/* ============================================================
   CONTINGENCY
   ============================================================ */

function renderRCContingency(
    data
) {

    const container =
        document.getElementById(
            "rc-contingency-kpis"
        );


    const contingencyConfigured =
        String(
            data.status || ""
        ).toLowerCase()
        !==
        "not configured";


    if (!contingencyConfigured) {

        container.innerHTML = `

            <div class="rc-kpi">

                <span>
                    Current Budget
                </span>

                <strong>
                    ${rcMoney(
                        data.current_budget
                    )}
                </strong>

            </div>


            <div class="rc-kpi">

                <span>
                    Contingency
                </span>

                <strong>
                    Not configured
                </strong>

            </div>


            <div class="rc-kpi">

                <span>
                    Proposed Exposure
                </span>

                <strong>
                    Not configured
                </strong>

            </div>


            <div class="rc-kpi">

                <span>
                    Approved not Drawn
                </span>

                <strong>
                    Not configured
                </strong>

            </div>


            <div class="rc-kpi">

                <span>
                    Drawn Contingency
                </span>

                <strong>
                    Not configured
                </strong>

            </div>


            <div class="rc-kpi">

                <span>
                    Remaining Contingency
                </span>

                <strong>
                    Not configured
                </strong>

                <span
                    class="
                        rc-status
                        not-configured
                    "
                >
                    Not Configured
                </span>

            </div>
        `;

        return;
    }


    container.innerHTML = `

        <div class="rc-kpi">

            <span>
                Current Budget
            </span>

            <strong>
                ${rcMoney(
                    data.current_budget
                )}
            </strong>

        </div>


        <div class="rc-kpi">

            <span>
                Contingency
            </span>

            <strong>
                ${rcMoney(
                    data.contingency_budget
                )}
            </strong>

        </div>


        <div class="
            rc-kpi
            exposure
        ">

            <span>
                Proposed Exposure
            </span>

            <strong>
                ${rcMoney(
                    data.proposed_risk_exposure
                )}
            </strong>

        </div>


        <div class="rc-kpi">

            <span>
                Approved not Drawn
            </span>

            <strong>
                ${rcMoney(
                    data.approved_not_drawn
                )}
            </strong>

        </div>


        <div class="
            rc-kpi
            drawn
        ">

            <span>
                Drawn Contingency
            </span>

            <strong>
                ${rcMoney(
                    data.drawn_contingency
                )}
            </strong>

        </div>


        <div class="
            rc-kpi
            remaining
        ">

            <span>
                Remaining Contingency
            </span>

            <strong>
                ${rcMoney(
                    data.remaining_contingency
                )}
            </strong>

            <span
                class="
                    rc-status
                    ${String(
                        data.status || ""
                    )
                    .toLowerCase()
                    .replaceAll(
                        " ",
                        "-"
                    )}
                "
            >
                ${rcEscape(
                    data.status
                )}
            </span>

        </div>
    `;


    const utilisation =
        document.getElementById(
            "rc-utilisation"
        );

    const pct =
        Math.max(
            0,
            Math.min(
                100,
                Number(
                    data.utilisation_pct
                )
                || 0
            )
        );


    utilisation.innerHTML = `

        <div class="rc-utilisation-head">

            <span>
                Contingency Utilisation
            </span>

            <strong>
                ${rcPercent(
                    data.utilisation_pct
                )}
            </strong>

        </div>

        <div class="rc-track">

            <div
                class="rc-fill"
                style="
                    width:${pct}%;
                "
            ></div>

        </div>
    `;
}


/* ============================================================
   RISK REGISTER
   ============================================================ */

function renderRCRisks(
    risks
) {

    const container =
        document.getElementById(
            "rc-risk-register"
        );


    if (!risks.length) {

        container.innerHTML = `

            <div class="rc-empty">
                No risk drawdown records for this project.
            </div>
        `;

        return;
    }


    container.innerHTML = `

        <div class="rc-table-wrap">

            <table class="rc-table">

                <thead>

                    <tr>

                        <th>Reference</th>
                        <th>Risk</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Owner</th>
                        <th>Event Date</th>
                        <th>Approved By</th>
                        <th>Actions</th>

                    </tr>

                </thead>

                <tbody>

                    ${risks
                        .map(
                            risk =>
                                renderRCRiskRow(
                                    risk
                                )
                        )
                        .join("")}

                </tbody>

            </table>

        </div>
    `;


    initialiseRCRiskRowEvents();
}


function renderRCRiskRow(
    risk
) {

    const status =
        String(
            risk.status || ""
        );


    let actions = "";


    if (
        status === "Proposed"
    ) {

        actions += `

            <button
                class="
                    rc-row-button
                    rc-success
                "
                data-rc-status="Approved"
                data-rc-id="${rcEscape(
                    risk.drawdown_id
                )}"
            >
                Approve
            </button>
        `;


        actions += `

            <button
                class="
                    rc-row-button
                    rc-warning
                "
                data-rc-status="Rejected"
                data-rc-id="${rcEscape(
                    risk.drawdown_id
                )}"
            >
                Reject
            </button>
        `;
    }


    if (
        status === "Approved"
    ) {

        actions += `

            <button
                class="
                    rc-row-button
                    rc-primary
                "
                data-rc-status="Drawn"
                data-rc-id="${rcEscape(
                    risk.drawdown_id
                )}"
            >
                Mark Drawn
            </button>
        `;
    }


    if (
        status !== "Drawn"
        &&
        status !== "Cancelled"
    ) {

        actions += `

            <button
                class="
                    rc-row-button
                    rc-secondary
                "
                data-rc-status="Cancelled"
                data-rc-id="${rcEscape(
                    risk.drawdown_id
                )}"
            >
                Cancel
            </button>
        `;
    }


    actions += `

        <button
            class="
                rc-row-button
                rc-danger
            "
            data-rc-delete="${rcEscape(
                risk.drawdown_id
            )}"
        >
            Delete
        </button>
    `;


    return `

        <tr>

            <td>
                <strong>
                    ${rcEscape(
                        risk.risk_reference
                    )}
                </strong>
            </td>


            <td>

                ${rcEscape(
                    risk.title
                )}

                ${
                    risk.description
                        ? `
                            <div
                                style="
                                    margin-top:3px;
                                    color:#94a3b8;
                                    font-size:7px;
                                "
                            >
                                ${rcEscape(
                                    risk.description
                                )}
                            </div>
                        `
                        : ""
                }

            </td>


            <td>
                ${rcEscape(
                    risk.category
                )}
            </td>


            <td>
                <strong>
                    ${rcMoney(
                        risk.amount
                    )}
                </strong>
            </td>


            <td>

                <span
                    class="
                        rc-risk-status
                        ${status.toLowerCase()}
                    "
                >
                    ${rcEscape(
                        status
                    )}
                </span>

            </td>


            <td>
                ${rcEscape(
                    risk.owner
                )}
            </td>


            <td>
                ${rcEscape(
                    rcDate(
                        risk.event_date
                    )
                )}
            </td>


            <td>
                ${rcEscape(
                    risk.approved_by
                )}
            </td>


            <td>

                <div class="rc-row-actions">
                    ${actions}
                </div>

            </td>

        </tr>
    `;
}


/* ============================================================
   CREATE RISK
   ============================================================ */

async function createRCRisk() {

    clearRCFeedback(
        "rc-risk-feedback"
    );


    const reference =
        document.getElementById(
            "rc-risk-reference"
        ).value.trim();

    const category =
        document.getElementById(
            "rc-risk-category"
        ).value;

    const status =
        document.getElementById(
            "rc-risk-status"
        ).value;

    const amount =
        Number(
            document.getElementById(
                "rc-risk-amount"
            ).value
        );

    const owner =
        document.getElementById(
            "rc-risk-owner"
        ).value.trim();

    const eventDate =
        document.getElementById(
            "rc-risk-date"
        ).value;

    const title =
        document.getElementById(
            "rc-risk-title"
        ).value.trim();

    const description =
        document.getElementById(
            "rc-risk-description"
        ).value.trim();


    if (!reference) {

        setRCFeedback(
            "rc-risk-feedback",
            "Risk reference is required.",
            "error"
        );

        return;
    }


    if (!title) {

        setRCFeedback(
            "rc-risk-feedback",
            "Risk title is required.",
            "error"
        );

        return;
    }


    if (
        !Number.isFinite(amount)
        ||
        amount <= 0
    ) {

        setRCFeedback(
            "rc-risk-feedback",
            "Enter a valid positive risk amount.",
            "error"
        );

        return;
    }


    try {

        await rcFetchJson(
            `${RC_API_BASE}/risks`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(
                        {
                            project_code:
                                rcSelectedProject,

                            risk_reference:
                                reference,

                            category:
                                category,

                            title:
                                title,

                            description:
                                description || null,

                            amount:
                                amount,

                            status:
                                status,

                            event_date:
                                eventDate || null,

                            owner:
                                owner || null,

                            approved_by:
                                null
                        }
                    )
            }
        );


        setRCFeedback(
            "rc-risk-feedback",
            "Risk record created.",
            "success"
        );


        clearRCRiskForm();

        await refreshRCProject();

    } catch (error) {

        setRCFeedback(
            "rc-risk-feedback",
            error.message,
            "error"
        );
    }
}


/* ============================================================
   UPDATE RISK
   ============================================================ */

async function updateRCRiskStatus(
    id,
    status
) {

    const payload = {
        status:
            status
    };


    if (
        status === "Approved"
    ) {

        payload.approved_by =
            "Project Manager";
    }


    try {

        await rcFetchJson(
            `${RC_API_BASE}/risks/${encodeURIComponent(
                id
            )}`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(
                        payload
                    )
            }
        );


        setRCFeedback(
            "rc-risk-feedback",
            `Risk updated to ${status}.`,
            "success"
        );


        await refreshRCProject();

    } catch (error) {

        setRCFeedback(
            "rc-risk-feedback",
            error.message,
            "error"
        );
    }
}


/* ============================================================
   DELETE RISK
   ============================================================ */

async function deleteRCRisk(
    id
) {

    if (
        !window.confirm(
            "Delete this risk record?"
        )
    ) {
        return;
    }


    try {

        await rcFetchJson(
            `${RC_API_BASE}/risks/${encodeURIComponent(
                id
            )}`,
            {
                method: "DELETE"
            }
        );


        setRCFeedback(
            "rc-risk-feedback",
            "Risk record deleted.",
            "success"
        );


        await refreshRCProject();

    } catch (error) {

        setRCFeedback(
            "rc-risk-feedback",
            error.message,
            "error"
        );
    }
}


/* ============================================================
   RISK EVENTS
   ============================================================ */

function initialiseRCRiskRowEvents() {

    document
        .querySelectorAll(
            "[data-rc-status]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        updateRCRiskStatus(

                            button.dataset
                                .rcId,

                            button.dataset
                                .rcStatus
                        );
                    }
                );
            }
        );


    document
        .querySelectorAll(
            "[data-rc-delete]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        deleteRCRisk(
                            button.dataset
                                .rcDelete
                        );
                    }
                );
            }
        );
}


/* ============================================================
   CASH FLOW SAVE
   ============================================================ */

async function saveRCCashflow() {

    clearRCFeedback(
        "rc-cash-feedback"
    );


    const period =
        document.getElementById(
            "rc-cash-period"
        ).value;

    const forecast =
        Number(
            document.getElementById(
                "rc-cash-forecast"
            ).value
        );

    const actual =
        Number(
            document.getElementById(
                "rc-cash-actual"
            ).value
        );

    const committed =
        Number(
            document.getElementById(
                "rc-cash-committed"
            ).value
        );

    const notes =
        document.getElementById(
            "rc-cash-notes"
        ).value.trim();


    if (!period) {

        setRCFeedback(
            "rc-cash-feedback",
            "Reporting period is required.",
            "error"
        );

        return;
    }


    if (
        [forecast, actual, committed]
        .some(
            value =>
                !Number.isFinite(value)
                ||
                value < 0
        )
    ) {

        setRCFeedback(
            "rc-cash-feedback",
            "Cash values must be zero or positive.",
            "error"
        );

        return;
    }


    try {

        await rcFetchJson(
            `${RC_API_BASE}/projects/${encodeURIComponent(
                rcSelectedProject
            )}/cashflow`,
            {
                method: "PUT",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(
                        {
                            reporting_period:
                                period,

                            forecast_cash:
                                forecast,

                            actual_cash:
                                actual,

                            committed_cash:
                                committed,

                            notes:
                                notes || null
                        }
                    )
            }
        );


        setRCFeedback(
            "rc-cash-feedback",
            "Cash-flow period saved.",
            "success"
        );


        await refreshRCProject();

    } catch (error) {

        setRCFeedback(
            "rc-cash-feedback",
            error.message,
            "error"
        );
    }
}


/* ============================================================
   CASH FLOW RENDER
   ============================================================ */

function renderRCCashflow(
    data
) {

    const summary =
        document.getElementById(
            "rc-cash-summary"
        );


    const periods =
        Array.isArray(
            data.periods
        )
            ? data.periods
            : [];


    if (!periods.length) {

        summary.innerHTML = `

            <div class="rc-cash-card">

                <span>
                    Forecast Cash
                </span>

                <strong>
                    Not configured
                </strong>

            </div>


            <div class="rc-cash-card">

                <span>
                    Actual Cash
                </span>

                <strong>
                    Not configured
                </strong>

            </div>


            <div class="rc-cash-card">

                <span>
                    Committed Cash
                </span>

                <strong>
                    Not configured
                </strong>

            </div>


            <div class="rc-cash-card">

                <span>
                    Cash Variance
                </span>

                <strong>
                    Not configured
                </strong>

                <span>
                    No cash-flow periods saved
                </span>

            </div>
        `;


        renderRCCashChart(
            []
        );

        renderRCCashTable(
            []
        );

        return;
    }


    summary.innerHTML = `

        <div class="rc-cash-card">

            <span>
                Forecast Cash
            </span>

            <strong>
                ${rcMoney(
                    data.total_forecast_cash
                )}
            </strong>

        </div>


        <div class="rc-cash-card">

            <span>
                Actual Cash
            </span>

            <strong>
                ${rcMoney(
                    data.total_actual_cash
                )}
            </strong>

        </div>


        <div class="rc-cash-card">

            <span>
                Committed Cash
            </span>

            <strong>
                ${rcMoney(
                    data.total_committed_cash
                )}
            </strong>

        </div>


        <div class="rc-cash-card">

            <span>
                Cash Variance
            </span>

            <strong>
                ${rcSignedMoney(
                    data.total_variance
                )}
            </strong>

            <span>
                ${rcPercent(
                    data.total_variance_pct
                )}
            </span>

        </div>
    `;


    renderRCCashChart(
        data.periods || []
    );

    renderRCCashTable(
        data.periods || []
    );
}


/* ============================================================
   CASH FLOW CHART
   ============================================================ */

function renderRCCashChart(
    periods
) {

    const container =
        document.getElementById(
            "rc-cash-chart"
        );


    if (!periods.length) {

        container.innerHTML = `

            <div class="rc-empty">
                Add cash-flow periods to display the trend.
            </div>
        `;

        return;
    }


    const width = 900;
    const height = 220;

    const left = 60;
    const right = 30;
    const top = 20;
    const bottom = 40;

    const chartWidth =
        width - left - right;

    const chartHeight =
        height - top - bottom;


    const values =
        periods.flatMap(
            item => [
                Number(
                    item.cumulative_forecast
                    || 0
                ),
                Number(
                    item.cumulative_actual
                    || 0
                )
            ]
        );


    const maxValue =
        Math.max(
            ...values,
            1
        );


    const x =
        index => {

            if (
                periods.length === 1
            ) {
                return (
                    left
                    +
                    chartWidth / 2
                );
            }

            return (
                left
                +
                (
                    index
                    /
                    (
                        periods.length
                        -
                        1
                    )
                )
                *
                chartWidth
            );
        };


    const y =
        value => {

            return (
                top
                +
                chartHeight
                -
                (
                    Number(value)
                    /
                    maxValue
                )
                *
                chartHeight
            );
        };


    const forecastPoints =
        periods
            .map(
                (item, index) =>
                    `${x(index)},${y(
                        item.cumulative_forecast
                    )}`
            )
            .join(" ");


    const actualPoints =
        periods
            .map(
                (item, index) =>
                    `${x(index)},${y(
                        item.cumulative_actual
                    )}`
            )
            .join(" ");


    const labels =
        periods
            .map(
                (item, index) => `

                    <text
                        x="${x(index)}"
                        y="${height - 10}"
                        text-anchor="middle"
                        class="rc-chart-label"
                    >
                        ${rcEscape(
                            item.reporting_period
                        )}
                    </text>
                `
            )
            .join("");


    const forecastDots =
        periods
            .map(
                (item, index) => `

                    <circle
                        cx="${x(index)}"
                        cy="${y(
                            item.cumulative_forecast
                        )}"
                        r="4"
                        class="rc-chart-dot-forecast"
                    ></circle>
                `
            )
            .join("");


    const actualDots =
        periods
            .map(
                (item, index) => `

                    <circle
                        cx="${x(index)}"
                        cy="${y(
                            item.cumulative_actual
                        )}"
                        r="4"
                        class="rc-chart-dot-actual"
                    ></circle>
                `
            )
            .join("");


    container.innerHTML = `

        <div class="rc-chart-legend">

            <span>
                <span
                    class="
                        rc-legend-dot
                        rc-legend-forecast
                    "
                ></span>

                Cumulative Forecast
            </span>

            <span>
                <span
                    class="
                        rc-legend-dot
                        rc-legend-actual
                    "
                ></span>

                Cumulative Actual
            </span>

        </div>


        <svg
            viewBox="0 0 ${width} ${height}"
            preserveAspectRatio="none"
        >

            <line
                x1="${left}"
                y1="${top}"
                x2="${left}"
                y2="${top + chartHeight}"
                class="rc-chart-grid"
            ></line>

            <line
                x1="${left}"
                y1="${top + chartHeight}"
                x2="${width - right}"
                y2="${top + chartHeight}"
                class="rc-chart-grid"
            ></line>


            <polyline
                points="${forecastPoints}"
                class="rc-chart-line-forecast"
            ></polyline>


            <polyline
                points="${actualPoints}"
                class="rc-chart-line-actual"
            ></polyline>


            ${forecastDots}
            ${actualDots}
            ${labels}

        </svg>
    `;
}


/* ============================================================
   CASH FLOW TABLE
   ============================================================ */

function renderRCCashTable(
    periods
) {

    const container =
        document.getElementById(
            "rc-cash-table"
        );


    if (!periods.length) {

        container.innerHTML = "";

        return;
    }


    container.innerHTML = `

        <div class="rc-table-wrap">

            <table class="rc-table">

                <thead>

                    <tr>

                        <th>Period</th>
                        <th>Forecast</th>
                        <th>Actual</th>
                        <th>Committed</th>
                        <th>Variance</th>
                        <th>Variance %</th>
                        <th>Status</th>
                        <th>Cumulative Forecast</th>
                        <th>Cumulative Actual</th>

                    </tr>

                </thead>

                <tbody>

                    ${periods
                        .map(
                            item => `

                                <tr>

                                    <td>
                                        <strong>
                                            ${rcEscape(
                                                item.reporting_period
                                            )}
                                        </strong>
                                    </td>

                                    <td>
                                        ${rcMoney(
                                            item.forecast_cash
                                        )}
                                    </td>

                                    <td>
                                        ${rcMoney(
                                            item.actual_cash
                                        )}
                                    </td>

                                    <td>
                                        ${rcMoney(
                                            item.committed_cash
                                        )}
                                    </td>

                                    <td>
                                        ${rcSignedMoney(
                                            item.variance
                                        )}
                                    </td>

                                    <td>
                                        ${rcPercent(
                                            item.variance_pct
                                        )}
                                    </td>

                                    <td>

                                        <span
                                            class="
                                                rc-status
                                                ${String(
                                                    item.variance_status
                                                    || ""
                                                )
                                                .toLowerCase()
                                                .replaceAll(
                                                    " ",
                                                    "-"
                                                )}
                                            "
                                        >
                                            ${rcEscape(
                                                item.variance_status
                                            )}
                                        </span>

                                    </td>

                                    <td>
                                        ${rcMoney(
                                            item.cumulative_forecast
                                        )}
                                    </td>

                                    <td>
                                        ${rcMoney(
                                            item.cumulative_actual
                                        )}
                                    </td>

                                </tr>
                            `
                        )
                        .join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* ============================================================
   FORM HELPERS
   ============================================================ */

function clearRCRiskForm() {

    [
        "rc-risk-reference",
        "rc-risk-amount",
        "rc-risk-owner",
        "rc-risk-date",
        "rc-risk-title",
        "rc-risk-description"
    ]
    .forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );

            if (element) {
                element.value = "";
            }
        }
    );


    const status =
        document.getElementById(
            "rc-risk-status"
        );

    if (status) {
        status.value =
            "Proposed";
    }
}


/* ============================================================
   FEEDBACK
   ============================================================ */

function setRCFeedback(
    id,
    message,
    type
) {

    const element =
        document.getElementById(
            id
        );

    if (!element) {
        return;
    }

    element.textContent =
        message;

    element.className =
        `rc-feedback visible ${type}`;
}


function clearRCFeedback(
    id
) {

    const element =
        document.getElementById(
            id
        );

    if (!element) {
        return;
    }

    element.textContent =
        "";

    element.className =
        "rc-feedback";
}


/* ============================================================
   REFRESH
   ============================================================ */

async function refreshRCProject() {

    await loadRCProject();
}


/* ============================================================
   EVENTS
   ============================================================ */

function initialiseRCEvents() {

    document
        .getElementById(
            "rc-project-select"
        )
        ?.addEventListener(
            "change",
            async event => {

                rcSelectedProject =
                    event.target.value;

                sessionStorage.setItem(
                    "controlsight:selected-project",
                    rcSelectedProject
                );

                await loadRCProject();
            }
        );


    document
        .getElementById(
            "rc-create-risk"
        )
        ?.addEventListener(
            "click",
            createRCRisk
        );


    document
        .getElementById(
            "rc-clear-risk"
        )
        ?.addEventListener(
            "click",
            clearRCRiskForm
        );


    document
        .getElementById(
            "rc-save-cashflow"
        )
        ?.addEventListener(
            "click",
            saveRCCashflow
        );


    document
        .getElementById(
            "rc-refresh-risk"
        )
        ?.addEventListener(
            "click",
            refreshRCProject
        );
}


/* ============================================================
   INITIALISE
   ============================================================ */

async function initialiseRCUI() {

    if (
        rcInitialised
    ) {
        return;
    }

    rcInitialised = true;


    installRCStyles();

    installRCPage();

    installRCNavigation();

    initialiseRCEvents();


    try {

        await loadRCConfig();

        await loadRCPortfolio();

    } catch (error) {

        console.error(
            "Risk/Cashflow UI failed:",
            error
        );
    }
}


/* ============================================================
   DOM READY
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initialiseRCUI();

    }
);
