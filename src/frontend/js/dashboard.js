/* ============================================================
   CONTROLSIGHT
   Project Controls Intelligence Platform
   ============================================================ */

const API_BASE = "/api";

let selectedProjectCode = null;


/* ============================================================
   FORMATTERS
   ============================================================ */

function formatCurrency(value) {

    const number = Number(value || 0);
    const absolute = Math.abs(number);
    const sign = number < 0 ? "-" : "";

    if (absolute >= 1_000_000_000) {
        const valueBn = absolute / 1_000_000_000;

        return `${sign}£${valueBn.toFixed(
            valueBn >= 10 ? 0 : 1
        )}bn`;
    }

    if (absolute >= 1_000_000) {
        const valueM = absolute / 1_000_000;

        return `${sign}£${valueM.toFixed(
            valueM >= 10 ? 0 : 1
        )}m`;
    }

    if (absolute >= 1_000) {
        const valueK = absolute / 1_000;

        return `${sign}£${valueK.toFixed(
            valueK >= 10 ? 0 : 1
        )}k`;
    }

    return `${sign}£${absolute.toFixed(0)}`;
}


function formatPercentage(value) {
    return `${Number(value || 0).toFixed(1)}%`;
}


function formatValidationRate(value) {
    return `${Number(value || 0).toFixed(2)}%`;
}


function formatAxisCurrency(value) {

    const number = Number(value || 0);
    const absolute = Math.abs(number);

    if (absolute >= 1_000_000_000) {
        const billions = number / 1_000_000_000;

        return `£${billions.toFixed(
            Math.abs(billions) >= 10 ? 0 : 1
        )}bn`;
    }

    if (absolute >= 1_000_000) {
        const millions = number / 1_000_000;

        return `£${millions.toFixed(
            Math.abs(millions) >= 10 ? 0 : 1
        )}m`;
    }

    if (absolute >= 1_000) {
        return `£${(number / 1_000).toFixed(0)}k`;
    }

    return `£${number.toFixed(0)}`;
}


/* ============================================================
   NAVIGATION
   ============================================================ */

function setActiveNavigation(targetHash) {

    document
        .querySelectorAll(".sidebar-nav .nav-item")
        .forEach(item => {

            item.classList.remove("active");

            if (
                item.getAttribute("href") === targetHash
            ) {
                item.classList.add("active");
            }

        });
}


function showProjectSelectionPrompt() {

    const oldPrompt =
        document.getElementById(
            "project-selection-prompt"
        );

    if (oldPrompt) {
        oldPrompt.remove();
    }


    const portfolio =
        document.getElementById(
            "project-portfolio"
        );

    if (!portfolio) {
        return;
    }


    const prompt =
        document.createElement("div");

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
                Choose a project below to open
                project-level cost, schedule and
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


    portfolio.prepend(prompt);


    prompt
        .querySelector("button")
        .addEventListener(
            "click",
            () => prompt.remove()
        );


    window.setTimeout(
        () => {
            if (
                document.body.contains(prompt)
            ) {
                prompt.remove();
            }
        },
        5000
    );
}


function initialiseNavigation() {

    const navItems =
        document.querySelectorAll(
            ".sidebar-nav .nav-item"
        );


    const projectOnlyTargets =
        new Set([
            "#project-detail",
            "#cost-performance",
            "#schedule-risk-panel",
            "#procurement-risk-panel"
        ]);


    navItems.forEach(item => {

        item.addEventListener(
            "click",
            event => {

                const href =
                    item.getAttribute("href");


                if (
                    projectOnlyTargets.has(href) &&
                    !selectedProjectCode
                ) {

                    event.preventDefault();

                    setActiveNavigation(
                        "#project-portfolio"
                    );


                    const portfolio =
                        document.getElementById(
                            "project-portfolio"
                        );

                    if (portfolio) {
                        portfolio.scrollIntoView({
                            behavior: "smooth",
                            block: "start"
                        });
                    }


                    showProjectSelectionPrompt();

                    return;
                }


                setActiveNavigation(href);

            }
        );

    });


    const currentHash =
        window.location.hash;


    const safeInitialHashes =
        new Set([
            "#portfolio-overview",
            "#project-portfolio",
            "#data-quality"
        ]);


    if (
        safeInitialHashes.has(currentHash)
    ) {
        setActiveNavigation(currentHash);
    } else {
        setActiveNavigation(
            "#portfolio-overview"
        );
    }
}


/* ============================================================
   PORTFOLIO KPIs
   ============================================================ */

