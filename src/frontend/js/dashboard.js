/* ============================================================
   CONTROLSIGHT
   Project Controls Intelligence Platform
   Dashboard v1.1
   ============================================================ */

const API_BASE = "/api";

let selectedProjectCode = null;


/* ============================================================
   HELPERS
   ============================================================ */

function isAvailable(value) {
    return (
        value !== null &&
        value !== undefined &&
        value !== ""
    );
}


function numericValue(value) {

    if (!isAvailable(value)) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}


function displayValue(value) {

    return isAvailable(value)
        ? String(value)
        : "—";
}


function escapeHtml(value) {

    if (!isAvailable(value)) {
        return "—";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* ============================================================
   FORMATTERS
   ============================================================ */

function formatCurrency(value) {

    const number = numericValue(value);

    if (number === null) {
        return "—";
    }

    const absolute = Math.abs(number);

    const sign =
        number < 0
            ? "-"
            : "";

    if (absolute >= 1_000_000_000) {

        const billions =
            absolute / 1_000_000_000;

        return `${sign}£${billions.toFixed(
            billions >= 10 ? 0 : 1
        )}bn`;
    }


    if (absolute >= 1_000_000) {

        const millions =
            absolute / 1_000_000;

        return `${sign}£${millions.toFixed(
            millions >= 10 ? 1 : 1
        )}m`;
    }


    if (absolute >= 1_000) {

        const thousands =
            absolute / 1_000;

        return `${sign}£${thousands.toFixed(
            thousands >= 10 ? 0 : 1
        )}k`;
    }


    return `${sign}£${absolute.toFixed(0)}`;
}


function formatPercentage(value) {

    const number = numericValue(value);

    if (number === null) {
        return "—";
    }

    return `${number.toFixed(1)}%`;
}


function formatPercentagePoints(value) {

    const number = numericValue(value);

    if (number === null) {
        return "—";
    }

    const sign =
        number > 0
            ? "+"
            : "";

    return `${sign}${number.toFixed(1)} pp`;
}


function formatValidationRate(value) {

    const number = numericValue(value);

    if (number === null) {
        return "—";
    }

    return `${number.toFixed(2)}%`;
}


function formatInteger(value) {

    const number = numericValue(value);

    if (number === null) {
        return "—";
    }

    return Math.round(number)
        .toLocaleString("en-GB");
}


function formatAxisCurrency(value) {

    const number = numericValue(value);

    if (number === null) {
        return "—";
    }

    const absolute =
        Math.abs(number);


    if (absolute >= 1_000_000_000) {

        return `£${(
            number / 1_000_000_000
        ).toFixed(1)}bn`;
    }


    if (absolute >= 1_000_000) {

        return `£${(
            number / 1_000_000
        ).toFixed(0)}m`;
    }


    if (absolute >= 1_000) {

        return `£${(
            number / 1_000
        ).toFixed(0)}k`;
    }


    return `£${number.toFixed(0)}`;
}


function getMetricClass(value) {

    const number =
        numericValue(value);

    if (number === null) {
        return "neutral";
    }

    if (number < 0) {
        return "negative";
    }

    if (number > 0) {
        return "positive";
    }

    return "neutral";
}


/* ============================================================
   API HELPER
   ============================================================ */

async function fetchJson(url) {

    const response =
        await fetch(url);

    if (!response.ok) {

        throw new Error(
            `API request failed: ${response.status}`
        );
    }

    return response.json();
}


/* ============================================================
   NAVIGATION
   ============================================================ */


/*
 * Original ControlSight was designed as one long scrolling page.
 *
 * This navigation controller converts the existing sections into
 * proper application views while preserving the existing project
 * selection and project-control behaviour.
 */


const PROJECT_SUB_TARGETS =
    new Set([
        "#cost-performance",
        "#schedule-risk-panel",
        "#procurement-risk-panel"
    ]);


const CORE_VIEW_TARGETS =
    new Set([
        "#portfolio-overview",
        "#project-portfolio",
        "#project-detail",
        "#data-quality"
    ]);


/* ------------------------------------------------------------
   ACTIVE SIDEBAR ITEM
   ------------------------------------------------------------ */

function setActiveNavigation(
    targetHash
) {

    document
        .querySelectorAll(
            ".sidebar-nav .nav-item"
        )
        .forEach(item => {

            const href =
                item.getAttribute(
                    "href"
                );


            /*
             * Cost / schedule / procurement live inside
             * Project Detail, but their own sidebar item
             * should still become active.
             */

            item.classList.toggle(
                "active",
                href === targetHash
            );

        });
}


/* ------------------------------------------------------------
   DISCOVER PRIMARY APPLICATION VIEWS
   ------------------------------------------------------------ */

function getPrimaryViewHashes() {

    const hashes =
        new Set(
            CORE_VIEW_TARGETS
        );


    document
        .querySelectorAll(
            '.sidebar-nav .nav-item[href^="#"]'
        )
        .forEach(item => {

            const href =
                item.getAttribute(
                    "href"
                );


            if (
                !href
                ||
                href === "#"
                ||
                PROJECT_SUB_TARGETS.has(
                    href
                )
            ) {
                return;
            }


            const target =
                document.querySelector(
                    href
                );


            if (target) {

                hashes.add(
                    href
                );
            }

        });


    return hashes;
}


/* ------------------------------------------------------------
   SHOW ONE PRIMARY VIEW
   ------------------------------------------------------------ */

function showPrimaryView(
    targetHash
) {

    const primaryViews =
        getPrimaryViewHashes();


    primaryViews.forEach(
        hash => {

            const element =
                document.querySelector(
                    hash
                );


            if (!element) {
                return;
            }


            const shouldShow =
                hash === targetHash;


            element.classList.toggle(
                "hidden",
                !shouldShow
            );


            element.style.display =
                shouldShow
                    ? ""
                    : "none";


            element.setAttribute(
                "aria-hidden",
                shouldShow
                    ? "false"
                    : "true"
            );

        });
}


/* ------------------------------------------------------------
   PROJECT SELECTION MESSAGE
   ------------------------------------------------------------ */

function showProjectSelectionPrompt() {

    const existing =
        document.getElementById(
            "project-selection-prompt"
        );


    if (existing) {
        existing.remove();
    }


    const portfolio =
        document.getElementById(
            "project-portfolio"
        );


    if (!portfolio) {
        return;
    }


    const prompt =
        document.createElement(
            "div"
        );


    prompt.id =
        "project-selection-prompt";


    prompt.className =
        "project-selection-prompt";


    prompt.innerHTML = `

        <div>

            <strong>
                Select a project first
            </strong>

            <span>
                Choose a project from the portfolio
                to open detailed cost, schedule and
                procurement controls.
            </span>

        </div>

        <button
            type="button"
            aria-label="Dismiss"
        >
            ×
        </button>

    `;


    portfolio.prepend(
        prompt
    );


    prompt
        .querySelector(
            "button"
        )
        ?.addEventListener(
            "click",
            () =>
                prompt.remove()
        );


    window.setTimeout(
        () => {

            if (
                document.body.contains(
                    prompt
                )
            ) {

                prompt.remove();
            }

        },
        5000
    );
}


/* ------------------------------------------------------------
   PROJECT SUB-VIEWS
   ------------------------------------------------------------ */

function showProjectControlView(
    targetHash
) {

    showPrimaryView(
        "#project-detail"
    );


    /*
     * Project detail content is rendered dynamically.
     * Give the browser one frame before scrolling.
     */

    window.requestAnimationFrame(
        () => {

            const target =
                document.querySelector(
                    targetHash
                );


            target
                ?.scrollIntoView({
                    behavior:
                        "smooth",

                    block:
                        "start"
                });

        }
    );
}


/* ------------------------------------------------------------
   NAVIGATE
   ------------------------------------------------------------ */

function navigateToHash(
    targetHash,
    options = {}
) {

    const {
        updateHash = true,
        scroll = true
    } = options;


    if (
        !targetHash
        ||
        targetHash === "#"
    ) {

        targetHash =
            "#portfolio-overview";
    }


    /*
     * Project-only controls require a selected project.
     */

    if (
        (
            targetHash ===
                "#project-detail"
            ||
            PROJECT_SUB_TARGETS.has(
                targetHash
            )
        )
        &&
        !selectedProjectCode
    ) {

        showPrimaryView(
            "#project-portfolio"
        );


        setActiveNavigation(
            "#project-portfolio"
        );


        if (updateHash) {

            history.replaceState(
                null,
                "",
                "#project-portfolio"
            );
        }


        showProjectSelectionPrompt();


        if (scroll) {

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        }


        return;
    }


    /*
     * Cost / Schedule / Procurement panels live inside
     * Project Detail rather than being separate top-level
     * sections.
     */

    if (
        PROJECT_SUB_TARGETS.has(
            targetHash
        )
    ) {

        showProjectControlView(
            targetHash
        );


        setActiveNavigation(
            targetHash
        );


        if (updateHash) {

            history.replaceState(
                null,
                "",
                targetHash
            );
        }


        return;
    }


    /*
     * Standard top-level application page.
     */

    const target =
        document.querySelector(
            targetHash
        );


    if (!target) {

        console.warn(
            "Navigation target not found:",
            targetHash
        );


        return;
    }


    showPrimaryView(
        targetHash
    );


    setActiveNavigation(
        targetHash
    );


    if (updateHash) {

        history.replaceState(
            null,
            "",
            targetHash
        );
    }


    if (scroll) {

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }
}


/* ------------------------------------------------------------
   INITIALISE NAVIGATION
   ------------------------------------------------------------ */

function initialiseNavigation() {

    const nav =
        document.querySelector(
            ".sidebar-nav"
        );


    if (!nav) {

        console.warn(
            "ControlSight navigation not found."
        );

        return;
    }


    /*
     * Event delegation is intentional.
     *
     * Additional ControlSight modules add sidebar links
     * dynamically after dashboard.js has loaded.
     */

    nav.addEventListener(
        "click",
        event => {

            const item =
                event.target.closest(
                    ".nav-item"
                );


            if (!item) {
                return;
            }


            const href =
                item.getAttribute(
                    "href"
                );


            if (
                !href
                ||
                href === "#"
            ) {
                return;
            }


            /*
             * Only take over navigation when the requested
             * element actually exists or is one of the known
             * dynamically rendered project-control panels.
             */

            if (
                !document.querySelector(
                    href
                )
                &&
                !PROJECT_SUB_TARGETS.has(
                    href
                )
            ) {

                return;
            }


            event.preventDefault();


            navigateToHash(
                href,
                {
                    updateHash:
                        true,

                    scroll:
                        true
                }
            );

        }
    );


    /*
     * Browser Back / Forward support.
     */

    window.addEventListener(
        "hashchange",
        () => {

            const hash =
                window.location.hash
                ||
                "#portfolio-overview";


            navigateToHash(
                hash,
                {
                    updateHash:
                        false,

                    scroll:
                        false
                }
            );

        }
    );


    /*
     * Initial page.
     */

    const initialHash =
        window.location.hash
        ||
        "#portfolio-overview";


    const initialExists =
        document.querySelector(
            initialHash
        )
        ||
        PROJECT_SUB_TARGETS.has(
            initialHash
        );


    navigateToHash(
        initialExists
            ? initialHash
            : "#portfolio-overview",
        {
            updateHash:
                !initialExists,

            scroll:
                false
        }
    );
}




/* ============================================================
   PORTFOLIO KPIs
   ============================================================ */

async function loadPortfolioKPIs() {

    const container =
        document.getElementById(
            "portfolio-kpis"
        );


    if (!container) {
        return;
    }


    try {

        const data =
            await fetchJson(
                `${API_BASE}/kpis`
            );


        const forecastVariance =
            numericValue(
                data.forecast_variance
            );


        const actualProgress =
            numericValue(
                data.actual_progress_pct
            );


        const plannedProgress =
            numericValue(
                data.planned_progress_pct
            );


        const progressVariance =
            actualProgress -
            plannedProgress;


        const isOverrun =
            forecastVariance < 0;


        const forecastExposure =
            Math.abs(
                forecastVariance
            );


        const forecastLabel =
            isOverrun
                ? "Forecast Overrun"
                : "Forecast Saving";


        const forecastNote =
            isOverrun
                ? "FAC above budget"
                : "FAC below budget";


        const forecastClass =
            isOverrun
                ? "metric-negative"
                : "metric-positive";


        const progressClass =
            getMetricClass(
                progressVariance
            );


        container.innerHTML = `

            <div class="kpi-card kpi-card-primary">

                <span class="kpi-label">
                    Portfolio Budget
                </span>

                <strong class="kpi-value">
                    ${formatCurrency(
                        data.total_budget
                    )}
                </strong>

                <span class="kpi-supporting-text">
                    Approved portfolio budget
                </span>

            </div>


            <div class="kpi-card kpi-card-primary">

                <span class="kpi-label">
                    Forecast at Completion
                </span>

                <strong class="kpi-value">
                    ${formatCurrency(
                        data.forecast_at_completion
                    )}
                </strong>

                <span class="kpi-supporting-text">
                    Current forecast completion cost
                </span>

            </div>


            <div class="kpi-card kpi-card-primary">

                <span class="kpi-label">
                    ${forecastLabel}
                </span>

                <strong
                    class="
                        kpi-value
                        ${forecastClass}
                    "
                >
                    ${formatCurrency(
                        forecastExposure
                    )}
                </strong>

                <span class="kpi-supporting-text">
                    ${forecastNote}
                </span>

            </div>


            <div class="kpi-card kpi-card-primary">

                <span class="kpi-label">
                    Progress vs Plan
                </span>

                <strong class="kpi-value">
                    ${formatPercentage(
                        actualProgress
                    )}
                </strong>

                <span class="
                    kpi-supporting-text
                    ${progressClass}
                ">
                    ${formatPercentage(
                        plannedProgress
                    )}
                    planned
                    ·
                    ${formatPercentagePoints(
                        progressVariance
                    )}
                </span>

            </div>

        `;


    } catch (error) {

        console.error(
            "Unable to load portfolio KPIs:",
            error
        );


        container.innerHTML = `

            <div class="intelligence-error">
                Unable to load portfolio performance.
            </div>

        `;
    }
}




/* ============================================================
   MANAGEMENT ATTENTION
   ============================================================ */

function attentionComponentHtml(
    label,
    component
) {

    if (!component) {

        return `
            <div class="attention-component">
                <span>${label}</span>
                <strong>—</strong>
            </div>
        `;
    }


    return `

        <div class="attention-component">

            <span>
                ${label}
            </span>

            <strong>
                ${formatInteger(
                    component.score
                )}
                /
                ${formatInteger(
                    component.maximum
                )}
            </strong>

        </div>

    `;
}


async function loadPortfolioAttention() {

    const container =
        document.getElementById(
            "portfolio-attention"
        );

    if (!container) {
        return;
    }


    try {

        const data =
            await fetchJson(
                `${API_BASE}/portfolio/attention-ranking`
            );


        const projects =
            Array.isArray(
                data.projects
            )
                ? data.projects
                : [];


        const summary =
            data.summary || {};


        const methodology =
            data.scoring_methodology || {};


        const limits =
            methodology.component_limits || {};


        const methodologySummary =
            document.getElementById(
                "attention-methodology-summary"
            );


        if (methodologySummary) {

            methodologySummary.innerHTML = `

                <span>
                    Cost
                    <strong>
                        /${limits.cost ?? 30}
                    </strong>
                </span>

                <span>
                    Progress
                    <strong>
                        /${limits.progress ?? 25}
                    </strong>
                </span>

                <span>
                    Critical Schedule
                    <strong>
                        /${limits.critical_schedule ?? 25}
                    </strong>
                </span>

                <span>
                    Procurement
                    <strong>
                        /${limits.procurement ?? 15}
                    </strong>
                </span>

                <span>
                    Data Quality
                    <strong>
                        /${limits.data_quality ?? 5}
                    </strong>
                </span>

            `;
        }


        const topProjects =
            projects.slice(
                0,
                4
            );


        const cards =
            topProjects
                .map(project => {

                    const level =
                        String(
                            project.attention_level ||
                            "Stable"
                        ).toLowerCase();


                    const components =
                        project.score_components ||
                        {};


                    return `

                        <button
                            type="button"
                            class="
                                priority-project
                                ${level}
                            "
                            data-project-code="${escapeHtml(
                                project.project_code
                            )}"
                        >

                            <div class="priority-rank">

                                <span>
                                    Priority
                                </span>

                                <strong>
                                    #${displayValue(
                                        project.rank
                                    )}
                                </strong>

                            </div>


                            <div class="priority-project-main">

                                <div class="priority-project-heading">

                                    <div>

                                        <span class="priority-code">
                                            ${escapeHtml(
                                                project.project_code
                                            )}
                                        </span>

                                        <strong>
                                            ${escapeHtml(
                                                project.project_name
                                            )}
                                        </strong>

                                    </div>


                                    <span
                                        class="
                                            priority-level
                                            ${level}
                                        "
                                    >
                                        ${escapeHtml(
                                            project.attention_level
                                        )}
                                    </span>

                                </div>


                                <div class="priority-driver">

                                    <span>
                                        Primary Driver
                                    </span>

                                    <strong>
                                        ${escapeHtml(
                                            project.primary_driver
                                        )}
                                    </strong>

                                </div>


                                <div class="priority-metrics">

                                    <div>

                                        <span>
                                            Forecast Var.
                                        </span>

                                        <strong
                                            class="${getMetricClass(
                                                project.forecast_variance_pct
                                            )}"
                                        >
                                            ${formatPercentage(
                                                project.forecast_variance_pct
                                            )}
                                        </strong>

                                    </div>


                                    <div>

                                        <span>
                                            Progress Var.
                                        </span>

                                        <strong
                                            class="${getMetricClass(
                                                project.progress_variance_pct
                                            )}"
                                        >
                                            ${formatPercentagePoints(
                                                project.progress_variance_pct
                                            )}
                                        </strong>

                                    </div>


                                    <div>

                                        <span>
                                            Critical Schedule Delays
                                        </span>

                                        <strong>
                                            ${formatInteger(
                                                project
                                                    .critical_delayed_activities
                                            )}
                                        </strong>

                                    </div>


                                    <div>

                                        <span>
                                            Critical Procurement Delays
                                        </span>

                                        <strong>
                                            ${formatInteger(
                                                project
                                                    .critical_procurement_delays
                                            )}
                                        </strong>

                                    </div>

                                </div>


                                <div class="attention-component-grid">

                                    ${attentionComponentHtml(
                                        "Cost",
                                        components.cost
                                    )}

                                    ${attentionComponentHtml(
                                        "Progress",
                                        components.progress
                                    )}

                                    ${attentionComponentHtml(
                                        "Critical Schedule",
                                        components
                                            .critical_schedule
                                    )}

                                    ${attentionComponentHtml(
                                        "Procurement",
                                        components.procurement
                                    )}

                                    ${attentionComponentHtml(
                                        "Data Quality",
                                        components.data_quality
                                    )}

                                </div>

                            </div>


                            <div class="attention-score">

                                <span>
                                    Attention
                                </span>

                                <strong>
                                    ${formatInteger(
                                        project.attention_score
                                    )}
                                </strong>

                                <small>
                                    /
                                    ${formatInteger(
                                        project
                                            .attention_score_maximum ??
                                        methodology.maximum_score ??
                                        100
                                    )}
                                </small>

                            </div>

                        </button>

                    `;

                })
                .join("");


        container.innerHTML = `

            <div class="attention-summary">

                <div class="attention-summary-item critical">

                    <strong>
                        ${formatInteger(
                            summary.critical_projects
                        )}
                    </strong>

                    <span>
                        Critical
                    </span>

                </div>


                <div class="attention-summary-item watch">

                    <strong>
                        ${formatInteger(
                            summary.watch_projects
                        )}
                    </strong>

                    <span>
                        Watch
                    </span>

                </div>


                <div class="attention-summary-item review">

                    <strong>
                        ${formatInteger(
                            summary.review_projects
                        )}
                    </strong>

                    <span>
                        Review
                    </span>

                </div>


                <div class="attention-summary-item stable">

                    <strong>
                        ${formatInteger(
                            summary.stable_projects
                        )}
                    </strong>

                    <span>
                        Stable
                    </span>

                </div>

            </div>


            <div class="priority-list">
                ${cards}
            </div>


            <div class="attention-methodology">

                <div>

                    <span>
                        Score Interpretation
                    </span>

                    <p>
                        The score is a deterministic
                        management-prioritisation index.
                        Cost and progress include a
                        1% / 1 percentage-point deadband
                        to prevent immaterial movements
                        from generating risk points.
                    </p>

                </div>


                <strong>
                    Not a probability of project failure
                </strong>

            </div>

        `;


        document
            .querySelectorAll(
                ".priority-project"
            )
            .forEach(card => {

                card.addEventListener(
                    "click",
                    async () => {

                        const projectCode =
                            card.dataset
                                .projectCode;

                        selectedProjectCode =
                            projectCode;

                        highlightSelectedProject(
                            projectCode
                        );

                        await loadProjectOverview(
                            projectCode
                        );

                    }
                );

            });

    } catch (error) {

        console.error(
            "Unable to load attention ranking:",
            error
        );


        container.innerHTML = `

            <div class="intelligence-error">
                Unable to load portfolio management priorities.
            </div>

        `;
    }
}


/* ============================================================
   PROJECT PORTFOLIO
   ============================================================ */

async function loadProjects() {

    const container =
        document.getElementById(
            "project-portfolio"
        );

    if (!container) {
        return;
    }


    try {

        const projects =
            await fetchJson(
                `${API_BASE}/projects`
            );


        container.innerHTML = `

            <div class="section-header">

                <div>

                    <h2>
                        Project Portfolio
                    </h2>

                    <p>
                        Cost, progress and performance status
                        across active projects.
                    </p>

                </div>


                <div
                    id="project-count"
                    class="project-count"
                >
                    ${projects.length} Projects
                </div>

            </div>


            <div class="portfolio-controls">

                <div class="project-search">

                    <span class="search-icon">
                        ⌕
                    </span>

                    <input
                        id="project-search-input"
                        type="search"
                        placeholder="Search project or code..."
                        autocomplete="off"
                    >

                </div>


                <div class="status-filters">

                    <button
                        type="button"
                        class="status-filter active"
                        data-status="All"
                    >
                        All
                    </button>

                    <button
                        type="button"
                        class="status-filter"
                        data-status="Green"
                    >
                        <span class="filter-dot green"></span>
                        Green
                    </button>

                    <button
                        type="button"
                        class="status-filter"
                        data-status="Amber"
                    >
                        <span class="filter-dot amber"></span>
                        Amber
                    </button>

                    <button
                        type="button"
                        class="status-filter"
                        data-status="Red"
                    >
                        <span class="filter-dot red"></span>
                        Red
                    </button>

                </div>

            </div>


            <div class="table-container">

                <table>

                    <thead>

                        <tr>

                            <th>Project</th>

                            <th>Project Name</th>

                            <th>Budget</th>

                            <th>Actual Cost</th>

                            <th>FAC</th>

                            <th>
                                Forecast Variance
                                <small>
                                    Budget − FAC
                                </small>
                            </th>

                            <th>
                                Progress
                            </th>

                            <th>
                                Progress Variance
                            </th>

                            <th>
                                Performance Status
                            </th>

                        </tr>

                    </thead>

                    <tbody
                        id="project-table-body"
                    ></tbody>

                </table>

            </div>

        `;


        const tbody =
            document.getElementById(
                "project-table-body"
            );


        const searchInput =
            document.getElementById(
                "project-search-input"
            );


        const filterButtons =
            document.querySelectorAll(
                ".status-filter"
            );


        let activeStatus =
            "All";


        function renderProjects() {

            const searchTerm =
                String(
                    searchInput?.value || ""
                )
                    .trim()
                    .toLowerCase();


            const filtered =
                projects.filter(
                    project => {

                        const matchesSearch =
                            String(
                                project.project_code ||
                                ""
                            )
                                .toLowerCase()
                                .includes(
                                    searchTerm
                                ) ||

                            String(
                                project.project_name ||
                                ""
                            )
                                .toLowerCase()
                                .includes(
                                    searchTerm
                                );


                        const status =
                            String(
                                project.health_status ||
                                "Unavailable"
                            );


                        const matchesStatus =
                            activeStatus ===
                                "All" ||

                            status.toLowerCase() ===
                                activeStatus
                                    .toLowerCase();


                        return (
                            matchesSearch &&
                            matchesStatus
                        );

                    }
                );


            document
                .getElementById(
                    "project-count"
                )
                .textContent =

                `${filtered.length} ${
                    filtered.length === 1
                        ? "Project"
                        : "Projects"
                }`;


            if (!filtered.length) {

                tbody.innerHTML = `

                    <tr>

                        <td
                            colspan="9"
                            class="no-project-results"
                        >
                            No projects match the
                            selected filters.
                        </td>

                    </tr>

                `;

                return;
            }


            tbody.innerHTML =
                filtered
                    .map(project => {

                        const status =
                            String(
                                project.health_status ||
                                "Unavailable"
                            );


                        const statusClass =
                            status.toLowerCase();


                        const selectedClass =
                            selectedProjectCode ===
                                project.project_code
                                ? "selected"
                                : "";


                        return `

                            <tr
                                class="
                                    project-row
                                    ${selectedClass}
                                "
                                data-project-code="${escapeHtml(
                                    project.project_code
                                )}"
                            >

                                <td>
                                    <strong>
                                        ${escapeHtml(
                                            project.project_code
                                        )}
                                    </strong>
                                </td>


                                <td>
                                    ${escapeHtml(
                                        project.project_name
                                    )}
                                </td>


                                <td>
                                    ${formatCurrency(
                                        project.approved_budget
                                    )}
                                </td>


                                <td>
                                    ${formatCurrency(
                                        project.actual_cost_to_date
                                    )}
                                </td>


                                <td>
                                    ${formatCurrency(
                                        project.forecast_at_completion
                                    )}
                                </td>


                                <td
                                    class="${getMetricClass(
                                        project.forecast_variance
                                    )}"
                                >
                                    ${formatCurrency(
                                        project.forecast_variance
                                    )}
                                </td>


                                <td>
                                    ${formatPercentage(
                                        project.actual_progress_pct
                                    )}
                                </td>


                                <td
                                    class="${getMetricClass(
                                        project.progress_variance_pct
                                    )}"
                                >
                                    ${formatPercentagePoints(
                                        project.progress_variance_pct
                                    )}
                                </td>


                                <td>

                                    <span
                                        class="
                                            status-badge
                                            ${statusClass}
                                        "
                                    >
                                        ${escapeHtml(
                                            status
                                        )}
                                    </span>

                                </td>

                            </tr>

                        `;

                    })
                    .join("");


            document
                .querySelectorAll(
                    ".project-row"
                )
                .forEach(row => {

                    row.addEventListener(
                        "click",
                        async () => {

                            const projectCode =
                                row.dataset
                                    .projectCode;


                            selectedProjectCode =
                                projectCode;


                            highlightSelectedProject(
                                projectCode
                            );


                            await loadProjectOverview(
                                projectCode
                            );

                        }
                    );

                });
        }


        searchInput?.addEventListener(
            "input",
            renderProjects
        );


        filterButtons.forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        filterButtons
                            .forEach(
                                item =>
                                    item.classList
                                        .remove(
                                            "active"
                                        )
                            );


                        button.classList.add(
                            "active"
                        );


                        activeStatus =
                            button.dataset
                                .status;


                        renderProjects();

                    }
                );

            }
        );


        renderProjects();

    } catch (error) {

        console.error(
            "Unable to load projects:",
            error
        );


        container.innerHTML = `

            <div class="intelligence-error">
                Unable to load project portfolio.
            </div>

        `;
    }
}


