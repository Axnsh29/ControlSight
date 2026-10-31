/* ============================================================
   CONTROLSIGHT — OVERVIEW V2
   Live-data executive overview
   ============================================================ */

(function () {
    "use strict";

    const secondaryIds = [
        "project-portfolio",
        "project-detail",
        "data-quality",
        "upload-data",
        "attention-tuning",
        "risk-cashflow",
        "report-pack",
        "change-control"
    ];

    let refreshToken = 0;

    /* ========================================================
       HELPERS
       ======================================================== */

    function num(value, fallback = 0) {
        const parsed = Number(value);

        return Number.isFinite(parsed)
            ? parsed
            : fallback;
    }

    function esc(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function currency(value) {
        const n = num(value);
        const abs = Math.abs(n);
        const sign = n < 0 ? "-" : "";

        if (abs >= 1_000_000_000) {
            return `${sign}£${(abs / 1_000_000_000).toFixed(1)}bn`;
        }

        if (abs >= 1_000_000) {
            return `${sign}£${(abs / 1_000_000).toFixed(1)}m`;
        }

        if (abs >= 1_000) {
            return `${sign}£${(abs / 1_000).toFixed(0)}k`;
        }

        return `${sign}£${abs.toFixed(0)}`;
    }

    function pct(value, decimals = 1) {
        const n = Number(value);

        return Number.isFinite(n)
            ? `${n.toFixed(decimals)}%`
            : "—";
    }

    function pp(value) {
        const n = Number(value);

        if (!Number.isFinite(n)) {
            return "—";
        }

        return `${n > 0 ? "+" : ""}${n.toFixed(1)} pp`;
    }

    function integer(value) {
        return Math.round(
            num(value)
        ).toLocaleString("en-GB");
    }

    function clamp(value, min, max) {
        return Math.max(
            min,
            Math.min(
                max,
                num(value)
            )
        );
    }

    function selectedPeriod() {
        const control =
            document.querySelector(
                "#reporting-period-control select"
            );

        return String(
            control?.value || ""
        ).trim();
    }

    function periodLabel(period = selectedPeriod()) {
        if (!period) {
            return "Latest reporting period";
        }

        const match =
            /^(\d{4})-(\d{2})$/.exec(
                period
            );

        if (!match) {
            return period;
        }

        const date =
            new Date(
                Number(match[1]),
                Number(match[2]) - 1,
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

    function periodUrl(endpoint) {
        const period =
            selectedPeriod();

        const base =
            `/api/${endpoint}`;

        if (!period) {
            return base;
        }

        return (
            `${base}?reporting_period=` +
            encodeURIComponent(period)
        );
    }

    async function getJson(url) {
        const response =
            await fetch(url);

        if (!response.ok) {
            throw new Error(
                `${response.status} ${url}`
            );
        }

        return response.json();
    }

    function navigate(target) {
        if (
            typeof window.navigateToHash ===
            "function"
        ) {
            window.navigateToHash(
                target
            );
            return;
        }

        window.location.hash =
            target;
    }

    /* ========================================================
       VIEW ISOLATION
       ======================================================== */

    function isolateOverview() {
        const hash =
            window.location.hash ||
            "#portfolio-overview";

        if (
            hash !==
            "#portfolio-overview"
        ) {
            return;
        }

        secondaryIds.forEach(id => {
            const node =
                document.getElementById(
                    id
                );

            if (!node) {
                return;
            }

            node.style.display =
                "none";

            node.classList.add(
                "hidden"
            );

            node.setAttribute(
                "aria-hidden",
                "true"
            );
        });

        const overview =
            document.getElementById(
                "portfolio-overview"
            );

        if (overview) {
            overview.style.display = "";
            overview.classList.remove(
                "hidden"
            );
            overview.setAttribute(
                "aria-hidden",
                "false"
            );
        }
    }

    /* ========================================================
       SHELL
       ======================================================== */

    function installOverviewShell() {
        const overview =
            document.getElementById(
                "portfolio-overview"
            );

        if (!overview) {
            return false;
        }

        overview.classList.add(
            "cs-overview-v2"
        );

        overview.innerHTML = `
            <div class="ov2-title-row">
                <div>
                    <span class="ov2-eyebrow">
                        Portfolio Control
                    </span>

                    <h2>
                        Portfolio Overview
                    </h2>

                    <p>
                        Project controls intelligence across cost,
                        progress, schedule, procurement and data quality.
                    </p>
                </div>

                <div
                    id="ov2-period-label"
                    class="ov2-period"
                >
                    ${esc(periodLabel())}
                </div>
            </div>

            <div class="ov2-hero">
                <div class="ov2-hero-icon">
                    ▥
                </div>

                <div class="ov2-hero-copy">
                    <span>
                        Executive Summary
                    </span>

                    <strong id="ov2-summary-title">
                        Loading portfolio intelligence...
                    </strong>

                    <p id="ov2-summary-detail">
                        Assessing cost, progress and management-attention signals.
                    </p>
                </div>

                <div class="ov2-hero-badge">
                    Management View
                </div>
            </div>

            <div
                id="ov2-kpis"
                class="ov2-kpis"
            >
                ${Array(6)
                    .fill(`
                        <article class="ov2-kpi">
                            <small>Loading...</small>
                        </article>
                    `)
                    .join("")}
            </div>

            <div class="ov2-main-grid">

                <section class="ov2-panel">
                    <div class="ov2-panel-head">
                        <div class="ov2-panel-title">
                            <span class="ov2-panel-symbol red">
                                !
                            </span>

                            <div>
                                <h3>
                                    Management Attention
                                </h3>

                                <p>
                                    Highest-priority projects requiring review.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            class="ov2-link"
                            data-ov2-target="#project-portfolio"
                        >
                            View all projects →
                        </button>
                    </div>

                    <div
                        id="ov2-attention"
                        class="ov2-attention-list"
                    >
                        <div class="ov2-attention-row header">
                            <span>#</span>
                            <span>Project</span>
                            <span>Score</span>
                            <span>Primary Driver</span>
                            <span>Variance</span>
                        </div>
                    </div>
                </section>

                <section class="ov2-panel">
                    <div class="ov2-panel-head">
                        <div class="ov2-panel-title">
                            <span class="ov2-panel-symbol">
                                ▥
                            </span>

                            <div>
                                <h3>
                                    Budget vs Forecast Exposure
                                </h3>

                                <p>
                                    Largest forecast completion exposures.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            class="ov2-link"
                            data-ov2-target="#project-portfolio"
                        >
                            View details →
                        </button>
                    </div>

                    <div
                        id="ov2-exposure-chart"
                    ></div>
                </section>

                <section class="ov2-panel">
                    <div class="ov2-panel-head">
                        <div class="ov2-panel-title">
                            <span class="ov2-panel-symbol green">
                                ◉
                            </span>

                            <div>
                                <h3>
                                    Portfolio Health
                                </h3>

                                <p>
                                    Management-attention distribution.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div
                        id="ov2-health"
                        class="ov2-health"
                    ></div>
                </section>

            </div>

            <div class="ov2-bottom-grid">

                <section class="ov2-panel">
                    <div class="ov2-panel-head">
                        <div class="ov2-panel-title">
                            <span class="ov2-panel-symbol amber">
                                ✦
                            </span>

                            <div>
                                <h3>
                                    Executive Intelligence
                                </h3>

                                <p>
                                    Key portfolio signals for the selected period.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div
                        id="ov2-intelligence"
                        class="ov2-insights"
                    ></div>
                </section>

                <section class="ov2-panel">
                    <div class="ov2-panel-head">
                        <div class="ov2-panel-title">
                            <span class="ov2-panel-symbol">
                                ✓
                            </span>

                            <div>
                                <h3>
                                    Next Actions
                                </h3>

                                <p>
                                    Highest-priority management follow-up.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div
                        id="ov2-actions"
                        class="ov2-actions"
                    ></div>
                </section>

                <section class="ov2-panel">
                    <div class="ov2-panel-head">
                        <div class="ov2-panel-title">
                            <span class="ov2-panel-symbol green">
                                ◫
                            </span>

                            <div>
                                <h3>
                                    Data Quality & Validation
                                </h3>

                                <p>
                                    Controlled analytical-layer health.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            class="ov2-link"
                            data-ov2-target="#data-quality"
                        >
                            View details →
                        </button>
                    </div>

                    <div
                        id="ov2-dq"
                        class="ov2-dq"
                    ></div>
                </section>

            </div>
        `;

        overview
            .querySelectorAll(
                "[data-ov2-target]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () =>
                        navigate(
                            button.dataset
                                .ov2Target
                        )
                );
            });

        return true;
    }

    /* ========================================================
       KPI RENDER
       ======================================================== */

    function renderKPIs(
        kpis,
        dq,
        attention
    ) {
        const container =
            document.getElementById(
                "ov2-kpis"
            );

        if (!container) {
            return;
        }

        const budget =
            num(
                kpis.total_budget
            );

        const actual =
            num(
                kpis.actual_cost_to_date
            );

        const fac =
            num(
                kpis.forecast_at_completion
            );

        const forecastVariance =
            num(
                kpis.forecast_variance
            );

        const planned =
            num(
                kpis.planned_progress_pct
            );

        const progress =
            num(
                kpis.actual_progress_pct
            );

        const progressVariance =
            progress - planned;

        const validation =
            num(
                dq.validation_pass_rate
            );

        const projectCount =
            num(
                attention?.summary
                    ?.total_projects,
                Array.isArray(
                    attention?.projects
                )
                    ? attention.projects.length
                    : 0
            );

        const cards = [
            {
                icon: "£",
                label: "Approved Budget",
                value: currency(budget),
                note:
                    `${integer(projectCount)} active projects`
            },
            {
                icon: "▥",
                label: "Actual Cost",
                value: currency(actual),
                note:
                    budget > 0
                        ? `${pct(actual / budget * 100)} of approved budget`
                        : "Actual cost to date"
            },
            {
                icon: "↗",
                label: "Forecast at Completion",
                value: currency(fac),
                note:
                    forecastVariance < 0
                        ? `${currency(Math.abs(forecastVariance))} above budget`
                        : `${currency(Math.abs(forecastVariance))} below budget`
            },
            {
                icon: "◎",
                label: "Forecast Variance",
                value:
                    currency(
                        forecastVariance
                    ),
                note:
                    budget > 0
                        ? `${pct(forecastVariance / budget * 100)} vs budget`
                        : "Budget minus FAC",
                danger:
                    forecastVariance < 0
            },
            {
                icon: "◔",
                label: "Portfolio Progress",
                value:
                    pct(progress),
                note:
                    `${pct(planned)} planned · ${pp(progressVariance)}`,
                danger:
                    progressVariance < 0
            },
            {
                icon: "✓",
                label: "Validation Quality",
                value:
                    pct(
                        validation,
                        2
                    ),
                note:
                    `${integer(
                        dq.accepted_rows
                    )} accepted records`
            }
        ];

        container.innerHTML =
            cards
                .map(card => `
                    <article class="ov2-kpi">
                        <div class="ov2-kpi-head">
                            <span class="ov2-kpi-icon">
                                ${card.icon}
                            </span>

                            ${esc(card.label)}
                        </div>

                        <strong${
                            card.danger
                                ? ' style="color:#dc2626"'
                                : ""
                        }>
                            ${esc(card.value)}
                        </strong>

                        <small>
                            ${esc(card.note)}
                        </small>

                        <div class="ov2-spark"></div>
                    </article>
                `)
                .join("");
    }

    /* ========================================================
       EXECUTIVE SUMMARY
       ======================================================== */

    function renderSummary(
        kpis,
        attention
    ) {
        const title =
            document.getElementById(
                "ov2-summary-title"
            );

        const detail =
            document.getElementById(
                "ov2-summary-detail"
            );

        const period =
            document.getElementById(
                "ov2-period-label"
            );

        if (period) {
            period.textContent =
                periodLabel();
        }

        if (!title || !detail) {
            return;
        }

        const budget =
            num(
                kpis.total_budget
            );

        const variance =
            num(
                kpis.forecast_variance
            );

        const planned =
            num(
                kpis.planned_progress_pct
            );

        const actual =
            num(
                kpis.actual_progress_pct
            );

        const progressVariance =
            actual - planned;

        const critical =
            num(
                attention?.summary
                    ?.critical_projects
            );

        if (
            variance < 0 &&
            progressVariance < 0
        ) {
            title.textContent =
                "Portfolio performance requires focused management attention.";

            detail.textContent =
                `${critical} critical projects · ` +
                `${currency(
                    Math.abs(variance)
                )} forecast exposure · ` +
                `${pp(
                    progressVariance
                )} progress variance.`;

            return;
        }

        if (variance < 0) {
            title.textContent =
                "Portfolio delivery remains controlled with forecast pressure requiring review.";

            detail.textContent =
                `${critical} critical projects · ` +
                `${currency(
                    Math.abs(variance)
                )} forecast above approved budget.`;

            return;
        }

        title.textContent =
            "Portfolio remains broadly controlled across cost and delivery.";

        detail.textContent =
            `${critical} critical projects · ` +
            `${pct(actual)} actual portfolio progress.`;
    }

    /* ========================================================
       MANAGEMENT ATTENTION
       ======================================================== */

    function renderAttention(
        attention
    ) {
        const container =
            document.getElementById(
                "ov2-attention"
            );

        if (!container) {
            return;
        }

        const projects =
            Array.isArray(
                attention.projects
            )
                ? attention.projects
                : [];

        const rows =
            projects.slice(
                0,
                5
            );

        container.innerHTML = `
            <div class="ov2-attention-row header">
                <span>#</span>
                <span>Project</span>
                <span>Score</span>
                <span>Primary Driver</span>
                <span>Variance</span>
            </div>

            ${
                rows.length
                    ? rows
                        .map(project => {
                            const level =
                                String(
                                    project
                                        .attention_level
                                    || ""
                                )
                                    .toLowerCase();

                            const forecast =
                                num(
                                    project
                                        .forecast_variance_pct
                                );

                            const progress =
                                num(
                                    project
                                        .progress_variance_pct
                                );

                            const useProgress =
                                Math.abs(progress) >
                                Math.abs(forecast);

                            return `
                                <div
                                    class="ov2-attention-row"
                                    data-ov2-project="${esc(
                                        project.project_code
                                    )}"
                                >
                                    <span>
                                        ${integer(
                                            project.rank
                                        )}
                                    </span>

                                    <div class="ov2-project">
                                        <strong>
                                            ${esc(
                                                project
                                                    .project_name
                                            )}
                                        </strong>

                                        <span>
                                            ${esc(
                                                project
                                                    .project_code
                                            )}
                                        </span>
                                    </div>

                                    <span
                                        class="ov2-score ${
                                            level === "watch"
                                                ? "watch"
                                                : level === "stable"
                                                    ? "stable"
                                                    : ""
                                        }"
                                    >
                                        ${integer(
                                            project
                                                .attention_score
                                        )}
                                    </span>

                                    <span>
                                        ${esc(
                                            project
                                                .primary_driver
                                            || "Review"
                                        )}
                                    </span>

                                    <span
                                        class="${
                                            (
                                                forecast < 0 ||
                                                progress < 0
                                            )
                                                ? "ov2-negative"
                                                : ""
                                        }"
                                    >
                                        ${
                                            useProgress
                                                ? pp(progress)
                                                : pct(forecast)
                                        }
                                    </span>
                                </div>
                            `;
                        })
                        .join("")
                    : `
                        <div class="ov2-attention-row">
                            <span></span>
                            <span>No attention data available.</span>
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    `
            }
        `;

        container
            .querySelectorAll(
                "[data-ov2-project]"
            )
            .forEach(row => {
                row.addEventListener(
                    "click",
                    async () => {
                        const code =
                            row.dataset
                                .ov2Project;

                        if (!code) {
                            return;
                        }

                        window.selectedProjectCode =
                            code;

                        try {
                            sessionStorage.setItem(
                                "controlsight:selected-project",
                                code
                            );
                        } catch {
                            // ignore
                        }

                        if (
                            typeof window.loadProjectOverview ===
                            "function"
                        ) {
                            await window
                                .loadProjectOverview(
                                    code
                                );
                        }

                        navigate(
                            "#project-detail"
                        );
                    }
                );
            });
    }

    /* ========================================================
       EXPOSURE CHART
       ======================================================== */

    function renderExposure(
        projects
    ) {
        const container =
            document.getElementById(
                "ov2-exposure-chart"
            );

        if (!container) {
            return;
        }

        const rows =
            Array.isArray(projects)
                ? [...projects]
                : [];

        rows.sort(
            (a, b) =>
                Math.abs(
                    num(
                        b.forecast_variance
                    )
                ) -
                Math.abs(
                    num(
                        a.forecast_variance
                    )
                )
        );

        const top =
            rows.slice(
                0,
                5
            );

        if (!top.length) {
            container.innerHTML =
                '<div style="padding:20px;color:#94a3b8;font-size:9px">No exposure data available.</div>';
            return;
        }

        const maximum =
            Math.max(
                ...top.flatMap(
                    project => [
                        num(
                            project
                                .approved_budget
                        ),
                        num(
                            project
                                .forecast_at_completion
                        )
                    ]
                ),
                1
            );

        container.innerHTML = `
            <div class="ov2-chart">
                ${top
                    .map(project => {
                        const budget =
                            num(
                                project
                                    .approved_budget
                            );

                        const fac =
                            num(
                                project
                                    .forecast_at_completion
                            );

                        const budgetHeight =
                            clamp(
                                budget /
                                maximum *
                                100,
                                8,
                                100
                            );

                        const facHeight =
                            clamp(
                                fac /
                                maximum *
                                100,
                                8,
                                100
                            );

                        const overrun =
                            fac >
                            budget;

                        return `
                            <div
                                class="ov2-chart-group"
                                title="${esc(
                                    project.project_name
                                )} · Budget ${currency(
                                    budget
                                )} · FAC ${currency(
                                    fac
                                )}"
                            >
                                <div
                                    class="ov2-bar"
                                    style="height:${budgetHeight}%"
                                ></div>

                                <div
                                    class="ov2-bar fac ${
                                        overrun
                                            ? "risk"
                                            : ""
                                    }"
                                    style="height:${facHeight}%"
                                ></div>
                            </div>
                        `;
                    })
                    .join("")}
            </div>

            <div class="ov2-chart-labels">
                ${top
                    .map(project => `
                        <span>
                            ${esc(
                                String(
                                    project
                                        .project_name
                                    || project
                                        .project_code
                                )
                                    .split(" ")
                                    .slice(0, 2)
                                    .join(" ")
                            )}
                        </span>
                    `)
                    .join("")}
            </div>
        `;
    }

    /* ========================================================
       PORTFOLIO HEALTH
       ======================================================== */

    function renderHealth(
        attention
    ) {
        const container =
            document.getElementById(
                "ov2-health"
            );

        if (!container) {
            return;
        }

        const summary =
            attention.summary || {};

        const critical =
            num(
                summary.critical_projects
            );

        const watch =
            num(
                summary.watch_projects
            );

        const review =
            num(
                summary.review_projects
            );

        const stable =
            num(
                summary.stable_projects
            );

        const total =
            critical +
            watch +
            review +
            stable;

        const safe =
            total || 1;

        const criticalEnd =
            critical / safe * 100;

        const watchEnd =
            criticalEnd +
            watch / safe * 100;

        const reviewEnd =
            watchEnd +
            review / safe * 100;

        container.innerHTML = `
            <div
                class="ov2-donut"
                style="
                    background:
                    conic-gradient(
                        #ef4444 0 ${criticalEnd}%,
                        #f59e0b ${criticalEnd}% ${watchEnd}%,
                        #3b82f6 ${watchEnd}% ${reviewEnd}%,
                        #10b981 ${reviewEnd}% 100%
                    );
                "
            >
                <div class="ov2-donut-center">
                    <strong>
                        ${integer(total)}
                    </strong>

                    <span>
                        Projects
                    </span>
                </div>
            </div>

            <div class="ov2-health-legend">

                <div class="ov2-health-item">
                    <span class="ov2-dot red"></span>
                    <span>Critical</span>
                    <strong>${integer(critical)}</strong>
                </div>

                <div class="ov2-health-item">
                    <span class="ov2-dot amber"></span>
                    <span>Watch</span>
                    <strong>${integer(watch)}</strong>
                </div>

                <div class="ov2-health-item">
                    <span class="ov2-dot blue"></span>
                    <span>Review</span>
                    <strong>${integer(review)}</strong>
                </div>

                <div class="ov2-health-item">
                    <span class="ov2-dot green"></span>
                    <span>Stable</span>
                    <strong>${integer(stable)}</strong>
                </div>

            </div>
        `;
    }

    /* ========================================================
       EXECUTIVE INTELLIGENCE
       ======================================================== */

    function renderIntelligence(
        kpis,
        attention,
        dq
    ) {
        const container =
            document.getElementById(
                "ov2-intelligence"
            );

        if (!container) {
            return;
        }

        const budget =
            num(
                kpis.total_budget
            );

        const variance =
            num(
                kpis.forecast_variance
            );

        const forecastPct =
            budget > 0
                ? Math.abs(
                    variance /
                    budget *
                    100
                )
                : 0;

        const planned =
            num(
                kpis.planned_progress_pct
            );

        const actual =
            num(
                kpis.actual_progress_pct
            );

        const progressVariance =
            actual -
            planned;

        const critical =
            num(
                attention?.summary
                    ?.critical_projects
            );

        const watch =
            num(
                attention?.summary
                    ?.watch_projects
            );

        const validation =
            num(
                dq.validation_pass_rate
            );

        const insights = [
            {
                icon: "↗",
                title:
                    variance < 0
                        ? "Forecast pressure remains elevated"
                        : "Forecast remains within approved budget",
                body:
                    variance < 0
                        ? `Portfolio FAC is ${currency(
                            Math.abs(variance)
                        )} above budget (${pct(
                            forecastPct
                        )}).`
                        : `Portfolio forecast is ${currency(
                            Math.abs(variance)
                        )} below approved budget.`
            },
            {
                icon: "◷",
                title:
                    progressVariance < 0
                        ? "Progress remains behind plan"
                        : "Portfolio progress is on or ahead of plan",
                body:
                    `Actual progress is ${pct(
                        actual
                    )} against ${pct(
                        planned
                    )} planned (${pp(
                        progressVariance
                    )}).`
            },
            {
                icon: "!",
                title:
                    `${integer(
                        critical
                    )} projects require critical attention`,
                body:
                    `${integer(
                        watch
                    )} additional projects are currently classified as Watch.`
            },
            {
                icon: "✓",
                title:
                    "Data quality remains controlled",
                body:
                    `${pct(
                        validation,
                        2
                    )} validation pass rate with ${integer(
                        dq.quarantined_rows
                    )} quarantined records.`
            }
        ];

        container.innerHTML =
            insights
                .map(item => `
                    <div class="ov2-item">
                        <span class="ov2-item-icon">
                            ${item.icon}
                        </span>

                        <div>
                            <strong>
                                ${esc(item.title)}
                            </strong>

                            <p>
                                ${esc(item.body)}
                            </p>
                        </div>
                    </div>
                `)
                .join("");
    }

    /* ========================================================
       WORKFLOW ACTIONS
       ======================================================== */

    async function loadActions(
        attention,
        token
    ) {
        const projects =
            Array.isArray(
                attention.projects
            )
                ? attention.projects
                    .slice(0, 5)
                : [];

        const period =
            selectedPeriod();

        const responses =
            await Promise.allSettled(
                projects.map(
                    project =>
                        getJson(
                            `/api/projects/${encodeURIComponent(
                                project.project_code
                            )}/workflow/actions${
                                period
                                    ? `?reporting_period=${encodeURIComponent(
                                        period
                                    )}`
                                    : ""
                            }`
                        )
                )
            );

        if (
            token !==
            refreshToken
        ) {
            return [];
        }

        const actions = [];

        responses.forEach(
            (response, index) => {
                if (
                    response.status !==
                    "fulfilled"
                ) {
                    return;
                }

                const project =
                    projects[index];

                const rows =
                    Array.isArray(
                        response.value.actions
                    )
                        ? response.value.actions
                        : [];

                rows.forEach(action => {
                    if (
                        String(
                            action.status
                        ).toLowerCase() ===
                        "closed"
                    ) {
                        return;
                    }

                    actions.push({
                        ...action,
                        project_name:
                            project
                                .project_name
                    });
                });
            }
        );

        actions.sort(
            (a, b) => {
                const priorityRank = {
                    Critical: 1,
                    High: 2,
                    Medium: 3,
                    Low: 4
                };

                const first =
                    priorityRank[
                        a.priority
                    ] ?? 5;

                const second =
                    priorityRank[
                        b.priority
                    ] ?? 5;

                if (
                    first !==
                    second
                ) {
                    return (
                        first -
                        second
                    );
                }

                return String(
                    a.due_date || ""
                ).localeCompare(
                    String(
                        b.due_date || ""
                    )
                );
            }
        );

        return actions.slice(
            0,
            4
        );
    }

    function renderActions(
        actions,
        attention
    ) {
        const container =
            document.getElementById(
                "ov2-actions"
            );

        if (!container) {
            return;
        }

        if (actions.length) {
            container.innerHTML =
                actions
                    .map(action => `
                        <div class="ov2-action">
                            <div>
                                <strong>
                                    ${esc(
                                        action.issue
                                    )}
                                </strong>

                                <span>
                                    ${esc(
                                        action.project_name
                                        || action.project_code
                                    )}
                                    ·
                                    ${esc(
                                        action.owner_role
                                    )}
                                    ${
                                        action.due_date
                                            ? ` · ${esc(
                                                action.due_date
                                            )}`
                                            : ""
                                    }
                                </span>
                            </div>

                            <div
                                class="ov2-status ${
                                    String(
                                        action.priority
                                    ).toLowerCase() ===
                                    "critical" ||
                                    String(
                                        action.priority
                                    ).toLowerCase() ===
                                    "high"
                                        ? "high"
                                        : ""
                                }"
                            >
                                ${esc(
                                    action.priority
                                    || action.status
                                )}
                            </div>
                        </div>
                    `)
                    .join("");

            return;
        }

        const top =
            Array.isArray(
                attention.projects
            )
                ? attention.projects
                    .slice(0, 4)
                : [];

        container.innerHTML =
            top.length
                ? top
                    .map(project => `
                        <div class="ov2-action">
                            <div>
                                <strong>
                                    Review ${esc(
                                        project.primary_driver
                                        || "project controls"
                                    )} exposure
                                </strong>

                                <span>
                                    ${esc(
                                        project.project_name
                                    )}
                                </span>
                            </div>

                            <div class="ov2-status">
                                Suggested
                            </div>
                        </div>
                    `)
                    .join("")
                : `
                    <div
                        style="
                            padding:18px 0;
                            color:#94a3b8;
                            font-size:8px;
                        "
                    >
                        No open management actions for this reporting period.
                    </div>
                `;
    }

    /* ========================================================
       DATA QUALITY
       ======================================================== */

    function renderDataQuality(
        dq
    ) {
        const container =
            document.getElementById(
                "ov2-dq"
            );

        if (!container) {
            return;
        }

        const rate =
            clamp(
                dq.validation_pass_rate,
                0,
                100
            );

        container.innerHTML = `
            <div class="ov2-dq-score">
                <strong>
                    ${pct(
                        rate,
                        2
                    )}
                </strong>

                <span>
                    Validation pass rate
                </span>
            </div>

            <div class="ov2-track">
                <span
                    style="width:${rate}%"
                ></span>
            </div>

            <div class="ov2-dq-stats">

                <div class="ov2-dq-stat">
                    <span>
                        Accepted
                    </span>

                    <strong>
                        ${integer(
                            dq.accepted_rows
                        )}
                    </strong>
                </div>

                <div class="ov2-dq-stat">
                    <span>
                        Quarantined
                    </span>

                    <strong>
                        ${integer(
                            dq.quarantined_rows
                        )}
                    </strong>
                </div>

                <div class="ov2-dq-stat">
                    <span>
                        Issue Events
                    </span>

                    <strong>
                        ${integer(
                            dq.issue_events
                            ?? dq.total_issues
                        )}
                    </strong>
                </div>

            </div>
        `;
    }

    /* ========================================================
       MASTER REFRESH
       ======================================================== */

    async function refreshOverview() {
        const token =
            ++refreshToken;

        const period =
            document.getElementById(
                "ov2-period-label"
            );

        if (period) {
            period.textContent =
                periodLabel();
        }

        try {
            const [
                kpis,
                projects,
                attention,
                dq
            ] =
                await Promise.all([
                    getJson(
                        periodUrl(
                            "kpis"
                        )
                    ),
                    getJson(
                        periodUrl(
                            "projects"
                        )
                    ),
                    getJson(
                        periodUrl(
                            "portfolio/attention-ranking"
                        )
                    ),
                    getJson(
                        "/api/data-quality"
                    )
                ]);

            if (
                token !==
                refreshToken
            ) {
                return;
            }

            renderKPIs(
                kpis,
                dq,
                attention
            );

            renderSummary(
                kpis,
                attention
            );

            renderAttention(
                attention
            );

            renderExposure(
                projects
            );

            renderHealth(
                attention
            );

            renderIntelligence(
                kpis,
                attention,
                dq
            );

            renderDataQuality(
                dq
            );

            const actions =
                await loadActions(
                    attention,
                    token
                );

            if (
                token !==
                refreshToken
            ) {
                return;
            }

            renderActions(
                actions,
                attention
            );

        } catch (error) {
            console.error(
                "Unable to refresh Overview v2:",
                error
            );

            const title =
                document.getElementById(
                    "ov2-summary-title"
                );

            const detail =
                document.getElementById(
                    "ov2-summary-detail"
                );

            if (title) {
                title.textContent =
                    "Unable to load portfolio intelligence.";
            }

            if (detail) {
                detail.textContent =
                    "Check the API response and browser console.";
            }
        }
    }

    /* ========================================================
       PERIOD CHANGE
       ======================================================== */

    function attachPeriodRefresh() {
        const select =
            document.querySelector(
                "#reporting-period-control select"
            );

        if (!select) {
            window.setTimeout(
                attachPeriodRefresh,
                150
            );
            return;
        }

        if (
            select.dataset
                .overviewV2Refresh ===
            "true"
        ) {
            return;
        }

        select.dataset
            .overviewV2Refresh =
            "true";

        select.addEventListener(
            "change",
            refreshOverview
        );
    }

    /* ========================================================
       DYNAMIC SECONDARY PAGES
       ======================================================== */

    function observeSecondaryModules() {
        const main =
            document.querySelector(
                ".dashboard-content"
            );

        if (!main) {
            return;
        }

        new MutationObserver(
            isolateOverview
        ).observe(
            main,
            {
                childList: true,
                subtree: false
            }
        );
    }

    /* ========================================================
       START
       ======================================================== */

    function start() {
        if (
            !installOverviewShell()
        ) {
            return;
        }

        isolateOverview();
        observeSecondaryModules();
        attachPeriodRefresh();

        window.addEventListener(
            "hashchange",
            () => {
                window.setTimeout(
                    isolateOverview,
                    0
                );
            }
        );

        refreshOverview();
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            start
        );
    } else {
        start();
    }

})();