async function loadPortfolioKPIs() {

    const container =
        document.getElementById(
            "portfolio-kpis"
        );

    if (!container) return;


    try {

        const response =
            await fetch(`${API_BASE}/kpis`);

        if (!response.ok) {
            throw new Error(
                `API request failed: ${response.status}`
            );
        }


        const data =
            await response.json();


        const varianceClass =
            Number(
                data.forecast_variance || 0
            ) < 0
                ? "negative"
                : "positive";


        container.innerHTML = `

            <div class="kpi-card">
                <span class="kpi-label">
                    Portfolio Budget
                </span>

                <strong class="kpi-value">
                    ${formatCurrency(
                        data.total_budget
                    )}
                </strong>
            </div>


            <div class="kpi-card">
                <span class="kpi-label">
                    Actual Cost
                </span>

                <strong class="kpi-value">
                    ${formatCurrency(
                        data.actual_cost_to_date
                    )}
                </strong>
            </div>


            <div class="kpi-card">
                <span class="kpi-label">
                    Forecast at Completion
                </span>

                <strong class="kpi-value">
                    ${formatCurrency(
                        data.forecast_at_completion
                    )}
                </strong>
            </div>


            <div class="kpi-card">
                <span class="kpi-label">
                    Forecast Variance
                </span>

                <strong
                    class="
                        kpi-value
                        ${varianceClass}
                    "
                >
                    ${formatCurrency(
                        data.forecast_variance
                    )}
                </strong>
            </div>


            <div class="kpi-card">
                <span class="kpi-label">
                    Actual Progress
                </span>

                <strong class="kpi-value">
                    ${formatPercentage(
                        data.actual_progress_pct
                    )}
                </strong>
            </div>


            <div class="kpi-card">
                <span class="kpi-label">
                    Validation Pass Rate
                </span>

                <strong class="kpi-value">
                    ${formatValidationRate(
                        data.data_quality_score
                    )}
                </strong>
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
   MANAGEMENT PRIORITIES
   ============================================================ */

async function loadPortfolioAttention() {

    const container =
        document.getElementById(
            "portfolio-attention"
        );

    if (!container) return;


    try {

        const response =
            await fetch(
                `${API_BASE}/portfolio/attention-ranking`
            );

        if (!response.ok) {
            throw new Error(
                `API request failed: ${response.status}`
            );
        }


        const data =
            await response.json();

        const projects =
            data.projects || [];

        const summary =
            data.summary || {};

        const topProjects =
            projects.slice(0, 4);


        const priorityCards =
            topProjects
                .map(project => {

                    const level =
                        String(
                            project.attention_level ||
                            "Stable"
                        ).toLowerCase();


                    const forecastVariance =
                        Number(
                            project.forecast_variance_pct ||
                            0
                        );


                    const progressVariance =
                        Number(
                            project.progress_variance_pct ||
                            0
                        );


                    const forecastClass =
                        forecastVariance < 0
                            ? "negative"
                            : "positive";


                    const progressClass =
                        progressVariance < 0
                            ? "negative"
                            : "positive";


                    return `

                        <button
                            type="button"
                            class="
                                priority-project
                                ${level}
                            "
                            data-project-code="${project.project_code}"
                        >

                            <div class="priority-rank">
                                <span>Priority</span>
                                <strong>#${project.rank}</strong>
                            </div>


                            <div class="priority-project-main">

                                <div class="priority-project-heading">

                                    <div>
                                        <span class="priority-code">
                                            ${project.project_code}
                                        </span>

                                        <strong>
                                            ${project.project_name}
                                        </strong>
                                    </div>


                                    <span
                                        class="
                                            priority-level
                                            ${level}
                                        "
                                    >
                                        ${project.attention_level}
                                    </span>

                                </div>


                                <div class="priority-driver">
                                    <span>
                                        Primary Driver
                                    </span>

                                    <strong>
                                        ${project.primary_driver}
                                    </strong>
                                </div>


                                <div class="priority-metrics">

                                    <div>
                                        <span>
                                            Forecast Var.
                                        </span>

                                        <strong class="${forecastClass}">
                                            ${formatPercentage(
                                                forecastVariance
                                            )}
                                        </strong>
                                    </div>


                                    <div>
                                        <span>
                                            Progress Var.
                                        </span>

                                        <strong class="${progressClass}">
                                            ${formatPercentage(
                                                progressVariance
                                            )}
                                        </strong>
                                    </div>


                                    <div>
                                        <span>
                                            Critical Schedule
                                        </span>

                                        <strong>
                                            ${
                                                project
                                                    .critical_delayed_activities ??
                                                0
                                            }
                                        </strong>
                                    </div>


                                    <div>
                                        <span>
                                            Critical Procurement
                                        </span>

                                        <strong>
                                            ${
                                                project
                                                    .critical_procurement_delays ??
                                                0
                                            }
                                        </strong>
                                    </div>

                                </div>

                            </div>


                            <div class="attention-score">
                                <span>Attention</span>

                                <strong>
                                    ${project.attention_score}
                                </strong>

                                <small>/ 100</small>
                            </div>

                        </button>
                    `;

                })
                .join("");


        container.innerHTML = `

            <div class="attention-header">

                <div>
                    <span class="section-eyebrow">
                        Portfolio Prioritisation
                    </span>

                    <h3>
                        Management Priorities
                    </h3>

                    <p>
                        Projects ranked using cost,
                        schedule, procurement and
                        data-quality exceptions.
                    </p>
                </div>


                <div class="attention-summary">

                    <div class="attention-summary-item critical">
                        <strong>
                            ${summary.critical_projects ?? 0}
                        </strong>
                        <span>Critical</span>
                    </div>

                    <div class="attention-summary-item watch">
                        <strong>
                            ${summary.watch_projects ?? 0}
                        </strong>
                        <span>Watch</span>
                    </div>

                    <div class="attention-summary-item review">
                        <strong>
                            ${summary.review_projects ?? 0}
                        </strong>
                        <span>Review</span>
                    </div>

                    <div class="attention-summary-item stable">
                        <strong>
                            ${summary.stable_projects ?? 0}
                        </strong>
                        <span>Stable</span>
                    </div>

                </div>

            </div>


            <div class="priority-list">
                ${priorityCards}
            </div>


            <div class="attention-methodology">

                <div>
                    <span>
                        Status Logic
                    </span>

                    <p>
                        Performance Status reflects headline
                        cost and progress position. Management
                        Attention additionally evaluates
                        critical schedule, procurement and
                        data-quality exceptions.
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
                            card.dataset.projectCode;

                        selectedProjectCode =
                            projectCode;

                        highlightSelectedProject(
                            projectCode
                        );

                        setActiveNavigation(
                            "#project-detail"
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
   DATA QUALITY CONTROL CENTRE
   ============================================================ */

async function loadDataQuality() {

    const container =
        document.getElementById(
            "data-quality-dashboard"
        );

    if (!container) return;


    try {

        const response =
            await fetch(
                `${API_BASE}/data-quality`
            );

        if (!response.ok) {
            throw new Error(
                `API request failed: ${response.status}`
            );
        }


        const data =
            await response.json();

        const issues =
            data.issues || [];


        const typeCounts = {};

        issues.forEach(issue => {

            const type =
                String(
                    issue.issue_type || "other"
                )
                    .replaceAll("_", " ")
                    .toLowerCase();

            typeCounts[type] =
                (typeCounts[type] || 0) + 1;
        });


        const issueTypeCards =
            Object.entries(typeCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => `
                    <div class="dq-type-card">
                        <span>${type}</span>
                        <strong>${count}</strong>
                    </div>
                `)
                .join("");


        const datasetCounts = {};

        issues.forEach(issue => {

            const dataset =
                issue.dataset ||
                "Unknown dataset";

            datasetCounts[dataset] =
                (datasetCounts[dataset] || 0) + 1;
        });


        const datasetRows =
            Object.entries(datasetCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([dataset, count]) => `
                    <div class="dq-dataset-row">

                        <div>
                            <strong>
                                ${dataset}
                            </strong>

                            <span>
                                Source validation
                            </span>
                        </div>

                        <span class="dq-issue-count">
                            ${count}
                            ${count === 1 ? "issue" : "issues"}
                        </span>

                    </div>
                `)
                .join("");


        const visibleIssues =
            issues.slice(0, 10);


        const issueRows =
            visibleIssues
                .map(issue => {

                    const issueType =
                        String(
                            issue.issue_type ||
                            "Issue"
                        ).replaceAll("_", " ");


                    const value =
                        issue.value === null ||
                        issue.value === undefined ||
                        issue.value === ""
                            ? "—"
                            : issue.value;


                    return `
                        <tr>
                            <td>
                                ${issue.dataset || "—"}
                            </td>

                            <td>
                                <span class="dq-issue-badge">
                                    ${issueType}
                                </span>
                            </td>

                            <td>
                                ${issue.column_name || "—"}
                            </td>

                            <td>
                                ${value}
                            </td>

                            <td class="dq-message">
                                ${issue.message || "—"}
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
                            Validation exceptions retained
                            from source project-control
                            datasets rather than silently
                            removed from reporting.
                        </p>
                    </div>


                    <div class="dq-total">
                        <span>
                            Logged Exceptions
                        </span>

                        <strong>
                            ${data.total_issues || 0}
                        </strong>
                    </div>

                </div>


                <div class="dq-pipeline">

                    <div class="dq-pipeline-step">
                        <span>01</span>
                        <strong>Source Data</strong>
                        <small>ERP-style project records</small>
                    </div>

                    <div class="dq-pipeline-arrow">→</div>

                    <div class="dq-pipeline-step">
                        <span>02</span>
                        <strong>Validation</strong>
                        <small>Structural &amp; logical checks</small>
                    </div>

                    <div class="dq-pipeline-arrow">→</div>

                    <div class="dq-pipeline-step">
                        <span>03</span>
                        <strong>Quarantine</strong>
                        <small>Invalid records isolated</small>
                    </div>

                    <div class="dq-pipeline-arrow">→</div>

                    <div class="dq-pipeline-step">
                        <span>04</span>
                        <strong>Controlled Reporting</strong>
                        <small>Traceable analytical layer</small>
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
                                Showing
                                ${visibleIssues.length}
                                of
                                ${issues.length}
                            </span>

                        </div>


                        <div class="dq-table-wrapper">

                            <table class="dq-table">

                                <thead>
                                    <tr>
                                        <th>Dataset</th>
                                        <th>Issue</th>
                                        <th>Field</th>
                                        <th>Value</th>
                                        <th>Validation Message</th>
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
                        Structurally invalid records are
                        isolated from the analytical layer,
                        while plausible but suspicious values
                        are retained and explicitly flagged
                        for investigation.
                    </span>

                </div>

            </div>

        `;

    } catch (error) {

        console.error(
            "Unable to load data quality:",
            error
        );

        container.innerHTML = `
            <div class="intelligence-error">
                Unable to load data-quality controls.
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

    if (!container) return;


    try {

        const response =
            await fetch(
                `${API_BASE}/projects`
            );

        if (!response.ok) {
            throw new Error(
                `API request failed: ${response.status}`
            );
        }


        const projects =
            await response.json();


        container.innerHTML = `

            <div class="section-header">

                <div>
                    <h2>
                        Project Portfolio
                    </h2>

                    <p>
                        Cost, progress and management status
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
                            <th>Forecast</th>
                            <th>Forecast Variance</th>
                            <th>Progress</th>
                            <th>Schedule Variance</th>
                            <th>Performance Status</th>
                        </tr>
                    </thead>

                    <tbody id="project-table-body"></tbody>

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


        let activeStatus = "All";


        function renderProjects() {

            const searchTerm =
                String(
                    searchInput.value || ""
                )
                    .trim()
                    .toLowerCase();


            const filtered =
                projects.filter(project => {

                    const matchesSearch =
                        String(
                            project.project_code || ""
                        )
                            .toLowerCase()
                            .includes(searchTerm) ||

                        String(
                            project.project_name || ""
                        )
                            .toLowerCase()
                            .includes(searchTerm);


                    const matchesStatus =
                        activeStatus === "All" ||

                        String(
                            project.management_status || ""
                        ).toLowerCase() ===
                        activeStatus.toLowerCase();


                    return (
                        matchesSearch &&
                        matchesStatus
                    );
                });


            document.getElementById(
                "project-count"
            ).textContent =
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
                                project.management_status ||
                                "Green"
                            );

                        const statusClass =
                            status.toLowerCase();

                        const forecastVariance =
                            Number(
                                project.forecast_variance ||
                                0
                            );

                        const progressVariance =
                            Number(
                                project.progress_variance_pct ||
                                0
                            );

                        const forecastClass =
                            forecastVariance < 0
                                ? "negative"
                                : "positive";

                        const progressClass =
                            progressVariance < 0
                                ? "negative"
                                : "positive";

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
                                data-project-code="${project.project_code}"
                            >

                                <td>
                                    <strong>
                                        ${project.project_code}
                                    </strong>
                                </td>

                                <td>
                                    ${project.project_name}
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

                                <td class="${forecastClass}">
                                    ${formatCurrency(
                                        forecastVariance
                                    )}
                                </td>

                                <td>
                                    ${formatPercentage(
                                        project.actual_progress_pct
                                    )}
                                </td>

                                <td class="${progressClass}">
                                    ${formatPercentage(
                                        progressVariance
                                    )}
                                </td>

                                <td>
                                    <span
                                        class="
                                            status-badge
                                            ${statusClass}
                                        "
                                    >
                                        ${status}
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
                                row.dataset.projectCode;

                            selectedProjectCode =
                                projectCode;

                            highlightSelectedProject(
                                projectCode
                            );

                            setActiveNavigation(
                                "#project-detail"
                            );

                            await loadProjectOverview(
                                projectCode
                            );
                        }
                    );

                });
        }


        searchInput.addEventListener(
            "input",
            renderProjects
        );


        filterButtons.forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    filterButtons.forEach(
                        item =>
                            item.classList.remove(
                                "active"
                            )
                    );

                    button.classList.add(
                        "active"
                    );

                    activeStatus =
                        button.dataset.status;

                    renderProjects();
                }
            );

        });


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

            row.classList.remove(
                "selected"
            );

            if (
                row.dataset.projectCode ===
                projectCode
            ) {
                row.classList.add(
                    "selected"
                );
            }
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

    if (!container) return;


    try {

        const response =
            await fetch(
                `${API_BASE}/projects/${projectCode}/overview`
            );

        if (!response.ok) {
            throw new Error(
                `API request failed: ${response.status}`
            );
        }


        const data =
            await response.json();

        const project =
            data.project || {};

        const schedule =
            data.schedule || {};

        const quality =
            data.data_quality || {};


        const status =
            String(
                project.management_status ||
                project.health_status ||
                "Green"
            );

        const statusClass =
            status.toLowerCase();


        const forecastVariance =
            Number(
                project.forecast_variance ||
                0
            );

        const progressVariance =
            Number(
                project.progress_variance_pct ||
                0
            );


        const forecastClass =
            forecastVariance < 0
                ? "negative"
                : "positive";

        const progressClass =
            progressVariance < 0
                ? "negative"
                : "positive";


        container.classList.remove(
            "hidden"
        );


        container.innerHTML = `

            <div class="section-header project-detail-header">

                <div>
                    <span class="project-code">
                        ${project.project_code}
                    </span>

                    <h2>
                        ${project.project_name}
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
                            ${statusClass}
                        "
                    >
                        ${status}
                    </span>

                </div>

            </div>


            <div class="detail-grid">

                <div class="detail-card">
                    <span>Approved Budget</span>
                    <strong>
                        ${formatCurrency(
                            project.approved_budget
                        )}
                    </strong>
                </div>

                <div class="detail-card">
                    <span>Actual Cost</span>
                    <strong>
                        ${formatCurrency(
                            project.actual_cost_to_date
                        )}
                    </strong>
                </div>

                <div class="detail-card">
                    <span>Forecast at Completion</span>
                    <strong>
                        ${formatCurrency(
                            project.forecast_at_completion
                        )}
                    </strong>
                </div>

                <div class="detail-card">
                    <span>Forecast Variance</span>
                    <strong class="${forecastClass}">
                        ${formatCurrency(
                            forecastVariance
                        )}
                    </strong>
                </div>

                <div class="detail-card">
                    <span>Planned Progress</span>
                    <strong>
                        ${formatPercentage(
                            project.planned_progress_pct
                        )}
                    </strong>
                </div>

                <div class="detail-card">
                    <span>Actual Progress</span>
                    <strong>
                        ${formatPercentage(
                            project.actual_progress_pct
                        )}
                    </strong>
                </div>

                <div class="detail-card">
                    <span>Progress Variance</span>
                    <strong class="${progressClass}">
                        ${formatPercentage(
                            progressVariance
                        )}
                    </strong>
                </div>

                <div class="detail-card">
                    <span>Delayed Activities</span>
                    <strong>
                        ${schedule.delayed_activities ?? 0}
                    </strong>
                </div>

                <div class="detail-card">
                    <span>Critical Delays</span>
                    <strong>
                        ${project.critical_delays ?? 0}
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
                                ${quality.cost_anomalies}
                                cost anomaly${
                                    Number(
                                        quality.cost_anomalies
                                    ) === 1
                                        ? ""
                                        : "ies"
                                }
                                ${
                                    Number(
                                        quality.cost_anomalies
                                    ) === 1
                                        ? "was"
                                        : "were"
                                }
                                detected. Review source cost
                                data before relying on
                                reported performance.
                            </span>

                        </div>
                    `
                    : ""
            }

        `;


        await Promise.all([
            loadManagementInsights(projectCode),
            loadCostTrend(projectCode),
            loadProgressTrend(projectCode),
            loadScheduleRisk(projectCode),
            loadProcurementRisk(projectCode)
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
            behavior: "smooth",
            block: "start"
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
   EXECUTIVE INTELLIGENCE
   ============================================================ */

async function loadManagementInsights(
    projectCode
) {

    const container =
        document.getElementById(
            "management-insights"
        );

    if (!container) return;


    try {

        const response =
            await fetch(
                `${API_BASE}/projects/${projectCode}/management-insights`
            );

        if (!response.ok) {
            throw new Error(
                `API request failed: ${response.status}`
            );
        }


        const data =
            await response.json();


        const attentionLevel =
            String(
                data.attention_level ||
                "Stable"
            );

        const attentionClass =
            attentionLevel.toLowerCase();

        const insights =
            data.insights || [];


        const insightCards =
            insights.length
                ? insights
                    .map(insight => {

                        const severity =
                            String(
                                insight.severity ||
                                "Stable"
                            );

                        const severityClass =
                            severity.toLowerCase();


                        return `

                            <div
                                class="
                                    insight-card
                                    ${severityClass}
                                "
                            >

                                <div class="insight-indicator"></div>

                                <div class="insight-content">

                                    <div class="insight-meta">

                                        <span>
                                            ${
                                                insight.category ||
                                                "Performance"
                                            }
                                        </span>

                                        <span
                                            class="
                                                insight-severity
                                                ${severityClass}
                                            "
                                        >
                                            ${severity}
                                        </span>

                                    </div>

                                    <strong>
                                        ${
                                            insight.title ||
                                            "Management observation"
                                        }
                                    </strong>

                                    <p>
                                        ${insight.message || ""}
                                    </p>

                                </div>

                            </div>
                        `;

                    })
                    .join("")
                : `
                    <div class="intelligence-empty">
                        No material management exceptions
                        identified.
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
                        Automated interpretation of cost,
                        schedule, procurement and
                        data-quality indicators.
                    </p>
                </div>


                <div
                    class="
                        attention-badge
                        ${attentionClass}
                    "
                >
                    <span>
                        Management Attention
                    </span>

                    <strong>
                        ${attentionLevel}
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
                        ${
                            data.management_summary ||
                            "No management summary available."
                        }
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
   COST PERFORMANCE
   ============================================================ */

