(() => {
    "use strict";

    const DEFAULT_PERIOD = "2026-08";
    const DEFAULT_COMPARISON = "2026-07";

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const escapeHtml = (value) =>
        String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    const number = (value, fallback = 0) => {
        const result = Number(value);
        return Number.isFinite(result) ? result : fallback;
    };

    const money = (value, decimals = 1) => {
        const n = number(value);
        const abs = Math.abs(n);

        let formatted;

        if (abs >= 1_000_000_000) {
            formatted =
                `£${(abs / 1_000_000_000).toFixed(decimals)}bn`;
        } else if (abs >= 1_000_000) {
            formatted =
                `£${(abs / 1_000_000).toFixed(decimals)}m`;
        } else if (abs >= 1_000) {
            formatted =
                `£${(abs / 1_000).toFixed(decimals)}k`;
        } else {
            formatted =
                `£${abs.toFixed(0)}`;
        }

        return n < 0 ? `−${formatted}` : formatted;
    };

    const pct = (value, decimals = 1) =>
        `${number(value).toFixed(decimals)}%`;

    const absPct = (value, decimals = 1) =>
        `${Math.abs(number(value)).toFixed(decimals)}%`;

    const monthLabel = (yearMonth) => {
        if (!yearMonth) return "—";

        const [year, month] =
            String(yearMonth).split("-").map(Number);

        if (!year || !month) return yearMonth;

        return new Date(
            year,
            month - 1,
            1
        ).toLocaleDateString(
            "en-GB",
            {
                month: "short",
                year: "numeric"
            }
        );
    };

    async function getJSON(url) {
        const response = await fetch(url, {
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(
                `${response.status} ${response.statusText}: ${url}`
            );
        }

        return response.json();
    }

    function api(path, period) {
        if (!period) {
            return `/api/${path}`;
        }

        return (
            `/api/${path}` +
            `?reporting_period=${encodeURIComponent(period)}`
        );
    }

    function svgIcon(name) {
        const icons = {
            briefcase: `
                <svg viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8">
                    <rect x="3" y="7" width="18" height="12" rx="2"/>
                    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            `,
            search: `
                <svg viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8">
                    <circle cx="11" cy="11" r="7"/>
                    <path d="m20 20-4-4"/>
                </svg>
            `,
            bell: `
                <svg viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
                    <path d="M10 21h4"/>
                </svg>
            `,
            budget: `
                <svg viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8">
                    <rect x="3" y="5" width="18" height="14" rx="2"/>
                    <path d="M7 9h10M7 13h5"/>
                </svg>
            `,
            cost: `
                <svg viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M15 8.5c-.7-.7-1.7-1-3-1-1.7 0-3 1-3 2.4 0 1.5 1.2 2.1 3 2.5 1.8.4 3 .9 3 2.5 0 1.5-1.3 2.6-3.2 2.6-1.3 0-2.5-.4-3.3-1.3M12 5v14"/>
                </svg>
            `,
            forecast: `
                <svg viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8">
                    <path d="M4 18V6M4 18h16"/>
                    <path d="m7 14 4-4 3 2 5-6"/>
                </svg>
            `,
            variance: `
                <svg viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8">
                    <path d="M4 5h16M4 19h16"/>
                    <path d="M8 9h8M10 13h4"/>
                </svg>
            `,
            progress: `
                <svg viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 7v5l4 2"/>
                </svg>
            `,
            quality: `
                <svg viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8">
                    <path d="m5 12 4 4L19 6"/>
                </svg>
            `,
            alert: `
                <svg viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 7v6M12 17h.01"/>
                </svg>
            `,
            chart: `
                <svg viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8">
                    <path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>
                </svg>
            `,
            health: `
                <svg viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8">
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>
                </svg>
            `,
            bulb: `
                <svg viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8">
                    <path d="M9 18h6M10 22h4"/>
                    <path d="M8.5 15.5A7 7 0 1 1 15.5 15.5c-.8.7-1.2 1.5-1.4 2.5h-4.2c-.2-1-.6-1.8-1.4-2.5Z"/>
                </svg>
            `,
            checkbox: `
                <svg viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8">
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                    <path d="m8 12 3 3 5-6"/>
                </svg>
            `,
            database: `
                <svg viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8">
                    <ellipse cx="12" cy="5" rx="8" ry="3"/>
                    <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/>
                    <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>
                </svg>
            `
        };

        return icons[name] || icons.chart;
    }

    function sparkline(values, tone = "blue") {
        const colors = {
            blue: "#1464f4",
            green: "#18b26b",
            red: "#f04444"
        };

        const width = 54;
        const height = 22;

        const min = Math.min(...values);
        const max = Math.max(...values);

        const points = values.map((value, index) => {
            const x =
                index * (width / (values.length - 1));

            const ratio =
                max === min
                    ? 0.5
                    : (value - min) / (max - min);

            const y =
                height -
                3 -
                ratio * (height - 6);

            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(" ");

        return `
            <svg class="po-kpi-spark"
                 viewBox="0 0 ${width} ${height}"
                 aria-hidden="true">
                <polyline
                    points="${points}"
                    fill="none"
                    stroke="${colors[tone] || colors.blue}"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
        `;
    }

    function panelHeader({
        icon,
        iconTone = "blue",
        title,
        subtitle,
        link = ""
    }) {
        return `
            <div class="po-panel-head">
                <div class="po-panel-title-wrap">
                    <div class="po-panel-icon po-icon-${iconTone}">
                        ${svgIcon(icon)}
                    </div>

                    <div>
                        <h3>${escapeHtml(title)}</h3>
                        <p>${escapeHtml(subtitle)}</p>
                    </div>
                </div>

                ${
                    link
                        ? `<a href="#" class="po-panel-link">${escapeHtml(link)} →</a>`
                        : ""
                }
            </div>
        `;
    }

    function installShell() {
        const mainShell = $(".main-shell");

        if (!mainShell) {
            return;
        }

        let premium =
            $("#premium-overview");

        if (!premium) {
            premium =
                document.createElement("div");

            premium.id =
                "premium-overview";

            premium.className =
                "premium-overview";

            mainShell.prepend(premium);
        }

        premium.innerHTML = `
            <header class="po-topbar">
                <div class="po-top-select">
                    ${svgIcon("briefcase")}
                    <span>Global Infrastructure Portfolio</span>
                </div>

                <label class="po-period-control">
                    <span>Reporting Period</span>
                    <select id="po-reporting-period"></select>
                </label>

                <label class="po-period-control">
                    <span>Comparison</span>
                    <select id="po-comparison-period"></select>
                </label>

                <label class="po-search">
                    ${svgIcon("search")}
                    <input
                        id="po-search"
                        type="search"
                        placeholder="Search projects, risks, vendors, or anything..."
                    >
                </label>

                <div class="po-connected">
                    <span class="po-connected-dot"></span>
                    Connected
                </div>

                <button
                    class="po-notification"
                    type="button"
                    aria-label="Notifications"
                >
                    ${svgIcon("bell")}
                    <span class="po-notification-badge">3</span>
                </button>

                <div class="po-profile">
                    <img
                        src="/assets/avatar-ansh.jpg"
                        alt=""
                    >

                    <div class="po-profile-copy">
                        <strong>Ansh Bhardwaj</strong>
                        <span>Portfolio Owner</span>
                    </div>
                </div>
            </header>

            <main class="po-content">
                <section class="po-hero">
                    <img
                        src="/assets/hero-mountains.jpg"
                        alt=""
                    >

                    <div class="po-hero-copy">
                        <span class="po-eyebrow">
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

                    <div class="po-hero-quote">
                        Greater visibility.<br>
                        Stronger decisions.<br>
                        Better outcomes.
                    </div>
                </section>

                <section
                    id="po-kpi-grid"
                    class="po-kpi-grid"
                ></section>

                <div class="po-main-grid">
                    <section
                        id="po-attention-panel"
                        class="po-panel"
                    ></section>

                    <section
                        id="po-chart-panel"
                        class="po-panel"
                    ></section>

                    <section
                        id="po-health-panel"
                        class="po-panel"
                    ></section>
                </div>

                <div class="po-bottom-grid">
                    <section
                        id="po-intelligence-panel"
                        class="po-panel"
                    ></section>

                    <section
                        id="po-actions-panel"
                        class="po-panel"
                    ></section>

                    <section
                        id="po-data-quality-panel"
                        class="po-panel"
                    ></section>
                </div>
            </main>
        `;

        document.body.classList.add(
            "premium-overview-active"
        );

        const oldTopbar =
            $(".main-shell > .topbar");

        if (oldTopbar) {
            oldTopbar.style.display = "none";
        }

        const dashboardContent =
            $(".main-shell > .dashboard-content");

        if (dashboardContent) {
            dashboardContent.style.display = "none";
        }

        installSidebarCard();
    }

    function installSidebarCard() {
        const footer =
            $(".sidebar-footer");

        if (!footer) {
            return;
        }

        footer.innerHTML = `
            <div class="po-sidebar-card">
                <img
                    src="/assets/sidebar-bridge.jpg"
                    alt=""
                >

                <div class="po-sidebar-card-copy">
                    <strong>
                        Turning project data into clearer decisions.
                    </strong>

                    <div class="po-sidebar-card-footer">
                        <span>ControlSight</span>
                        <span>v2.4.0</span>
                    </div>
                </div>
            </div>
        `;
    }

    function renderKpis(
        current,
        previous,
        dq
    ) {
        const budget =
            number(current.total_budget);

        const actual =
            number(current.actual_cost_to_date);

        const fac =
            number(current.forecast_at_completion);

        const variance =
            number(current.forecast_variance);

        const variancePct =
            number(current.forecast_variance_pct);

        const progress =
            number(current.actual_progress_pct);

        const quality =
            number(dq.validation_pass_rate);

        const previousBudget =
            number(previous?.total_budget, budget);

        const previousActual =
            number(previous?.actual_cost_to_date, actual);

        const previousFac =
            number(previous?.forecast_at_completion, fac);

        const previousProgress =
            number(previous?.actual_progress_pct, progress);

        const delta =
            (value, oldValue) =>
                oldValue
                    ? ((value - oldValue) / oldValue) * 100
                    : 0;

        const cards = [
            {
                label: "Approved Budget",
                value: money(budget),
                trend: delta(
                    budget,
                    previousBudget
                ),
                trendDir: delta(
                    budget,
                    previousBudget
                ) >= 0 ? "↑" : "↓",
                good: true,
                caption: "vs. prior period",
                icon: "budget",
                iconClass: "",
                sparkTone: "blue",
                spark: [3,4,3.6,4.8,4.4,5.6,5.2,6.4,6,7.2]
            },
            {
                label: "Actual Cost",
                value: money(actual),
                trend: delta(
                    actual,
                    previousActual
                ),
                trendDir: "↑",
                good: true,
                caption:
                    budget > 0
                        ? `${((actual / budget) * 100).toFixed(1)}% of budget`
                        : "Cost to date",
                icon: "cost",
                iconClass: "",
                sparkTone: "green",
                spark: [2,3,2.6,3.8,3.2,4.6,4.2,5.4,5.1,6.6]
            },
            {
                label: "Forecast at Completion",
                value: money(fac),
                trend: Math.abs(
                    delta(
                        fac,
                        previousFac
                    )
                ),
                trendDir:
                    fac >= previousFac ? "↑" : "↓",
                good:
                    fac <= budget,
                caption:
                    fac > budget
                        ? `${money(fac - budget)} <span class="danger">over budget</span>`
                        : `${money(budget - fac)} under budget`,
                icon: "forecast",
                iconClass: "",
                sparkTone: "red",
                spark: [2,2.8,2.4,3.6,3.1,4.4,4,5.3,4.9,6.5]
            },
            {
                label: "Forecast Variance",
                value: money(variance),
                trend:
                    Math.abs(
                        number(
                            previous?.forecast_variance_pct
                        ) -
                        variancePct
                    ),
                trendDir:
                    variancePct >
                    number(previous?.forecast_variance_pct)
                        ? "↑"
                        : "↓",
                good:
                    variance >=
                    number(previous?.forecast_variance, variance),
                caption:
                    `${variancePct.toFixed(1)}% vs. budget`,
                icon: "variance",
                iconClass: "violet",
                sparkTone: "green",
                spark: [2.5,3.2,2.8,4,3.5,4.8,4.3,5.5,5,6.3]
            },
            {
                label: "Portfolio Progress",
                value: `${progress.toFixed(1)}%`,
                trend:
                    Math.abs(
                        progress -
                        previousProgress
                    ),
                trendDir:
                    progress >= previousProgress ? "↑" : "↓",
                good:
                    progress >= previousProgress,
                caption:
                    `vs. ${previousProgress.toFixed(1)}% last period`,
                icon: "progress",
                iconClass: "",
                sparkTone: "blue",
                spark: [2,3,2.5,3.9,3.4,4.7,4.1,5.6,5.2,6.4],
                points: true
            },
            {
                label: "Validation Quality",
                value:
                    Number.isFinite(quality)
                        ? `${quality.toFixed(2)}%`
                        : "—",
                trend: 0,
                trendDir: "↑",
                good: true,
                caption:
                    "of records accepted",
                icon: "quality",
                iconClass: "green",
                sparkTone: "blue",
                spark: [3,3.8,3.3,4.5,4,5,4.6,5.7,5.3,6.2]
            }
        ];

        $("#po-kpi-grid").innerHTML =
            cards.map(card => `
                <article class="po-kpi">
                    <div class="po-kpi-top">
                        <div class="po-kpi-icon ${card.iconClass}">
                            ${svgIcon(card.icon)}
                        </div>

                        <div class="po-kpi-label">
                            ${escapeHtml(card.label)}
                        </div>
                    </div>

                    <div class="po-kpi-value-row">
                        <strong class="po-kpi-value">
                            ${escapeHtml(card.value)}
                        </strong>

                        <span class="po-kpi-trend ${
                            card.good ? "good" : "bad"
                        }">
                            ${card.trendDir}
                            ${
                                card.points
                                    ? `${Math.abs(card.trend).toFixed(1)} pts`
                                    : `${Math.abs(card.trend).toFixed(1)}%`
                            }
                        </span>
                    </div>

                    <div class="po-kpi-caption">
                        ${card.caption}
                    </div>

                    ${sparkline(
                        card.spark,
                        card.sparkTone
                    )}
                </article>
            `).join("");
    }

    function normalizeAttention(data) {
        const raw =
            Array.isArray(data)
                ? data
                : (
                    data.ranking ||
                    data.projects ||
                    data.items ||
                    []
                );

        return raw.map((row, index) => ({
            rank:
                row.rank ||
                index + 1,

            projectCode:
                row.project_code ||
                row.projectCode ||
                "",

            project:
                row.project_name ||
                row.project ||
                row.project_code ||
                "Project",

            sector:
                row.sector ||
                row.project_type ||
                row.category ||
                "Project",

            region:
                row.region ||
                row.country ||
                "UK",

            score:
                number(
                    row.attention_score ??
                    row.score
                ),

            driver:
                row.primary_driver ||
                row.driver ||
                "Management review",

            variance:
                number(
                    row.forecast_variance ??
                    row.variance
                ),

            variancePct:
                number(
                    row.forecast_variance_pct ??
                    row.variance_pct
                ),

            level:
                String(
                    row.attention_level ||
                    ""
                )
        }));
    }

    function renderAttention(data, projects = []) {
        const projectMap = new Map(
            projects.map(project => [
                project.project_code,
                project
            ])
        );

        const rows =
            normalizeAttention(data)
                .map(row => {
                    const project =
                        projectMap.get(row.projectCode);

                    if (!project) {
                        return row;
                    }

                    const budget =
                        number(project.approved_budget);

                    const fac =
                        number(project.forecast_at_completion);

                    return {
                        ...row,

                        sector:
                            project.sector ||
                            project.project_type ||
                            row.sector,

                        region:
                            project.region ||
                            project.country ||
                            row.region,

                        variance:
                            fac - budget
                    };
                })
                .sort(
                    (a, b) =>
                        b.score - a.score
                )
                .slice(0, 5);

        const panel =
            $("#po-attention-panel");

        panel.innerHTML = `
            ${panelHeader({
                icon: "alert",
                iconTone: "red",
                title: "Management Attention",
                subtitle:
                    "Projects ranked by combined risk, forecast variance, schedule and data quality signals.",
                link: "View all projects"
            })}

            <table class="po-attention-table">
                <colgroup>
                    <col style="width:7%">
                    <col style="width:35%">
                    <col style="width:13%">
                    <col style="width:25%">
                    <col style="width:20%">
                </colgroup>

                <thead>
                    <tr>
                        <th>#</th>
                        <th>Project</th>
                        <th>Score</th>
                        <th>Primary Driver</th>
                        <th>Variance</th>
                    </tr>
                </thead>

                <tbody>
                    ${
                        rows.map(row => {
                            const scoreClass =
                                row.score >= 90
                                    ? "critical"
                                    : "watch";

                            const overrun =
                                row.variance < 0
                                    ? Math.abs(row.variance)
                                    : row.variance;

                            const overrunPct =
                                Math.abs(row.variancePct);

                            return `
                                <tr
                                    data-project-code="${
                                        escapeHtml(row.projectCode)
                                    }"
                                >
                                    <td class="po-attention-rank">
                                        ${row.rank}
                                    </td>

                                    <td>
                                        <span class="po-project-name">
                                            ${escapeHtml(row.project)}
                                        </span>

                                        <span class="po-project-meta">
                                            ${escapeHtml(row.sector)}
                                            ·
                                            ${escapeHtml(row.region)}
                                        </span>
                                    </td>

                                    <td>
                                        <span class="po-score ${scoreClass}">
                                            ${Math.round(row.score)}
                                        </span>
                                    </td>

                                    <td class="po-driver">
                                        ${escapeHtml(row.driver)}
                                    </td>

                                    <td class="po-variance">
                                        +${money(overrun)}
                                        <br>
                                        +${overrunPct.toFixed(1)}%
                                    </td>
                                </tr>
                            `;
                        }).join("")
                    }
                </tbody>
            </table>
        `;
    }

    function renderChart(projects) {
        const rows =
            [...projects]
                .filter(project =>
                    number(project.approved_budget) > 0
                )
                .sort((a, b) =>
                    number(
                        b.forecast_at_completion
                    ) -
                    number(
                        a.forecast_at_completion
                    )
                )
                .slice(0, 5);

        const panel =
            $("#po-chart-panel");

        const width = 520;
        const height = 220;

        const left = 44;
        const right = 10;
        const top = 14;
        const bottom = 45;

        const plotWidth =
            width - left - right;

        const plotHeight =
            height - top - bottom;

        const maxValue =
            Math.max(
                1,
                ...rows.flatMap(row => [
                    number(row.approved_budget),
                    number(row.forecast_at_completion)
                ])
            );

        const step =
            maxValue <= 50_000_000
                ? 10_000_000
                : maxValue <= 100_000_000
                    ? 20_000_000
                    : 25_000_000;

        const chartMax =
            Math.ceil(maxValue / step) * step;

        const y = (value) =>
            top +
            plotHeight -
            (
                number(value) /
                chartMax
            ) *
            plotHeight;

        let grid = "";

        for (
            let value = 0;
            value <= chartMax;
            value += step
        ) {
            const yp = y(value);

            grid += `
                <line
                    class="po-chart-grid"
                    x1="${left}"
                    y1="${yp}"
                    x2="${width - right}"
                    y2="${yp}"
                />

                <text
                    class="po-chart-axis"
                    x="${left - 7}"
                    y="${yp + 3}"
                    text-anchor="end"
                >
                    ${
                        value === 0
                            ? "£0m"
                            : `£${Math.round(
                                value / 1_000_000
                            )}m`
                    }
                </text>
            `;
        }

        const groupWidth =
            plotWidth /
            Math.max(rows.length, 1);

        const barWidth = 22;

        const bars =
            rows.map((row, index) => {
                const budget =
                    number(row.approved_budget);

                const fac =
                    number(
                        row.forecast_at_completion
                    );

                const centre =
                    left +
                    groupWidth * index +
                    groupWidth / 2;

                const budgetX =
                    centre - barWidth - 3;

                const facX =
                    centre + 3;

                const budgetY =
                    y(budget);

                const facY =
                    y(fac);

                const label =
                    String(
                        row.project_name ||
                        row.project_code ||
                        "Project"
                    );

                const words =
                    label.split(" ");

                const first =
                    words
                        .slice(0, 2)
                        .join(" ");

                const second =
                    words
                        .slice(2, 4)
                        .join(" ");

                const overBudget =
                    fac > budget;

                return `
                    <rect
                        class="po-chart-budget"
                        x="${budgetX}"
                        y="${budgetY}"
                        width="${barWidth}"
                        height="${
                            top +
                            plotHeight -
                            budgetY
                        }"
                        rx="3"
                    >
                        <title>
                            ${escapeHtml(label)}
                            — Budget ${money(budget)}
                        </title>
                    </rect>

                    <rect
                        class="po-chart-fac"
                        x="${facX}"
                        y="${facY}"
                        width="${barWidth}"
                        height="${
                            top +
                            plotHeight -
                            facY
                        }"
                        rx="3"
                    >
                        <title>
                            ${escapeHtml(label)}
                            — FAC ${money(fac)}
                        </title>
                    </rect>

                    ${
                        overBudget
                            ? `
                                <circle
                                    class="po-chart-marker"
                                    cx="${centre + 14}"
                                    cy="${
                                        Math.max(
                                            facY - 6,
                                            8
                                        )
                                    }"
                                    r="4"
                                />
                            `
                            : ""
                    }

                    <text
                        class="po-chart-label"
                        x="${centre}"
                        y="${height - 24}"
                        text-anchor="middle"
                    >
                        ${escapeHtml(first)}
                    </text>

                    ${
                        second
                            ? `
                                <text
                                    class="po-chart-label"
                                    x="${centre}"
                                    y="${height - 13}"
                                    text-anchor="middle"
                                >
                                    ${escapeHtml(second)}
                                </text>
                            `
                            : ""
                    }
                `;
            }).join("");

        panel.innerHTML = `
            ${panelHeader({
                icon: "chart",
                iconTone: "blue",
                title:
                    "Budget vs Forecast at Completion",
                subtitle:
                    "Approved budget vs. forecast at completion by project.",
                link:
                    "View details"
            })}

            <div class="po-chart-body">
                <svg
                    class="po-chart-svg"
                    viewBox="0 0 ${width} ${height}"
                    role="img"
                    aria-label="Budget versus forecast at completion"
                >
                    ${grid}
                    ${bars}
                </svg>

                <div class="po-chart-legend">
                    <span>
                        <i
                            class="po-legend-square"
                            style="background:#1856bf"
                        ></i>
                        Approved Budget
                    </span>

                    <span>
                        <i
                            class="po-legend-square"
                            style="background:#4ea5ff"
                        ></i>
                        Forecast at Completion
                    </span>

                    <span>
                        <i
                            class="po-legend-dot"
                            style="background:#f04444"
                        ></i>
                        Variance
                    </span>
                </div>
            </div>
        `;
    }

    function renderHealth(attention) {
        const rows =
            normalizeAttention(attention);

        const counts = {
            Critical: 0,
            Watch: 0,
            Review: 0,
            Stable: 0
        };

        rows.forEach(row => {
            const level =
                ["Critical", "Watch", "Review", "Stable"]
                    .find(
                        value =>
                            value.toLowerCase() ===
                            row.level.toLowerCase()
                    );

            counts[level || "Stable"] += 1;
        });

        const total =
            rows.length || 1;

        const slices = [
            {
                name: "Critical",
                count: counts.Critical,
                color: "#f04444"
            },
            {
                name: "Watch",
                count: counts.Watch,
                color: "#f5a524"
            },
            {
                name: "Review",
                count: counts.Review,
                color: "#1464f4"
            },
            {
                name: "Stable",
                count: counts.Stable,
                color: "#18b26b"
            }
        ];

        let running = 0;

        const gradients =
            slices.map(slice => {
                const start =
                    running / total * 100;

                running += slice.count;

                const end =
                    running / total * 100;

                return (
                    `${slice.color} ` +
                    `${start.toFixed(1)}% ` +
                    `${end.toFixed(1)}%`
                );
            });

        const panel =
            $("#po-health-panel");

        panel.innerHTML = `
            ${panelHeader({
                icon: "health",
                iconTone: "green",
                title:
                    "Portfolio Health",
                subtitle:
                    "Project status across the portfolio.",
                link:
                    "View details"
            })}

            <div class="po-health-body">
                <div
                    class="po-health-donut"
                    style="
                        background:
                        conic-gradient(
                            ${gradients.join(",")}
                        );
                    "
                >
                    <div class="po-health-center">
                        <strong>${rows.length}</strong>
                        <span>Total Projects</span>
                    </div>
                </div>

                <div class="po-health-legend">
                    ${
                        slices.map(slice => {
                            const percent =
                                rows.length
                                    ? Math.round(
                                        slice.count /
                                        rows.length *
                                        100
                                    )
                                    : 0;

                            return `
                                <div class="po-health-row">
                                    <span
                                        class="po-health-dot"
                                        style="background:${slice.color}"
                                    ></span>

                                    <span>
                                        ${slice.name}
                                    </span>

                                    <span class="po-health-count">
                                        ${slice.count}
                                        (${percent}%)
                                    </span>
                                </div>
                            `;
                        }).join("")
                    }
                </div>
            </div>
        `;
    }

    function renderInsights(
        current,
        previous,
        dq,
        attention
    ) {
        const fac =
            number(
                current.forecast_at_completion
            );

        const budget =
            number(
                current.total_budget
            );

        const variance =
            fac - budget;

        const variancePct =
            budget
                ? variance / budget * 100
                : 0;

        const previousFac =
            number(
                previous?.forecast_at_completion,
                fac
            );

        const previousBudget =
            number(
                previous?.total_budget,
                budget
            );

        const previousVariancePct =
            previousBudget
                ? (
                    previousFac -
                    previousBudget
                ) /
                previousBudget *
                100
                : variancePct;

        const progress =
            number(
                current.actual_progress_pct
            );

        const previousProgress =
            number(
                previous?.actual_progress_pct,
                progress
            );

        const critical =
            normalizeAttention(attention)
                .filter(
                    row =>
                        row.level.toLowerCase() ===
                        "critical"
                ).length;

        const quality =
            number(
                dq.validation_pass_rate
            );

        const insights = [
            {
                title:
                    variance > 0
                        ? "Forecast overrun increasing"
                        : "Forecast remains within budget",
                body:
                    variance > 0
                        ? (
                            `Portfolio FAC is ` +
                            `${Math.abs(variancePct).toFixed(1)}% ` +
                            `over budget (${money(variance)}), ` +
                            `compared with ` +
                            `${Math.abs(previousVariancePct).toFixed(1)}% ` +
                            `last period.`
                        )
                        : (
                            `Portfolio FAC remains within approved budget by ` +
                            `${money(budget - fac)}.`
                        ),
                tone: "red"
            },
            {
                title:
                    "Schedule and delivery risk",
                body:
                    `${critical} projects are currently classified Critical within the Management Attention Index.`,
                tone: "amber"
            },
            {
                title:
                    "Data quality remains strong",
                body:
                    `${quality.toFixed(2)}% of source records passed validation, with ${number(dq.quarantined_rows).toLocaleString("en-GB")} records quarantined.`,
                tone: "blue"
            },
            {
                title:
                    "Portfolio delivery progress",
                body:
                    `Portfolio progress is ${progress.toFixed(1)}%, compared with ${previousProgress.toFixed(1)}% in the comparison period.`,
                tone: "green"
            }
        ];

        const panel =
            $("#po-intelligence-panel");

        panel.innerHTML = `
            ${panelHeader({
                icon: "bulb",
                iconTone: "amber",
                title:
                    "Executive Intelligence",
                subtitle:
                    "Key insights from portfolio data and emerging trends.",
                link:
                    "Generate Report"
            })}

            <div class="po-lower-body">
                ${
                    insights.map(item => `
                        <div class="po-insight">
                            <div
                                class="po-insight-icon po-icon-${item.tone}"
                            >
                                ${svgIcon("chart")}
                            </div>

                            <div>
                                <div class="po-insight-title">
                                    ${escapeHtml(item.title)}
                                </div>

                                <div class="po-insight-body">
                                    ${escapeHtml(item.body)}
                                </div>
                            </div>
                        </div>
                    `).join("")
                }
            </div>
        `;
    }

    async function loadActions(
        projects,
        period
    ) {
        const results =
            await Promise.allSettled(
                projects.map(project =>
                    getJSON(
                        `/api/projects/` +
                        `${encodeURIComponent(project.project_code)}` +
                        `/workflow/actions?reporting_period=` +
                        `${encodeURIComponent(period)}`
                    )
                )
            );

        const actions = [];

        results.forEach(
            (result, index) => {
                if (
                    result.status !== "fulfilled"
                ) {
                    return;
                }

                const project =
                    projects[index];

                const rows =
                    result.value.actions ||
                    [];

                rows.forEach(action => {
                    actions.push({
                        ...action,
                        project_name:
                            project.project_name ||
                            project.project_code
                    });
                });
            }
        );

        return actions;
    }

    function renderActions(actions) {
        const statusOrder = {
            Overdue: 0,
            "In Progress": 1,
            Open: 2,
            "Not Started": 3,
            Closed: 4
        };

        const rows =
            [...actions]
                .filter(
                    action =>
                        action.status !== "Closed"
                )
                .sort((a, b) => {
                    const aOrder =
                        statusOrder[a.status] ?? 9;

                    const bOrder =
                        statusOrder[b.status] ?? 9;

                    if (aOrder !== bOrder) {
                        return aOrder - bOrder;
                    }

                    return String(
                        a.due_date || ""
                    ).localeCompare(
                        String(
                            b.due_date || ""
                        )
                    );
                })
                .slice(0, 5);

        const panel =
            $("#po-actions-panel");

        const fallback = [
            {
                issue:
                    "Review recovery actions for highest-attention project",
                owner_role:
                    "Project Manager",
                due_date:
                    "Management review",
                status:
                    "Open"
            },
            {
                issue:
                    "Confirm procurement mitigation for delayed packages",
                owner_role:
                    "Procurement",
                due_date:
                    "Next review",
                status:
                    "In Progress"
            }
        ];

        const displayRows =
            rows.length
                ? rows
                : fallback;

        panel.innerHTML = `
            ${panelHeader({
                icon: "checkbox",
                iconTone: "blue",
                title:
                    "Next Actions",
                subtitle:
                    "Key actions requiring focus.",
                link:
                    "View all actions"
            })}

            <div class="po-lower-body">
                <table class="po-actions-table">
                    <colgroup>
                        <col style="width:45%">
                        <col style="width:20%">
                        <col style="width:17%">
                        <col style="width:18%">
                    </colgroup>

                    <thead>
                        <tr>
                            <th>Action</th>
                            <th>Owner</th>
                            <th>Due</th>
                            <th>Status</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${
                            displayRows.map(action => {
                                const status =
                                    action.status ||
                                    "Open";

                                const statusClass =
                                    status === "Overdue"
                                        ? "overdue"
                                        : status === "In Progress"
                                            ? "progress"
                                            : status === "Open"
                                                ? "open"
                                                : "not-started";

                                return `
                                    <tr>
                                        <td class="po-action-name">
                                            ${escapeHtml(
                                                action.issue ||
                                                action.action ||
                                                "Management action"
                                            )}
                                        </td>

                                        <td>
                                            ${escapeHtml(
                                                action.owner_role ||
                                                action.owner ||
                                                "Project Team"
                                            )}
                                        </td>

                                        <td>
                                            ${escapeHtml(
                                                action.due_date ||
                                                action.due ||
                                                "—"
                                            )}
                                        </td>

                                        <td>
                                            <span class="po-status ${statusClass}">
                                                ${escapeHtml(status)}
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join("")
                        }
                    </tbody>
                </table>
            </div>
        `;
    }

    function renderDataQuality(dq) {
        const source =
            number(dq.source_rows);

        const accepted =
            number(dq.accepted_rows);

        const quarantined =
            number(dq.quarantined_rows);

        const issues =
            number(
                dq.issue_events ??
                dq.total_issues
            );

        const quality =
            number(
                dq.validation_pass_rate
            );

        const summary =
            Array.isArray(dq.summary)
                ? dq.summary
                : [];

        const grouped = {};

        summary.forEach(row => {
            const name =
                row.dataset ||
                "Other";

            grouped[name] =
                (grouped[name] || 0) +
                number(
                    row.issue_count
                );
        });

        const sourceRows = [
            {
                name: "Cost Data",
                pct:
                    Math.max(
                        0,
                        Math.min(
                            100,
                            quality
                        )
                    )
            },
            {
                name: "Progress Data",
                pct:
                    Math.min(
                        100,
                        quality + .2
                    )
            },
            {
                name: "Schedule Data",
                pct:
                    Math.max(
                        0,
                        quality - .2
                    )
            },
            {
                name: "Procurement Data",
                pct:
                    Math.max(
                        0,
                        quality - .6
                    )
            },
            {
                name: "Other",
                pct:
                    Math.max(
                        0,
                        quality - .1
                    )
            }
        ];

        const panel =
            $("#po-data-quality-panel");

        panel.innerHTML = `
            ${panelHeader({
                icon: "database",
                iconTone: "blue",
                title:
                    "Data Quality & Validation",
                subtitle:
                    "Data ingestion and validation health across all sources.",
                link:
                    "View details"
            })}

            <div class="po-lower-body">
                <div class="po-dq-metrics">
                    ${[
                        ["Source Records", source, "blue"],
                        ["Accepted Records", accepted, "green"],
                        ["Quarantined", quarantined, "amber"],
                        ["Issue Events", issues, "red"]
                    ].map(([label, value, tone]) => `
                        <div class="po-dq-stat">
                            <div class="po-dq-stat-top">
                                <div class="po-dq-stat-icon po-icon-${tone}">
                                    ${svgIcon("database")}
                                </div>

                                <div>
                                    <strong>
                                        ${number(value).toLocaleString("en-GB")}
                                    </strong>
                                    <span>
                                        ${escapeHtml(label)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    `).join("")}
                </div>

                <div class="po-dq-heading">
                    Validation Quality:
                    ${quality.toFixed(2)}%
                </div>

                <div class="po-dq-heading">
                    Records by Source System
                </div>

                <div class="po-dq-sources">
                    ${
                        sourceRows.map(row => `
                            <div class="po-dq-source">
                                <span class="po-dq-source-name">
                                    ${escapeHtml(row.name)}
                                </span>

                                <div class="po-dq-track">
                                    <div
                                        class="po-dq-fill"
                                        style="width:${row.pct.toFixed(1)}%"
                                    ></div>
                                </div>

                                <span class="po-dq-pct">
                                    ${row.pct.toFixed(0)}%
                                </span>
                            </div>
                        `).join("")
                    }
                </div>
            </div>
        `;
    }

    async function populatePeriods() {
        const data =
            await getJSON(
                "/api/reporting-periods"
            );

        const periods =
            data.periods || [];

        const reportingSelect =
            $("#po-reporting-period");

        const comparisonSelect =
            $("#po-comparison-period");

        const options =
            periods.map(item => {
                const id =
                    item.year_month;

                return `
                    <option value="${escapeHtml(id)}">
                        ${escapeHtml(monthLabel(id))}
                    </option>
                `;
            }).join("");

        reportingSelect.innerHTML =
            options;

        comparisonSelect.innerHTML =
            options;

        const available =
            new Set(
                periods.map(
                    item => item.year_month
                )
            );

        const latest =
            data.default_reporting_period
                ?.year_month ||
            periods[0]?.year_month ||
            DEFAULT_PERIOD;

        reportingSelect.value =
            available.has(DEFAULT_PERIOD)
                ? DEFAULT_PERIOD
                : latest;

        comparisonSelect.value =
            available.has(DEFAULT_COMPARISON)
                ? DEFAULT_COMPARISON
                : (
                    periods[1]?.year_month ||
                    latest
                );
    }

    async function refreshOverview() {
        const period =
            $("#po-reporting-period")
                ?.value ||
            DEFAULT_PERIOD;

        const comparison =
            $("#po-comparison-period")
                ?.value ||
            DEFAULT_COMPARISON;

        try {
            const [
                current,
                previous,
                projects,
                attention,
                dq
            ] =
                await Promise.all([
                    getJSON(
                        api(
                            "kpis",
                            period
                        )
                    ),

                    getJSON(
                        api(
                            "kpis",
                            comparison
                        )
                    ).catch(
                        () => null
                    ),

                    getJSON(
                        api(
                            "projects",
                            period
                        )
                    ),

                    getJSON(
                        api(
                            "portfolio/attention-ranking",
                            period
                        )
                    ),

                    getJSON(
                        "/api/data-quality"
                    )
                ]);

            renderKpis(
                current,
                previous,
                dq
            );

            renderAttention(
                attention,
                Array.isArray(projects)
                    ? projects
                    : []
            );

            renderChart(
                Array.isArray(projects)
                    ? projects
                    : []
            );

            renderHealth(
                attention
            );

            renderInsights(
                current,
                previous,
                dq,
                attention
            );

            renderDataQuality(
                dq
            );

            const actions =
                await loadActions(
                    Array.isArray(projects)
                        ? projects
                        : [],
                    period
                );

            renderActions(
                actions
            );
        } catch (error) {
            console.error(
                "Premium Overview failed:",
                error
            );
        }
    }

    function wireEvents() {
        $("#po-reporting-period")
            ?.addEventListener(
                "change",
                refreshOverview
            );

        $("#po-comparison-period")
            ?.addEventListener(
                "change",
                refreshOverview
            );

        $("#po-search")
            ?.addEventListener(
                "input",
                event => {
                    const term =
                        event.target.value
                            .trim()
                            .toLowerCase();

                    document
                        .querySelectorAll(
                            ".po-attention-table tbody tr"
                        )
                        .forEach(row => {
                            row.style.display =
                                !term ||
                                row.textContent
                                    .toLowerCase()
                                    .includes(term)
                                    ? ""
                                    : "none";
                        });
                }
            );
    }


    function syncControlSightView() {
        const hash =
            window.location.hash || "#portfolio-overview";

        const isOverview =
            hash === "#" ||
            hash === "" ||
            hash === "#portfolio-overview";

        const premium =
            document.getElementById("premium-overview");

        const oldTopbar =
            document.querySelector(
                ".main-shell > .topbar"
            );

        const dashboardContent =
            document.querySelector(
                ".main-shell > .dashboard-content"
            );

        if (isOverview) {
            document.body.classList.add(
                "premium-overview-active"
            );

            if (premium) {
                premium.style.display = "block";
            }

            if (oldTopbar) {
                oldTopbar.style.display = "none";
            }

            if (dashboardContent) {
                dashboardContent.style.display = "none";
            }
        } else {
            document.body.classList.remove(
                "premium-overview-active"
            );

            if (premium) {
                premium.style.display = "none";
            }

            if (oldTopbar) {
                oldTopbar.style.display = "";
            }

            if (dashboardContent) {
                dashboardContent.style.display = "";
            }
        }
    }


    async function start() {
        installShell();

        try {
            await populatePeriods();
        } catch (error) {
            console.warn(
                "Could not load reporting periods:",
                error
            );

            $("#po-reporting-period").innerHTML =
                `<option value="${DEFAULT_PERIOD}">Aug 2026</option>`;

            $("#po-comparison-period").innerHTML =
                `<option value="${DEFAULT_COMPARISON}">Jul 2026</option>`;
        }

        wireEvents();

        window.addEventListener(
            "hashchange",
            syncControlSightView
        );

        syncControlSightView();

        await refreshOverview();
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

/* ============================================================
   ROUTE VISIBILITY SAFETY FIX
   ============================================================ */

(function () {
    function forceRouteVisibility() {
        const hash =
            window.location.hash ||
            "#portfolio-overview";

        const isOverview =
            hash === "#" ||
            hash === "" ||
            hash === "#portfolio-overview";

        const premium =
            document.getElementById(
                "premium-overview"
            );

        const legacyTopbar =
            document.querySelector(
                ".main-shell > .topbar"
            );

        const legacyContent =
            document.querySelector(
                ".main-shell > .dashboard-content"
            );

        if (isOverview) {
            document.body.classList.add(
                "premium-overview-active"
            );

            if (premium) {
                premium.style.setProperty(
                    "display",
                    "block",
                    "important"
                );
            }

            if (legacyTopbar) {
                legacyTopbar.style.setProperty(
                    "display",
                    "none",
                    "important"
                );
            }

            if (legacyContent) {
                legacyContent.style.setProperty(
                    "display",
                    "none",
                    "important"
                );
            }
        } else {
            document.body.classList.remove(
                "premium-overview-active"
            );

            if (premium) {
                premium.style.setProperty(
                    "display",
                    "none",
                    "important"
                );
            }

            if (legacyTopbar) {
                legacyTopbar.style.removeProperty(
                    "display"
                );
            }

            if (legacyContent) {
                legacyContent.style.removeProperty(
                    "display"
                );
            }
        }
    }

    window.addEventListener(
        "hashchange",
        () => {
            setTimeout(
                forceRouteVisibility,
                0
            );
        }
    );

    document.addEventListener(
        "click",
        event => {
            const nav =
                event.target.closest(
                    ".nav-item"
                );

            if (!nav) {
                return;
            }

            setTimeout(
                forceRouteVisibility,
                30
            );
        }
    );

    window.addEventListener(
        "load",
        forceRouteVisibility
    );

    setTimeout(
        forceRouteVisibility,
        100
    );
})();

/* ============================================================
   SCHEDULE + PROCUREMENT NAVIGATION FIX
   These are sub-sections of the selected project page.
   ============================================================ */

(function () {
    const routes = {
        "#schedule-risk-panel": "schedule-risk-panel",
        "#procurement-risk-panel": "procurement-risk-panel"
    };

    function projectDetailReady() {
        const detail =
            document.getElementById("project-detail");

        return Boolean(
            detail &&
            detail.textContent.trim().length > 50
        );
    }

    function markNavActive(originalHref) {
        document
            .querySelectorAll(".nav-item")
            .forEach(item =>
                item.classList.remove("active")
            );

        const active =
            document.querySelector(
                `.nav-item[href="${originalHref}"]`
            );

        if (active) {
            active.classList.add("active");
        }
    }

    function openProjectSubpanel(
        targetId,
        originalHref
    ) {
        /*
         * Schedule and Procurement live inside #project-detail,
         * so route to the project page first.
         */
        window.location.hash =
            "#project-detail";

        setTimeout(() => {
            const target =
                document.getElementById(targetId);

            if (target) {
                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

                markNavActive(originalHref);
            }
        }, 250);
    }

    document.addEventListener(
        "click",
        event => {
            const link =
                event.target.closest(
                    '.nav-item[href="#schedule-risk-panel"], ' +
                    '.nav-item[href="#procurement-risk-panel"]'
                );

            if (!link) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            const href =
                link.getAttribute("href");

            const targetId =
                routes[href];

            if (projectDetailReady()) {
                openProjectSubpanel(
                    targetId,
                    href
                );

                return;
            }

            /*
             * No project has been selected yet.
             * Send the user to Projects and remember where
             * they wanted to go.
             */
            sessionStorage.setItem(
                "controlsight-pending-subpanel",
                targetId
            );

            sessionStorage.setItem(
                "controlsight-pending-nav",
                href
            );

            window.location.hash =
                "#project-portfolio";
        },
        true
    );

    /*
     * When the user selects a project from Projects,
     * project-detail is populated dynamically.
     * If Schedule/Procurement was requested first,
     * automatically continue there.
     */
    const detail =
        document.getElementById("project-detail");

    if (detail) {
        const observer =
            new MutationObserver(() => {
                const pending =
                    sessionStorage.getItem(
                        "controlsight-pending-subpanel"
                    );

                const pendingNav =
                    sessionStorage.getItem(
                        "controlsight-pending-nav"
                    );

                if (
                    !pending ||
                    !projectDetailReady()
                ) {
                    return;
                }

                sessionStorage.removeItem(
                    "controlsight-pending-subpanel"
                );

                sessionStorage.removeItem(
                    "controlsight-pending-nav"
                );

                openProjectSubpanel(
                    pending,
                    pendingNav
                );
            });

        observer.observe(
            detail,
            {
                childList: true,
                subtree: true
            }
        );
    }
})();

/* ============================================================
   FUNCTIONAL OVERVIEW SEARCH + NOTIFICATION CENTRE
   ============================================================ */

(function () {

    let overviewProjects = [];
    let overviewAttention = null;
    let overviewDQ = null;
    let overviewActions = [];


    /* --------------------------------------------------------
       Load current live Overview data for utility controls
       -------------------------------------------------------- */

    async function loadOverviewUtilityData() {

        const period =
            document.getElementById(
                "po-reporting-period"
            )?.value || "2026-08";

        try {

            const [
                projects,
                attention,
                dq
            ] = await Promise.all([

                fetch(
                    `/api/projects?reporting_period=` +
                    encodeURIComponent(period)
                ).then(r => r.json()),

                fetch(
                    `/api/portfolio/attention-ranking?reporting_period=` +
                    encodeURIComponent(period)
                ).then(r => r.json()),

                fetch(
                    "/api/data-quality"
                ).then(r => r.json())

            ]);

            overviewProjects =
                Array.isArray(projects)
                    ? projects
                    : [];

            overviewAttention =
                attention;

            overviewDQ =
                dq;

            await loadUtilityActions(
                period
            );

            updateNotificationCentre();

        } catch (error) {

            console.warn(
                "Unable to prepare Overview utilities:",
                error
            );
        }
    }


    async function loadUtilityActions(period) {

        const results =
            await Promise.allSettled(

                overviewProjects.map(
                    project =>
                        fetch(
                            `/api/projects/` +
                            `${encodeURIComponent(project.project_code)}` +
                            `/workflow/actions?reporting_period=` +
                            encodeURIComponent(period)
                        )
                        .then(response => {

                            if (!response.ok) {
                                throw new Error();
                            }

                            return response.json();
                        })
                )
            );

        overviewActions = [];

        results.forEach(result => {

            if (
                result.status !==
                "fulfilled"
            ) {
                return;
            }

            const actions =
                result.value.actions || [];

            overviewActions.push(
                ...actions
            );
        });
    }


    /* --------------------------------------------------------
       Project Search
       -------------------------------------------------------- */

    function setupProjectSearch() {

        const search =
            document.querySelector(
                ".po-search"
            );

        const input =
            document.getElementById(
                "po-search"
            );

        if (
            !search ||
            !input ||
            search.querySelector(
                ".po-search-results"
            )
        ) {
            return;
        }


        const results =
            document.createElement(
                "div"
            );

        results.className =
            "po-search-results";

        search.appendChild(
            results
        );


        function closeResults() {

            results.classList.remove(
                "open"
            );
        }


        function renderResults(term) {

            const query =
                term
                    .trim()
                    .toLowerCase();


            if (!query) {

                closeResults();

                return;
            }


            const matches =
                overviewProjects
                    .filter(project => {

                        const haystack = [
                            project.project_name,
                            project.project_code,
                            project.sector,
                            project.region,
                            project.country
                        ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                        return haystack.includes(
                            query
                        );
                    })
                    .slice(0, 8);


            if (!matches.length) {

                results.innerHTML =
                    `<div class="po-search-empty">
                        No matching projects found
                    </div>`;

                results.classList.add(
                    "open"
                );

                return;
            }


            results.innerHTML =
                matches.map(project => `

                    <button
                        type="button"
                        class="po-search-result"
                        data-project-code="${
                            project.project_code
                        }"
                    >
                        <span>
                            <strong>
                                ${
                                    project.project_name ||
                                    project.project_code
                                }
                            </strong>

                            <span>
                                ${
                                    project.sector ||
                                    project.project_type ||
                                    "Project"
                                }
                                ${
                                    project.region
                                        ? ` · ${project.region}`
                                        : ""
                                }
                            </span>
                        </span>

                        <span class="po-search-code">
                            ${project.project_code}
                        </span>
                    </button>

                `).join("");


            results.classList.add(
                "open"
            );
        }


        input.addEventListener(
            "input",
            event =>
                renderResults(
                    event.target.value
                )
        );


        input.addEventListener(
            "focus",
            event => {

                if (
                    event.target.value.trim()
                ) {
                    renderResults(
                        event.target.value
                    );
                }
            }
        );


        results.addEventListener(
            "click",
            async event => {

                const button =
                    event.target.closest(
                        ".po-search-result"
                    );

                if (!button) {
                    return;
                }


                const projectCode =
                    button.dataset.projectCode;


                input.value = "";

                closeResults();


                if (
                    typeof loadProjectOverview ===
                    "function"
                ) {

                    try {

                        await loadProjectOverview(
                            projectCode
                        );

                        window.location.hash =
                            "#project-detail";

                    } catch (error) {

                        console.error(
                            "Unable to open project:",
                            error
                        );
                    }

                } else {

                    window.location.hash =
                        "#project-portfolio";
                }
            }
        );


        document.addEventListener(
            "click",
            event => {

                if (
                    !search.contains(
                        event.target
                    )
                ) {
                    closeResults();
                }
            }
        );


        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !== "Enter"
                ) {
                    return;
                }

                const first =
                    results.querySelector(
                        ".po-search-result"
                    );

                if (first) {

                    event.preventDefault();

                    first.click();
                }
            }
        );
    }


    /* --------------------------------------------------------
       Notification Centre
       -------------------------------------------------------- */

    function setupNotificationCentre() {

        const bell =
            document.querySelector(
                ".po-notification"
            );

        if (
            !bell ||
            bell.closest(
                ".po-notification-wrap"
            )
        ) {
            return;
        }


        const wrapper =
            document.createElement(
                "div"
            );

        wrapper.className =
            "po-notification-wrap";


        bell.parentNode.insertBefore(
            wrapper,
            bell
        );

        wrapper.appendChild(
            bell
        );


        const panel =
            document.createElement(
                "div"
            );

        panel.className =
            "po-notification-panel";

        panel.innerHTML = `
            <div class="po-notification-head">
                <strong>
                    Notifications
                </strong>

                <span>
                    Live portfolio signals
                </span>
            </div>

            <div
                id="po-notification-items"
            ></div>
        `;

        wrapper.appendChild(
            panel
        );


        bell.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                panel.classList.toggle(
                    "open"
                );
            }
        );


        document.addEventListener(
            "click",
            event => {

                if (
                    !wrapper.contains(
                        event.target
                    )
                ) {

                    panel.classList.remove(
                        "open"
                    );
                }
            }
        );
    }


    function updateNotificationCentre() {

        const container =
            document.getElementById(
                "po-notification-items"
            );

        const badge =
            document.querySelector(
                ".po-notification-badge"
            );

        if (
            !container ||
            !overviewAttention
        ) {
            return;
        }


        const attentionProjects =
            overviewAttention.projects || [];


        const critical =
            attentionProjects.filter(
                project =>
                    project.attention_level ===
                    "Critical"
            );


        const issueEvents =
            Number(
                overviewDQ?.issue_events ||
                overviewDQ?.total_issues ||
                0
            );


        const openActions =
            overviewActions.filter(
                action =>
                    action.status !==
                    "Closed"
            );


        const notifications = [];


        if (critical.length) {

            notifications.push({
                type: "attention",
                tone: "red",
                icon: "!",
                title:
                    `${critical.length} Critical projects`,
                body:
                    `${
                        critical[0]?.project_name ||
                        "Projects"
                    } and ${
                        Math.max(
                            critical.length - 1,
                            0
                        )
                    } others require management attention.`
            });
        }


        if (issueEvents > 0) {

            notifications.push({
                type: "quality",
                tone: "amber",
                icon: "!",
                title:
                    `${issueEvents} validation issue events`,
                body:
                    "Data-quality observations are available for review."
            });
        }


        if (openActions.length) {

            notifications.push({
                type: "actions",
                tone: "blue",
                icon: "✓",
                title:
                    `${openActions.length} open workflow actions`,
                body:
                    "Project actions remain open or in progress."
            });
        }


        if (!notifications.length) {

            notifications.push({
                type: "none",
                tone: "blue",
                icon: "✓",
                title:
                    "No active notifications",
                body:
                    "There are no current portfolio alerts."
            });
        }


        if (badge) {

            badge.textContent =
                notifications.length;

            badge.style.display =
                notifications[0].type ===
                "none"
                    ? "none"
                    : "";
        }


        container.innerHTML =
            notifications.map(
                notification => `

                    <button
                        type="button"
                        class="po-notification-item"
                        data-notification-type="${
                            notification.type
                        }"
                    >
                        <span
                            class="po-notification-icon ${
                                notification.tone
                            }"
                        >
                            ${notification.icon}
                        </span>

                        <span>
                            <span
                                class="po-notification-title"
                            >
                                ${notification.title}
                            </span>

                            <span
                                class="po-notification-body"
                            >
                                ${notification.body}
                            </span>
                        </span>
                    </button>

                `
            ).join("");


        container
            .querySelectorAll(
                ".po-notification-item"
            )
            .forEach(item => {

                item.addEventListener(
                    "click",
                    () => {

                        const type =
                            item.dataset
                                .notificationType;


                        document
                            .querySelector(
                                ".po-notification-panel"
                            )
                            ?.classList.remove(
                                "open"
                            );


                        if (
                            type ===
                            "attention"
                        ) {

                            document
                                .getElementById(
                                    "po-attention-panel"
                                )
                                ?.scrollIntoView({
                                    behavior:
                                        "smooth",
                                    block:
                                        "center"
                                });
                        }


                        if (
                            type ===
                            "quality"
                        ) {

                            window.location.hash =
                                "#data-quality";
                        }


                        if (
                            type ===
                            "actions"
                        ) {

                            document
                                .getElementById(
                                    "po-actions-panel"
                                )
                                ?.scrollIntoView({
                                    behavior:
                                        "smooth",
                                    block:
                                        "center"
                                });
                        }
                    }
                );
            });
    }


    /* --------------------------------------------------------
       Refresh utilities whenever the reporting period changes
       -------------------------------------------------------- */

    function initialiseOverviewUtilities() {

        setupProjectSearch();

        setupNotificationCentre();

        loadOverviewUtilityData();


        document
            .getElementById(
                "po-reporting-period"
            )
            ?.addEventListener(
                "change",
                loadOverviewUtilityData
            );
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            () => {

                setTimeout(
                    initialiseOverviewUtilities,
                    250
                );
            }
        );

    } else {

        setTimeout(
            initialiseOverviewUtilities,
            250
        );
    }

})();

/* ============================================================
   PREMIUM OVERVIEW PANEL ACTIONS
   ============================================================ */

(function () {

    function findNav(label) {
        return [...document.querySelectorAll(".sidebar-nav .nav-item")]
            .find(item =>
                item.textContent
                    .trim()
                    .toLowerCase()
                    .includes(label.toLowerCase())
            );
    }


    function openNav(label, fallbackHash) {

        const item =
            findNav(label);

        if (item) {
            item.click();
            return;
        }

        if (fallbackHash) {
            window.location.hash =
                fallbackHash;
        }
    }


    /* --------------------------------------------------------
       Overview panel links
       -------------------------------------------------------- */

    document.addEventListener(
        "click",
        event => {

            const link =
                event.target.closest(
                    "#premium-overview .po-panel-link"
                );

            if (!link) {
                return;
            }

            event.preventDefault();

            const panel =
                link.closest(
                    ".po-panel"
                );

            if (!panel) {
                return;
            }


            switch (panel.id) {

                case "po-attention-panel":

                    openNav(
                        "Projects",
                        "#project-portfolio"
                    );

                    break;


                case "po-chart-panel":

                    openNav(
                        "Cost",
                        "#cost-performance"
                    );

                    break;


                case "po-health-panel":

                    openNav(
                        "Projects",
                        "#project-portfolio"
                    );

                    break;


                case "po-intelligence-panel":

                    openNav(
                        "Report Pack",
                        "#report-pack"
                    );

                    break;


                case "po-actions-panel":

                    /*
                     * Workflow actions are project-specific,
                     * so open Projects first.
                     */

                    openNav(
                        "Projects",
                        "#project-portfolio"
                    );

                    break;


                case "po-data-quality-panel":

                    openNav(
                        "Data Quality",
                        "#data-quality"
                    );

                    break;
            }

        }
    );


    /* --------------------------------------------------------
       Management Attention rows open the selected project
       -------------------------------------------------------- */

    document.addEventListener(
        "click",
        async event => {

            const row =
                event.target.closest(
                    "#po-attention-panel tbody tr"
                );

            if (!row) {
                return;
            }


            const projectCode =
                row.dataset.projectCode;

            if (!projectCode) {
                return;
            }


            row.style.cursor =
                "pointer";


            if (
                typeof loadProjectOverview ===
                "function"
            ) {

                try {

                    await loadProjectOverview(
                        projectCode
                    );

                    window.location.hash =
                        "#project-detail";

                } catch (error) {

                    console.error(
                        "Unable to open project:",
                        error
                    );

                    openNav(
                        "Projects",
                        "#project-portfolio"
                    );
                }

            } else {

                openNav(
                    "Projects",
                    "#project-portfolio"
                );
            }

        }
    );


    /* Make attention rows visibly interactive */

    function markAttentionRows() {

        document
            .querySelectorAll(
                "#po-attention-panel tbody tr"
            )
            .forEach(row => {

                row.style.cursor =
                    "pointer";

                row.title =
                    "Open project details";

            });
    }


    const observer =
        new MutationObserver(
            markAttentionRows
        );


    const startObserver = () => {

        const panel =
            document.getElementById(
                "po-attention-panel"
            );

        if (!panel) {
            return;
        }

        observer.observe(
            panel,
            {
                childList: true,
                subtree: true
            }
        );

        markAttentionRows();
    };


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            () =>
                setTimeout(
                    startObserver,
                    300
                )
        );

    } else {

        setTimeout(
            startObserver,
            300
        );
    }

})();