function highlightSelectedProject(
    projectCode
) {

    document
        .querySelectorAll(
            ".project-row"
        )
        .forEach(row => {

            row.classList.toggle(
                "selected",
                row.dataset.projectCode ===
                    projectCode
            );

        });
}


/* ============================================================
   PROJECT OVERVIEW
   ============================================================ */

async function loadProjectOverview(
    projectCode
) {

    const container =
        document.getElementById(
            "project-detail"
        );

    if (!container) {
        return;
    }


    try {

        const data =
            await fetchJson(
                `${API_BASE}/projects/${projectCode}/overview`
            );


        const project =
            data.project || {};


        const schedule =
            data.schedule || {};


        const quality =
            data.data_quality || {};


        const status =
            String(
                project.health_status ||
                project.management_status ||
                "Unavailable"
            );


        container.classList.remove(
            "hidden"
        );


        container.innerHTML = `

            <div class="section-header project-detail-header">

                <div>

                    <span class="project-code">
                        ${escapeHtml(
                            project.project_code
                        )}
                    </span>

                    <h2>
                        ${escapeHtml(
                            project.project_name
                        )}
                    </h2>

                    <p>
                        Executive project performance overview.
                    </p>

                </div>


                <div class="project-status-display">

                    <span>
                        Performance Status
                    </span>

                    <span
                        class="
                            status-badge
                            ${status.toLowerCase()}
                        "
                    >
                        ${escapeHtml(
                            status
                        )}
                    </span>

                </div>

            </div>


            <div class="detail-grid">

                <div class="detail-card">
                    <span>
                        Approved Budget
                    </span>
                    <strong>
                        ${formatCurrency(
                            project.approved_budget
                        )}
                    </strong>
                </div>


                <div class="detail-card">
                    <span>
                        Actual Cost
                    </span>
                    <strong>
                        ${formatCurrency(
                            project.actual_cost_to_date
                        )}
                    </strong>
                </div>


                <div class="detail-card">
                    <span>
                        Forecast at Completion
                    </span>
                    <strong>
                        ${formatCurrency(
                            project.forecast_at_completion
                        )}
                    </strong>
                </div>


                <div class="detail-card">

                    <span>
                        Forecast Variance
                        <small>
                            Budget − FAC
                        </small>
                    </span>

                    <strong
                        class="${getMetricClass(
                            project.forecast_variance
                        )}"
                    >
                        ${formatCurrency(
                            project.forecast_variance
                        )}
                    </strong>

                </div>


                <div class="detail-card">
                    <span>
                        Planned Progress
                    </span>
                    <strong>
                        ${formatPercentage(
                            project.planned_progress_pct
                        )}
                    </strong>
                </div>


                <div class="detail-card">
                    <span>
                        Actual Progress
                    </span>
                    <strong>
                        ${formatPercentage(
                            project.actual_progress_pct
                        )}
                    </strong>
                </div>


                <div class="detail-card">
                    <span>
                        Progress Variance
                    </span>
                    <strong
                        class="${getMetricClass(
                            project.progress_variance_pct
                        )}"
                    >
                        ${formatPercentagePoints(
                            project.progress_variance_pct
                        )}
                    </strong>
                </div>


                <div class="detail-card">
                    <span>
                        Delayed Activities
                    </span>
                    <strong>
                        ${formatInteger(
                            schedule.delayed_activities
                        )}
                    </strong>
                </div>


                <div class="detail-card">
                    <span>
                        Critical Schedule Delays
                    </span>
                    <strong>
                        ${formatInteger(
                            schedule
                                .critical_delayed_activities
                        )}
                    </strong>
                </div>

            </div>


            <div class="intelligence-section">

                <div
                    id="management-insights"
                    class="intelligence-panel"
                >
                    <div class="chart-loading">
                        Analysing project performance...
                    </div>
                </div>

            </div>


            <div
                id="cost-performance"
                class="chart-section"
            >

                <div class="chart-header">

                    <div>

                        <h3>
                            Cost Performance
                        </h3>

                        <p>
                            Cumulative planned vs actual
                            expenditure.
                        </p>

                    </div>

                </div>


                <div
                    id="cost-chart"
                    class="chart-container"
                >
                    <div class="chart-loading">
                        Loading cost performance...
                    </div>
                </div>

            </div>


            <div class="chart-section">

                <div class="chart-header">

                    <div>

                        <h3>
                            Progress S-Curve
                        </h3>

                        <p>
                            Planned vs actual project progress.
                        </p>

                    </div>

                </div>


                <div
                    id="progress-chart"
                    class="chart-container"
                >
                    <div class="chart-loading">
                        Loading progress performance...
                    </div>
                </div>

            </div>


            <div class="risk-section">

                <div class="chart-header">

                    <div>

                        <h3>
                            Risk Intelligence
                        </h3>

                        <p>
                            Schedule and procurement risks
                            requiring management attention.
                        </p>

                    </div>

                </div>


                <div class="risk-grid">

                    <div
                        id="schedule-risk-panel"
                        class="risk-panel"
                    >
                        <div class="chart-loading">
                            Loading schedule risk...
                        </div>
                    </div>


                    <div
                        id="procurement-risk-panel"
                        class="risk-panel"
                    >
                        <div class="chart-loading">
                            Loading procurement risk...
                        </div>
                    </div>

                </div>

            </div>


            ${
                Number(
                    quality.cost_anomalies || 0
                ) > 0

                    ? `

                        <div class="quality-alert">

                            <strong>
                                Data Quality Alert
                            </strong>

                            <span>

                                ${formatInteger(
                                    quality.cost_anomalies
                                )}

                                retained cost anomaly
                                ${Number(
                                    quality.cost_anomalies
                                ) === 1
                                    ? "requires"
                                    : "records require"
                                }

                                review before relying on
                                reported cost performance.

                            </span>

                        </div>

                    `

                    : ""
            }

        `;


        await Promise.all([
            loadManagementInsights(
                projectCode
            ),
            loadCostTrend(
                projectCode
            ),
            loadProgressTrend(
                projectCode
            ),
            loadScheduleRisk(
                projectCode
            ),
            loadProcurementRisk(
                projectCode
            )
        ]);


        window.history.replaceState(
            null,
            "",
            "#project-detail"
        );


        setActiveNavigation(
            "#project-detail"
        );


        container.scrollIntoView({
            behavior:
                "smooth",
            block:
                "start"
        });

    } catch (error) {

        console.error(
            "Unable to load project overview:",
            error
        );


        container.classList.remove(
            "hidden"
        );


        container.innerHTML = `

            <div class="intelligence-error">
                Unable to load selected project.
            </div>

        `;
    }
}