async function loadCostTrend(
    projectCode
) {

    const container =
        document.getElementById(
            "cost-chart"
        );

    if (!container) return;


    try {

        const response =
            await fetch(
                `${API_BASE}/projects/${projectCode}/cost-trend`
            );

        if (!response.ok) {
            throw new Error(
                `API request failed: ${response.status}`
            );
        }


        const data =
            await response.json();

        const rawTrend =
            data.cost_trend || [];


        if (!rawTrend.length) {

            container.innerHTML = `
                <div class="chart-loading">
                    No cost performance data available.
                </div>
            `;

            return;
        }


        const trend =
            rawTrend.map(row => ({
                date: row.date,
                yearMonth: row.year_month,

                planned:
                    Number(
                        row.cumulative_planned_cost ||
                        0
                    ),

                actual:
                    Number(
                        row.cumulative_actual_cost ||
                        0
                    ),

                forecast:
                    Number(
                        row.forecast_at_completion ||
                        0
                    ),

                anomalyCount:
                    Number(
                        row.anomaly_count ||
                        0
                    )
            }));


        const width = 1000;
        const height = 340;

        const margin = {
            top: 32,
            right: 28,
            bottom: 48,
            left: 74
        };


        const chartWidth =
            width -
            margin.left -
            margin.right;

        const chartHeight =
            height -
            margin.top -
            margin.bottom;


        /*
        IMPORTANT:
        Use real cumulative £ values for the scale.
        */

        const allValues = [
            ...trend.map(row => row.planned),
            ...trend.map(row => row.actual)
        ];


        const rawMaximum =
            Math.max(
                ...allValues,
                1
            );


        const maximumValue =
            rawMaximum * 1.08;


        const yScale =
            value => (
                margin.top +
                chartHeight -
                (
                    Number(value || 0) /
                    maximumValue
                ) *
                chartHeight
            );


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
                        (trend.length - 1)
                    ) *
                    chartWidth
                );
            };


        const createPath =
            key =>
                trend
                    .map((row, index) => (
                        `${
                            index === 0
                                ? "M"
                                : "L"
                        } ` +
                        `${xScale(index).toFixed(2)} ` +
                        `${yScale(row[key]).toFixed(2)}`
                    ))
                    .join(" ");


        const plannedPath =
            createPath("planned");

        const actualPath =
            createPath("actual");


        const yTickCount = 4;


        const yGridLines =
            Array.from(
                {
                    length:
                        yTickCount + 1
                },
                (_, index) => {

                    const ratio =
                        index / yTickCount;

                    const value =
                        maximumValue *
                        (1 - ratio);

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
                                ${formatAxisCurrency(value)}
                            </text>
                        </g>
                    `;
                }
            )
            .join("");


        const labelIndexes =
            trend.length === 1
                ? [0]
                : [
                    0,
                    Math.floor(
                        (trend.length - 1) / 2
                    ),
                    trend.length - 1
                ];


        const xLabels =
            [...new Set(labelIndexes)]
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
                            ${
                                row.yearMonth ||
                                row.date ||
                                ""
                            }
                        </text>
                    `;
                })
                .join("");


        const anomalyMarkers =
            trend
                .map((row, index) => {

                    if (
                        row.anomalyCount <= 0
                    ) {
                        return "";
                    }


                    const x =
                        xScale(index);

                    const y =
                        yScale(row.actual);


                    return `
                        <g>
                            <circle
                                cx="${x}"
                                cy="${y}"
                                r="6"
                                class="anomaly-marker"
                            ></circle>

                            <title>
                                ${
                                    row.yearMonth ||
                                    row.date
                                }:
                                ${row.anomalyCount}
                                cost anomaly
                            </title>
                        </g>
                    `;
                })
                .join("");


        const latest =
            trend[
                trend.length - 1
            ];


        const latestPlanned =
            Number(
                latest.planned || 0
            );

        const latestActual =
            Number(
                latest.actual || 0
            );


        const variance =
            latestActual -
            latestPlanned;


        const varianceClass =
            variance > 0
                ? "negative"
                : "positive";


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
                        <i class="legend-dot anomaly"></i>
                        Data anomaly
                    </span>

                </div>


                <div class="progress-variance">

                    Latest Actual:

                    <strong>
                        ${formatCurrency(
                            latestActual
                        )}
                    </strong>

                    <span class="metric-divider">
                        ·
                    </span>

                    Variance:

                    <strong class="${varianceClass}">
                        ${
                            variance > 0
                                ? "+"
                                : ""
                        }${formatCurrency(
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
                    aria-label="Cumulative planned versus actual project cost"
                >

                    ${yGridLines}
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
   PROGRESS S-CURVE
   ============================================================ */

async function loadProgressTrend(
    projectCode
) {

    const container =
        document.getElementById(
            "progress-chart"
        );

    if (!container) return;


    try {

        const response =
            await fetch(
                `${API_BASE}/projects/${projectCode}/progress-trend`
            );

        if (!response.ok) {
            throw new Error(
                `API request failed: ${response.status}`
            );
        }


        const data =
            await response.json();

        const rawTrend =
            data.progress_trend || [];


        if (!rawTrend.length) {

            container.innerHTML = `
                <div class="chart-loading">
                    No progress data available.
                </div>
            `;

            return;
        }


        const trend =
            rawTrend.map(row => ({
                date: row.date,
                yearMonth: row.year_month,

                planned:
                    Number(
                        row.planned_progress_pct ||
                        0
                    ),

                actual:
                    Number(
                        row.actual_progress_pct ||
                        0
                    ),

                variance:
                    Number(
                        row.progress_variance_pct ||
                        0
                    )
            }));


        const width = 1000;
        const height = 320;

        const margin = {
            top: 24,
            right: 28,
            bottom: 46,
            left: 64
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
                        (trend.length - 1)
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
                            Number(value || 0)
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


        const createPath =
            key =>
                trend
                    .map((row, index) => (
                        `${
                            index === 0
                                ? "M"
                                : "L"
                        } ` +
                        `${xScale(index).toFixed(2)} ` +
                        `${yScale(row[key]).toFixed(2)}`
                    ))
                    .join(" ");


        const plannedPath =
            createPath("planned");

        const actualPath =
            createPath("actual");


        const yTicks =
            [100, 75, 50, 25, 0];


        const yGrid =
            yTicks
                .map(value => {

                    const y =
                        yScale(value);

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
                        (trend.length - 1) / 2
                    ),
                    trend.length - 1
                ];


        const xLabels =
            [...new Set(labelIndexes)]
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
                            ${
                                row.yearMonth ||
                                row.date ||
                                ""
                            }
                        </text>
                    `;
                })
                .join("");


        const latest =
            trend[
                trend.length - 1
            ];


        const latestVariance =
            Number(
                latest.variance || 0
            );


        const varianceClass =
            latestVariance < 0
                ? "negative"
                : "positive";


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

                    <strong class="${varianceClass}">
                        ${formatPercentage(
                            latestVariance
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

    if (!container) return;


    try {

        const response =
            await fetch(
                `${API_BASE}/projects/${projectCode}/schedule-risk`
            );

        if (!response.ok) {
            throw new Error(
                `API request failed: ${response.status}`
            );
        }


        const data =
            await response.json();

        const summary =
            data.summary || {};

        const activities =
            data.activities || [];


        const delayedActivities =
            activities
                .filter(
                    activity =>
                        Number(
                            activity.delayed_activity_flag ||
                            0
                        ) === 1
                )
                .slice(0, 5);


        const riskRows =
            delayedActivities.length
                ? delayedActivities
                    .map(activity => {

                        const delayDays =
                            Math.max(
                                Number(
                                    activity.finish_delay_days ||
                                    0
                                ),
                                Number(
                                    activity.start_delay_days ||
                                    0
                                )
                            );


                        return `

                            <div class="risk-item">

                                <div class="risk-item-main">
                                    <strong>
                                        ${activity.activity_name}
                                    </strong>

                                    <span>
                                        ${activity.discipline}
                                    </span>
                                </div>


                                <div class="risk-item-meta">

                                    ${
                                        Number(
                                            activity.is_critical ||
                                            0
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
                    ${summary.delayed_activities ?? 0}
                </div>

            </div>


            <div class="risk-stats">

                <div>
                    <span>Total Activities</span>
                    <strong>
                        ${summary.total_activities ?? 0}
                    </strong>
                </div>

                <div>
                    <span>Critical</span>
                    <strong>
                        ${summary.critical_activities ?? 0}
                    </strong>
                </div>

                <div>
                    <span>Delayed</span>
                    <strong>
                        ${summary.delayed_activities ?? 0}
                    </strong>
                </div>

                <div>
                    <span>Critical + Delayed</span>
                    <strong>
                        ${
                            summary
                                .critical_delayed_activities ??
                            0
                        }
                    </strong>
                </div>

            </div>


            <div class="risk-list">

                <div class="risk-list-title">
                    Highest-priority delayed activities
                </div>

                ${riskRows}

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

    if (!container) return;


    try {

        const response =
            await fetch(
                `${API_BASE}/projects/${projectCode}/procurement-risk`
            );

        if (!response.ok) {
            throw new Error(
                `API request failed: ${response.status}`
            );
        }


        const data =
            await response.json();

        const summary =
            data.summary || {};

        const items =
            data.procurement_items || [];


        const delayedItems =
            items
                .filter(
                    item =>
                        Number(
                            item.delayed_delivery_flag ||
                            0
                        ) === 1
                )
                .slice(0, 5);


        const riskRows =
            delayedItems.length
                ? delayedItems
                    .map(item => {

                        const delayDays =
                            Number(
                                item.delivery_delay_days ||
                                0
                            );


                        return `

                            <div class="risk-item">

                                <div class="risk-item-main">
                                    <strong>
                                        ${
                                            item.vendor_name ||
                                            item.vendor_id ||
                                            "Unknown vendor"
                                        }
                                    </strong>

                                    <span>
                                        ${
                                            item.category ||
                                            "Procurement"
                                        }
                                    </span>
                                </div>


                                <div class="risk-item-meta">

                                    ${
                                        Number(
                                            item.critical_delay_flag ||
                                            0
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
                    ${summary.delayed_items ?? 0}
                </div>

            </div>


            <div class="risk-stats">

                <div>
                    <span>Total Items</span>
                    <strong>
                        ${summary.total_items ?? 0}
                    </strong>
                </div>

                <div>
                    <span>Delayed</span>
                    <strong>
                        ${summary.delayed_items ?? 0}
                    </strong>
                </div>

                <div>
                    <span>Critical Delays</span>
                    <strong>
                        ${summary.critical_delays ?? 0}
                    </strong>
                </div>

                <div>
                    <span>Avg Delay</span>
                    <strong>
                        ${summary.avg_delay_days ?? 0}d
                    </strong>
                </div>

            </div>


            <div class="risk-list">

                <div class="risk-list-title">
                    Highest-priority delayed deliveries
                </div>

                ${riskRows}

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
   INITIALISE
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initialiseNavigation();

        loadPortfolioKPIs();

        loadPortfolioAttention();

        loadDataQuality();

        loadProjects();

    }
);