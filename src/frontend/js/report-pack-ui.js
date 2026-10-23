/* ============================================================
   CONTROLSIGHT
   MONTHLY REPORT PACK UI
   v1.0.0
   ============================================================ */

const REPORT_PACK_API_BASE = "/api/report-pack";
const REPORT_PACK_PROJECTS_API = "/api/projects";
const REPORT_PACK_PERIODS_API = "/api/reporting-periods";

let reportPackInitialised = false;
let reportPackSelectedProject = null;
let reportPackSelectedPeriod = null;
let reportPackPreview = null;


/* ============================================================
   HELPERS
   ============================================================ */

function rpEscape(value) {

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


function rpMoney(value) {

    const number =
        Number(value);

    if (
        !Number.isFinite(
            number
        )
    ) {
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


function rpPercent(value) {

    const number =
        Number(value);

    if (
        !Number.isFinite(
            number
        )
    ) {
        return "0.0%";
    }

    return `${number.toFixed(1)}%`;
}


function rpFormatDateTime(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

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
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(date);
}


function rpFormatBytes(bytes) {

    const number =
        Number(bytes);

    if (
        !Number.isFinite(number)
        ||
        number <= 0
    ) {
        return "0 KB";
    }

    if (
        number <
        1024 * 1024
    ) {
        return `${(
            number / 1024
        ).toFixed(1)} KB`;
    }

    return `${(
        number /
        1024 /
        1024
    ).toFixed(2)} MB`;
}


async function rpFetchJson(
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
                detail =
                    body.detail;

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

function installReportPackStyles() {

    if (
        document.getElementById(
            "controlsight-report-pack-styles"
        )
    ) {
        return;
    }

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "controlsight-report-pack-styles";

    style.textContent = `

        #report-pack {
            scroll-margin-top: 90px;
        }

        .rp-shell {
            display: grid;
            gap: 18px;
        }

        .rp-hero {

            display: flex;
            justify-content: space-between;
            align-items: flex-start;

            gap: 20px;

            padding: 20px 22px;

            background:
                linear-gradient(
                    135deg,
                    #0f172a,
                    #243b53
                );

            color: white;

            border-radius: 12px;

            box-shadow:
                0 10px 28px
                rgba(
                    15,
                    23,
                    42,
                    0.15
                );
        }

        .rp-eyebrow {

            display: block;

            margin-bottom: 6px;

            color: #a5b4fc;

            font-size: 10px;
            font-weight: 850;

            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .rp-hero h2 {

            margin: 0;

            color: white;

            font-size: 22px;
            font-weight: 850;
        }

        .rp-hero p {

            max-width: 760px;

            margin: 8px 0 0;

            color: #cbd5e1;

            font-size: 11px;
            line-height: 1.6;
        }

        .rp-badge {

            flex: 0 0 auto;

            padding: 8px 11px;

            color: #ddd6fe;

            background:
                rgba(
                    129,
                    140,
                    248,
                    0.13
                );

            border:
                1px solid
                rgba(
                    165,
                    180,
                    252,
                    0.25
                );

            border-radius: 999px;

            font-size: 9px;
            font-weight: 850;
        }

        .rp-panel {

            padding: 20px;

            background: white;

            border:
                1px solid
                #e5e7eb;

            border-radius: 11px;

            box-shadow:
                0 2px 8px
                rgba(
                    15,
                    23,
                    42,
                    0.05
                );
        }

        .rp-header {

            display: flex;
            justify-content: space-between;
            align-items: flex-start;

            gap: 16px;

            margin-bottom: 16px;
        }

        .rp-header h3 {

            margin: 0;

            color: #0f172a;

            font-size: 16px;
            font-weight: 850;
        }

        .rp-header p {

            margin: 5px 0 0;

            color: #64748b;

            font-size: 10px;
            line-height: 1.5;
        }

        .rp-controls {

            display: grid;

            grid-template-columns:
                minmax(250px, 1.4fr)
                minmax(170px, 0.8fr)
                auto;

            gap: 12px;

            align-items: end;
        }

        .rp-field {

            display: grid;
            gap: 5px;
        }

        .rp-field label {

            color: #475569;

            font-size: 8px;
            font-weight: 800;
        }

        .rp-select,
        .rp-input {

            width: 100%;

            box-sizing: border-box;

            padding: 10px 11px;

            color: #0f172a;

            background: white;

            border:
                1px solid
                #cbd5e1;

            border-radius: 7px;

            font-family: inherit;

            font-size: 10px;
            font-weight: 700;
        }

        .rp-button-row {

            display: flex;
            flex-wrap: wrap;

            gap: 8px;
        }

        .rp-button {

            appearance: none;

            padding: 9px 12px;

            border-radius: 7px;

            font-family: inherit;

            font-size: 9px;
            font-weight: 850;

            cursor: pointer;
        }

        .rp-primary {

            color: white;

            background: #4f46e5;

            border:
                1px solid
                #4f46e5;
        }

        .rp-secondary {

            color: #334155;

            background: white;

            border:
                1px solid
                #cbd5e1;
        }

        .rp-success {

            color: #166534;

            background: #f0fdf4;

            border:
                1px solid
                #bbf7d0;
        }

        .rp-grid {

            display: grid;

            grid-template-columns:
                repeat(
                    4,
                    minmax(0, 1fr)
                );

            gap: 10px;
        }

        .rp-card {

            padding: 14px;

            background: #f8fafc;

            border:
                1px solid
                #e5eaf1;

            border-radius: 8px;
        }

        .rp-card span {

            display: block;

            color: #64748b;

            font-size: 8px;
            font-weight: 750;
        }

        .rp-card strong {

            display: block;

            margin-top: 5px;

            color: #0f172a;

            font-size: 16px;
            font-weight: 850;
        }

        .rp-card.red strong {
            color: #b91c1c;
        }

        .rp-card.amber strong {
            color: #b45309;
        }

        .rp-card.green strong {
            color: #166534;
        }

        .rp-section-grid {

            display: grid;

            grid-template-columns:
                repeat(
                    2,
                    minmax(0, 1fr)
                );

            gap: 12px;

            margin-top: 14px;
        }

        .rp-mini-panel {

            padding: 14px;

            background: #fbfdff;

            border:
                1px solid
                #e5eaf1;

            border-radius: 8px;
        }

        .rp-mini-panel h4 {

            margin: 0 0 10px;

            color: #0f172a;

            font-size: 11px;
            font-weight: 850;
        }

        .rp-metric-row {

            display: flex;
            justify-content: space-between;

            gap: 12px;

            padding: 7px 0;

            border-bottom:
                1px solid
                #eef2f7;

            font-size: 9px;
        }

        .rp-metric-row:last-child {
            border-bottom: none;
        }

        .rp-metric-row span {
            color: #64748b;
        }

        .rp-metric-row strong {
            color: #0f172a;
        }

        .rp-feedback {

            display: none;

            margin-top: 12px;

            padding: 9px 11px;

            border-radius: 7px;

            font-size: 9px;
        }

        .rp-feedback.visible {
            display: block;
        }

        .rp-feedback.success {

            color: #166534;

            background: #f0fdf4;

            border:
                1px solid
                #bbf7d0;
        }

        .rp-feedback.error {

            color: #991b1b;

            background: #fef2f2;

            border:
                1px solid
                #fecaca;
        }

        .rp-feedback.info {

            color: #1d4ed8;

            background: #eff6ff;

            border:
                1px solid
                #bfdbfe;
        }

        .rp-download-list {

            display: grid;
            gap: 8px;

            margin-top: 14px;
        }

        .rp-download-item {

            display: flex;
            justify-content: space-between;
            align-items: center;

            gap: 12px;

            padding: 11px 12px;

            background: #f8fafc;

            border:
                1px solid
                #e5eaf1;

            border-radius: 8px;
        }

        .rp-download-item strong {

            display: block;

            color: #0f172a;

            font-size: 9px;
        }

        .rp-download-item span {

            display: block;

            margin-top: 3px;

            color: #64748b;

            font-size: 8px;
        }

        .rp-download-link {

            flex: 0 0 auto;

            padding: 7px 10px;

            color: #1d4ed8;

            background: white;

            border:
                1px solid
                #bfdbfe;

            border-radius: 6px;

            text-decoration: none;

            font-size: 8px;
            font-weight: 850;
        }

        .rp-empty {

            padding: 28px;

            text-align: center;

            color: #64748b;

            font-size: 10px;
        }

        .rp-note {

            margin-top: 14px;

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

        .rp-note strong {
            color: #0f172a;
        }

        @media (max-width: 1100px) {

            .rp-controls {
                grid-template-columns: 1fr 1fr;
            }

            .rp-controls .rp-button-row {
                grid-column: 1 / -1;
            }

            .rp-grid {
                grid-template-columns:
                    repeat(
                        2,
                        minmax(0, 1fr)
                    );
            }
        }

        @media (max-width: 720px) {

            .rp-hero,
            .rp-header {

                flex-direction: column;
            }

            .rp-controls,
            .rp-grid,
            .rp-section-grid {

                grid-template-columns:
                    1fr;
            }

            .rp-controls .rp-button-row {
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

function installReportPackPage() {

    if (
        document.getElementById(
            "report-pack"
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
        "report-pack";

    section.className =
        "dashboard-section";

    section.innerHTML = `

        <div class="rp-shell">

            <div class="rp-hero">

                <div>

                    <span class="rp-eyebrow">
                        Management Reporting
                    </span>

                    <h2>
                        Monthly Report Pack
                    </h2>

                    <p>
                        Assemble project-control information
                        into a management-ready monthly report
                        covering cost, progress, forecast
                        credibility, change control, risk,
                        cash flow and actions.
                    </p>

                </div>

                <div class="rp-badge">
                    PDF + Excel Export
                </div>

            </div>


            <div class="rp-panel">

                <div class="rp-header">

                    <div>

                        <h3>
                            Report Selection
                        </h3>

                        <p>
                            Choose a project and reporting
                            period before previewing or exporting.
                        </p>

                    </div>

                </div>


                <div class="rp-controls">

                    <div class="rp-field">

                        <label>
                            Project
                        </label>

                        <select
                            id="rp-project"
                            class="rp-select"
                        ></select>

                    </div>


                    <div class="rp-field">

                        <label>
                            Reporting Period
                        </label>

                        <select
                            id="rp-period"
                            class="rp-select"
                        ></select>

                    </div>


                    <div class="rp-button-row">

                        <button
                            id="rp-preview"
                            class="
                                rp-button
                                rp-secondary
                            "
                            type="button"
                        >
                            Refresh Preview
                        </button>

                    </div>

                </div>


                <div
                    id="rp-feedback"
                    class="rp-feedback"
                ></div>

            </div>


            <div class="rp-panel">

                <div class="rp-header">

                    <div>

                        <h3>
                            Report Preview
                        </h3>

                        <p>
                            High-level contents that will feed
                            the generated management pack.
                        </p>

                    </div>

                </div>


                <div
                    id="rp-preview-container"
                >
                    Loading preview...
                </div>

            </div>


            <div class="rp-panel">

                <div class="rp-header">

                    <div>

                        <h3>
                            Generate Report
                        </h3>

                        <p>
                            Export the selected project period
                            to PDF, Excel, or both.
                        </p>

                    </div>

                </div>


                <div class="rp-button-row">

                    <button
                        id="rp-generate-pdf"
                        class="
                            rp-button
                            rp-primary
                        "
                        type="button"
                    >
                        Generate PDF
                    </button>


                    <button
                        id="rp-generate-excel"
                        class="
                            rp-button
                            rp-success
                        "
                        type="button"
                    >
                        Generate Excel
                    </button>


                    <button
                        id="rp-generate-both"
                        class="
                            rp-button
                            rp-secondary
                        "
                        type="button"
                    >
                        Generate Both
                    </button>

                </div>


                <div
                    id="rp-generated-files"
                    class="rp-download-list"
                ></div>

            </div>


            <div class="rp-panel">

                <div class="rp-header">

                    <div>

                        <h3>
                            Generated Reports
                        </h3>

                        <p>
                            Previously generated monthly
                            report packs.
                        </p>

                    </div>

                    <button
                        id="rp-refresh-history"
                        class="
                            rp-button
                            rp-secondary
                        "
                        type="button"
                    >
                        Refresh
                    </button>

                </div>


                <div
                    id="rp-history"
                >
                    Loading report history...
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

function installReportPackNavigation() {

    const nav =
        document.querySelector(
            ".sidebar-nav"
        );

    if (!nav) {
        return;
    }

    if (
        nav.querySelector(
            'a[href="#report-pack"]'
        )
    ) {
        return;
    }

    const link =
        document.createElement(
            "a"
        );

    link.href =
        "#report-pack";

    link.className =
        "nav-item";

    link.innerHTML = `

        <span class="nav-icon">
            ▣
        </span>

        <span>
            Report Pack
        </span>
    `;

    link.addEventListener(
        "click",
        event => {

            event.preventDefault();

            document
                .getElementById(
                    "report-pack"
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
   LOAD PROJECTS
   ============================================================ */

async function loadReportPackProjects() {

    const data =
        await rpFetchJson(
            REPORT_PACK_PROJECTS_API
        );


    let projects = [];


    if (
        Array.isArray(data)
    ) {

        projects = data;

    } else if (
        Array.isArray(
            data.projects
        )
    ) {

        projects =
            data.projects;

    } else if (
        Array.isArray(
            data.data
        )
    ) {

        projects =
            data.data;
    }


    const select =
        document.getElementById(
            "rp-project"
        );


    select.innerHTML =
        projects
            .map(
                project => {

                    const code =
                        project.project_code
                        ||
                        project.code;

                    const name =
                        project.project_name
                        ||
                        project.name
                        ||
                        code;


                    return `

                        <option
                            value="${rpEscape(
                                code
                            )}"
                        >
                            ${rpEscape(
                                code
                            )}
                            ·
                            ${rpEscape(
                                name
                            )}
                        </option>
                    `;
                }
            )
            .join("");


    if (
        !reportPackSelectedProject
        &&
        projects.length
    ) {

        reportPackSelectedProject =
            projects[0]
                .project_code
            ||
            projects[0]
                .code;
    }


    if (
        reportPackSelectedProject
    ) {

        select.value =
            reportPackSelectedProject;
    }
}


/* ============================================================
   LOAD PERIODS
   ============================================================ */

async function loadReportPackPeriods() {

    const select =
        document.getElementById(
            "rp-period"
        );


    let periods = [];


    try {

        const data =
            await rpFetchJson(
                REPORT_PACK_PERIODS_API
            );


        if (
            Array.isArray(data)
        ) {

            periods =
                data;

        } else if (
            Array.isArray(
                data.reporting_periods
            )
        ) {

            periods =
                data.reporting_periods;

        } else if (
            Array.isArray(
                data.periods
            )
        ) {

            periods =
                data.periods;
        }

    } catch {

        periods = [];
    }


    periods =
        periods
            .map(
                item => {

                    if (
                        typeof item ===
                        "string"
                    ) {
                        return item;
                    }

                    return (
                        item.reporting_period
                        ||
                        item.period
                        ||
                        item.value
                    );
                }
            )
            .filter(Boolean);


    periods =
        [
            ...new Set(
                periods
            )
        ]
        .sort()
        .reverse();


    if (
        !periods.length
    ) {

        const now =
            new Date();

        periods = [
            `${now.getFullYear()}-${String(
                now.getMonth() + 1
            ).padStart(2, "0")}`
        ];
    }


    select.innerHTML =
        periods
            .map(
                period => `

                    <option
                        value="${rpEscape(
                            period
                        )}"
                    >
                        ${rpEscape(
                            period
                        )}
                    </option>
                `
            )
            .join("");


    if (
        !reportPackSelectedPeriod
    ) {

        reportPackSelectedPeriod =
            periods[0];
    }


    if (
        periods.includes(
            reportPackSelectedPeriod
        )
    ) {

        select.value =
            reportPackSelectedPeriod;

    } else {

        reportPackSelectedPeriod =
            periods[0];

        select.value =
            reportPackSelectedPeriod;
    }
}


/* ============================================================
   PREVIEW
   ============================================================ */

async function loadReportPackPreview() {

    if (
        !reportPackSelectedProject
        ||
        !reportPackSelectedPeriod
    ) {
        return;
    }


    setReportPackFeedback(
        "Loading report preview...",
        "info"
    );


    try {

        reportPackPreview =
            await rpFetchJson(
                (
                    `${REPORT_PACK_API_BASE}` +
                    `/preview/` +
                    encodeURIComponent(
                        reportPackSelectedProject
                    ) +
                    `?reporting_period=` +
                    encodeURIComponent(
                        reportPackSelectedPeriod
                    )
                )
            );


        renderReportPackPreview(
            reportPackPreview
        );


        clearReportPackFeedback();

    } catch (error) {

        setReportPackFeedback(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   RENDER PREVIEW
   ============================================================ */

function renderReportPackPreview(
    data
) {

    const container =
        document.getElementById(
            "rp-preview-container"
        );


    if (!data) {

        container.innerHTML = `

            <div class="rp-empty">
                Report preview unavailable.
            </div>
        `;

        return;
    }


    const project =
        data.project || {};

    const performance =
        data.performance || {};

    const change =
        data.change_control || {};

    const risk =
        data.risk_control || {};

    const cash =
        data.cashflow || {};

    const schedule =
        data.schedule || {};

    const procurement =
        data.procurement || {};

    const actions =
        data.actions || [];

    const commentary =
        data.commentary || {};


    const managementStatus =
        String(
            performance.management_status
            || "—"
        );


    const statusClass =
        managementStatus.toLowerCase()
        === "red"
            ? "red"
            :
        managementStatus.toLowerCase()
        === "amber"
            ? "amber"
            :
        managementStatus.toLowerCase()
        === "green"
            ? "green"
            :
        "";


    container.innerHTML = `

        <div class="rp-grid">

            <div class="rp-card">

                <span>
                    Project
                </span>

                <strong>
                    ${rpEscape(
                        project.project_code
                    )}
                </strong>

                <span>
                    ${rpEscape(
                        project.project_name
                    )}
                </span>

            </div>


            <div class="rp-card ${statusClass}">

                <span>
                    Management Status
                </span>

                <strong>
                    ${rpEscape(
                        managementStatus
                    )}
                </strong>

            </div>


            <div class="rp-card">

                <span>
                    Current Budget
                </span>

                <strong>
                    ${rpMoney(
                        change.current_budget
                    )}
                </strong>

            </div>


            <div class="rp-card">

                <span>
                    FAC
                </span>

                <strong>
                    ${rpMoney(
                        performance
                            .forecast_at_completion
                    )}
                </strong>

            </div>


            <div class="rp-card">

                <span>
                    Actual Cost
                </span>

                <strong>
                    ${rpMoney(
                        performance
                            .actual_cost_to_date
                    )}
                </strong>

            </div>


            <div class="rp-card">

                <span>
                    Actual Progress
                </span>

                <strong>
                    ${rpPercent(
                        performance
                            .actual_progress_pct
                    )}
                </strong>

            </div>


            <div class="rp-card">

                <span>
                    Forecast Credibility
                </span>

                <strong>
                    ${rpEscape(
                        performance
                            .forecast_credibility_status
                    )}
                </strong>

                <span>
                    Gap:
                    ${rpPercent(
                        performance
                            .forecast_credibility_gap_pct
                    )}
                </span>

            </div>


            <div class="rp-card">

                <span>
                    Remaining Contingency
                </span>

                <strong>
                    ${rpMoney(
                        risk.remaining
                    )}
                </strong>

            </div>

        </div>


        <div class="rp-section-grid">


            <div class="rp-mini-panel">

                <h4>
                    Budget & Change Control
                </h4>

                ${rpMetric(
                    "Original Budget",
                    rpMoney(
                        change.original_budget
                    )
                )}

                ${rpMetric(
                    "Approved Changes",
                    rpMoney(
                        change.approved_changes
                    )
                )}

                ${rpMetric(
                    "Pending Changes",
                    rpMoney(
                        change.pending_changes
                    )
                )}

                ${rpMetric(
                    "Potential Budget",
                    rpMoney(
                        change.potential_budget
                    )
                )}

            </div>


            <div class="rp-mini-panel">

                <h4>
                    Contingency & Risk
                </h4>

                ${rpMetric(
                    "Contingency",
                    rpMoney(
                        risk.contingency_budget
                    )
                )}

                ${rpMetric(
                    "Proposed Exposure",
                    rpMoney(
                        risk.proposed_exposure
                    )
                )}

                ${rpMetric(
                    "Approved not Drawn",
                    rpMoney(
                        risk.approved_not_drawn
                    )
                )}

                ${rpMetric(
                    "Utilisation",
                    rpPercent(
                        risk.utilisation_pct
                    )
                )}

            </div>


            <div class="rp-mini-panel">

                <h4>
                    Cash Flow
                </h4>

                ${rpMetric(
                    "Forecast Cash",
                    rpMoney(
                        cash.total_forecast
                    )
                )}

                ${rpMetric(
                    "Actual Cash",
                    rpMoney(
                        cash.total_actual
                    )
                )}

                ${rpMetric(
                    "Committed Cash",
                    rpMoney(
                        cash.total_committed
                    )
                )}

                ${rpMetric(
                    "Variance",
                    rpMoney(
                        cash.total_variance
                    )
                )}

            </div>


            <div class="rp-mini-panel">

                <h4>
                    Schedule & Procurement
                </h4>

                ${rpMetric(
                    "Delayed Activities",
                    rpEscape(
                        schedule
                            .delayed_activities
                    )
                )}

                ${rpMetric(
                    "Critical Delayed",
                    rpEscape(
                        schedule
                            .critical_delayed
                    )
                )}

                ${rpMetric(
                    "Delayed Procurement",
                    rpEscape(
                        procurement
                            .delayed_items
                    )
                )}

                ${rpMetric(
                    "Critical Procurement Delays",
                    rpEscape(
                        procurement
                            .critical_delays
                    )
                )}

            </div>


            <div class="rp-mini-panel">

                <h4>
                    Management Workflow
                </h4>

                ${rpMetric(
                    "Action Count",
                    actions.length
                )}

                ${rpMetric(
                    "Saved Commentary",
                    (
                        Object.keys(
                            commentary
                        ).length > 0
                            ? "Available"
                            : "Not saved"
                    )
                )}

                ${rpMetric(
                    "Reporting Period",
                    rpEscape(
                        data.reporting_period
                    )
                )}

            </div>


            <div class="rp-mini-panel">

                <h4>
                    Forecast Cross-Check
                </h4>

                ${rpMetric(
                    "Progress-Implied EAC",
                    rpMoney(
                        performance
                            .progress_implied_eac
                    )
                )}

                ${rpMetric(
                    "Credibility Gap",
                    rpMoney(
                        performance
                            .forecast_credibility_gap
                    )
                )}

                ${rpMetric(
                    "Credibility Gap %",
                    rpPercent(
                        performance
                            .forecast_credibility_gap_pct
                    )
                )}

            </div>

        </div>


        <div class="rp-note">

            <strong>
                Report scope:
            </strong>

            the generated pack consolidates
            management reporting data available
            in ControlSight for the selected project
            and reporting period.

        </div>
    `;
}


function rpMetric(
    label,
    value
) {

    return `

        <div class="rp-metric-row">

            <span>
                ${rpEscape(label)}
            </span>

            <strong>
                ${value}
            </strong>

        </div>
    `;
}


/* ============================================================
   GENERATE
   ============================================================ */

async function generateReportPack(
    formats
) {

    if (
        !reportPackSelectedProject
        ||
        !reportPackSelectedPeriod
    ) {

        setReportPackFeedback(
            "Select a project and reporting period.",
            "error"
        );

        return;
    }


    setReportPackFeedback(
        "Generating report pack...",
        "info"
    );


    try {

        const result =
            await rpFetchJson(
                `${REPORT_PACK_API_BASE}/generate`,
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
                                    reportPackSelectedProject,

                                reporting_period:
                                    reportPackSelectedPeriod,

                                formats:
                                    formats
                            }
                        )
                }
            );


        renderGeneratedFiles(
            result.files || []
        );


        setReportPackFeedback(
            "Report pack generated successfully.",
            "success"
        );


        await loadReportPackHistory();

    } catch (error) {

        setReportPackFeedback(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   GENERATED FILES
   ============================================================ */

function renderGeneratedFiles(
    files
) {

    const container =
        document.getElementById(
            "rp-generated-files"
        );


    if (!files.length) {

        container.innerHTML = "";

        return;
    }


    container.innerHTML =
        files
            .map(
                file => `

                    <div class="rp-download-item">

                        <div>

                            <strong>
                                ${rpEscape(
                                    file.filename
                                )}
                            </strong>

                            <span>
                                ${rpEscape(
                                    String(
                                        file.format
                                    ).toUpperCase()
                                )}
                                · Generated now
                            </span>

                        </div>


                        <a
                            class="rp-download-link"
                            href="${rpEscape(
                                file.download_url
                            )}"
                        >
                            Download
                        </a>

                    </div>
                `
            )
            .join("");
}


/* ============================================================
   HISTORY
   ============================================================ */

async function loadReportPackHistory() {

    const container =
        document.getElementById(
            "rp-history"
        );


    try {

        const data =
            await rpFetchJson(
                `${REPORT_PACK_API_BASE}/files`
            );


        const files =
            data.files || [];


        if (!files.length) {

            container.innerHTML = `

                <div class="rp-empty">
                    No reports generated yet.
                </div>
            `;

            return;
        }


        container.innerHTML = `

            <div class="rp-download-list">

                ${files
                    .map(
                        file => `

                            <div class="rp-download-item">

                                <div>

                                    <strong>
                                        ${rpEscape(
                                            file.filename
                                        )}
                                    </strong>

                                    <span>
                                        ${rpFormatBytes(
                                            file.size_bytes
                                        )}
                                        ·
                                        ${rpEscape(
                                            rpFormatDateTime(
                                                file.modified_at
                                            )
                                        )}
                                    </span>

                                </div>


                                <a
                                    class="rp-download-link"
                                    href="${rpEscape(
                                        file.download_url
                                    )}"
                                >
                                    Download
                                </a>

                            </div>
                        `
                    )
                    .join("")}

            </div>
        `;

    } catch (error) {

        container.innerHTML = `

            <div class="rp-empty">
                Report history could not be loaded.
            </div>
        `;

        console.error(
            "Report history failed:",
            error
        );
    }
}


/* ============================================================
   FEEDBACK
   ============================================================ */

function setReportPackFeedback(
    message,
    type
) {

    const element =
        document.getElementById(
            "rp-feedback"
        );

    if (!element) {
        return;
    }

    element.textContent =
        message;

    element.className =
        `rp-feedback visible ${type}`;
}


function clearReportPackFeedback() {

    const element =
        document.getElementById(
            "rp-feedback"
        );

    if (!element) {
        return;
    }

    element.textContent = "";

    element.className =
        "rp-feedback";
}


/* ============================================================
   EVENTS
   ============================================================ */

function initialiseReportPackEvents() {

    document
        .getElementById(
            "rp-project"
        )
        ?.addEventListener(
            "change",
            async event => {

                reportPackSelectedProject =
                    event.target.value;

                await loadReportPackPreview();
            }
        );


    document
        .getElementById(
            "rp-period"
        )
        ?.addEventListener(
            "change",
            async event => {

                reportPackSelectedPeriod =
                    event.target.value;

                await loadReportPackPreview();
            }
        );


    document
        .getElementById(
            "rp-preview"
        )
        ?.addEventListener(
            "click",
            loadReportPackPreview
        );


    document
        .getElementById(
            "rp-generate-pdf"
        )
        ?.addEventListener(
            "click",
            () => {

                generateReportPack(
                    ["pdf"]
                );
            }
        );


    document
        .getElementById(
            "rp-generate-excel"
        )
        ?.addEventListener(
            "click",
            () => {

                generateReportPack(
                    ["xlsx"]
                );
            }
        );


    document
        .getElementById(
            "rp-generate-both"
        )
        ?.addEventListener(
            "click",
            () => {

                generateReportPack(
                    [
                        "pdf",
                        "xlsx"
                    ]
                );
            }
        );


    document
        .getElementById(
            "rp-refresh-history"
        )
        ?.addEventListener(
            "click",
            loadReportPackHistory
        );
}


/* ============================================================
   INITIALISE
   ============================================================ */

async function initialiseReportPackUI() {

    if (
        reportPackInitialised
    ) {
        return;
    }

    reportPackInitialised =
        true;


    installReportPackStyles();

    installReportPackPage();

    installReportPackNavigation();

    initialiseReportPackEvents();


    try {

        await loadReportPackProjects();

        await loadReportPackPeriods();

        await loadReportPackPreview();

        await loadReportPackHistory();

    } catch (error) {

        console.error(
            "Report Pack UI failed:",
            error
        );


        setReportPackFeedback(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   DOM READY
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initialiseReportPackUI();

    }
);