/* ============================================================
   MANAGEMENT INSIGHTS
   ============================================================ */

async function loadManagementInsights(
    projectCode
) {

    const container =
        document.getElementById(
            "management-insights"
        );

    if (!container) {
        return;
    }


    try {

        const data =
            await fetchJson(
                `${API_BASE}/projects/${projectCode}/management-insights`
            );


        const attentionLevel =
            String(
                data.attention_level ||
                "Stable"
            );


        const insights =
            Array.isArray(
                data.insights
            )
                ? data.insights
                : [];


        const insightCards =
            insights.length

                ? insights
                    .map(insight => {

                        const severity =
                            String(
                                insight.severity ||
                                "stable"
                            )
                                .toLowerCase();


                        return `

                            <div
                                class="
                                    insight-card
                                    ${severity}
                                "
                            >

                                <div class="insight-indicator"></div>


                                <div class="insight-content">

                                    <div class="insight-meta">

                                        <span>
                                            ${escapeHtml(
                                                insight.category
                                            )}
                                        </span>

                                        <span
                                            class="
                                                insight-severity
                                                ${severity}
                                            "
                                        >
                                            ${escapeHtml(
                                                insight.severity
                                            )}
                                        </span>

                                    </div>


                                    <strong>
                                        ${escapeHtml(
                                            insight.title
                                        )}
                                    </strong>


                                    <p>
                                        ${escapeHtml(
                                            insight.message
                                        )}
                                    </p>

                                </div>

                            </div>

                        `;

                    })
                    .join("")

                : `

                    <div class="intelligence-empty">
                        No material management exceptions identified.
                    </div>

                `;


        container.innerHTML = `

            <div class="intelligence-header">

                <div>

                    <span class="section-eyebrow">
                        Exception Analytics
                    </span>

                    <h3>
                        Executive Intelligence
                    </h3>

                    <p>
                        Deterministic rules-based
                        interpretation of cost, schedule,
                        procurement and data-quality
                        indicators.
                    </p>

                </div>


                <div
                    class="
                        attention-badge
                        ${attentionLevel.toLowerCase()}
                    "
                >

                    <span>
                        Management Attention
                    </span>

                    <strong>
                        ${escapeHtml(
                            attentionLevel
                        )}
                    </strong>

                </div>

            </div>


            <div class="executive-summary">

                <div class="summary-icon">
                    !
                </div>

                <div>

                    <span>
                        Management Summary
                    </span>

                    <strong>
                        ${escapeHtml(
                            data.executive_summary ||
                            "No management summary available."
                        )}
                    </strong>

                </div>

            </div>


            <div class="insight-grid">
                ${insightCards}
            </div>


            <div class="intelligence-footer">

                <span>
                    ${insights.length}
                    ${
                        insights.length === 1
                            ? "exception"
                            : "exceptions"
                    }
                    identified
                </span>

                <span>
                    Rules-based project controls analysis
                </span>

            </div>

        `;

    } catch (error) {

        console.error(
            "Unable to load management insights:",
            error
        );


        container.innerHTML = `

            <div class="intelligence-error">
                Unable to generate management insights.
            </div>

        `;
    }
}


