/* ============================================================
   CONTROLSIGHT
   FRONTEND POLISH / EXPERIENCE LAYER
   v1.4.0

   FEATURES
   ------------------------------------------------------------
   - Portfolio cost exposure
   - Forecast credibility portfolio status
   - Forecast credibility project panel
   - Reporting period selector
   - Period-aware project controls
   - FAC movement panel
   - FAC movement waterfall
   - Cost Control Cockpit
   - Period commentary
   - Action log
   - Action suggestions
   - Owner / due date / priority / status
   - Reporting snapshot
   - Scroll spy
   - Demo service notice

   IMPORTANT
   ------------------------------------------------------------
   Project-detail enhancements use controlled polling rather
   than MutationObservers to avoid self-refresh loops.
   ============================================================ */


const POLISH_API_BASE = "/api";


/* ============================================================
   STATE
   ============================================================ */

let forecastCredibilityProjects = null;

let controlSightReportingPeriod = null;

let controlSightReportingPeriods = [];

let polishLastProjectCode = null;

let polishProjectRefreshRunning = false;

let polishPortfolioEnhanced = false;

let workflowRefreshRunning = false;

let workflowLastKey = null;


/* ============================================================
   BASIC HELPERS
   ============================================================ */

function polishIsAvailable(value) {

    return (
        value !== null &&
        value !== undefined &&
        value !== ""
    );
}


function polishNumber(value) {

    if (!polishIsAvailable(value)) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}


