/* ============================================================
   CONTROLSIGHT — OVERVIEW V2
   Clean premium live-data implementation
   ============================================================ */

(function () {
    "use strict";

    let refreshToken = 0;

    const SECONDARY_IDS = [
        "project-portfolio",
        "project-detail",
        "data-quality",
        "upload-data",
        "attention-tuning",
        "risk-cashflow",
        "report-pack",
        "change-control"
    ];

    /* ========================================================
       HELPERS
       ======================================================== */

    function num(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function esc(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function integer(value) {
        return Math.round(num(value)).toLocaleString("en-GB");
    }

    function currency(value) {
        const number = num(value);
        const abs = Math.abs(number);
        const sign = number < 0 ? "-" : "";

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
        const number = Number(value);

        return Number.isFinite(number)
            ? `${number.toFixed(decimals)}%`
            : "—";
    }

    function pp(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "—";
        }

        return `${number > 0 ? "+" : ""}${number.toFixed(1)} pp`;
    }

    function clamp(value, min, max) {
        return Math.max(
            min,
            Math.min(max, num(value))
        );
    }

    function reportingSelect() {
        return document.querySelector(
            "#reporting-period-control select"
        );
    }

    function selectedPeriod() {
        return String(
            reportingSelect()?.value || ""
        ).trim();
    }

    function periodLabel(period = selectedPeriod()) {
        const match = /^(\d{4})-(\d{2})$/.exec(period);

        if (!match) {
            return period || "Latest";
        }

        const date = new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            1
        );

        return new Intl.DateTimeFormat(
            "en-GB",
            {
                month: "short",
                year: "numeric"
            }
        ).format(date);
    }

    function previousPeriodLabel(period = selectedPeriod()) {
        const match = /^(\d{4})-(\d{2})$/.exec(period);

        if (!match) {
            return "Previous period";
        }

        const date = new Date(
            Number(match[1]),
            Number(match[2]) - 2,
            1
        );

        return new Intl.DateTimeFormat(
            "en-GB",
            {
                month: "short",
                year: "numeric"
            }
        ).format(date);
    }

    function periodUrl(endpoint) {
        const period = selectedPeriod();
        const base = `/api/${endpoint}`;

        return period
            ? `${base}?reporting_period=${encodeURIComponent(period)}`
            : base;
    }

    async function getJson(url) {
        const response = await fetch(url);

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
            window.navigateToHash(target);
            return;
        }

        window.location.hash = target;
    }

    /* ========================================================
       VIEW ISOLATION
       ======================================================== */

    function isolateOverview() {
        const hash =
            window.location.hash ||
            "#portfolio-overview";

        if (hash !== "#portfolio-overview") {
            return;
        }

        SECONDARY_IDS.forEach(id => {
            const node =
                document.getElementById(id);

            if (!node) {
                return;
            }

            node.style.display = "none";
            node.classList.add("hidden");
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
            overview.classList.remove("hidden");
            overview.setAttribute(
                "aria-hidden",
                "false"
            );
        }
    }

    /* ========================================================
       SHELL
       ======================================================== */

    function installOverview() {
        const overview =
            document.getElementById(
                "portfolio-overview"
            );

        const select =
            reportingSelect();

        if (!overview) {
            return false;
        }

        overview.classList.add(
            "cs-overview-v2"
        );

        overview.innerHTML = `

            <!-- TOP CONTROLS -->

            <div class="ov2-appbar">

                <div class="ov2-app-control">
                    <span class="ov2-app-control-icon">
                        ▣
                    </span>

                    <div class="ov2-app-control-copy">
                        <span class="ov2-app-label">
                            Portfolio
                        </span>

                        <span class="ov2-app-value">
                            Global Infrastructure Portfolio
                        </span>
                    </div>
                </div>


                <div class="ov2-app-control">
                    <div
                        class="ov2-app-control-copy"
                        style="width:100%"
                    >
                        <span class="ov2-app-label">
                            Reporting Period
                        </span>

                        <div id="ov2-period-host"></div>
                    </div>
                </div>


                <div class="ov2-app-control">
                    <div class="ov2-app-control-copy">
                        <span class="ov2-app-label">
                            Comparison Period
                        </span>

                        <span
                            id="ov2-comparison-period"
                            class="ov2-app-value"
                        >
                            ${esc(previousPeriodLabel())}
                        </span>
                    </div>
                </div>


                <label class="ov2-app-search">
                    <span>⌕</span>

                    <input
                        id="ov2-search"
                        type="search"
                        placeholder="Search projects, risks, vendors, or anything..."
                        autocomplete="off"
                    >
                </label>


                <div class="ov2-connected">
                    <span class="ov2-connected-dot"></span>
                    Connected
                </div>

                <button
                    type="button"
                    class="ov2-top-action"
                    aria-label="Notifications"
                >
                    ♢
                    <span class="ov2-notification-dot">
                        3
                    </span>
                </button>

                <div class="ov2-profile">

                    <div class="ov2-profile-avatar">
                        CS
                    </div>

                    <div class="ov2-profile-copy">
                        <strong>
                            Portfolio Owner
                        </strong>

                        <span>
                            Management View
                        </span>
                    </div>

                </div>

            </div>


            <!-- PAGE HEADER -->

            <section class="ov2-page-header">
                <div class="ov2-page-header-copy">
                    <span class="ov2-page-eyebrow">
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
            </section>


            <!-- KPI STRIP -->

            <div
                id="ov2-kpis"
                class="ov2-kpis"
            ></div>


            <!-- MAIN ROW -->

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
                                    Projects ranked by combined risk,
                                    forecast variance and delivery signals.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            class="ov2-link"
                            data-target="#project-portfolio"
                        >
                            View all projects →
                        </button>

                    </div>

                    <div
                        id="ov2-attention"
                        class="ov2-attention-list"
                    ></div>

                </section>


                <section class="ov2-panel">

                    <div class="ov2-panel-head">

                        <div class="ov2-panel-title">
                            <span class="ov2-panel-symbol">
                                ▥
                            </span>

                            <div>
                                <h3>
                                    Budget vs Forecast at Completion
                                </h3>

                                <p>
                                    Approved budget compared with FAC.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            class="ov2-link"
                            data-target="#project-portfolio"
                        >
                            View details →
                        </button>

                    </div>

                    <div id="ov2-exposure-chart"></div>

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
                                    Project status across the portfolio.
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


            <!-- LOWER ROW -->

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
                                    Key insights from portfolio data.
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
                                    Key actions requiring management focus.
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
                                    Data ingestion and validation health.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            class="ov2-link"
                            data-target="#data-quality"
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

        if (select) {
            select.classList.add(
                "ov2-app-select"
            );

            document
                .getElementById(
                    "ov2-period-host"
                )
                ?.appendChild(select);
        }

        const oldControl =
            document.getElementById(
                "reporting-period-control"
            );

        if (oldControl) {
            oldControl.style.display = "none";
        }

        overview
            .querySelectorAll(
                "[data-target]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => navigate(
                        button.dataset.target
                    )
                );
            });

        wireSearch();

        return true;
    }

    /* ========================================================
       KPI RENDER
       ======================================================== */

    function renderKPIs(kpis, dq, attention) {
        const container =
            document.getElementById(
                "ov2-kpis"
            );

        if (!container) {
            return;
        }

        const budget =
            num(kpis.total_budget);

        const actual =
            num(kpis.actual_cost_to_date);

        const fac =
            num(
                kpis.forecast_at_completion
            );

        const variance =
            num(kpis.forecast_variance);

        const progress =
            num(
                kpis.actual_progress_pct
            );

        const planned =
            num(
                kpis.planned_progress_pct
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
                sub:
                    `${integer(projectCount)} active projects`,
                tone: "blue",
                spark:
                    "M2 18 L12 14 L22 15 L32 11 L42 12 L52 8 L62 9 L72 6 L84 7 L98 2"
            },

            {
                icon: "▥",
                label: "Actual Cost",
                value: currency(actual),
                sub:
                    budget > 0
                        ? `${pct(
                            actual /
                            budget *
                            100
                        )} of approved budget`
                        : "Actual cost to date",
                tone: "good",
                spark:
                    "M2 18 L12 16 L22 13 L32 15 L42 9 L52 11 L62 7 L72 9 L84 4 L98 2"
            },

            {
                icon: "↗",
                label: "Forecast at Completion",
                value: currency(fac),
                sub:
                    variance < 0
                        ? `${currency(
                            Math.abs(variance)
                        )} over budget`
                        : `${currency(
                            Math.abs(variance)
                        )} under budget`,
                tone:
                    variance < 0
                        ? "bad"
                        : "good",
                spark:
                    "M2 18 L12 13 L22 15 L32 10 L42 12 L52 7 L62 9 L72 5 L84 7 L98 2"
            },

            {
                icon: "◎",
                label: "Forecast Variance",
                value: currency(variance),
                sub:
                    budget > 0
                        ? `${pct(
                            variance /
                            budget *
                            100
                        )} vs budget`
                        : "Budget minus FAC",
                tone:
                    variance < 0
                        ? "bad"
                        : "good",
                spark:
                    "M2 18 L12 14 L22 16 L32 11 L42 13 L52 8 L62 10 L72 6 L84 7 L98 3"
            },

            {
                icon: "◔",
                label: "Portfolio Progress",
                value: pct(progress),
                sub:
                    `${pct(planned)} planned · ${pp(progressVariance)}`,
                tone:
                    progressVariance < 0
                        ? "bad"
                        : "good",
                spark:
                    "M2 18 L12 15 L22 11 L32 14 L42 9 L52 10 L62 6 L72 8 L84 4 L98 2"
            },

            {
                icon: "✓",
                label: "Validation Quality",
                value: pct(validation, 2),
                sub:
                    `${integer(
                        dq.accepted_rows
                    )} accepted records`,
                tone: "good",
                spark:
                    "M2 18 L12 15 L22 16 L32 11 L42 12 L52 8 L62 9 L72 5 L84 6 L98 2"
            }
        ];

        container.innerHTML =
            cards
                .map(card => `
                    <article class="ov2-kpi">

                        <div class="ov2-kpi-top">

                            <div class="ov2-kpi-label-wrap">

                                <span class="ov2-kpi-icon">
                                    ${card.icon}
                                </span>

                                <span class="ov2-kpi-label">
                                    ${esc(card.label)}
                                </span>

                            </div>

                        </div>

                        <strong
                            class="
                                ov2-kpi-value
                                ${
                                    card.tone === "bad"
                                        ? "bad"
                                        : ""
                                }
                            "
                        >
                            ${esc(card.value)}
                        </strong>

                        <span class="ov2-kpi-sub">
                            ${esc(card.sub)}
                        </span>

                        <div
                            class="
                                ov2-sparkline
                                ${card.tone}
                            "
                        >
                            <svg
                                viewBox="0 0 100 22"
                                preserveAspectRatio="none"
                                aria-hidden="true"
                            >
                                <path
                                    d="${card.spark}"
                                />
                            </svg>
                        </div>

                    </article>
                `)
                .join("");
    }

    /* ========================================================
       MANAGEMENT ATTENTION
       ======================================================== */

    function renderAttention(data) {
        const container =
            document.getElementById(
                "ov2-attention"
            );

        if (!container) {
            return;
        }

        const projects =
            Array.isArray(data.projects)
                ? data.projects.slice(0, 5)
                : [];

        container.innerHTML = `
            <div class="ov2-attention-row header">
                <span>#</span>
                <span>Project</span>
                <span>Score</span>
                <span>Primary Driver</span>
                <span>Variance</span>
            </div>

            ${projects.map(project => {
                const level =
                    String(
                        project.attention_level
                        || ""
                    ).toLowerCase();

                const forecast =
                    num(
                        project.forecast_variance_pct
                    );

                const progress =
                    num(
                        project.progress_variance_pct
                    );

                const useProgress =
                    Math.abs(progress) >
                    Math.abs(forecast);

                return `
                    <div
                        class="ov2-attention-row"
                        data-project="${esc(
                            project.project_code
                        )}"
                    >
                        <span>
                            ${integer(project.rank)}
                        </span>

                        <div class="ov2-project">
                            <strong>
                                ${esc(
                                    project.project_name
                                )}
                            </strong>

                            <span>
                                ${esc(
                                    project.project_code
                                )}
                            </span>
                        </div>

                        <span
                            class="
                                ov2-score
                                ${
                                    level === "watch"
                                        ? "watch"
                                        : level === "stable"
                                            ? "stable"
                                            : ""
                                }
                            "
                        >
                            ${integer(
                                project.attention_score
                            )}
                        </span>

                        <span>
                            ${esc(
                                project.primary_driver
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
            }).join("")}
        `;

        container
            .querySelectorAll(
                "[data-project]"
            )
            .forEach(row => {
                row.addEventListener(
                    "click",
                    async () => {
                        const code =
                            row.dataset.project;

                        if (!code) {
                            return;
                        }

                        window.selectedProjectCode =
                            code;

                        if (
                            typeof window
                                .loadProjectOverview ===
                            "function"
                        ) {
                            await window
                                .loadProjectOverview(code);
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


    function renderExposure(projects) {
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
                    num(b.forecast_variance)
                ) -
                Math.abs(
                    num(a.forecast_variance)
                )
        );

        const top =
            rows.slice(0, 5);

        if (!top.length) {
            container.innerHTML =
                '<div style="padding:20px;color:#94a3b8;font-size:8px">No project exposure data available.</div>';
            return;
        }

        const maxValue =
            Math.max(
                ...top.flatMap(
                    project => [
                        num(
                            project.approved_budget
                        ),
                        num(
                            project.forecast_at_completion
                        )
                    ]
                ),
                1
            );

        const niceStep =
            maxValue <= 25_000_000
                ? 5_000_000
                : maxValue <= 60_000_000
                    ? 10_000_000
                    : maxValue <= 120_000_000
                        ? 20_000_000
                        : 50_000_000;

        const chartMax =
            Math.ceil(
                maxValue /
                niceStep
            ) * niceStep;

        const width = 520;
        const height = 225;

        const left = 48;
        const right = 12;
        const topPadding = 15;
        const bottom = 43;

        const plotWidth =
            width - left - right;

        const plotHeight =
            height - topPadding - bottom;

        const groupWidth =
            plotWidth / top.length;

        const barWidth = 22;

        function y(value) {
            return (
                topPadding +
                plotHeight -
                (
                    num(value) /
                    chartMax
                ) *
                plotHeight
            );
        }

        const gridLines = [];

        for (
            let value = 0;
            value <= chartMax;
            value += niceStep
        ) {

            const yPos =
                y(value);

            gridLines.push(`
                <line
                    class="ov2-exposure-grid"
                    x1="${left}"
                    y1="${yPos}"
                    x2="${width - right}"
                    y2="${yPos}"
                />

                <text
                    class="ov2-exposure-axis-label"
                    x="${left - 8}"
                    y="${yPos + 3}"
                    text-anchor="end"
                >
                    ${
                        value === 0
                            ? "£0"
                            : `£${Math.round(
                                value /
                                1_000_000
                            )}m`
                    }
                </text>
            `);
        }


        const bars =
            top.map(
                (project, index) => {

                    const budget =
                        num(
                            project.approved_budget
                        );

                    const fac =
                        num(
                            project.forecast_at_completion
                        );

                    const groupX =
                        left +
                        index *
                        groupWidth;

                    const center =
                        groupX +
                        groupWidth /
                        2;

                    const budgetX =
                        center -
                        barWidth -
                        3;

                    const facX =
                        center +
                        3;

                    const budgetY =
                        y(budget);

                    const facY =
                        y(fac);

                    const budgetHeight =
                        topPadding +
                        plotHeight -
                        budgetY;

                    const facHeight =
                        topPadding +
                        plotHeight -
                        facY;

                    const variance =
                        fac - budget;

                    const markerY =
                        Math.min(
                            budgetY,
                            facY
                        ) - 6;

                    const words =
                        String(
                            project.project_name
                            || project.project_code
                        )
                            .split(" ");

                    const label1 =
                        words
                            .slice(0, 2)
                            .join(" ");

                    const label2 =
                        words
                            .slice(2, 4)
                            .join(" ");

                    return `

                        <g
                            class="ov2-exposure-project"
                            data-project="${esc(
                                project.project_code
                            )}"
                        >

                            <rect
                                class="ov2-exposure-budget"
                                x="${budgetX}"
                                y="${budgetY}"
                                width="${barWidth}"
                                height="${budgetHeight}"
                                rx="3"
                            >
                                <title>
                                    ${esc(
                                        project.project_name
                                    )} — Budget ${currency(
                                        budget
                                    )}
                                </title>
                            </rect>

                            <rect
                                class="
                                    ov2-exposure-fac
                                    ${
                                        fac > budget
                                            ? "over"
                                            : ""
                                    }
                                "
                                x="${facX}"
                                y="${facY}"
                                width="${barWidth}"
                                height="${facHeight}"
                                rx="3"
                            >
                                <title>
                                    ${esc(
                                        project.project_name
                                    )} — FAC ${currency(
                                        fac
                                    )}
                                </title>
                            </rect>

                            ${
                                variance > 0
                                    ? `
                                        <circle
                                            class="ov2-exposure-variance"
                                            cx="${
                                                center
                                            }"
                                            cy="${
                                                markerY
                                            }"
                                            r="4"
                                        >
                                            <title>
                                                Forecast overrun ${currency(
                                                    variance
                                                )}
                                            </title>
                                        </circle>
                                    `
                                    : ""
                            }

                            <text
                                class="ov2-exposure-project-label"
                                x="${center}"
                                y="${height - 22}"
                                text-anchor="middle"
                            >
                                ${esc(label1)}
                            </text>

                            ${
                                label2
                                    ? `
                                        <text
                                            class="ov2-exposure-project-label"
                                            x="${center}"
                                            y="${height - 12}"
                                            text-anchor="middle"
                                        >
                                            ${esc(label2)}
                                        </text>
                                    `
                                    : ""
                            }

                        </g>
                    `;
                }
            )
            .join("");


        container.innerHTML = `

            <div class="ov2-exposure-wrap">

                <svg
                    class="ov2-exposure-svg"
                    viewBox="0 0 ${width} ${height}"
                    preserveAspectRatio="xMidYMid meet"
                    role="img"
                    aria-label="Approved budget versus forecast at completion by project"
                >

                    ${gridLines.join("")}

                    ${bars}

                </svg>


                <div class="ov2-exposure-legend">

                    <span>
                        <i class="budget"></i>
                        Approved Budget
                    </span>

                    <span>
                        <i class="fac"></i>
                        Forecast at Completion
                    </span>

                    <span>
                        <i class="variance"></i>
                        Forecast Overrun
                    </span>

                </div>

            </div>
        `;
    }


    /* ========================================================
       HEALTH
       ======================================================== */

    function renderHealth(data) {
        const container =
            document.getElementById(
                "ov2-health"
            );

        if (!container) {
            return;
        }

        const summary =
            data.summary || {};

        const critical =
            num(summary.critical_projects);

        const watch =
            num(summary.watch_projects);

        const review =
            num(summary.review_projects);

        const stable =
            num(summary.stable_projects);

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
                    )
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
       INTELLIGENCE
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
            num(kpis.total_budget);

        const variance =
            num(kpis.forecast_variance);

        const progress =
            num(kpis.actual_progress_pct);

        const planned =
            num(kpis.planned_progress_pct);

        const lag =
            progress - planned;

        const critical =
            num(
                attention?.summary
                    ?.critical_projects
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
                        : "Forecast remains controlled",
                body:
                    variance < 0
                        ? `Portfolio FAC is ${currency(
                            Math.abs(variance)
                        )} above approved budget.`
                        : `Portfolio forecast remains within approved budget.`
            },

            {
                icon: "◷",
                title:
                    lag < 0
                        ? "Progress remains behind plan"
                        : "Portfolio progress is on plan",
                body:
                    `${pct(progress)} actual against ${pct(
                        planned
                    )} planned (${pp(lag)}).`
            },

            {
                icon: "!",
                title:
                    `${integer(
                        critical
                    )} critical projects require attention`,
                body:
                    "Management Attention highlights the projects requiring review."
            },

            {
                icon: "✓",
                title:
                    "Data quality remains strong",
                body:
                    `${pct(
                        validation,
                        2
                    )} of evaluated records passed validation.`
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
       ACTIONS
       ======================================================== */

    async function loadActions(
        attention,
        token
    ) {
        const projects =
            Array.isArray(
                attention.projects
            )
                ? attention.projects.slice(0, 5)
                : [];

        const period =
            selectedPeriod();

        const responses =
            await Promise.allSettled(
                projects.map(project =>
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

        if (token !== refreshToken) {
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
                            project.project_name
                    });
                });
            }
        );

        const priorityRank = {
            Critical: 1,
            High: 2,
            Medium: 3,
            Low: 4
        };

        actions.sort(
            (a, b) =>
                (
                    priorityRank[
                        a.priority
                    ] ?? 5
                ) -
                (
                    priorityRank[
                        b.priority
                    ] ?? 5
                )
        );

        return actions.slice(0, 4);
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
                actions.map(action => `
                    <div class="ov2-action">

                        <div>
                            <strong>
                                ${esc(action.issue)}
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
                            </span>
                        </div>

                        <div
                            class="
                                ov2-status
                                ${
                                    ["Critical", "High"]
                                        .includes(
                                            action.priority
                                        )
                                        ? "high"
                                        : ""
                                }
                            "
                        >
                            ${esc(
                                action.priority
                                || action.status
                            )}
                        </div>

                    </div>
                `).join("");

            return;
        }

        const projects =
            Array.isArray(
                attention.projects
            )
                ? attention.projects.slice(0, 4)
                : [];

        container.innerHTML =
            projects.map(project => `
                <div class="ov2-action">

                    <div>
                        <strong>
                            Review ${esc(
                                project.primary_driver
                                || "project controls"
                            )}
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
            `).join("");
    }

    /* ========================================================
       DATA QUALITY
       ======================================================== */

    function renderDQ(dq) {
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
                    ${pct(rate, 2)}
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
                    <span>Accepted</span>
                    <strong>
                        ${integer(
                            dq.accepted_rows
                        )}
                    </strong>
                </div>

                <div class="ov2-dq-stat">
                    <span>Quarantined</span>
                    <strong>
                        ${integer(
                            dq.quarantined_rows
                        )}
                    </strong>
                </div>

                <div class="ov2-dq-stat">
                    <span>Issue Events</span>
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
       SEARCH
       ======================================================== */

    function wireSearch() {
        const input =
            document.getElementById(
                "ov2-search"
            );

        if (!input) {
            return;
        }

        input.addEventListener(
            "keydown",
            event => {
                if (event.key !== "Enter") {
                    return;
                }

                const term =
                    input.value
                        .trim()
                        .toLowerCase();

                if (!term) {
                    return;
                }

                const match =
                    Array.from(
                        document.querySelectorAll(
                            "[data-project]"
                        )
                    ).find(row =>
                        row.textContent
                            .toLowerCase()
                            .includes(term)
                    );

                if (match) {
                    match.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });

                    match.animate(
                        [
                            {
                                background:
                                    "#dbeafe"
                            },
                            {
                                background:
                                    ""
                            }
                        ],
                        {
                            duration: 900
                        }
                    );
                }
            }
        );
    }

    /* ========================================================
       MASTER REFRESH
       ======================================================== */

    async function refreshOverview() {
        const token =
            ++refreshToken;

        const comparison =
            document.getElementById(
                "ov2-comparison-period"
            );

        if (comparison) {
            comparison.textContent =
                previousPeriodLabel();
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
                        periodUrl("kpis")
                    ),
                    getJson(
                        periodUrl("projects")
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

            if (token !== refreshToken) {
                return;
            }

            renderKPIs(
                kpis,
                dq,
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

            renderDQ(dq);

            const actions =
                await loadActions(
                    attention,
                    token
                );

            if (token !== refreshToken) {
                return;
            }

            renderActions(
                actions,
                attention
            );

        } catch (error) {
            console.error(
                "Overview v2 refresh failed:",
                error
            );
        }
    }

    /* ========================================================
       PERIOD CHANGE
       ======================================================== */

    function attachPeriodListener() {
        const select =
            reportingSelect();

        if (!select) {
            setTimeout(
                attachPeriodListener,
                150
            );
            return;
        }

        if (
            select.dataset
                .overviewPremiumListener ===
            "true"
        ) {
            return;
        }

        select.dataset
            .overviewPremiumListener =
            "true";

        select.addEventListener(
            "change",
            refreshOverview
        );
    }

    /* ========================================================
       START
       ======================================================== */

    function start() {
        if (!installOverview()) {
            return;
        }

        isolateOverview();
        attachPeriodListener();
        refreshOverview();

        window.addEventListener(
            "hashchange",
            () => {
                setTimeout(
                    isolateOverview,
                    0
                );
            }
        );
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