/* ============================================================
   GENERIC SVG LINE CHART
   ============================================================ */

function createLinePath(
    rows,
    key,
    xScale,
    yScale
) {

    return rows
        .map(
            (row, index) => {

                const value =
                    numericValue(
                        row[key]
                    );

                if (value === null) {
                    return "";
                }

                return `${index === 0 ? "M" : "L"} ` +
                    `${xScale(index).toFixed(2)} ` +
                    `${yScale(value).toFixed(2)}`;
            }
        )
        .filter(Boolean)
        .join(" ");
}


/* ============================================================
   COST TREND
   ============================================================ */

async function loadCostTrend(
    projectCode
) {

    const container =
        document.getElementById(
            "cost-chart"
        );

    if (!container) {
        return;
    }


    try {

        const data =
            await fetchJson(
                `${API_BASE}/projects/${projectCode}/cost-trend`
            );


        const rows =
            Array.isArray(
                data.cost_trend
            )
                ? data.cost_trend
                : [];


        if (!rows.length) {

            container.innerHTML = `
                <div class="chart-loading">
                    No cost performance data available.
                </div>
            `;

            return;
        }


        const trend =
            rows.map(
                row => ({
                    date:
                        row.date,
                    yearMonth:
                        row.year_month,
                    planned:
                        numericValue(
                            row.cumulative_planned_cost
                        ),
                    actual:
                        numericValue(
                            row.cumulative_actual_cost
                        ),
                    committed:
                        numericValue(
                            row.cumulative_committed_cost
                        ),
                    forecast:
                        numericValue(
                            row.forecast_at_completion
                        ),
                    anomalyCount:
                        numericValue(
                            row.anomaly_count
                        ) || 0
                })
            );


        const width =
            1000;

        const height =
            340;

        const margin = {
            top:
                32,
            right:
                28,
            bottom:
                48,
            left:
                74
        };


        const chartWidth =
            width -
            margin.left -
            margin.right;


        const chartHeight =
            height -
            margin.top -
            margin.bottom;


        const values =
            trend
                .flatMap(
                    row => [
                        row.planned,
                        row.actual,
                        row.committed
                    ]
                )
                .filter(
                    value =>
                        value !== null
                );


        const maximumValue =
            Math.max(
                ...values,
                1
            ) * 1.08;


        const xScale =
            index => {

                if (trend.length === 1) {

                    return (
                        margin.left +
                        chartWidth / 2
                    );
                }

                return (
                    margin.left +
                    (
                        index /
                        (
                            trend.length - 1
                        )
                    ) *
                    chartWidth
                );
            };


        const yScale =
            value => (

                margin.top +
                chartHeight -
                (
                    value /
                    maximumValue
                ) *
                chartHeight

            );


        const plannedPath =
            createLinePath(
                trend,
                "planned",
                xScale,
                yScale
            );


        const actualPath =
            createLinePath(
                trend,
                "actual",
                xScale,
                yScale
            );


        const committedPath =
            createLinePath(
                trend,
                "committed",
                xScale,
                yScale
            );


        const yTicks =
            [0, 1, 2, 3, 4];


        const grid =
            yTicks
                .map(index => {

                    const ratio =
                        index / 4;

                    const value =
                        maximumValue *
                        (
                            1 - ratio
                        );

                    const y =
                        margin.top +
                        chartHeight *
                        ratio;


                    return `

                        <g>

                            <line
                                x1="${margin.left}"
                                y1="${y}"
                                x2="${width - margin.right}"
                                y2="${y}"
                                class="chart-grid-line"
                            ></line>

                            <text
                                x="${margin.left - 12}"
                                y="${y + 3}"
                                text-anchor="end"
                                class="chart-axis-label"
                            >
                                ${formatAxisCurrency(
                                    value
                                )}
                            </text>

                        </g>

                    `;

                })
                .join("");


        const labelIndexes =
            trend.length === 1

                ? [0]

                : [
                    0,
                    Math.floor(
                        (
                            trend.length - 1
                        ) / 2
                    ),
                    trend.length - 1
                ];


        const xLabels =
            [
                ...new Set(
                    labelIndexes
                )
            ]
                .map(index => {

                    const row =
                        trend[index];

                    return `

                        <text
                            x="${xScale(index)}"
                            y="${height - 14}"
                            text-anchor="middle"
                            class="chart-axis-label"
                        >
                            ${escapeHtml(
                                row.yearMonth ||
                                row.date
                            )}
                        </text>

                    `;

                })
                .join("");


        const anomalyMarkers =
            trend
                .map(
                    (row, index) => {

                        if (
                            row.anomalyCount <= 0 ||
                            row.actual === null
                        ) {
                            return "";
                        }


                        return `

                            <g>

                                <circle
                                    cx="${xScale(index)}"
                                    cy="${yScale(
                                        row.actual
                                    )}"
                                    r="6"
                                    class="anomaly-marker"
                                ></circle>

                                <title>
                                    ${escapeHtml(
                                        row.yearMonth ||
                                        row.date
                                    )}:
                                    ${row.anomalyCount}
                                    cost anomaly
                                </title>

                            </g>

                        `;

                    }
                )
                .join("");


        const latest =
            trend[
                trend.length - 1
            ];


        const variance =
            (
                latest.actual !== null &&
                latest.planned !== null
            )
                ? latest.actual -
                    latest.planned
                : null;


        container.innerHTML = `

            <div class="chart-summary">

                <div class="chart-legend">

                    <span>
                        <i class="legend-line planned"></i>
                        Planned
                    </span>

                    <span>
                        <i class="legend-line actual"></i>
                        Actual
                    </span>

                    <span>
                        <i class="legend-line committed"></i>
                        Committed
                    </span>

                    <span>
                        <i class="legend-dot anomaly"></i>
                        Data anomaly
                    </span>

                </div>


                <div class="progress-variance">

                    Latest Actual:

                    <strong>
                        ${formatCurrency(
                            latest.actual
                        )}
                    </strong>

                    <span class="metric-divider">
                        ·
                    </span>

                    Plan Variance:

                    <strong
                        class="${getMetricClass(
                            variance === null
                                ? null
                                : -variance
                        )}"
                    >
                        ${
                            variance !== null &&
                            variance > 0
                                ? "+"
                                : ""
                        }

                        ${formatCurrency(
                            variance
                        )}
                    </strong>

                </div>

            </div>


            <div class="svg-chart-wrapper">

                <svg
                    viewBox="0 0 ${width} ${height}"
                    class="cost-chart-svg"
                    role="img"
                    aria-label="Cumulative planned, actual and committed project cost"
                >

                    ${grid}
                    ${xLabels}

                    <path
                        d="${plannedPath}"
                        class="
                            chart-line
                            planned-line
                        "
                    ></path>

                    <path
                        d="${actualPath}"
                        class="
                            chart-line
                            actual-line
                        "
                    ></path>

                    <path
                        d="${committedPath}"
                        class="
                            chart-line
                            committed-line
                        "
                    ></path>

                    ${anomalyMarkers}

                </svg>

            </div>

        `;

    } catch (error) {

        console.error(
            "Unable to load cost trend:",
            error
        );


        container.innerHTML = `
            <div class="intelligence-error">
                Unable to load cost performance data.
            </div>
        `;
    }
}