function polishEscape(value) {

    if (!polishIsAvailable(value)) {
        return "—";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function polishCurrency(value) {

    const number =
        polishNumber(value);

    if (number === null) {
        return "—";
    }

    const absolute =
        Math.abs(number);

    const sign =
        number < 0
            ? "-"
            : "";

    if (absolute >= 1_000_000_000) {

        return (
            `${sign}£${(
                absolute /
                1_000_000_000
            ).toFixed(1)}bn`
        );
    }

    if (absolute >= 1_000_000) {

        return (
            `${sign}£${(
                absolute /
                1_000_000
            ).toFixed(1)}m`
        );
    }

    if (absolute >= 1_000) {

        return (
            `${sign}£${(
                absolute /
                1_000
            ).toFixed(0)}k`
        );
    }

    return (
        `${sign}£${absolute.toFixed(0)}`
    );
}


function polishPercentage(
    value,
    decimals = 1
) {

    const number =
        polishNumber(value);

    if (number === null) {
        return "—";
    }

    return (
        `${number.toFixed(
            decimals
        )}%`
    );
}


function formatReportingPeriodLabel(
    yearMonth
) {

    if (!yearMonth) {
        return "Unknown period";
    }

    const parts =
        String(yearMonth)
            .split("-");

    if (parts.length !== 2) {
        return yearMonth;
    }

    const year =
        Number(parts[0]);

    const month =
        Number(parts[1]);

    if (!year || !month) {
        return yearMonth;
    }

    const date =
        new Date(
            year,
            month - 1,
            1
        );

    return new Intl.DateTimeFormat(
        "en-GB",
        {
            month: "long",
            year: "numeric"
        }
    ).format(date);
}


function formatFacPeriod(
    yearMonth
) {

    return formatReportingPeriodLabel(
        yearMonth
    );
}


function formatSnapshotDate(value) {

    if (!value) {
        return "Portfolio snapshot";
    }

    const text =
        String(value);

    const normalized =
        /^\d{8}$/.test(text)
            ? `${text.slice(
                0,
                4
            )}-${text.slice(
                4,
                6
            )}-${text.slice(
                6,
                8
            )}`
            : text;

    const date =
        new Date(
            `${normalized}T00:00:00`
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return text;
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


function formatWorkflowDate(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(
            `${value}T00:00:00`
        );

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


function workflowDefaultDueDate(
    days = 14
) {

    const date =
        new Date();

    date.setDate(
        date.getDate() +
        days
    );

    return date
        .toISOString()
        .slice(
            0,
            10
        );
}


/* ============================================================
   FETCH HELPERS
   ============================================================ */

async function polishFetch(
    url,
    timeoutMs = 20000
) {

    const controller =
        new AbortController();

    const timeout =
        window.setTimeout(
            () => {
                controller.abort();
            },
            timeoutMs
        );

    try {

        const response =
            await fetch(
                url,
                {
                    signal:
                        controller.signal
                }
            );

        if (!response.ok) {

            throw new Error(
                `Request failed: ${response.status}`
            );
        }

        return response;

    } finally {

        window.clearTimeout(
            timeout
        );
    }
}


async function polishFetchJson(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            options
        );

    if (!response.ok) {

        let message =
            `Request failed: ${response.status}`;

        try {

            const body =
                await response.json();

            if (body?.detail) {
                message =
                    body.detail;
            }

        } catch {
            // ignore
        }

        throw new Error(
            message
        );
    }

    return response.json();
}


/* ============================================================
   REPORTING PERIOD URL
   ============================================================ */

function withReportingPeriod(url) {

    if (
        !controlSightReportingPeriod
    ) {
        return url;
    }

    const separator =
        url.includes("?")
            ? "&"
            : "?";

    return (
        `${url}${separator}` +
        `reporting_period=` +
        encodeURIComponent(
            controlSightReportingPeriod
        )
    );
}


/* ============================================================
   SELECTED PROJECT
   ============================================================ */

function getSelectedProjectCode() {

    const detail =
        document.getElementById(
            "project-detail"
        );

    if (
        !detail ||
        detail.classList.contains(
            "hidden"
        )
    ) {
        return null;
    }


    if (
        typeof selectedProjectCode !==
            "undefined"
        &&
        selectedProjectCode
    ) {

        return String(
            selectedProjectCode
        ).trim();
    }


    const dataElement =
        detail.querySelector(
            "[data-project-code]"
        );

    if (
        dataElement
        ?.dataset
        ?.projectCode
    ) {

        return String(
            dataElement.dataset.projectCode
        ).trim();
    }


    const visibleCode =
        detail.querySelector(
            ".project-code"
        );

    if (
        visibleCode
        ?.textContent
    ) {

        return visibleCode
            .textContent
            .trim();
    }


    return null;
}


/* ============================================================
   FEATURE STYLES
   ============================================================ */

function installPolishFeatureStyles() {

    if (
        document.getElementById(
            "controlsight-v140-feature-styles"
        )
    ) {
        return;
    }

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "controlsight-v140-feature-styles";

    style.textContent = `

        /* ==============================================
           SHARED
           ============================================== */

        .polish-panel {
            background: #ffffff;
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-panel);
        }

        .polish-panel-error {
            padding: 14px;
            color: #b91c1c;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 7px;
            font-size: 9px;
        }

        .polish-muted {
            color: var(--text-muted);
        }


        /* ==============================================
           FORECAST CREDIBILITY
           ============================================== */

        .credibility-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 58px;
            padding: 4px 7px;
            border-radius: 999px;
            font-size: 8px;
            font-weight: 800;
            white-space: nowrap;
        }

        .credibility-badge.normal {
            color: #166534;
            background: #dcfce7;
            border: 1px solid #bbf7d0;
        }

        .credibility-badge.watch {
            color: #92400e;
            background: #fef3c7;
            border: 1px solid #fde68a;
        }

        .credibility-badge.high {
            color: #9a3412;
            background: #ffedd5;
            border: 1px solid #fed7aa;
        }

        .credibility-badge.critical {
            color: #991b1b;
            background: #fee2e2;
            border: 1px solid #fecaca;
        }

        .credibility-badge.unavailable {
            color: #475569;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
        }

        .forecast-credibility-panel,
        .fac-movement-panel,
        .fac-waterfall-panel,
        .workflow-control-panel {

            margin-top: 18px;
            padding: 18px;
            background: #ffffff;
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-panel);
        }

        .forecast-credibility-header,
        .fac-movement-header,
        .fac-waterfall-header,
        .workflow-control-header {

            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 15px;
        }

        .forecast-credibility-header h3,
        .fac-movement-header h3,
        .fac-waterfall-header h3,
        .workflow-control-header h3 {

            margin: 2px 0 0;
            color: var(--text-primary);
            font-size: 15px;
            font-weight: 760;
        }

        .forecast-credibility-header p,
        .fac-movement-header p,
        .fac-waterfall-header p,
        .workflow-control-header p {

            max-width: 700px;
            margin: 5px 0 0;
            color: var(--text-secondary);
            font-size: 9px;
            line-height: 1.55;
        }

        .forecast-credibility-grid {

            display: grid;
            grid-template-columns:
                repeat(
                    5,
                    minmax(0, 1fr)
                );
            gap: 8px;
        }

        .forecast-credibility-metric {

            padding: 11px 12px;
            background: #f8fafc;
            border: 1px solid #e5eaf1;
            border-radius: 7px;
        }

        .forecast-credibility-metric span {

            display: block;
            color: var(--text-muted);
            font-size: 8px;
            font-weight: 700;
        }

        .forecast-credibility-metric strong {

            display: block;
            margin-top: 4px;
            color: var(--text-primary);
            font-size: 13px;
            font-weight: 800;
        }

        .forecast-credibility-metric.credibility-gap strong {
            color: #b91c1c;
        }

        .forecast-credibility-method {

            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-top: 12px;
            padding: 10px 11px;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 7px;
        }

        .forecast-credibility-method strong {

            flex: 0 0 auto;
            color: #1e3a8a;
            font-size: 8px;
        }

        .forecast-credibility-method span {

            color: #1d4ed8;
            font-size: 8px;
            line-height: 1.5;
        }


        /* ==============================================
           REPORTING PERIOD
           ============================================== */

        .reporting-period-control {

            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 18px;
            padding: 14px 16px;
            background: #ffffff;
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-panel);
        }

        .reporting-period-eyebrow {

            display: block;
            color: #2563eb;
            font-size: 8px;
            font-weight: 850;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .reporting-period-copy h3 {

            margin: 3px 0 0;
            font-size: 14px;
            font-weight: 780;
        }

        .reporting-period-copy p {

            margin: 4px 0 0;
            color: var(--text-secondary);
            font-size: 8px;
        }

        .reporting-period-actions {

            display: flex;
            align-items: center;
            gap: 10px;
        }

        .reporting-period-select-wrap {

            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .reporting-period-select-wrap label {

            color: var(--text-muted);
            font-size: 7px;
            font-weight: 700;
        }

        .reporting-period-select {

            min-width: 170px;
            padding: 8px 10px;
            background: #f8fafc;
            border: 1px solid #dbe3ec;
            border-radius: 7px;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 10px;
            font-weight: 750;
            cursor: pointer;
        }

        .reporting-period-context {

            min-width: 150px;
            padding: 8px 10px;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 7px;
        }

        .reporting-period-context span {

            display: block;
            color: #1d4ed8;
            font-size: 7px;
            font-weight: 700;
        }

        .reporting-period-context strong {

            display: block;
            margin-top: 3px;
            color: #1e3a8a;
            font-size: 9px;
            font-weight: 800;
        }


        /* ==============================================
           FAC MOVEMENT
           ============================================== */

        .fac-movement-period {

            padding: 6px 9px;
            border-radius: 999px;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            color: #1d4ed8;
            font-size: 8px;
            font-weight: 800;
            white-space: nowrap;
        }

        .fac-movement-grid {

            display: grid;
            grid-template-columns:
                repeat(
                    4,
                    minmax(0, 1fr)
                );
            gap: 8px;
        }

        .fac-movement-card {

            padding: 11px 12px;
            background: #f8fafc;
            border: 1px solid #e5eaf1;
            border-radius: 7px;
        }

        .fac-movement-card span {

            display: block;
            color: var(--text-muted);
            font-size: 8px;
            font-weight: 700;
        }

        .fac-movement-card strong {

            display: block;
            margin-top: 4px;
            font-size: 13px;
            font-weight: 800;
        }

        .fac-movement-value.deteriorated {
            color: #dc2626;
        }

        .fac-movement-value.improved {
            color: #16a34a;
        }

        .fac-movement-value.stable {
            color: #475569;
        }

        .fac-movement-direction {

            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 10px;
            padding: 9px 11px;
            border-radius: 7px;
        }

        .fac-movement-direction.deteriorated {

            background: #fef2f2;
            color: #b91c1c;
            border: 1px solid #fecaca;
        }

        .fac-movement-direction.improved {

            background: #f0fdf4;
            color: #166534;
            border: 1px solid #bbf7d0;
        }

        .fac-movement-direction.stable {

            background: #f8fafc;
            color: #475569;
            border: 1px solid #e2e8f0;
        }


        /* ==============================================
           COST COCKPIT
           ============================================== */

        .cost-control-cockpit {

            margin: 0 0 18px;
            padding: 18px;

            background:
                linear-gradient(
                    135deg,
                    #0b1628,
                    #132c48
                );

            border-radius: var(--radius-md);
            color: #ffffff;

            box-shadow:
                0 10px 26px
                rgba(
                    15,
                    23,
                    42,
                    0.14
                );
        }

        .cost-cockpit-header {

            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 16px;
        }

        .cost-cockpit-eyebrow {

            color: #60a5fa;
            font-size: 8px;
            font-weight: 850;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .cost-cockpit-header h3 {

            margin: 3px 0 0;
            color: #ffffff;
            font-size: 16px;
        }

        .cost-cockpit-header p {

            margin: 5px 0 0;
            color: #94a3b8;
            font-size: 9px;
        }

        .cost-cockpit-status {

            padding: 6px 9px;
            border-radius: 999px;
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
        }

        .cost-cockpit-status.green {

            color: #bbf7d0;
            background: rgba(34, 197, 94, 0.15);
            border: 1px solid rgba(34, 197, 94, 0.30);
        }

        .cost-cockpit-status.amber {

            color: #fde68a;
            background: rgba(245, 158, 11, 0.15);
            border: 1px solid rgba(245, 158, 11, 0.30);
        }

        .cost-cockpit-status.red {

            color: #fecaca;
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.30);
        }

        .cost-cockpit-grid,
        .cost-cockpit-lower {

            display: grid;
            grid-template-columns:
                repeat(
                    4,
                    minmax(0, 1fr)
                );
            gap: 8px;
        }

        .cost-cockpit-lower {
            margin-top: 8px;
        }

        .cost-cockpit-card,
        .cost-cockpit-indicator {

            padding: 11px 12px;
            background: rgba(255, 255, 255, 0.055);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
        }

        .cost-cockpit-card span,
        .cost-cockpit-indicator span {

            display: block;
            color: #94a3b8;
            font-size: 8px;
            font-weight: 700;
        }

        .cost-cockpit-card strong {

            display: block;
            margin-top: 5px;
            color: #ffffff;
            font-size: 16px;
            font-weight: 820;
        }

        .cost-cockpit-indicator strong {

            display: block;
            margin-top: 4px;
            color: #e2e8f0;
            font-size: 12px;
            font-weight: 800;
        }

        .cost-cockpit-indicator .negative {
            color: #f87171;
        }

        .cost-cockpit-indicator .positive {
            color: #4ade80;
        }

        .cost-cockpit-indicator .warning {
            color: #fbbf24;
        }

        .cost-cockpit-meter {

            height: 6px;
            margin-top: 14px;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.07);
            border-radius: 999px;
        }

        .cost-cockpit-meter-fill {

            height: 100%;
            border-radius: 999px;
        }

        .cost-cockpit-meter-fill.green {
            background: #22c55e;
        }

        .cost-cockpit-meter-fill.amber {
            background: #f59e0b;
        }

        .cost-cockpit-meter-fill.red {
            background: #ef4444;
        }

        .cost-cockpit-footer {

            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-top: 8px;
            color: #94a3b8;
            font-size: 8px;
        }


        /* ==============================================
           FAC WATERFALL
           ============================================== */

        .fac-waterfall-chart {

            display: flex;
            align-items: flex-end;
            justify-content: center;
            gap: 42px;
            min-height: 245px;
            padding: 26px 20px 12px;

            background:
                linear-gradient(
                    180deg,
                    #f8fafc,
                    #ffffff
                );

            border: 1px solid #e5eaf1;
            border-radius: 8px;
        }

        .fac-waterfall-column {

            width: 160px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end;
        }

        .fac-waterfall-value {

            margin-bottom: 8px;
            color: #0f172a;
            font-size: 14px;
            font-weight: 850;
        }

        .fac-waterfall-bar {

            width: 74px;
            min-height: 12px;
            border-radius: 5px 5px 2px 2px;
        }

        .fac-waterfall-bar.base {

            background:
                linear-gradient(
                    180deg,
                    #64748b,
                    #475569
                );
        }

        .fac-waterfall-bar.current {

            background:
                linear-gradient(
                    180deg,
                    #2563eb,
                    #1d4ed8
                );
        }

        .fac-waterfall-bar.increase {

            background:
                linear-gradient(
                    180deg,
                    #f87171,
                    #dc2626
                );
        }

        .fac-waterfall-bar.decrease {

            background:
                linear-gradient(
                    180deg,
                    #4ade80,
                    #16a34a
                );
        }

        .fac-waterfall-bar.stable {
            background: #94a3b8;
        }

        .fac-waterfall-label {

            margin-top: 8px;
            color: #0f172a;
            font-size: 9px;
            font-weight: 800;
        }

        .fac-waterfall-sub {

            margin-top: 3px;
            color: #64748b;
            font-size: 8px;
            text-align: center;
        }

        .fac-waterfall-summary {

            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin-top: 10px;
            padding: 10px 12px;
            background: #f8fafc;
            border: 1px solid #e5eaf1;
            border-radius: 7px;
            color: #475569;
            font-size: 8px;
        }

        .fac-waterfall-summary strong {

            color: #0f172a;
            font-size: 9px;
        }


        /* ==============================================
           WORKFLOW CONTROLS
           ============================================== */

        .workflow-control-panel {

            margin-bottom: 18px;
        }

        .workflow-period-badge {

            padding: 6px 9px;
            border-radius: 999px;
            background: #f1f5f9;
            border: 1px solid #dbe3ec;
            color: #475569;
            font-size: 8px;
            font-weight: 800;
            white-space: nowrap;
        }

        .workflow-tabs {

            display: flex;
            gap: 6px;
            margin-bottom: 14px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e5eaf1;
        }

        .workflow-tab {

            appearance: none;
            border: 1px solid #dbe3ec;
            background: #f8fafc;
            color: #475569;
            padding: 7px 10px;
            border-radius: 7px;
            font-family: inherit;
            font-size: 8px;
            font-weight: 800;
            cursor: pointer;
        }

        .workflow-tab.active {

            background: #0f172a;
            border-color: #0f172a;
            color: #ffffff;
        }

        .workflow-view.hidden {
            display: none;
        }


        /* COMMENTARY */

        .workflow-commentary-grid {

            display: grid;
            grid-template-columns:
                repeat(
                    2,
                    minmax(0, 1fr)
                );
            gap: 10px;
        }

        .workflow-commentary-card {

            padding: 12px;
            background: #f8fafc;
            border: 1px solid #e5eaf1;
            border-radius: 8px;
        }

        .workflow-commentary-card-header {

            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            margin-bottom: 7px;
        }

        .workflow-commentary-card-header strong {

            color: #0f172a;
            font-size: 9px;
            font-weight: 850;
        }

        .workflow-commentary-owner {

            color: #64748b;
            font-size: 7px;
            font-weight: 700;
        }

        .workflow-commentary-textarea {

            width: 100%;
            min-height: 82px;
            resize: vertical;
            box-sizing: border-box;
            padding: 9px 10px;
            font-family: inherit;
            font-size: 9px;
            line-height: 1.5;
            color: #334155;
            background: #ffffff;
            border: 1px solid #dbe3ec;
            border-radius: 6px;
            outline: none;
        }

        .workflow-commentary-textarea:focus {

            border-color: #3b82f6;
            box-shadow:
                0 0 0 3px
                rgba(59, 130, 246, 0.08);
        }

        .workflow-credibility-note {

            margin-top: 10px;
            padding: 10px 12px;
            background: #fff7ed;
            border: 1px solid #fed7aa;
            border-radius: 7px;
        }

        .workflow-credibility-note strong {

            display: block;
            margin-bottom: 4px;
            color: #9a3412;
            font-size: 8px;
        }

        .workflow-credibility-note span {

            color: #9a3412;
            font-size: 8px;
            line-height: 1.5;
        }

        .workflow-commentary-footer {

            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            margin-top: 10px;
        }

        .workflow-generated-label {

            color: #64748b;
            font-size: 7px;
        }


        /* BUTTONS */

        .workflow-primary-button,
        .workflow-secondary-button,
        .workflow-danger-button,
        .workflow-add-suggestion-button {

            appearance: none;
            border: none;
            font-family: inherit;
            cursor: pointer;
            font-weight: 800;
            border-radius: 6px;
        }

        .workflow-primary-button {

            padding: 8px 12px;
            background: #2563eb;
            color: #ffffff;
            font-size: 8px;
        }

        .workflow-primary-button:hover {
            background: #1d4ed8;
        }

        .workflow-secondary-button {

            padding: 7px 10px;
            background: #ffffff;
            color: #334155;
            border: 1px solid #dbe3ec;
            font-size: 8px;
        }

        .workflow-danger-button {

            padding: 5px 7px;
            background: #fff1f2;
            color: #be123c;
            border: 1px solid #fecdd3;
            font-size: 7px;
        }

        .workflow-add-suggestion-button {

            padding: 6px 9px;
            background: #eff6ff;
            color: #1d4ed8;
            border: 1px solid #bfdbfe;
            font-size: 7px;
        }


        /* ACTION SUMMARY */

        .workflow-action-summary {

            display: grid;
            grid-template-columns:
                repeat(
                    3,
                    minmax(0, 1fr)
                );
            gap: 8px;
            margin-bottom: 12px;
        }

        .workflow-action-summary-card {

            padding: 10px 12px;
            background: #f8fafc;
            border: 1px solid #e5eaf1;
            border-radius: 7px;
        }

        .workflow-action-summary-card span {

            display: block;
            color: #64748b;
            font-size: 7px;
            font-weight: 700;
        }

        .workflow-action-summary-card strong {

            display: block;
            margin-top: 3px;
            color: #0f172a;
            font-size: 15px;
            font-weight: 850;
        }


        /* ACTION TABLE */

        .workflow-action-table-wrap {

            overflow-x: auto;
            border: 1px solid #e5eaf1;
            border-radius: 8px;
        }

        .workflow-action-table {

            width: 100%;
            min-width: 850px;
            border-collapse: collapse;
            font-size: 8px;
        }

        .workflow-action-table th {

            padding: 9px 10px;
            text-align: left;
            color: #64748b;
            background: #f8fafc;
            border-bottom: 1px solid #e5eaf1;
            font-size: 7px;
            font-weight: 850;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }

        .workflow-action-table td {

            padding: 9px 10px;
            color: #334155;
            border-bottom: 1px solid #eef2f7;
            vertical-align: top;
        }

        .workflow-action-table tbody tr:last-child td {
            border-bottom: none;
        }

        .workflow-category-badge,
        .workflow-priority-badge {

            display: inline-flex;
            align-items: center;
            padding: 4px 6px;
            border-radius: 999px;
            font-size: 7px;
            font-weight: 800;
            white-space: nowrap;
        }

        .workflow-category-badge {

            background: #f1f5f9;
            color: #475569;
            border: 1px solid #e2e8f0;
        }

        .workflow-priority-badge.critical {

            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #fecaca;
        }

        .workflow-priority-badge.high {

            background: #ffedd5;
            color: #9a3412;
            border: 1px solid #fed7aa;
        }

        .workflow-priority-badge.medium {

            background: #fef3c7;
            color: #92400e;
            border: 1px solid #fde68a;
        }

        .workflow-priority-badge.low {

            background: #dcfce7;
            color: #166534;
            border: 1px solid #bbf7d0;
        }

        .workflow-status-select {

            padding: 5px 6px;
            border: 1px solid #dbe3ec;
            border-radius: 6px;
            background: #ffffff;
            color: #334155;
            font-family: inherit;
            font-size: 8px;
        }

        .workflow-empty-state {

            padding: 24px;
            text-align: center;
            color: #64748b;
            font-size: 9px;
        }


        /* ADD ACTION FORM */

        .workflow-action-form {

            display: grid;
            grid-template-columns:
                1fr 2fr 1.3fr 1fr 1fr auto;
            gap: 8px;
            align-items: end;
            margin-top: 12px;
            padding: 12px;
            background: #f8fafc;
            border: 1px solid #e5eaf1;
            border-radius: 8px;
        }

        .workflow-form-field {

            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .workflow-form-field label {

            color: #64748b;
            font-size: 7px;
            font-weight: 750;
        }

        .workflow-form-field input,
        .workflow-form-field select {

            width: 100%;
            box-sizing: border-box;
            padding: 7px 8px;
            background: #ffffff;
            border: 1px solid #dbe3ec;
            border-radius: 6px;
            color: #334155;
            font-family: inherit;
            font-size: 8px;
        }


        /* SUGGESTIONS */

        .workflow-suggestions {

            margin-top: 14px;
            padding-top: 12px;
            border-top: 1px solid #e5eaf1;
        }

        .workflow-suggestions-header {

            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
        }

        .workflow-suggestions-header strong {

            color: #0f172a;
            font-size: 9px;
        }

        .workflow-suggestions-header span {

            color: #64748b;
            font-size: 7px;
        }

        .workflow-suggestion-list {

            display: grid;
            gap: 7px;
        }

        .workflow-suggestion {

            display: grid;
            grid-template-columns:
                auto 1fr auto auto;
            align-items: center;
            gap: 10px;
            padding: 9px 10px;
            background: #f8fafc;
            border: 1px solid #e5eaf1;
            border-radius: 7px;
        }

        .workflow-suggestion-text strong {

            display: block;
            color: #0f172a;
            font-size: 8px;
        }

        .workflow-suggestion-text span {

            display: block;
            margin-top: 2px;
            color: #64748b;
            font-size: 7px;
        }


        /* WORKFLOW FEEDBACK */

        .workflow-feedback {

            margin-top: 8px;
            min-height: 16px;
            color: #2563eb;
            font-size: 8px;
            font-weight: 700;
        }

        .workflow-feedback.error {
            color: #b91c1c;
        }

        .workflow-feedback.success {
            color: #15803d;
        }


        /* ==============================================
           RESPONSIVE
           ============================================== */

        @media (max-width: 1100px) {

            .workflow-action-form {

                grid-template-columns:
                    repeat(
                        2,
                        minmax(0, 1fr)
                    );
            }

            .workflow-action-form
            .workflow-primary-button {

                min-height: 32px;
            }
        }


        @media (max-width: 1050px) {

            .forecast-credibility-grid {

                grid-template-columns:
                    repeat(
                        3,
                        minmax(0, 1fr)
                    );
            }

            .fac-movement-grid,
            .cost-cockpit-grid,
            .cost-cockpit-lower {

                grid-template-columns:
                    repeat(
                        2,
                        minmax(0, 1fr)
                    );
            }
        }


        @media (max-width: 760px) {

            .reporting-period-control,
            .forecast-credibility-header,
            .fac-movement-header,
            .fac-waterfall-header,
            .cost-cockpit-header,
            .workflow-control-header {

                flex-direction: column;
                align-items: stretch;
            }

            .reporting-period-actions {

                flex-direction: column;
                align-items: stretch;
            }

            .reporting-period-select {

                width: 100%;
                min-width: 0;
            }

            .fac-waterfall-chart {

                justify-content: flex-start;
                overflow-x: auto;
            }

            .workflow-commentary-grid {

                grid-template-columns: 1fr;
            }

            .workflow-action-summary {

                grid-template-columns:
                    repeat(
                        3,
                        minmax(0, 1fr)
                    );
            }

            .workflow-suggestion {

                grid-template-columns:
                    1fr;
            }
        }


        @media (max-width: 520px) {

            .forecast-credibility-grid,
            .fac-movement-grid,
            .cost-cockpit-grid,
            .cost-cockpit-lower,
            .workflow-action-summary,
            .workflow-action-form {

                grid-template-columns:
                    1fr;
            }

            .workflow-commentary-footer {

                flex-direction: column;
                align-items: stretch;
            }
        }

    `;

    document.head.appendChild(
        style
    );
}


/* ============================================================
   CREDIBILITY BADGE
   ============================================================ */

function credibilityBadgeHtml(status) {

    const text =
        polishIsAvailable(status)
            ? String(status)
            : "Unavailable";

    const cssClass =
        text
            .toLowerCase()
            .replaceAll(
                " ",
                "-"
            );

    return `
        <span
            class="
                credibility-badge
                ${polishEscape(cssClass)}
            "
        >
            ${polishEscape(text)}
        </span>
    `;
}


/* ============================================================
   PORTFOLIO COST EXPOSURE
   ============================================================ */

async function loadPortfolioExposure() {

    const container =
        document.getElementById(
            "portfolio-exposure-chart"
        );

    if (!container) {
        return;
    }

    try {

        const response =
            await polishFetch(
                `${POLISH_API_BASE}/projects`
            );

        const projects =
            await response.json();

        if (
            !Array.isArray(projects)
            ||
            !projects.length
        ) {
            return;
        }

        const ranked =
            [...projects].sort(
                (a, b) => {

                    const aBudget =
                        polishNumber(
                            a.approved_budget
                        ) || 0;

                    const aFac =
                        polishNumber(
                            a.forecast_at_completion
                        ) || 0;

                    const bBudget =
                        polishNumber(
                            b.approved_budget
                        ) || 0;

                    const bFac =
                        polishNumber(
                            b.forecast_at_completion
                        ) || 0;

                    return (
                        (bFac - bBudget)
                        -
                        (aFac - aBudget)
                    );
                }
            );

        const maximum =
            Math.max(
                ...ranked.map(
                    project =>
                        Math.max(
                            polishNumber(
                                project.approved_budget
                            ) || 0,

                            polishNumber(
                                project.forecast_at_completion
                            ) || 0
                        )
                ),
                1
            );

        container.innerHTML =
            ranked
                .map(
                    project => {

                        const budget =
                            polishNumber(
                                project.approved_budget
                            ) || 0;

                        const fac =
                            polishNumber(
                                project.forecast_at_completion
                            ) || 0;

                        const variance =
                            fac -
                            budget;

                        const budgetWidth =
                            Math.min(
                                100,
                                budget /
                                maximum *
                                100
                            );

                        const facWidth =
                            Math.min(
                                100,
                                fac /
                                maximum *
                                100
                            );

                        return `

                            <div class="exposure-row">

                                <div class="exposure-project">

                                    <strong>
                                        ${polishEscape(
                                            project.project_name
                                        )}
                                    </strong>

                                    <span>
                                        ${polishEscape(
                                            project.project_code
                                        )}
                                    </span>

                                </div>


                                <div class="exposure-bars">

                                    <div class="exposure-track">

                                        <div
                                            class="exposure-budget-bar"
                                            style="
                                                width:
                                                ${budgetWidth}%;
                                            "
                                        ></div>

                                    </div>


                                    <div class="exposure-forecast-track">

                                        <div
                                            class="
                                                exposure-forecast-bar
                                                ${
                                                    fac > budget
                                                        ? "overrun"
                                                        : "under"
                                                }
                                            "
                                            style="
                                                width:
                                                ${facWidth}%;
                                            "
                                        ></div>

                                    </div>

                                </div>


                                <div class="exposure-values">

                                    <strong>
                                        ${polishCurrency(
                                            fac
                                        )}
                                    </strong>

                                    <span
                                        class="${
                                            variance > 0
                                                ? "negative"
                                                : "positive"
                                        }"
                                    >
                                        ${
                                            variance > 0
                                                ? "+"
                                                : ""
                                        }${polishCurrency(
                                            variance
                                        )}
                                    </span>

                                </div>

                            </div>
                        `;
                    }
                )
                .join("");

    } catch (error) {

        console.warn(
            "Unable to load portfolio exposure:",
            error
        );
    }
}


/* ============================================================
   PORTFOLIO FORECAST CREDIBILITY
   ============================================================ */

async function getForecastCredibilityProjects() {

    if (
        Array.isArray(
            forecastCredibilityProjects
        )
    ) {
        return forecastCredibilityProjects;
    }

    const response =
        await polishFetch(
            `${POLISH_API_BASE}/projects`
        );

    const data =
        await response.json();

    forecastCredibilityProjects =
        Array.isArray(data)
            ? data
            : [];

    return forecastCredibilityProjects;
}


async function enhanceProjectPortfolioCredibility() {

    const table =
        document.querySelector(
            "#project-portfolio table"
        );

    if (!table) {
        return;
    }

    const headerRow =
        table.querySelector(
            "thead tr"
        );

    if (!headerRow) {
        return;
    }


    if (
        !headerRow.querySelector(
            "[data-forecast-credibility-header]"
        )
    ) {

        const header =
            document.createElement(
                "th"
            );

        header.setAttribute(
            "data-forecast-credibility-header",
            "true"
        );

        header.innerHTML = `
            Forecast Credibility
            <small>
                FAC cross-check
            </small>
        `;

        const finalHeader =
            headerRow.lastElementChild;

        if (finalHeader) {

            headerRow.insertBefore(
                header,
                finalHeader
            );

        } else {

            headerRow.appendChild(
                header
            );
        }
    }


    try {

        const projects =
            await getForecastCredibilityProjects();

        const byCode =
            new Map(
                projects.map(
                    project => [
                        String(
                            project.project_code
                        ),
                        project
                    ]
                )
            );


        table
            .querySelectorAll(
                "tbody tr.project-row"
            )
            .forEach(
                row => {

                    if (
                        row.querySelector(
                            "[data-forecast-credibility-cell]"
                        )
                    ) {
                        return;
                    }

                    const code =
                        String(
                            row.dataset.projectCode
                        );

                    const project =
                        byCode.get(code);

                    const cell =
                        document.createElement(
                            "td"
                        );

                    cell.setAttribute(
                        "data-forecast-credibility-cell",
                        "true"
                    );

                    cell.innerHTML =
                        credibilityBadgeHtml(
                            project
                                ?.forecast_credibility_status
                            ||
                            "Unavailable"
                        );

                    const finalCell =
                        row.lastElementChild;

                    if (finalCell) {

                        row.insertBefore(
                            cell,
                            finalCell
                        );

                    } else {

                        row.appendChild(
                            cell
                        );
                    }
                }
            );

        polishPortfolioEnhanced =
            true;

    } catch (error) {

        console.warn(
            "Unable to enhance project portfolio:",
            error
        );
    }
}


/* ============================================================
   REPORTING PERIOD SELECTOR
   ============================================================ */

function getPreviousReportingPeriod(
    selectedYearMonth
) {

    const index =
        controlSightReportingPeriods
            .findIndex(
                period =>
                    period.year_month ===
                    selectedYearMonth
            );

    if (index < 0) {
        return null;
    }

    return (
        controlSightReportingPeriods[
            index + 1
        ]
        ||
        null
    );
}


function updateReportingPeriodContext() {

    const selected =
        controlSightReportingPeriod;

    if (!selected) {
        return;
    }

    const previous =
        getPreviousReportingPeriod(
            selected
        );


    const context =
        document.getElementById(
            "reporting-period-context"
        );

    if (context) {

        context.innerHTML = `

            <span>
                Comparison period
            </span>

            <strong>
                ${
                    previous
                        ? formatReportingPeriodLabel(
                            previous.year_month
                        )
                        : "No earlier period"
                }
            </strong>

        `;
    }


    const selectedPeriod =
        controlSightReportingPeriods
            .find(
                period =>
                    period.year_month ===
                    selected
            );


    const snapshot =
        document.getElementById(
            "snapshot-date"
        );

    if (
        snapshot &&
        selectedPeriod
    ) {

        snapshot.textContent =
            formatSnapshotDate(
                selectedPeriod.date
            );
    }


    workflowLastKey =
        null;


    window.dispatchEvent(
        new CustomEvent(
            "controlsight:reporting-period-changed",
            {
                detail: {

                    reportingPeriod:
                        selected,

                    previousReportingPeriod:
                        previous
                            ?.year_month
                        ||
                        null
                }
            }
        )
    );
}


async function loadReportingPeriodSelector() {

    const overview =
        document.getElementById(
            "portfolio-overview"
        );

    if (!overview) {
        return;
    }


    let control =
        document.getElementById(
            "reporting-period-control"
        );


    if (!control) {

        control =
            document.createElement(
                "section"
            );

        control.id =
            "reporting-period-control";

        control.className =
            "reporting-period-control";

        overview.insertAdjacentElement(
            "beforebegin",
            control
        );
    }


    control.innerHTML = `

        <div class="reporting-period-copy">

            <span class="reporting-period-eyebrow">
                Reporting Context
            </span>

            <h3>
                Reporting Period
            </h3>

            <p>
                Select the management reporting period
                used for project-control analysis and
                period-on-period comparison.
            </p>

        </div>


        <div class="reporting-period-actions">

            <div class="reporting-period-select-wrap">

                <label for="reporting-period-select">
                    Active period
                </label>

                <select
                    id="reporting-period-select"
                    class="reporting-period-select"
                    disabled
                >
                    <option>
                        Loading periods...
                    </option>
                </select>

            </div>


            <div
                id="reporting-period-context"
                class="reporting-period-context"
            >

                <span>
                    Comparison period
                </span>

                <strong>
                    Resolving...
                </strong>

            </div>

        </div>
    `;


    try {

        const response =
            await polishFetch(
                `${POLISH_API_BASE}/reporting-periods`
            );

        const data =
            await response.json();

        const periods =
            Array.isArray(
                data.periods
            )
                ? data.periods
                : [];


        if (!periods.length) {

            throw new Error(
                "No reporting periods returned"
            );
        }


        controlSightReportingPeriods =
            periods;


        controlSightReportingPeriod =
            data
                .default_reporting_period
                ?.year_month
            ||
            periods[0].year_month;


        const select =
            document.getElementById(
                "reporting-period-select"
            );


        select.innerHTML =
            periods
                .map(
                    period => `

                        <option
                            value="${polishEscape(
                                period.year_month
                            )}"
                        >
                            ${polishEscape(
                                formatReportingPeriodLabel(
                                    period.year_month
                                )
                            )}
                        </option>
                    `
                )
                .join("");


        select.value =
            controlSightReportingPeriod;


        select.disabled =
            false;


        select.addEventListener(
            "change",
            event => {

                controlSightReportingPeriod =
                    event.target.value;

                updateReportingPeriodContext();
            }
        );


        updateReportingPeriodContext();

    } catch (error) {

        console.error(
            "Unable to load reporting periods:",
            error
        );

        control.innerHTML = `

            <div class="reporting-period-copy">

                <span class="reporting-period-eyebrow">
                    Reporting Context
                </span>

                <h3>
                    Reporting Period
                </h3>

                <p>
                    Reporting-period controls
                    could not be loaded.
                </p>

            </div>
        `;
    }
}


/* ============================================================
   FORECAST CREDIBILITY PANEL
   ============================================================ */

function ensureForecastCredibilityPanel() {

    const projectCode =
        getSelectedProjectCode();

    if (!projectCode) {
        return null;
    }


    const detail =
        document.getElementById(
            "project-detail"
        );

    if (!detail) {
        return null;
    }


    let panel =
        detail.querySelector(
            ".forecast-credibility-panel"
        );


    if (!panel) {

        panel =
            document.createElement(
                "section"
            );

        panel.className =
            "forecast-credibility-panel";


        const costSection =
            document.getElementById(
                "cost-performance"
            );


        if (costSection) {

            costSection.insertAdjacentElement(
                "beforebegin",
                panel
            );

        } else {

            detail.appendChild(
                panel
            );
        }
    }


    panel.dataset.projectCode =
        projectCode;


    return {
        panel,
        projectCode
    };
}


async function refreshForecastCredibilityForPeriod() {

    const target =
        ensureForecastCredibilityPanel();

    if (!target) {
        return;
    }


    const {
        panel,
        projectCode
    } = target;


    try {

        const response =
            await polishFetch(
                withReportingPeriod(
                    `${POLISH_API_BASE}/projects/${encodeURIComponent(
                        projectCode
                    )}/forecast-credibility`
                )
            );


        const data =
            await response.json();


        panel.innerHTML = `

            <div class="forecast-credibility-header">

                <div>

                    <span class="section-eyebrow">
                        Forecast Assurance
                    </span>

                    <h3>
                        Forecast Credibility Cross-Check
                    </h3>

                    <p>
                        Independent sanity check comparing
                        reported FAC with a progress-implied
                        completion-cost proxy.
                    </p>

                </div>

                ${credibilityBadgeHtml(
                    data.forecast_credibility_status
                )}

            </div>


            <div class="forecast-credibility-grid">

                <div class="forecast-credibility-metric">

                    <span>
                        Reported FAC
                    </span>

                    <strong>
                        ${polishCurrency(
                            data.reported_fac
                        )}
                    </strong>

                </div>


                <div class="forecast-credibility-metric">

                    <span>
                        Actual Cost
                    </span>

                    <strong>
                        ${polishCurrency(
                            data.actual_cost_to_date
                        )}
                    </strong>

                </div>


                <div class="forecast-credibility-metric">

                    <span>
                        Actual Progress
                    </span>

                    <strong>
                        ${polishPercentage(
                            data.actual_progress_pct
                        )}
                    </strong>

                </div>


                <div class="forecast-credibility-metric">

                    <span>
                        Progress-Implied EAC
                    </span>

                    <strong>
                        ${polishCurrency(
                            data.progress_implied_eac
                        )}
                    </strong>

                </div>


                <div
                    class="
                        forecast-credibility-metric
                        credibility-gap
                    "
                >

                    <span>
                        Credibility Gap
                    </span>

                    <strong>
                        ${polishCurrency(
                            data.forecast_credibility_gap
                        )}

                        ·

                        ${polishPercentage(
                            data.forecast_credibility_gap_pct
                        )}
                    </strong>

                </div>

            </div>


            <div class="forecast-credibility-method">

                <strong>
                    Methodology
                </strong>

                <span>
                    Progress-Implied EAC =
                    Actual Cost ÷
                    (Actual Progress % ÷ 100).

                    This is a forecast sanity check,
                    not formal Earned Value Management,
                    and it does not replace reported FAC.
                </span>

            </div>
        `;


        panel.dataset.loadedPeriod =
            controlSightReportingPeriod
            ||
            "latest";


    } catch (error) {

        console.error(
            "Unable to refresh forecast credibility:",
            error
        );

        panel.innerHTML = `

            <div class="polish-panel-error">
                Forecast credibility could not be loaded.
            </div>
        `;
    }
}


/* ============================================================
   FAC MOVEMENT PANEL
   ============================================================ */

function ensureFacMovementPanel() {

    const projectCode =
        getSelectedProjectCode();

    if (!projectCode) {
        return null;
    }


    const costSection =
        document.getElementById(
            "cost-performance"
        );

    if (!costSection) {
        return null;
    }


    let panel =
        costSection.querySelector(
            ".fac-movement-panel"
        );


    if (!panel) {

        panel =
            document.createElement(
                "section"
            );

        panel.className =
            "fac-movement-panel";

        costSection.appendChild(
            panel
        );
    }


    return {
        panel,
        projectCode
    };
}


async function refreshFacMovementForPeriod() {

    const target =
        ensureFacMovementPanel();

    if (!target) {
        return;
    }


    const {
        panel,
        projectCode
    } = target;


    try {

        const response =
            await polishFetch(
                withReportingPeriod(
                    `${POLISH_API_BASE}/projects/${encodeURIComponent(
                        projectCode
                    )}/fac-movement`
                )
            );


        const data =
            await response.json();


        const direction =
            String(
                data.movement_direction
                ||
                "Stable"
            );


        const cssClass =
            direction.toLowerCase();


        const change =
            polishNumber(
                data.fac_change
            )
            ||
            0;


        const changePct =
            polishNumber(
                data.fac_change_pct
            )
            ||
            0;


        const arrow =
            direction ===
                "Deteriorated"
                ? "↑"
                :
            direction ===
                "Improved"
                ? "↓"
                :
                "→";


        panel.innerHTML = `

            <div class="fac-movement-header">

                <div>

                    <span class="section-eyebrow">
                        Period-on-Period Control
                    </span>

                    <h3>
                        FAC Movement
                    </h3>

                    <p>
                        Latest change in Forecast at Completion
                        versus the immediately preceding
                        reporting period.
                    </p>

                </div>


                <div class="fac-movement-period">

                    ${formatFacPeriod(
                        data.previous_reporting_period
                    )}

                    →

                    ${formatFacPeriod(
                        data.current_reporting_period
                    )}

                </div>

            </div>


            <div class="fac-movement-grid">

                <div class="fac-movement-card">

                    <span>
                        Previous FAC
                    </span>

                    <strong>
                        ${polishCurrency(
                            data.previous_fac
                        )}
                    </strong>

                </div>


                <div class="fac-movement-card">

                    <span>
                        Current FAC
                    </span>

                    <strong>
                        ${polishCurrency(
                            data.current_fac
                        )}
                    </strong>

                </div>


                <div class="fac-movement-card">

                    <span>
                        FAC Change
                    </span>

                    <strong
                        class="
                            fac-movement-value
                            ${cssClass}
                        "
                    >
                        ${
                            change > 0
                                ? "+"
                                : ""
                        }${polishCurrency(
                            change
                        )}
                    </strong>

                </div>


                <div class="fac-movement-card">

                    <span>
                        FAC Change %
                    </span>

                    <strong
                        class="
                            fac-movement-value
                            ${cssClass}
                        "
                    >
                        ${
                            changePct > 0
                                ? "+"
                                : ""
                        }${polishPercentage(
                            changePct
                        )}
                    </strong>

                </div>

            </div>


            <div
                class="
                    fac-movement-direction
                    ${cssClass}
                "
            >

                <span>
                    Forecast movement
                </span>

                <strong>
                    ${polishEscape(
                        direction
                    )}
                    ${arrow}
                </strong>

            </div>
        `;


    } catch (error) {

        console.error(
            "Unable to refresh FAC movement:",
            error
        );

        panel.innerHTML = `
            <div class="polish-panel-error">
                FAC movement could not be loaded.
            </div>
        `;
    }
}


/* ============================================================
   FAC WATERFALL
   ============================================================ */

function ensureFacWaterfallPanel() {

    const projectCode =
        getSelectedProjectCode();

    if (!projectCode) {
        return null;
    }


    const costSection =
        document.getElementById(
            "cost-performance"
        );

    if (!costSection) {
        return null;
    }


    let panel =
        costSection.querySelector(
            ".fac-waterfall-panel"
        );


    if (!panel) {

        panel =
            document.createElement(
                "section"
            );

        panel.className =
            "fac-waterfall-panel";


        const movement =
            costSection.querySelector(
                ".fac-movement-panel"
            );


        if (movement) {

            movement.insertAdjacentElement(
                "afterend",
                panel
            );

        } else {

            costSection.appendChild(
                panel
            );
        }
    }


    return {
        panel,
        projectCode
    };
}


async function refreshFacWaterfallForPeriod() {

    const target =
        ensureFacWaterfallPanel();

    if (!target) {
        return;
    }


    const {
        panel,
        projectCode
    } = target;


    try {

        const response =
            await polishFetch(
                withReportingPeriod(
                    `${POLISH_API_BASE}/projects/${encodeURIComponent(
                        projectCode
                    )}/fac-movement`
                )
            );


        const data =
            await response.json();


        const previous =
            polishNumber(
                data.previous_fac
            )
            ||
            0;


        const current =
            polishNumber(
                data.current_fac
            )
            ||
            0;


        const delta =
            polishNumber(
                data.fac_change
            )
            ||
            0;


        const maximum =
            Math.max(
                previous,
                current,
                1
            );


        const previousHeight =
            Math.max(
                35,
                previous /
                maximum *
                155
            );


        const currentHeight =
            Math.max(
                35,
                current /
                maximum *
                155
            );


        const deltaHeight =
            Math.max(
                24,
                Math.min(
                    120,
                    Math.abs(
                        data.fac_change_pct
                        ||
                        0
                    ) *
                    7
                )
            );


        const deltaClass =
            delta > 0
                ? "increase"
                :
            delta < 0
                ? "decrease"
                :
                "stable";


        const movementLabel =
            delta > 0
                ? "Deterioration"
                :
            delta < 0
                ? "Improvement"
                :
                "Stable";


        panel.innerHTML = `

            <div class="fac-waterfall-header">

                <div>

                    <span class="section-eyebrow">
                        Forecast Bridge
                    </span>

                    <h3>
                        FAC Movement Waterfall
                    </h3>

                    <p>
                        Visual bridge showing how the
                        selected-period FAC moved from the
                        previous reporting period.
                    </p>

                </div>


                <div class="fac-movement-period">

                    ${formatFacPeriod(
                        data.previous_reporting_period
                    )}

                    →

                    ${formatFacPeriod(
                        data.current_reporting_period
                    )}

                </div>

            </div>


            <div class="fac-waterfall-chart">


                <div class="fac-waterfall-column">

                    <div class="fac-waterfall-value">

                        ${polishCurrency(
                            previous
                        )}

                    </div>


                    <div
                        class="
                            fac-waterfall-bar
                            base
                        "
                        style="
                            height:
                            ${previousHeight}px;
                        "
                    ></div>


                    <div class="fac-waterfall-label">
                        Previous FAC
                    </div>


                    <div class="fac-waterfall-sub">

                        ${formatFacPeriod(
                            data.previous_reporting_period
                        )}

                    </div>

                </div>


                <div class="fac-waterfall-column">

                    <div class="fac-waterfall-value">

                        ${
                            delta > 0
                                ? "+"
                                : ""
                        }${polishCurrency(
                            delta
                        )}

                    </div>


                    <div
                        class="
                            fac-waterfall-bar
                            ${deltaClass}
                        "
                        style="
                            height:
                            ${deltaHeight}px;
                        "
                    ></div>


                    <div class="fac-waterfall-label">
                        Period Movement
                    </div>


                    <div class="fac-waterfall-sub">

                        ${movementLabel}

                        ·

                        ${polishPercentage(
                            data.fac_change_pct
                        )}

                    </div>

                </div>


                <div class="fac-waterfall-column">

                    <div class="fac-waterfall-value">

                        ${polishCurrency(
                            current
                        )}

                    </div>


                    <div
                        class="
                            fac-waterfall-bar
                            current
                        "
                        style="
                            height:
                            ${currentHeight}px;
                        "
                    ></div>


                    <div class="fac-waterfall-label">
                        Current FAC
                    </div>


                    <div class="fac-waterfall-sub">

                        ${formatFacPeriod(
                            data.current_reporting_period
                        )}

                    </div>

                </div>

            </div>


            <div class="fac-waterfall-summary">

                <span>

                    Previous FAC

                    ${
                        delta >= 0
                            ? "+"
                            : "−"
                    }

                    ${polishCurrency(
                        Math.abs(delta)
                    )}

                    =

                    ${polishCurrency(
                        current
                    )}

                </span>


                <strong>
                    ${polishEscape(
                        data.movement_direction
                        ||
                        "Stable"
                    )}
                </strong>

            </div>
        `;


    } catch (error) {

        console.error(
            "Unable to refresh FAC waterfall:",
            error
        );

        panel.innerHTML = `
            <div class="polish-panel-error">
                FAC waterfall could not be loaded.
            </div>
        `;
    }
}


/* ============================================================
   COST COCKPIT
   ============================================================ */

function getCostCockpitStatus(
    fac,
    budget
) {

    if (
        !budget ||
        budget <= 0
    ) {

        return {
            label:
                "Unavailable",

            className:
                "amber"
        };
    }


    const overrunPct =
        (
            fac -
            budget
        )
        /
        budget
        *
        100;


    if (overrunPct >= 10) {

        return {
            label: "Red",
            className: "red"
        };
    }


    if (overrunPct >= 5) {

        return {
            label: "Amber",
            className: "amber"
        };
    }


    return {
        label: "Green",
        className: "green"
    };
}


function ensureCostCockpit() {

    const projectCode =
        getSelectedProjectCode();

    if (!projectCode) {
        return null;
    }


    const costSection =
        document.getElementById(
            "cost-performance"
        );

    if (!costSection) {
        return null;
    }


    let cockpit =
        costSection.querySelector(
            ".cost-control-cockpit"
        );


    if (!cockpit) {

        cockpit =
            document.createElement(
                "section"
            );

        cockpit.className =
            "cost-control-cockpit";

        costSection.insertAdjacentElement(
            "afterbegin",
            cockpit
        );
    }


    return {
        cockpit,
        projectCode
    };
}


async function refreshCostCockpitForPeriod() {

    const target =
        ensureCostCockpit();

    if (!target) {
        return;
    }


    const {
        cockpit,
        projectCode
    } = target;


    try {

        const [
            overviewResponse,
            trendResponse,
            movementResponse
        ] =
            await Promise.all([

                polishFetch(
                    withReportingPeriod(
                        `${POLISH_API_BASE}/projects/${encodeURIComponent(
                            projectCode
                        )}/overview`
                    )
                ),

                polishFetch(
                    withReportingPeriod(
                        `${POLISH_API_BASE}/projects/${encodeURIComponent(
                            projectCode
                        )}/cost-trend`
                    )
                ),

                polishFetch(
                    withReportingPeriod(
                        `${POLISH_API_BASE}/projects/${encodeURIComponent(
                            projectCode
                        )}/fac-movement`
                    )
                )

            ]);


        const overview =
            await overviewResponse.json();


        const trend =
            await trendResponse.json();


        const movement =
            await movementResponse.json();


        const project =
            overview.project
            ||
            {};


        const trendRows =
            Array.isArray(
                trend.cost_trend
            )
                ? trend.cost_trend
                : [];


        const latest =
            trendRows[
                trendRows.length - 1
            ]
            ||
            {};


        const budget =
            polishNumber(
                project.approved_budget
            )
            ||
            0;


        const actual =
            polishNumber(
                latest.cumulative_actual_cost
            )
            ??
            polishNumber(
                project.actual_cost_to_date
            )
            ??
            0;


        const committed =
            polishNumber(
                latest.cumulative_committed_cost
            )
            ??
            polishNumber(
                project.committed_cost_to_date
            )
            ??
            0;


        const fac =
            polishNumber(
                latest.forecast_at_completion
            )
            ??
            polishNumber(
                project.forecast_at_completion
            )
            ??
            0;


        const forecastVariance =
            budget -
            fac;


        const facVsBudget =
            budget > 0
                ? (
                    fac -
                    budget
                )
                /
                budget
                *
                100
                : 0;


        const movementValue =
            polishNumber(
                movement.fac_change
            )
            ||
            0;


        const movementPct =
            polishNumber(
                movement.fac_change_pct
            )
            ||
            0;


        const status =
            getCostCockpitStatus(
                fac,
                budget
            );


        const budgetConsumption =
            budget > 0
                ? actual /
                budget *
                100
                : 0;


        const meter =
            Math.min(
                Math.max(
                    budgetConsumption,
                    0
                ),
                100
            );


        const movementArrow =
            movement.movement_direction
                ===
                "Deteriorated"
                ? "↑"
                :
            movement.movement_direction
                ===
                "Improved"
                ? "↓"
                :
                "→";


        cockpit.innerHTML = `

            <div class="cost-cockpit-header">

                <div>

                    <span class="cost-cockpit-eyebrow">
                        Cost Control
                    </span>

                    <h3>
                        Cost Performance Cockpit
                    </h3>

                    <p>
                        Reporting period:
                        ${polishEscape(
                            formatReportingPeriodLabel(
                                controlSightReportingPeriod
                                ||
                                movement.current_reporting_period
                            )
                        )}
                    </p>

                </div>


                <span
                    class="
                        cost-cockpit-status
                        ${status.className}
                    "
                >
                    ${status.label}
                    Cost Status
                </span>

            </div>


            <div class="cost-cockpit-grid">

                <div class="cost-cockpit-card">

                    <span>
                        Approved Budget
                    </span>

                    <strong>
                        ${polishCurrency(
                            budget
                        )}
                    </strong>

                </div>


                <div class="cost-cockpit-card">

                    <span>
                        Actual Cost
                    </span>

                    <strong>
                        ${polishCurrency(
                            actual
                        )}
                    </strong>

                </div>


                <div class="cost-cockpit-card">

                    <span>
                        Committed Cost
                    </span>

                    <strong>
                        ${polishCurrency(
                            committed
                        )}
                    </strong>

                </div>


                <div class="cost-cockpit-card">

                    <span>
                        Current FAC
                    </span>

                    <strong>
                        ${polishCurrency(
                            fac
                        )}
                    </strong>

                </div>

            </div>


            <div class="cost-cockpit-lower">

                <div class="cost-cockpit-indicator">

                    <span>
                        Forecast Variance
                    </span>

                    <strong
                        class="${
                            forecastVariance < 0
                                ? "negative"
                                : "positive"
                        }"
                    >
                        ${polishCurrency(
                            forecastVariance
                        )}
                    </strong>

                </div>


                <div class="cost-cockpit-indicator">

                    <span>
                        FAC vs Budget
                    </span>

                    <strong
                        class="${
                            facVsBudget >= 10
                                ? "negative"
                                :
                            facVsBudget >= 5
                                ? "warning"
                                :
                                "positive"
                        }"
                    >
                        ${
                            facVsBudget > 0
                                ? "+"
                                : ""
                        }${facVsBudget.toFixed(
                            1
                        )}%
                    </strong>

                </div>


                <div class="cost-cockpit-indicator">

                    <span>
                        FAC Movement
                    </span>

                    <strong
                        class="${
                            movementValue > 0
                                ? "negative"
                                :
                            movementValue < 0
                                ? "positive"
                                :
                                ""
                        }"
                    >
                        ${
                            movementValue > 0
                                ? "+"
                                : ""
                        }${polishCurrency(
                            movementValue
                        )}

                        ${movementArrow}
                    </strong>

                </div>


                <div class="cost-cockpit-indicator">

                    <span>
                        FAC Movement %
                    </span>

                    <strong
                        class="${
                            movementPct > 0
                                ? "negative"
                                :
                            movementPct < 0
                                ? "positive"
                                :
                                ""
                        }"
                    >
                        ${
                            movementPct > 0
                                ? "+"
                                : ""
                        }${movementPct.toFixed(
                            1
                        )}%
                    </strong>

                </div>

            </div>


            <div class="cost-cockpit-meter">

                <div
                    class="
                        cost-cockpit-meter-fill
                        ${status.className}
                    "
                    style="
                        width:
                        ${meter}%;
                    "
                ></div>

            </div>


            <div class="cost-cockpit-footer">

                <span>
                    Budget consumed:
                    ${budgetConsumption.toFixed(
                        1
                    )}%
                </span>

                <span>
                    ${formatFacPeriod(
                        movement.previous_reporting_period
                    )}

                    →

                    ${formatFacPeriod(
                        movement.current_reporting_period
                    )}
                </span>

            </div>
        `;


    } catch (error) {

        console.error(
            "Unable to refresh cost cockpit:",
            error
        );

        cockpit.innerHTML = `

            <div class="cost-cockpit-loading">
                Cost control cockpit could not be loaded.
            </div>
        `;
    }
}


/* ============================================================
   WORKFLOW PANEL
   ============================================================ */

function ensureWorkflowPanel() {

    const projectCode =
        getSelectedProjectCode();

    if (!projectCode) {
        return null;
    }


    const detail =
        document.getElementById(
            "project-detail"
        );

    if (!detail) {
        return null;
    }


    let panel =
        detail.querySelector(
            ".workflow-control-panel"
        );


    if (!panel) {

        panel =
            document.createElement(
                "section"
            );

        panel.className =
            "workflow-control-panel";


        const costSection =
            document.getElementById(
                "cost-performance"
            );


        const credibility =
            detail.querySelector(
                ".forecast-credibility-panel"
            );


        if (costSection) {

            costSection.insertAdjacentElement(
                "beforebegin",
                panel
            );

        } else if (credibility) {

            credibility.insertAdjacentElement(
                "afterend",
                panel
            );

        } else {

            detail.appendChild(
                panel
            );
        }
    }


    panel.dataset.projectCode =
        projectCode;


    return {
        panel,
        projectCode
    };
}


/* ============================================================
   WORKFLOW COMMENTARY RENDER
   ============================================================ */

function workflowCommentaryCard(
    title,
    owner,
    field,
    value
) {

    return `

        <div class="workflow-commentary-card">

            <div class="workflow-commentary-card-header">

                <strong>
                    ${polishEscape(
                        title
                    )}
                </strong>

                <span class="workflow-commentary-owner">
                    ${polishEscape(
                        owner
                    )}
                </span>

            </div>


            <textarea
                class="workflow-commentary-textarea"
                data-commentary-field="${field}"
            >${polishEscape(
                value
                ||
                ""
            )}</textarea>

        </div>
    `;
}


function workflowPriorityBadge(
    priority
) {

    const cssClass =
        String(
            priority
            ||
            "Medium"
        )
        .toLowerCase();

    return `

        <span
            class="
                workflow-priority-badge
                ${polishEscape(cssClass)}
            "
        >
            ${polishEscape(
                priority
                ||
                "Medium"
            )}
        </span>
    `;
}


function workflowCategoryBadge(
    category
) {

    return `

        <span class="workflow-category-badge">
            ${polishEscape(
                category
                ||
                "General"
            )}
        </span>
    `;
}


/* ============================================================
   WORKFLOW ACTION TABLE
   ============================================================ */

function renderWorkflowActionRows(
    actions
) {

    if (
        !Array.isArray(actions)
        ||
        !actions.length
    ) {

        return `

            <tr>

                <td
                    colspan="7"
                    class="workflow-empty-state"
                >
                    No actions have been logged for this
                    reporting period.
                </td>

            </tr>
        `;
    }


    return actions
        .map(
            action => `

                <tr
                    data-action-id="${polishEscape(
                        action.action_id
                    )}"
                >

                    <td>
                        ${workflowCategoryBadge(
                            action.category
                        )}
                    </td>


                    <td>
                        ${polishEscape(
                            action.issue
                        )}
                    </td>


                    <td>
                        ${polishEscape(
                            action.owner_role
                        )}
                    </td>


                    <td>
                        ${formatWorkflowDate(
                            action.due_date
                        )}
                    </td>


                    <td>
                        ${workflowPriorityBadge(
                            action.priority
                        )}
                    </td>


                    <td>

                        <select
                            class="workflow-status-select"
                            data-action-status="${polishEscape(
                                action.action_id
                            )}"
                        >

                            ${[
                                "Open",
                                "In Progress",
                                "On Hold",
                                "Closed"
                            ]
                            .map(
                                status => `

                                    <option
                                        value="${status}"
                                        ${
                                            action.status
                                            ===
                                            status
                                                ? "selected"
                                                : ""
                                        }
                                    >
                                        ${status}
                                    </option>
                                `
                            )
                            .join("")}

                        </select>

                    </td>


                    <td>

                        <button
                            type="button"
                            class="workflow-danger-button"
                            data-delete-action="${polishEscape(
                                action.action_id
                            )}"
                        >
                            Delete
                        </button>

                    </td>

                </tr>
            `
        )
        .join("");
}


/* ============================================================
   WORKFLOW SUGGESTIONS
   ============================================================ */

function renderWorkflowSuggestions(
    suggestions
) {

    if (
        !Array.isArray(suggestions)
        ||
        !suggestions.length
    ) {

        return `

            <div class="workflow-empty-state">
                No additional management actions are
                suggested for this reporting period.
            </div>
        `;
    }


    return suggestions
        .map(
            (
                suggestion,
                index
            ) => `

                <div
                    class="workflow-suggestion"
                    data-suggestion-index="${index}"
                >

                    <div>
                        ${workflowCategoryBadge(
                            suggestion.category
                        )}
                    </div>


                    <div class="workflow-suggestion-text">

                        <strong>
                            ${polishEscape(
                                suggestion.issue
                            )}
                        </strong>

                        <span>
                            Owner:
                            ${polishEscape(
                                suggestion.owner_role
                            )}
                        </span>

                    </div>


                    <div>
                        ${workflowPriorityBadge(
                            suggestion.priority
                        )}
                    </div>


                    <button
                        type="button"
                        class="workflow-add-suggestion-button"
                        data-add-suggestion="${index}"
                    >
                        Add to Action Log
                    </button>

                </div>
            `
        )
        .join("");
}


/* ============================================================
   WORKFLOW TAB CONTROL
   ============================================================ */

function initialiseWorkflowTabs(
    panel
) {

    panel
        .querySelectorAll(
            ".workflow-tab"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const target =
                            button.dataset
                                .workflowTarget;


                        panel
                            .querySelectorAll(
                                ".workflow-tab"
                            )
                            .forEach(
                                item => {

                                    item.classList.toggle(
                                        "active",
                                        item === button
                                    );
                                }
                            );


                        panel
                            .querySelectorAll(
                                ".workflow-view"
                            )
                            .forEach(
                                view => {

                                    view.classList.toggle(
                                        "hidden",
                                        view.dataset
                                            .workflowView
                                        !==
                                        target
                                    );
                                }
                            );
                    }
                );
            }
        );
}


/* ============================================================
   SAVE COMMENTARY
   ============================================================ */

async function saveWorkflowCommentary(
    panel,
    projectCode,
    reportingPeriod
) {

    const feedback =
        panel.querySelector(
            "#workflow-feedback"
        );


    const fieldValue =
        field => {

            return (
                panel
                    .querySelector(
                        `[data-commentary-field="${field}"]`
                    )
                    ?.value
                    ??
                    ""
            );
        };


    try {

        if (feedback) {

            feedback.textContent =
                "Saving commentary...";

            feedback.className =
                "workflow-feedback";
        }


        await polishFetchJson(
            `${POLISH_API_BASE}/projects/${encodeURIComponent(
                projectCode
            )}/workflow/commentary`,
            {
                method: "PUT",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(
                        {
                            project_code:
                                projectCode,

                            reporting_period:
                                reportingPeriod,

                            cost_commentary:
                                fieldValue(
                                    "cost_commentary"
                                ),

                            progress_commentary:
                                fieldValue(
                                    "progress_commentary"
                                ),

                            schedule_commentary:
                                fieldValue(
                                    "schedule_commentary"
                                ),

                            procurement_commentary:
                                fieldValue(
                                    "procurement_commentary"
                                )
                        }
                    )
            }
        );


        if (feedback) {

            feedback.textContent =
                "Commentary saved successfully";

            feedback.className =
                "workflow-feedback success";
        }


    } catch (error) {

        console.error(
            "Unable to save commentary:",
            error
        );


        if (feedback) {

            feedback.textContent =
                error.message;

            feedback.className =
                "workflow-feedback error";
        }
    }
}


/* ============================================================
   CREATE ACTION
   ============================================================ */

async function createWorkflowAction(
    projectCode,
    reportingPeriod,
    payload
) {

    return polishFetchJson(
        `${POLISH_API_BASE}/projects/${encodeURIComponent(
            projectCode
        )}/workflow/actions`,
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
                            projectCode,

                        reporting_period:
                            reportingPeriod,

                        category:
                            payload.category,

                        issue:
                            payload.issue,

                        owner_role:
                            payload.owner_role,

                        due_date:
                            payload.due_date,

                        status:
                            payload.status
                            ||
                            "Open",

                        priority:
                            payload.priority
                            ||
                            "Medium",

                        source:
                            payload.source
                            ||
                            "Management Review"
                    }
                )
        }
    );
}