/* ============================================================
   PROGRESS TREND
   ============================================================ */

async function loadProgressTrend(
    projectCode
) {

    const container =
        document.getElementById(
            "progress-chart"
        );

    if (!container) {
        return;
    }


    try {

        const data =
            await fetchJson(
                `${API_BASE}/projects/${projectCode}/progress-trend`
            );


        const rows =
            Array.isArray(
                data.progress_trend
            )
                ? data.progress_trend
                : [];


        if (!rows.length) {

            container.innerHTML = `
                <div class="chart-loading">
                    No progress data available.
                </div>
            `;

            return;
        }


        const trend =
            rows.map(
                row => ({
                    date:
                        row.date,
                    yearMonth:
                        row.year_month,
                    planned:
                        numericValue(
                            row.planned_progress_pct
                        ),
                    actual:
                        numericValue(
                            row.actual_progress_pct
                        ),
                    variance:
                        numericValue(
                            row.progress_variance_pct
                        )
                })
            );


        const width =
            1000;

        const height =
            320;

        const margin = {
            top:
                24,
            right:
                28,
            bottom:
                46,
            left:
                64
        };


        const chartWidth =
            width -
            margin.left -
            margin.right;


        const chartHeight =
            height -
            margin.top -
            margin.bottom;


        const xScale =
            index => {

                if (trend.length === 1) {

                    return (
                        margin.left +
                        chartWidth / 2
                    );
                }

                return (
                    margin.left +
                    (
                        index /
                        (
                            trend.length - 1
                        )
                    ) *
                    chartWidth
                );
            };


        const yScale =
            value => {

                const bounded =
                    Math.max(
                        0,
                        Math.min(
                            100,
                            value
                        )
                    );

                return (
                    margin.top +
                    chartHeight -
                    (
                        bounded / 100
                    ) *
                    chartHeight
                );
            };


        const plannedPath =
            createLinePath(
                trend,
                "planned",
                xScale,
                yScale
            );


        const actualPath =
            createLinePath(
                trend,
                "actual",
                xScale,
                yScale
            );


        const yGrid =
            [100, 75, 50, 25, 0]
                .map(value => {

                    const y =
                        yScale(
                            value
                        );

                    return `

                        <g>

                            <line
                                x1="${margin.left}"
                                y1="${y}"
                                x2="${width - margin.right}"
                                y2="${y}"
                                class="chart-grid-line"
                            ></line>

                            <text
                                x="${margin.left - 12}"
                                y="${y + 3}"
                                text-anchor="end"
                                class="chart-axis-label"
                            >
                                ${value}%
                            </text>

                        </g>

                    `;

                })
                .join("");


        const labelIndexes =
            trend.length === 1

                ? [0]

                : [
                    0,
                    Math.floor(
                        (
                            trend.length - 1
                        ) / 2
                    ),
                    trend.length - 1
                ];


        const xLabels =
            [
                ...new Set(
                    labelIndexes
                )
            ]
                .map(index => {

                    const row =
                        trend[index];

                    return `

                        <text
                            x="${xScale(index)}"
                            y="${height - 12}"
                            text-anchor="middle"
                            class="chart-axis-label"
                        >
                            ${escapeHtml(
                                row.yearMonth ||
                                row.date
                            )}
                        </text>

                    `;

                })
                .join("");


        const latest =
            trend[
                trend.length - 1
            ];


        container.innerHTML = `

            <div class="chart-summary">

                <div class="chart-legend">

                    <span>
                        <i class="legend-line progress-planned"></i>
                        Planned Progress
                    </span>

                    <span>
                        <i class="legend-line progress-actual"></i>
                        Actual Progress
                    </span>

                </div>


                <div class="progress-variance">

                    Latest Variance:

                    <strong
                        class="${getMetricClass(
                            latest.variance
                        )}"
                    >
                        ${formatPercentagePoints(
                            latest.variance
                        )}
                    </strong>

                </div>

            </div>


            <div class="svg-chart-wrapper">

                <svg
                    viewBox="0 0 ${width} ${height}"
                    class="cost-chart-svg"
                    role="img"
                    aria-label="Planned versus actual project progress"
                >

                    ${yGrid}
                    ${xLabels}

                    <path
                        d="${plannedPath}"
                        class="
                            chart-line
                            progress-planned-line
                        "
                    ></path>

                    <path
                        d="${actualPath}"
                        class="
                            chart-line
                            progress-actual-line
                        "
                    ></path>

                </svg>

            </div>

        `;

    } catch (error) {

        console.error(
            "Unable to load progress trend:",
            error
        );


        container.innerHTML = `
            <div class="intelligence-error">
                Unable to load progress performance.
            </div>
        `;
    }
}


/* ============================================================
   SCHEDULE RISK
   ============================================================ */

async function loadScheduleRisk(
    projectCode
) {

    const container =
        document.getElementById(
            "schedule-risk-panel"
        );

    if (!container) {
        return;
    }


    try {

        const data =
            await fetchJson(
                `${API_BASE}/projects/${projectCode}/schedule-risk`
            );


        const summary =
            data.summary || {};


        const activities =
            Array.isArray(
                data.activities
            )
                ? data.activities
                : [];


        const delayed =
            activities
                .filter(
                    activity =>
                        Number(
                            activity
                                .delayed_activity_flag
                        ) === 1
                )
                .slice(
                    0,
                    5
                );


        const rows =
            delayed.length

                ? delayed
                    .map(activity => {

                        const delayDays =
                            Math.max(
                                numericValue(
                                    activity
                                        .finish_delay_days
                                ) || 0,
                                numericValue(
                                    activity
                                        .start_delay_days
                                ) || 0
                            );


                        return `

                            <div class="risk-item">

                                <div class="risk-item-main">

                                    <strong>
                                        ${escapeHtml(
                                            activity.activity_name
                                        )}
                                    </strong>

                                    <span>
                                        ${escapeHtml(
                                            activity.discipline
                                        )}
                                    </span>

                                </div>


                                <div class="risk-item-meta">

                                    ${
                                        Number(
                                            activity.is_critical
                                        ) === 1

                                            ? `
                                                <span
                                                    class="
                                                        risk-tag
                                                        critical
                                                    "
                                                >
                                                    Critical
                                                </span>
                                            `

                                            : ""
                                    }

                                    <span>
                                        ${delayDays}d delay
                                    </span>

                                </div>

                            </div>

                        `;

                    })
                    .join("")

                : `
                    <div class="empty-risk">
                        No delayed schedule activities.
                    </div>
                `;


        container.innerHTML = `

            <div class="risk-panel-header">

                <div>

                    <span class="risk-eyebrow">
                        Schedule
                    </span>

                    <h4>
                        Schedule Risk
                    </h4>

                </div>

                <div class="risk-total">
                    ${formatInteger(
                        summary.delayed_activities
                    )}
                </div>

            </div>


            <div class="risk-stats">

                <div>
                    <span>
                        Total Activities
                    </span>
                    <strong>
                        ${formatInteger(
                            summary.total_activities
                        )}
                    </strong>
                </div>

                <div>
                    <span>
                        Critical
                    </span>
                    <strong>
                        ${formatInteger(
                            summary.critical_activities
                        )}
                    </strong>
                </div>

                <div>
                    <span>
                        Delayed
                    </span>
                    <strong>
                        ${formatInteger(
                            summary.delayed_activities
                        )}
                    </strong>
                </div>

                <div>
                    <span>
                        Critical + Delayed
                    </span>
                    <strong>
                        ${formatInteger(
                            summary
                                .critical_delayed_activities
                        )}
                    </strong>
                </div>

            </div>


            <div class="risk-list">

                <div class="risk-list-title">
                    Highest-priority delayed activities
                </div>

                ${rows}

            </div>

        `;

    } catch (error) {

        console.error(
            "Unable to load schedule risk:",
            error
        );


        container.innerHTML = `
            <div class="intelligence-error">
                Unable to load schedule risk.
            </div>
        `;
    }
}