/* ============================================================
   PATCH ACTION
   ============================================================ */

async function patchWorkflowAction(
    actionId,
    payload
) {

    return polishFetchJson(
        `${POLISH_API_BASE}/workflow/actions/${encodeURIComponent(
            actionId
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
}


/* ============================================================
   DELETE ACTION
   ============================================================ */

async function deleteWorkflowAction(
    actionId
) {

    return polishFetchJson(
        `${POLISH_API_BASE}/workflow/actions/${encodeURIComponent(
            actionId
        )}`,
        {
            method: "DELETE"
        }
    );
}


/* ============================================================
   WORKFLOW EVENT HANDLERS
   ============================================================ */

function initialiseWorkflowEvents(
    panel,
    projectCode,
    reportingPeriod,
    suggestions
) {

    initialiseWorkflowTabs(
        panel
    );


    const feedback =
        panel.querySelector(
            "#workflow-feedback"
        );


    const saveCommentaryButton =
        panel.querySelector(
            "#workflow-save-commentary"
        );


    saveCommentaryButton
        ?.addEventListener(
            "click",
            async () => {

                await saveWorkflowCommentary(
                    panel,
                    projectCode,
                    reportingPeriod
                );
            }
        );


    const categorySelect =
        panel.querySelector(
            "#workflow-action-category"
        );


    const ownerSelect =
        panel.querySelector(
            "#workflow-action-owner"
        );


    const ownerMapping = {

        "Cost":
            "Cost Control / Commercial",

        "Progress":
            "Planning / Project Controls",

        "Schedule":
            "Planning / Project Manager",

        "Procurement":
            "Procurement",

        "Data Quality":
            "Data / Project Controls",

        "Forecast Credibility":
            "Cost Control / Commercial"
    };


    categorySelect
        ?.addEventListener(
            "change",
            () => {

                if (
                    ownerSelect
                    &&
                    ownerMapping[
                        categorySelect.value
                    ]
                ) {

                    ownerSelect.value =
                        ownerMapping[
                            categorySelect.value
                        ];
                }
            }
        );


    const form =
        panel.querySelector(
            "#workflow-action-form"
        );


    form
        ?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const category =
                    panel
                        .querySelector(
                            "#workflow-action-category"
                        )
                        ?.value;


                const issue =
                    panel
                        .querySelector(
                            "#workflow-action-issue"
                        )
                        ?.value
                        ?.trim();


                const owner =
                    panel
                        .querySelector(
                            "#workflow-action-owner"
                        )
                        ?.value;


                const dueDate =
                    panel
                        .querySelector(
                            "#workflow-action-due"
                        )
                        ?.value;


                const priority =
                    panel
                        .querySelector(
                            "#workflow-action-priority"
                        )
                        ?.value;


                if (!issue) {

                    if (feedback) {

                        feedback.textContent =
                            "Enter an issue/action description";

                        feedback.className =
                            "workflow-feedback error";
                    }

                    return;
                }


                try {

                    if (feedback) {

                        feedback.textContent =
                            "Creating action...";

                        feedback.className =
                            "workflow-feedback";
                    }


                    await createWorkflowAction(
                        projectCode,
                        reportingPeriod,
                        {
                            category,
                            issue,
                            owner_role:
                                owner,

                            due_date:
                                dueDate,

                            priority,

                            status:
                                "Open",

                            source:
                                "Management Review"
                        }
                    );


                    workflowLastKey =
                        null;


                    await refreshWorkflowPanel(
                        true
                    );


                } catch (error) {

                    if (feedback) {

                        feedback.textContent =
                            error.message;

                        feedback.className =
                            "workflow-feedback error";
                    }
                }
            }
        );


    panel
        .querySelectorAll(
            "[data-action-status]"
        )
        .forEach(
            select => {

                select.addEventListener(
                    "change",
                    async () => {

                        const actionId =
                            select.dataset
                                .actionStatus;


                        try {

                            await patchWorkflowAction(
                                actionId,
                                {
                                    status:
                                        select.value
                                }
                            );


                            workflowLastKey =
                                null;


                            await refreshWorkflowPanel(
                                true
                            );


                        } catch (error) {

                            console.error(
                                "Unable to update action:",
                                error
                            );


                            if (feedback) {

                                feedback.textContent =
                                    error.message;

                                feedback.className =
                                    "workflow-feedback error";
                            }
                        }
                    }
                );
            }
        );


    panel
        .querySelectorAll(
            "[data-delete-action]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const actionId =
                            button.dataset
                                .deleteAction;


                        if (
                            !window.confirm(
                                "Delete this action?"
                            )
                        ) {
                            return;
                        }


                        try {

                            await deleteWorkflowAction(
                                actionId
                            );


                            workflowLastKey =
                                null;


                            await refreshWorkflowPanel(
                                true
                            );


                        } catch (error) {

                            if (feedback) {

                                feedback.textContent =
                                    error.message;

                                feedback.className =
                                    "workflow-feedback error";
                            }
                        }
                    }
                );
            }
        );


    panel
        .querySelectorAll(
            "[data-add-suggestion]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const index =
                            Number(
                                button.dataset
                                    .addSuggestion
                            );


                        const suggestion =
                            suggestions[
                                index
                            ];


                        if (!suggestion) {
                            return;
                        }


                        try {

                            button.disabled =
                                true;

                            button.textContent =
                                "Adding...";


                            await createWorkflowAction(
                                projectCode,
                                reportingPeriod,
                                {
                                    category:
                                        suggestion.category,

                                    issue:
                                        suggestion.issue,

                                    owner_role:
                                        suggestion.owner_role,

                                    due_date:
                                        workflowDefaultDueDate(
                                            14
                                        ),

                                    status:
                                        "Open",

                                    priority:
                                        suggestion.priority,

                                    source:
                                        "Attention Flag"
                                }
                            );


                            workflowLastKey =
                                null;


                            await refreshWorkflowPanel(
                                true
                            );


                        } catch (error) {

                            button.disabled =
                                false;

                            button.textContent =
                                "Add to Action Log";


                            if (feedback) {

                                feedback.textContent =
                                    error.message;

                                feedback.className =
                                    "workflow-feedback error";
                            }
                        }
                    }
                );
            }
        );
}


/* ============================================================
   WORKFLOW PANEL REFRESH
   ============================================================ */

async function refreshWorkflowPanel(
    force = false
) {

    if (
        workflowRefreshRunning
    ) {
        return;
    }


    const target =
        ensureWorkflowPanel();

    if (!target) {
        return;
    }


    const {
        panel,
        projectCode
    } = target;


    if (
        !controlSightReportingPeriod
    ) {
        return;
    }


    const reportingPeriod =
        controlSightReportingPeriod;


    const workflowKey =
        `${projectCode}|${reportingPeriod}`;


    if (
        !force
        &&
        workflowLastKey
        ===
        workflowKey
        &&
        panel.dataset.workflowLoaded
        ===
        "true"
    ) {
        return;
    }


    workflowRefreshRunning =
        true;


    panel.innerHTML = `

        <div class="workflow-control-header">

            <div>

                <span class="section-eyebrow">
                    Management Workflow
                </span>

                <h3>
                    Period Commentary & Action Log
                </h3>

                <p>
                    Converts project-control exceptions into
                    accountable management actions with
                    commentary, owners, due dates, priorities
                    and status tracking.
                </p>

            </div>

            <div class="workflow-period-badge">
                ${polishEscape(
                    formatReportingPeriodLabel(
                        reportingPeriod
                    )
                )}
            </div>

        </div>

        <div class="workflow-empty-state">
            Loading workflow controls...
        </div>
    `;


    try {

        const [
            commentary,
            actionData,
            suggestionData
        ] =
            await Promise.all([

                polishFetchJson(
                    `${POLISH_API_BASE}/projects/${encodeURIComponent(
                        projectCode
                    )}/workflow/commentary?reporting_period=${encodeURIComponent(
                        reportingPeriod
                    )}`
                ),

                polishFetchJson(
                    `${POLISH_API_BASE}/projects/${encodeURIComponent(
                        projectCode
                    )}/workflow/actions?reporting_period=${encodeURIComponent(
                        reportingPeriod
                    )}`
                ),

                polishFetchJson(
                    `${POLISH_API_BASE}/projects/${encodeURIComponent(
                        projectCode
                    )}/workflow/action-suggestions?reporting_period=${encodeURIComponent(
                        reportingPeriod
                    )}`
                )

            ]);


        const actions =
            Array.isArray(
                actionData.actions
            )
                ? actionData.actions
                : [];


        const suggestions =
            Array.isArray(
                suggestionData.suggestions
            )
                ? suggestionData.suggestions
                : [];


        panel.innerHTML = `

            <div class="workflow-control-header">

                <div>

                    <span class="section-eyebrow">
                        Management Workflow
                    </span>

                    <h3>
                        Period Commentary & Action Log
                    </h3>

                    <p>
                        Converts project-control exceptions
                        into accountable management actions.
                    </p>

                </div>


                <div class="workflow-period-badge">
                    ${polishEscape(
                        formatReportingPeriodLabel(
                            reportingPeriod
                        )
                    )}
                </div>

            </div>


            <div class="workflow-tabs">

                <button
                    type="button"
                    class="workflow-tab active"
                    data-workflow-target="commentary"
                >
                    Period Commentary
                </button>

                <button
                    type="button"
                    class="workflow-tab"
                    data-workflow-target="actions"
                >
                    Action Log
                    (${actionData.action_count || 0})
                </button>

                <button
                    type="button"
                    class="workflow-tab"
                    data-workflow-target="suggestions"
                >
                    Suggested Actions
                    (${suggestions.length})
                </button>

            </div>


            <!-- COMMENTARY -->

            <div
                class="workflow-view"
                data-workflow-view="commentary"
            >

                <div class="workflow-commentary-grid">

                    ${workflowCommentaryCard(
                        "Cost",
                        "Cost Control / Commercial",
                        "cost_commentary",
                        commentary.cost_commentary
                    )}

                    ${workflowCommentaryCard(
                        "Progress",
                        "Planning / Project Controls",
                        "progress_commentary",
                        commentary.progress_commentary
                    )}

                    ${workflowCommentaryCard(
                        "Schedule",
                        "Planning / Project Manager",
                        "schedule_commentary",
                        commentary.schedule_commentary
                    )}

                    ${workflowCommentaryCard(
                        "Procurement",
                        "Procurement",
                        "procurement_commentary",
                        commentary.procurement_commentary
                    )}

                </div>


                <div class="workflow-credibility-note">

                    <strong>
                        Forecast Credibility
                    </strong>

                    <span>
                        ${polishEscape(
                            commentary.forecast_credibility_note
                            ||
                            "No forecast credibility commentary available."
                        )}
                    </span>

                </div>


                <div class="workflow-commentary-footer">

                    <span class="workflow-generated-label">

                        ${
                            commentary.saved_commentary
                                ? "Saved management commentary"
                                : "Generated from deterministic management rules"
                        }

                        · Not AI-generated

                    </span>


                    <button
                        type="button"
                        id="workflow-save-commentary"
                        class="workflow-primary-button"
                    >
                        Save Commentary
                    </button>

                </div>

            </div>


            <!-- ACTION LOG -->

            <div
                class="workflow-view hidden"
                data-workflow-view="actions"
            >

                <div class="workflow-action-summary">

                    <div class="workflow-action-summary-card">

                        <span>
                            Total Actions
                        </span>

                        <strong>
                            ${actionData.action_count || 0}
                        </strong>

                    </div>


                    <div class="workflow-action-summary-card">

                        <span>
                            Open Actions
                        </span>

                        <strong>
                            ${actionData.open_actions || 0}
                        </strong>

                    </div>


                    <div class="workflow-action-summary-card">

                        <span>
                            Closed Actions
                        </span>

                        <strong>
                            ${actionData.closed_actions || 0}
                        </strong>

                    </div>

                </div>


                <div class="workflow-action-table-wrap">

                    <table class="workflow-action-table">

                        <thead>

                            <tr>

                                <th>
                                    Category
                                </th>

                                <th>
                                    Issue / Action
                                </th>

                                <th>
                                    Owner
                                </th>

                                <th>
                                    Due Date
                                </th>

                                <th>
                                    Priority
                                </th>

                                <th>
                                    Status
                                </th>

                                <th>
                                    Action
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            ${renderWorkflowActionRows(
                                actions
                            )}

                        </tbody>

                    </table>

                </div>


                <form
                    id="workflow-action-form"
                    class="workflow-action-form"
                >

                    <div class="workflow-form-field">

                        <label>
                            Category
                        </label>

                        <select id="workflow-action-category">

                            <option>
                                Cost
                            </option>

                            <option>
                                Progress
                            </option>

                            <option>
                                Schedule
                            </option>

                            <option>
                                Procurement
                            </option>

                            <option>
                                Data Quality
                            </option>

                            <option>
                                Forecast Credibility
                            </option>

                        </select>

                    </div>


                    <div class="workflow-form-field">

                        <label>
                            Issue / Action
                        </label>

                        <input
                            id="workflow-action-issue"
                            type="text"
                            placeholder="Describe the management action"
                        >

                    </div>


                    <div class="workflow-form-field">

                        <label>
                            Owner
                        </label>

                        <select id="workflow-action-owner">

                            <option>
                                Cost Control / Commercial
                            </option>

                            <option>
                                Planning / Project Controls
                            </option>

                            <option>
                                Planning / Project Manager
                            </option>

                            <option>
                                Procurement
                            </option>

                            <option>
                                Data / Project Controls
                            </option>

                            <option>
                                Project Manager
                            </option>

                        </select>

                    </div>


                    <div class="workflow-form-field">

                        <label>
                            Due Date
                        </label>

                        <input
                            id="workflow-action-due"
                            type="date"
                            value="${workflowDefaultDueDate(
                                14
                            )}"
                        >

                    </div>


                    <div class="workflow-form-field">

                        <label>
                            Priority
                        </label>

                        <select id="workflow-action-priority">

                            <option>
                                Medium
                            </option>

                            <option>
                                High
                            </option>

                            <option>
                                Critical
                            </option>

                            <option>
                                Low
                            </option>

                        </select>

                    </div>


                    <button
                        type="submit"
                        class="workflow-primary-button"
                    >
                        Add Action
                    </button>

                </form>

            </div>


            <!-- SUGGESTIONS -->

            <div
                class="workflow-view hidden"
                data-workflow-view="suggestions"
            >

                <div class="workflow-suggestions">

                    <div class="workflow-suggestions-header">

                        <strong>
                            Management Action Suggestions
                        </strong>

                        <span>
                            Deterministic rules · Not AI-generated
                        </span>

                    </div>


                    <div class="workflow-suggestion-list">

                        ${renderWorkflowSuggestions(
                            suggestions
                        )}

                    </div>

                </div>

            </div>


            <div
                id="workflow-feedback"
                class="workflow-feedback"
            ></div>
        `;


        initialiseWorkflowEvents(
            panel,
            projectCode,
            reportingPeriod,
            suggestions
        );


        panel.dataset.workflowLoaded =
            "true";


        workflowLastKey =
            workflowKey;


    } catch (error) {

        console.error(
            "Unable to load workflow controls:",
            error
        );


        panel.innerHTML = `

            <div class="workflow-control-header">

                <div>

                    <span class="section-eyebrow">
                        Management Workflow
                    </span>

                    <h3>
                        Period Commentary & Action Log
                    </h3>

                </div>

            </div>


            <div class="polish-panel-error">

                Workflow controls could not be loaded.

                <br><br>

                ${polishEscape(
                    error.message
                )}

            </div>
        `;
    } finally {

        workflowRefreshRunning =
            false;
    }
}


/* ============================================================
   REFRESH SELECTED PROJECT ENHANCEMENTS
   ============================================================ */

async function refreshSelectedProjectEnhancements() {

    if (
        polishProjectRefreshRunning
    ) {
        return;
    }


    const projectCode =
        getSelectedProjectCode();


    if (!projectCode) {
        return;
    }


    polishProjectRefreshRunning =
        true;


    try {

        await Promise.allSettled([

            refreshForecastCredibilityForPeriod(),

            refreshFacMovementForPeriod(),

            refreshFacWaterfallForPeriod(),

            refreshCostCockpitForPeriod(),

            refreshWorkflowPanel()

        ]);

    } finally {

        polishProjectRefreshRunning =
            false;
    }
}


/* ============================================================
   CONTROLLED PROJECT STATE CHECK
   ============================================================ */

function initialiseProjectEnhancementController() {

    window.setInterval(
        async () => {

            const projectCode =
                getSelectedProjectCode();


            if (!projectCode) {

                polishLastProjectCode =
                    null;

                workflowLastKey =
                    null;

                return;
            }


            const costSection =
                document.getElementById(
                    "cost-performance"
                );


            if (!costSection) {
                return;
            }


            const projectChanged =
                projectCode !==
                polishLastProjectCode;


            const missingCockpit =
                !costSection.querySelector(
                    ".cost-control-cockpit"
                );


            const missingMovement =
                !costSection.querySelector(
                    ".fac-movement-panel"
                );


            const missingWaterfall =
                !costSection.querySelector(
                    ".fac-waterfall-panel"
                );


            const detail =
                document.getElementById(
                    "project-detail"
                );


            const missingCredibility =
                !detail?.querySelector(
                    ".forecast-credibility-panel"
                );


            const missingWorkflow =
                !detail?.querySelector(
                    ".workflow-control-panel"
                );


            if (
                projectChanged
                ||
                missingCockpit
                ||
                missingMovement
                ||
                missingWaterfall
                ||
                missingCredibility
                ||
                missingWorkflow
            ) {

                polishLastProjectCode =
                    projectCode;


                workflowLastKey =
                    null;


                await refreshSelectedProjectEnhancements();
            }

        },
        500
    );
}


/* ============================================================
   REPORTING PERIOD CHANGE
   ============================================================ */

function initialiseReportingPeriodRefresh() {

    window.addEventListener(
        "controlsight:reporting-period-changed",
        async () => {

            workflowLastKey =
                null;


            await refreshSelectedProjectEnhancements();
        }
    );
}


/* ============================================================
   PORTFOLIO ENHANCEMENT CHECK
   ============================================================ */

function initialisePortfolioEnhancementController() {

    window.setInterval(
        async () => {

            const table =
                document.querySelector(
                    "#project-portfolio table"
                );


            if (!table) {
                return;
            }


            const header =
                table.querySelector(
                    "[data-forecast-credibility-header]"
                );


            if (!header) {

                polishPortfolioEnhanced =
                    false;
            }


            if (
                !polishPortfolioEnhanced
            ) {

                await enhanceProjectPortfolioCredibility();
            }

        },
        800
    );
}


/* ============================================================
   REPORTING SNAPSHOT
   ============================================================ */

async function loadReportingSnapshot() {

    const element =
        document.getElementById(
            "snapshot-date"
        );

    if (!element) {
        return;
    }


    try {

        const response =
            await polishFetch(
                `${POLISH_API_BASE}/reporting-periods`
            );


        const data =
            await response.json();


        const latest =
            data
                .default_reporting_period
                ?.date;


        element.textContent =
            latest
                ? formatSnapshotDate(
                    latest
                )
                : "Portfolio snapshot";


    } catch (error) {

        console.warn(
            "Unable to load reporting snapshot:",
            error
        );
    }
}


/* ============================================================
   SERVICE NOTICE
   ============================================================ */

function initialiseServiceNotice() {

    const notice =
        document.getElementById(
            "demo-service-notice"
        );

    const dismiss =
        document.getElementById(
            "dismiss-service-notice"
        );


    if (
        !notice ||
        !dismiss
    ) {
        return;
    }


    if (
        sessionStorage.getItem(
            "controlsight-demo-notice-hidden"
        )
        ===
        "1"
    ) {

        notice.classList.add(
            "hidden-notice"
        );

        return;
    }


    dismiss.addEventListener(
        "click",
        () => {

            notice.classList.add(
                "hidden-notice"
            );

            sessionStorage.setItem(
                "controlsight-demo-notice-hidden",
                "1"
            );
        }
    );


    window.setTimeout(
        () => {

            notice.classList.add(
                "hidden-notice"
            );

        },
        9000
    );
}


/* ============================================================
   NAVIGATION
   ============================================================ */

function initialisePolishNavigation() {

    document
        .querySelectorAll(
            ".sidebar-nav .nav-item"
        )
        .forEach(
            item => {

                item.addEventListener(
                    "click",
                    () => {

                        const href =
                            item.getAttribute(
                                "href"
                            );


                        if (!href) {
                            return;
                        }


                        window.setTimeout(
                            () => {

                                const element =
                                    document.querySelector(
                                        href
                                    );


                                if (
                                    element &&
                                    !element.classList.contains(
                                        "hidden"
                                    )
                                ) {

                                    element.scrollIntoView(
                                        {
                                            behavior:
                                                "smooth",

                                            block:
                                                "start"
                                        }
                                    );
                                }

                            },
                            20
                        );
                    }
                );
            }
        );
}


/* ============================================================
   SCROLL SPY
   ============================================================ */

function initialiseScrollSpy() {

    const targets = [

        "portfolio-overview",

        "project-portfolio",

        "project-detail",

        "cost-performance",

        "schedule-risk-panel",

        "procurement-risk-panel",

        "data-quality"

    ];


    let scheduled =
        false;


    function resolve() {

        scheduled =
            false;


        const marker =
            120;


        let best =
            null;


        let bestDistance =
            Infinity;


        targets.forEach(
            id => {

                const element =
                    document.getElementById(
                        id
                    );


                if (
                    !element ||
                    element.classList.contains(
                        "hidden"
                    )
                ) {
                    return;
                }


                const rect =
                    element.getBoundingClientRect();


                if (
                    rect.bottom <= 0
                ) {
                    return;
                }


                const distance =
                    Math.abs(
                        rect.top -
                        marker
                    );


                if (
                    rect.top <= marker &&
                    rect.bottom > marker
                ) {

                    best =
                        `#${id}`;

                    bestDistance =
                        -1;

                } else if (
                    bestDistance !== -1 &&
                    distance <
                    bestDistance
                ) {

                    bestDistance =
                        distance;

                    best =
                        `#${id}`;
                }
            }
        );


        if (!best) {
            return;
        }


        document
            .querySelectorAll(
                ".sidebar-nav .nav-item"
            )
            .forEach(
                item => {

                    item.classList.toggle(
                        "active",
                        item.getAttribute(
                            "href"
                        )
                        ===
                        best
                    );
                }
            );
    }


    function request() {

        if (scheduled) {
            return;
        }


        scheduled =
            true;


        window.requestAnimationFrame(
            resolve
        );
    }


    window.addEventListener(
        "scroll",
        request,
        {
            passive: true
        }
    );


    window.addEventListener(
        "resize",
        request
    );


    window.setTimeout(
        request,
        100
    );
}


/* ============================================================
   INITIALISE
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        installPolishFeatureStyles();

        initialiseServiceNotice();

        initialisePolishNavigation();

        initialiseScrollSpy();

        initialiseReportingPeriodRefresh();

        loadReportingPeriodSelector();

        loadReportingSnapshot();

        loadPortfolioExposure();

        initialisePortfolioEnhancementController();

        initialiseProjectEnhancementController();

    }
);