/* ============================================================
   PROCUREMENT RISK
   ============================================================ */

async function loadProcurementRisk(
    projectCode
) {

    const container =
        document.getElementById(
            "procurement-risk-panel"
        );

    if (!container) {
        return;
    }


    try {

        const data =
            await fetchJson(
                `${API_BASE}/projects/${projectCode}/procurement-risk`
            );


        const summary =
            data.summary || {};


        const items =
            Array.isArray(
                data.procurement_items
            )
                ? data.procurement_items
                : [];


        const delayed =
            items
                .filter(
                    item =>
                        Number(
                            item
                                .delayed_delivery_flag
                        ) === 1
                )
                .slice(
                    0,
                    5
                );


        const rows =
            delayed.length

                ? delayed
                    .map(item => `

                        <div class="risk-item">

                            <div class="risk-item-main">

                                <strong>
                                    ${escapeHtml(
                                        item.vendor_name ||
                                        item.vendor_id ||
                                        "Unknown vendor"
                                    )}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        item.category ||
                                        "Procurement"
                                    )}
                                </span>

                            </div>


                            <div class="risk-item-meta">

                                ${
                                    Number(
                                        item
                                            .critical_delay_flag
                                    ) === 1

                                        ? `
                                            <span
                                                class="
                                                    risk-tag
                                                    critical
                                                "
                                            >
                                                Critical
                                            </span>
                                        `

                                        : ""
                                }

                                <span>
                                    ${formatInteger(
                                        item
                                            .delivery_delay_days
                                    )}d delay
                                </span>

                            </div>

                        </div>

                    `)
                    .join("")

                : `
                    <div class="empty-risk">
                        No delayed procurement items.
                    </div>
                `;


        container.innerHTML = `

            <div class="risk-panel-header">

                <div>

                    <span class="risk-eyebrow">
                        Procurement
                    </span>

                    <h4>
                        Delivery Risk
                    </h4>

                </div>

                <div class="risk-total">
                    ${formatInteger(
                        summary.delayed_items
                    )}
                </div>

            </div>


            <div class="risk-stats">

                <div>
                    <span>
                        Total Items
                    </span>
                    <strong>
                        ${formatInteger(
                            summary.total_items
                        )}
                    </strong>
                </div>

                <div>
                    <span>
                        Delayed
                    </span>
                    <strong>
                        ${formatInteger(
                            summary.delayed_items
                        )}
                    </strong>
                </div>

                <div>
                    <span>
                        Critical Delays
                    </span>
                    <strong>
                        ${formatInteger(
                            summary.critical_delays
                        )}
                    </strong>
                </div>

                <div>
                    <span>
                        Avg Delay
                    </span>
                    <strong>
                        ${
                            isAvailable(
                                summary.avg_delay_days
                            )
                                ? `${displayValue(
                                    summary.avg_delay_days
                                )}d`
                                : "—"
                        }
                    </strong>
                </div>

            </div>


            <div class="risk-list">

                <div class="risk-list-title">
                    Highest-priority delayed deliveries
                </div>

                ${rows}

            </div>

        `;

    } catch (error) {

        console.error(
            "Unable to load procurement risk:",
            error
        );


        container.innerHTML = `
            <div class="intelligence-error">
                Unable to load procurement risk.
            </div>
        `;
    }
}


/* ============================================================
   DATA QUALITY
   ============================================================ */

function populateValidationSummary(
    data
) {

    const mappings = [
        [
            "dq-source-rows",
            formatInteger(
                data.source_rows
            )
        ],
        [
            "dq-accepted-rows",
            formatInteger(
                data.accepted_rows
            )
        ],
        [
            "dq-quarantined-rows",
            formatInteger(
                data.quarantined_rows
            )
        ],
        [
            "dq-issue-events",
            formatInteger(
                data.issue_events
            )
        ],
        [
            "dq-validation-rate",
            formatValidationRate(
                data.validation_pass_rate
            )
        ]
    ];


    mappings.forEach(
        ([id, value]) => {

            const element =
                document.getElementById(
                    id
                );

            if (element) {
                element.textContent =
                    value;
            }

        }
    );
}


async function loadDataQuality() {

    const container =
        document.getElementById(
            "data-quality-dashboard"
        );

    if (!container) {
        return;
    }


    try {

        const data =
            await fetchJson(
                `${API_BASE}/data-quality`
            );


        populateValidationSummary(
            data
        );


        const issues =
            Array.isArray(
                data.issues
            )
                ? data.issues
                : [];


        const typeCounts = {};


        issues.forEach(
            issue => {

                const type =
                    String(
                        issue.issue_type ||
                        "other"
                    )
                        .replaceAll(
                            "_",
                            " "
                        )
                        .toLowerCase();


                typeCounts[type] =
                    (
                        typeCounts[type] ||
                        0
                    ) + 1;

            }
        );


        const issueTypeCards =
            Object
                .entries(
                    typeCounts
                )
                .sort(
                    (a, b) =>
                        b[1] - a[1]
                )
                .map(
                    ([type, count]) => `

                        <div class="dq-type-card">

                            <span>
                                ${escapeHtml(
                                    type
                                )}
                            </span>

                            <strong>
                                ${count}
                            </strong>

                        </div>

                    `
                )
                .join("");


        const datasetCounts = {};


        issues.forEach(
            issue => {

                const dataset =
                    issue.dataset ||
                    "Unknown dataset";


                datasetCounts[dataset] =
                    (
                        datasetCounts[
                            dataset
                        ] ||
                        0
                    ) + 1;

            }
        );


        const datasetRows =
            Object
                .entries(
                    datasetCounts
                )
                .sort(
                    (a, b) =>
                        b[1] - a[1]
                )
                .map(
                    ([dataset, count]) => `

                        <div class="dq-dataset-row">

                            <div>

                                <strong>
                                    ${escapeHtml(
                                        dataset
                                    )}
                                </strong>

                                <span>
                                    Source validation
                                </span>

                            </div>


                            <span class="dq-issue-count">

                                ${count}

                                ${
                                    count === 1
                                        ? "issue"
                                        : "issues"
                                }

                            </span>

                        </div>

                    `
                )
                .join("");


        /*
         * Show every validation issue.
         * There are currently 13, so we no longer hide
         * three records behind a 10-row display limit.
         */

        const issueRows =
            issues
                .map(issue => {

                    const issueType =
                        String(
                            issue.issue_type ||
                            "Issue"
                        )
                            .replaceAll(
                                "_",
                                " "
                            );


                    return `

                        <tr>

                            <td>
                                #${formatInteger(
                                    issue.issue_id
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    issue.dataset
                                )}
                            </td>

                            <td>
                                ${formatInteger(
                                    issue.row_index
                                )}
                            </td>

                            <td>

                                <span class="dq-issue-badge">
                                    ${escapeHtml(
                                        issueType
                                    )}
                                </span>

                            </td>

                            <td>
                                ${escapeHtml(
                                    issue.column_name
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    issue.value
                                )}
                            </td>

                            <td class="dq-message">
                                ${escapeHtml(
                                    issue.message
                                )}
                            </td>

                        </tr>

                    `;

                })
                .join("");


        container.innerHTML = `

            <div class="data-quality-dashboard">

                <div class="dq-header">

                    <div>

                        <span class="section-eyebrow">
                            Data Governance
                        </span>

                        <h2>
                            Data Quality Control Centre
                        </h2>

                        <p>
                            Validation exceptions are logged
                            and traceable. Structurally invalid
                            records are quarantined, while
                            plausible anomalies are retained
                            and explicitly flagged for review.
                        </p>

                    </div>


                    <div class="dq-total">

                        <span>
                            Issue Events
                        </span>

                        <strong>
                            ${formatInteger(
                                data.issue_events ??
                                data.total_issues
                            )}
                        </strong>

                    </div>

                </div>


                <div class="dq-validation-formula">

                    <strong>
                        Validation Pass Rate
                    </strong>

                    <span>
                        ${formatInteger(
                            data.accepted_rows
                        )}
                        accepted
                        ÷
                        ${formatInteger(
                            data.source_rows
                        )}
                        source
                        =
                        ${formatValidationRate(
                            data.validation_pass_rate
                        )}
                    </span>

                </div>


                <div class="dq-pipeline">

                    <div class="dq-pipeline-step">

                        <span>
                            01
                        </span>

                        <strong>
                            Source Data
                        </strong>

                        <small>
                            ${formatInteger(
                                data.source_rows
                            )}
                            operational records
                        </small>

                    </div>


                    <div class="dq-pipeline-arrow">
                        →
                    </div>


                    <div class="dq-pipeline-step">

                        <span>
                            02
                        </span>

                        <strong>
                            Validation
                        </strong>

                        <small>
                            Structural &amp; logical checks
                        </small>

                    </div>


                    <div class="dq-pipeline-arrow">
                        →
                    </div>


                    <div class="dq-pipeline-step">

                        <span>
                            03
                        </span>

                        <strong>
                            Quarantine
                        </strong>

                        <small>
                            ${formatInteger(
                                data.quarantined_rows
                            )}
                            invalid records isolated
                        </small>

                    </div>


                    <div class="dq-pipeline-arrow">
                        →
                    </div>


                    <div class="dq-pipeline-step">

                        <span>
                            04
                        </span>

                        <strong>
                            Controlled Reporting
                        </strong>

                        <small>
                            ${formatInteger(
                                data.accepted_rows
                            )}
                            accepted records
                        </small>

                    </div>

                </div>


                <div class="dq-type-grid">
                    ${issueTypeCards}
                </div>


                <div class="dq-detail-grid">

                    <div class="dq-panel">

                        <div class="dq-panel-header">

                            <div>

                                <span>
                                    Source Monitoring
                                </span>

                                <h3>
                                    Issues by Dataset
                                </h3>

                            </div>

                        </div>


                        <div class="dq-dataset-list">
                            ${datasetRows}
                        </div>

                    </div>


                    <div class="dq-panel">

                        <div class="dq-panel-header">

                            <div>

                                <span>
                                    Audit Trail
                                </span>

                                <h3>
                                    Validation Register
                                </h3>

                            </div>


                            <span class="dq-register-count">
                                Showing all
                                ${issues.length}
                                issue events
                            </span>

                        </div>


                        <div class="dq-table-wrapper">

                            <table class="dq-table">

                                <thead>

                                    <tr>

                                        <th>
                                            ID
                                        </th>

                                        <th>
                                            Dataset
                                        </th>

                                        <th>
                                            Source Row
                                        </th>

                                        <th>
                                            Issue
                                        </th>

                                        <th>
                                            Field
                                        </th>

                                        <th>
                                            Value
                                        </th>

                                        <th>
                                            Validation Message
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>
                                    ${issueRows}
                                </tbody>

                            </table>

                        </div>

                    </div>

                </div>


                <div class="dq-governance-note">

                    <strong>
                        Control principle
                    </strong>

                    <span>
                        Quarantined rows represent invalid
                        source records excluded from the
                        controlled analytical layer.
                        Issue events are validation
                        observations and may include more
                        than one issue relating to a single
                        record.
                    </span>

                </div>

            </div>

        `;

    } catch (error) {

        console.error(
            "Unable to load data quality:",
            error
        );


        populateValidationSummary(
            {}
        );


        container.innerHTML = `

            <div class="intelligence-error">
                Unable to load data-quality controls.
            </div>

        `;
    }
}


/* ============================================================
   INITIALISE
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initialiseNavigation();

        Promise.allSettled([
            loadPortfolioKPIs(),
            loadPortfolioAttention(),
            loadProjects(),
            loadDataQuality()
        ]);

    }
);