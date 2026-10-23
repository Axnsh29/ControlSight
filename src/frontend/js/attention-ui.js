/* ============================================================
   CONTROLSIGHT
   TUNABLE MANAGEMENT ATTENTION UI
   v1.0.0
   ============================================================ */

const ATTENTION_UI_API_BASE = "/api/attention";

let attentionDefaultConfig = null;
let attentionCurrentConfig = null;
let attentionCurrentRanking = [];
let attentionInitialised = false;


/* ============================================================
   HELPERS
   ============================================================ */

function attentionEscape(value) {
    if (value === null || value === undefined) {
        return "—";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function attentionNumber(value, decimals = 1) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return number.toFixed(decimals);
}


function attentionFetchJson(url, options = {}) {
    return fetch(url, options).then(async response => {
        if (!response.ok) {
            let detail = `Request failed with HTTP ${response.status}`;

            try {
                const body = await response.json();

                if (typeof body?.detail === "string") {
                    detail = body.detail;
                } else if (body?.detail) {
                    detail = JSON.stringify(body.detail);
                }
            } catch {
                // ignore
            }

            throw new Error(detail);
        }

        return response.json();
    });
}


function deepCloneAttention(value) {
    return JSON.parse(
        JSON.stringify(value)
    );
}


/* ============================================================
   STYLES
   ============================================================ */

function installAttentionStyles() {
    if (
        document.getElementById(
            "controlsight-attention-ui-styles"
        )
    ) {
        return;
    }

    const style = document.createElement("style");

    style.id = "controlsight-attention-ui-styles";

    style.textContent = `
        #attention-tuning {
            scroll-margin-top: 90px;
        }

        .attention-shell {
            display: grid;
            gap: 16px;
        }

        .attention-hero {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 18px;

            padding: 18px 20px;

            background:
                linear-gradient(
                    135deg,
                    #101827,
                    #243b53
                );

            color: white;

            border-radius: 10px;

            box-shadow:
                0 10px 28px
                rgba(15, 23, 42, 0.14);
        }

        .attention-hero-copy {
            max-width: 780px;
        }

        .attention-eyebrow {
            display: block;
            margin-bottom: 5px;

            color: #93c5fd;

            font-size: 8px;
            font-weight: 850;

            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .attention-hero h2 {
            margin: 0;

            color: white;

            font-size: 19px;
            font-weight: 800;
        }

        .attention-hero p {
            margin: 7px 0 0;

            color: #cbd5e1;

            font-size: 9px;
            line-height: 1.6;
        }

        .attention-hero-badge {
            flex: 0 0 auto;

            padding: 7px 10px;

            color: #bfdbfe;

            background:
                rgba(59, 130, 246, 0.12);

            border:
                1px solid
                rgba(96, 165, 250, 0.25);

            border-radius: 999px;

            font-size: 8px;
            font-weight: 800;
        }

        .attention-layout {
            display: grid;

            grid-template-columns:
                minmax(320px, 0.72fr)
                minmax(0, 1.28fr);

            gap: 16px;
        }

        .attention-panel {
            padding: 18px;

            background: white;

            border: 1px solid #e5e7eb;
            border-radius: 10px;

            box-shadow:
                0 2px 8px
                rgba(15, 23, 42, 0.05);
        }

        .attention-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;

            gap: 12px;

            margin-bottom: 14px;
        }

        .attention-panel-header h3 {
            margin: 0;

            color: #0f172a;

            font-size: 14px;
            font-weight: 800;
        }

        .attention-panel-header p {
            margin: 5px 0 0;

            color: #64748b;

            font-size: 8px;
            line-height: 1.5;
        }

        .attention-control-group {
            margin-top: 14px;
        }

        .attention-control-group:first-of-type {
            margin-top: 0;
        }

        .attention-control-title {
            margin-bottom: 8px;

            color: #334155;

            font-size: 8px;
            font-weight: 850;

            text-transform: uppercase;
            letter-spacing: 0.04em;
        }

        .attention-slider-row {
            display: grid;

            grid-template-columns:
                minmax(120px, 1fr)
                minmax(120px, 1.2fr)
                54px;

            align-items: center;

            gap: 10px;

            padding: 8px 0;

            border-bottom: 1px solid #eef2f7;
        }

        .attention-slider-row:last-child {
            border-bottom: none;
        }

        .attention-slider-label strong {
            display: block;

            color: #334155;

            font-size: 8px;
        }

        .attention-slider-label span {
            display: block;

            margin-top: 2px;

            color: #94a3b8;

            font-size: 7px;
        }

        .attention-slider {
            width: 100%;
        }

        .attention-input {
            width: 100%;

            padding: 6px 7px;

            color: #0f172a;

            background: #f8fafc;

            border: 1px solid #dbe3ec;
            border-radius: 6px;

            font-family: inherit;
            font-size: 8px;
            font-weight: 750;

            box-sizing: border-box;
        }

        .attention-total-card {
            display: flex;
            justify-content: space-between;
            align-items: center;

            gap: 10px;

            margin-top: 12px;
            padding: 10px 11px;

            background: #eff6ff;

            border: 1px solid #bfdbfe;
            border-radius: 7px;
        }

        .attention-total-card span {
            color: #1e40af;

            font-size: 8px;
            font-weight: 750;
        }

        .attention-total-card strong {
            color: #1d4ed8;

            font-size: 15px;
            font-weight: 850;
        }

        .attention-button-row {
            display: flex;
            flex-wrap: wrap;

            gap: 7px;

            margin-top: 14px;
        }

        .attention-button {
            appearance: none;

            padding: 8px 11px;

            border-radius: 6px;

            font-family: inherit;
            font-size: 8px;
            font-weight: 850;

            cursor: pointer;
        }

        .attention-button-primary {
            color: white;

            background: #2563eb;

            border: 1px solid #2563eb;
        }

        .attention-button-secondary {
            color: #334155;

            background: white;

            border: 1px solid #cbd5e1;
        }

        .attention-feedback {
            display: none;

            margin-top: 10px;
            padding: 8px 10px;

            border-radius: 6px;

            font-size: 8px;
            line-height: 1.5;
        }

        .attention-feedback.visible {
            display: block;
        }

        .attention-feedback.info {
            color: #1d4ed8;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
        }

        .attention-feedback.error {
            color: #991b1b;
            background: #fef2f2;
            border: 1px solid #fecaca;
        }

        .attention-feedback.success {
            color: #166534;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
        }

        .attention-summary-grid {
            display: grid;

            grid-template-columns:
                repeat(4, minmax(0, 1fr));

            gap: 8px;

            margin-bottom: 14px;
        }

        .attention-summary-card {
            padding: 10px 11px;

            background: #f8fafc;

            border: 1px solid #e5eaf1;
            border-radius: 7px;
        }

        .attention-summary-card span {
            display: block;

            color: #64748b;

            font-size: 7px;
            font-weight: 750;
        }

        .attention-summary-card strong {
            display: block;

            margin-top: 4px;

            color: #0f172a;

            font-size: 16px;
            font-weight: 850;
        }

        .attention-table-wrap {
            overflow-x: auto;

            border: 1px solid #e5eaf1;
            border-radius: 8px;
        }

        .attention-table {
            width: 100%;

            min-width: 960px;

            border-collapse: collapse;

            font-size: 8px;
        }

        .attention-table th {
            padding: 9px 10px;

            text-align: left;

            color: #64748b;
            background: #f8fafc;

            border-bottom: 1px solid #e5eaf1;

            font-size: 7px;
            font-weight: 850;

            text-transform: uppercase;
        }

        .attention-table td {
            padding: 10px;

            color: #334155;

            border-bottom: 1px solid #eef2f7;

            vertical-align: top;
        }

        .attention-rank {
            display: inline-flex;

            align-items: center;
            justify-content: center;

            width: 23px;
            height: 23px;

            background: #f1f5f9;

            border-radius: 50%;

            color: #334155;

            font-size: 8px;
            font-weight: 850;
        }

        .attention-level {
            display: inline-flex;

            padding: 4px 7px;

            border-radius: 999px;

            font-size: 7px;
            font-weight: 850;
        }

        .attention-level.critical {
            color: #991b1b;
            background: #fee2e2;
        }

        .attention-level.watch {
            color: #92400e;
            background: #fef3c7;
        }

        .attention-level.review {
            color: #9a3412;
            background: #ffedd5;
        }

        .attention-level.stable {
            color: #166534;
            background: #dcfce7;
        }

        .attention-score-cell strong {
            display: block;

            color: #0f172a;

            font-size: 11px;
            font-weight: 850;
        }

        .attention-score-cell span {
            display: block;

            margin-top: 2px;

            color: #94a3b8;

            font-size: 7px;
        }

        .attention-breakdown {
            display: grid;
            gap: 4px;

            min-width: 180px;
        }

        .attention-breakdown-row {
            display: grid;

            grid-template-columns:
                92px
                1fr
                40px;

            gap: 5px;

            align-items: center;
        }

        .attention-breakdown-label {
            color: #64748b;

            font-size: 7px;
        }

        .attention-breakdown-track {
            height: 5px;

            overflow: hidden;

            background: #e2e8f0;

            border-radius: 999px;
        }

        .attention-breakdown-fill {
            height: 100%;

            background: #3b82f6;

            border-radius: 999px;
        }

        .attention-breakdown-value {
            color: #475569;

            font-size: 7px;
            font-weight: 750;

            text-align: right;
        }

        .attention-method-note {
            margin-top: 12px;
            padding: 9px 10px;

            color: #475569;

            background: #f8fafc;

            border: 1px solid #e2e8f0;
            border-radius: 7px;

            font-size: 7px;
            line-height: 1.5;
        }

        .attention-method-note strong {
            color: #0f172a;
        }

        @media (max-width: 1100px) {
            .attention-layout {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 750px) {
            .attention-summary-grid {
                grid-template-columns:
                    repeat(2, minmax(0, 1fr));
            }

            .attention-slider-row {
                grid-template-columns:
                    1fr;
            }

            .attention-hero {
                flex-direction: column;
            }
        }
    `;

    document.head.appendChild(style);
}


/* ============================================================
   PAGE
   ============================================================ */

function installAttentionPage() {
    if (
        document.getElementById(
            "attention-tuning"
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
        document.createElement("section");

    section.id = "attention-tuning";

    section.className = "dashboard-section";

    section.innerHTML = `
        <div class="attention-shell">

            <div class="attention-hero">

                <div class="attention-hero-copy">

                    <span class="attention-eyebrow">
                        Management Prioritisation
                    </span>

                    <h2>
                        Tunable Management Attention
                    </h2>

                    <p>
                        Adjust the relative importance of cost,
                        progress, critical schedule, procurement
                        and data-quality signals to test how
                        portfolio management priorities change.
                    </p>

                </div>

                <div class="attention-hero-badge">
                    Scenario Tool · Default Methodology Protected
                </div>

            </div>


            <div class="attention-layout">

                <div class="attention-panel">

                    <div class="attention-panel-header">

                        <div>

                            <h3>
                                Attention Configuration
                            </h3>

                            <p>
                                Custom settings are temporary
                                and do not change the default
                                ControlSight methodology.
                            </p>

                        </div>

                    </div>


                    <div class="attention-control-group">

                        <div class="attention-control-title">
                            Component Weights
                        </div>

                        <div id="attention-weight-controls"></div>

                        <div class="attention-total-card">

                            <span>
                                Total Available Score
                            </span>

                            <strong id="attention-total-weight">
                                100
                            </strong>

                        </div>

                    </div>


                    <div class="attention-control-group">

                        <div class="attention-control-title">
                            Cost Overrun Thresholds (%)
                        </div>

                        <div id="attention-cost-thresholds"></div>

                    </div>


                    <div class="attention-control-group">

                        <div class="attention-control-title">
                            Progress Lag Thresholds (pp)
                        </div>

                        <div id="attention-progress-thresholds"></div>

                    </div>


                    <div class="attention-control-group">

                        <div class="attention-control-title">
                            Portfolio Attention Levels
                        </div>

                        <div id="attention-level-thresholds"></div>

                    </div>


                    <div class="attention-button-row">

                        <button
                            id="attention-apply"
                            class="
                                attention-button
                                attention-button-primary
                            "
                            type="button"
                        >
                            Apply & Rerank
                        </button>

                        <button
                            id="attention-reset"
                            class="
                                attention-button
                                attention-button-secondary
                            "
                            type="button"
                        >
                            Reset Defaults
                        </button>

                    </div>


                    <div
                        id="attention-feedback"
                        class="attention-feedback"
                    ></div>

                </div>


                <div class="attention-panel">

                    <div class="attention-panel-header">

                        <div>

                            <h3>
                                Live Portfolio Ranking
                            </h3>

                            <p>
                                Projects rerank according to the
                                active attention scenario.
                            </p>

                        </div>

                    </div>


                    <div
                        id="attention-summary"
                        class="attention-summary-grid"
                    ></div>


                    <div
                        id="attention-ranking-container"
                    >
                        Loading ranking...
                    </div>


                    <div class="attention-method-note">

                        <strong>
                            Important:
                        </strong>

                        the Management Attention Index is
                        a management-prioritisation tool.
                        It is not a probability of project
                        failure and does not replace formal
                        project-control judgement.

                    </div>

                </div>

            </div>

        </div>
    `;

    main.appendChild(section);
}


/* ============================================================
   NAV
   ============================================================ */

function installAttentionNavigation() {
    const nav =
        document.querySelector(
            ".sidebar-nav"
        );

    if (!nav) {
        return;
    }

    if (
        nav.querySelector(
            'a[href="#attention-tuning"]'
        )
    ) {
        return;
    }

    const link =
        document.createElement("a");

    link.href = "#attention-tuning";
    link.className = "nav-item";

    link.innerHTML = `
        <span class="nav-icon">◎</span>
        <span>Attention Tuning</span>
    `;

    link.addEventListener(
        "click",
        event => {
            event.preventDefault();

            document
                .getElementById(
                    "attention-tuning"
                )
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
        }
    );

    nav.appendChild(link);
}


/* ============================================================
   CONFIG LOAD
   ============================================================ */

async function loadAttentionConfig() {
    const data =
        await attentionFetchJson(
            `${ATTENTION_UI_API_BASE}/config`
        );

    attentionDefaultConfig =
        deepCloneAttention(
            data.default_configuration
        );

    attentionCurrentConfig =
        deepCloneAttention(
            data.default_configuration
        );

    renderAttentionControls();
}


/* ============================================================
   CONTROL RENDERING
   ============================================================ */

const ATTENTION_WEIGHT_META = {
    cost: {
        label: "Cost",
        description: "Forecast overrun severity"
    },

    progress: {
        label: "Progress",
        description: "Lag versus planned progress"
    },

    critical_schedule: {
        label: "Critical Schedule",
        description: "Delayed critical activities"
    },

    procurement: {
        label: "Procurement",
        description: "Delayed and critical deliveries"
    },

    data_quality: {
        label: "Data Quality",
        description: "Data anomalies requiring review"
    }
};


function renderAttentionControls() {
    renderAttentionWeightControls();
    renderAttentionCostThresholds();
    renderAttentionProgressThresholds();
    renderAttentionLevelThresholds();
    updateAttentionTotalWeight();
}


function renderAttentionWeightControls() {
    const container =
        document.getElementById(
            "attention-weight-controls"
        );

    if (!container) return;

    container.innerHTML =
        Object.entries(
            ATTENTION_WEIGHT_META
        )
        .map(([key, meta]) => {
            const value =
                attentionCurrentConfig
                    .weights[key];

            return `
                <div class="attention-slider-row">

                    <div class="attention-slider-label">

                        <strong>
                            ${attentionEscape(meta.label)}
                        </strong>

                        <span>
                            ${attentionEscape(meta.description)}
                        </span>

                    </div>

                    <input
                        class="attention-slider"
                        type="range"
                        min="0"
                        max="50"
                        step="1"
                        value="${value}"
                        data-attention-weight-slider="${key}"
                    >

                    <input
                        class="attention-input"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value="${value}"
                        data-attention-weight-input="${key}"
                    >

                </div>
            `;
        })
        .join("");

    container
        .querySelectorAll(
            "[data-attention-weight-slider]"
        )
        .forEach(slider => {
            slider.addEventListener(
                "input",
                () => {
                    const key =
                        slider.dataset
                            .attentionWeightSlider;

                    const value =
                        Number(slider.value);

                    attentionCurrentConfig
                        .weights[key] =
                            value;

                    const input =
                        container.querySelector(
                            `[data-attention-weight-input="${key}"]`
                        );

                    if (input) {
                        input.value = value;
                    }

                    updateAttentionTotalWeight();
                }
            );
        });

    container
        .querySelectorAll(
            "[data-attention-weight-input]"
        )
        .forEach(input => {
            input.addEventListener(
                "input",
                () => {
                    const key =
                        input.dataset
                            .attentionWeightInput;

                    let value =
                        Number(input.value);

                    if (!Number.isFinite(value)) {
                        value = 0;
                    }

                    value =
                        Math.max(
                            0,
                            Math.min(
                                100,
                                value
                            )
                        );

                    attentionCurrentConfig
                        .weights[key] =
                            value;

                    const slider =
                        container.querySelector(
                            `[data-attention-weight-slider="${key}"]`
                        );

                    if (slider) {
                        slider.value =
                            Math.min(
                                50,
                                value
                            );
                    }

                    updateAttentionTotalWeight();
                }
            );
        });
}


function renderSimpleThresholdRows(
    containerId,
    configObject,
    labels,
    datasetPrefix
) {
    const container =
        document.getElementById(
            containerId
        );

    if (!container) return;

    container.innerHTML =
        Object.entries(labels)
            .map(([key, label]) => `
                <div class="attention-slider-row">

                    <div class="attention-slider-label">
                        <strong>
                            ${attentionEscape(label)}
                        </strong>
                    </div>

                    <div></div>

                    <input
                        class="attention-input"
                        type="number"
                        min="0"
                        step="0.5"
                        value="${configObject[key]}"
                        data-${datasetPrefix}="${key}"
                    >

                </div>
            `)
            .join("");
}


function renderAttentionCostThresholds() {
    renderSimpleThresholdRows(
        "attention-cost-thresholds",

        attentionCurrentConfig
            .component_thresholds
            .cost,

        {
            low: "Low",
            medium: "Medium",
            high: "High"
        },

        "attention-cost-threshold"
    );

    document
        .querySelectorAll(
            "[data-attention-cost-threshold]"
        )
        .forEach(input => {
            input.addEventListener(
                "input",
                () => {
                    const key =
                        input.dataset
                            .attentionCostThreshold;

                    attentionCurrentConfig
                        .component_thresholds
                        .cost[key] =
                            Number(input.value);
                }
            );
        });
}


function renderAttentionProgressThresholds() {
    renderSimpleThresholdRows(
        "attention-progress-thresholds",

        attentionCurrentConfig
            .component_thresholds
            .progress,

        {
            low: "Low",
            medium: "Medium",
            high: "High"
        },

        "attention-progress-threshold"
    );

    document
        .querySelectorAll(
            "[data-attention-progress-threshold]"
        )
        .forEach(input => {
            input.addEventListener(
                "input",
                () => {
                    const key =
                        input.dataset
                            .attentionProgressThreshold;

                    attentionCurrentConfig
                        .component_thresholds
                        .progress[key] =
                            Number(input.value);
                }
            );
        });
}


function renderAttentionLevelThresholds() {
    const container =
        document.getElementById(
            "attention-level-thresholds"
        );

    if (!container) return;

    const thresholds =
        attentionCurrentConfig
            .attention_thresholds;

    container.innerHTML = `
        <div class="attention-slider-row">

            <div class="attention-slider-label">
                <strong>Watch</strong>
                <span>
                    Minimum score for Watch
                </span>
            </div>

            <div></div>

            <input
                class="attention-input"
                id="attention-watch-threshold"
                type="number"
                min="0"
                step="1"
                value="${thresholds.watch}"
            >

        </div>


        <div class="attention-slider-row">

            <div class="attention-slider-label">
                <strong>Critical</strong>
                <span>
                    Minimum score for Critical
                </span>
            </div>

            <div></div>

            <input
                class="attention-input"
                id="attention-critical-threshold"
                type="number"
                min="0"
                step="1"
                value="${thresholds.critical}"
            >

        </div>
    `;

    document
        .getElementById(
            "attention-watch-threshold"
        )
        ?.addEventListener(
            "input",
            event => {
                attentionCurrentConfig
                    .attention_thresholds
                    .watch =
                        Number(
                            event.target.value
                        );
            }
        );

    document
        .getElementById(
            "attention-critical-threshold"
        )
        ?.addEventListener(
            "input",
            event => {
                attentionCurrentConfig
                    .attention_thresholds
                    .critical =
                        Number(
                            event.target.value
                        );
            }
        );
}


function updateAttentionTotalWeight() {
    const total =
        Object.values(
            attentionCurrentConfig?.weights || {}
        )
        .reduce(
            (sum, value) =>
                sum + Number(value || 0),
            0
        );

    const element =
        document.getElementById(
            "attention-total-weight"
        );

    if (element) {
        element.textContent =
            attentionNumber(
                total,
                0
            );
    }
}


/* ============================================================
   FEEDBACK
   ============================================================ */

function setAttentionFeedback(
    message,
    type = "info"
) {
    const element =
        document.getElementById(
            "attention-feedback"
        );

    if (!element) return;

    element.textContent = message;

    element.className =
        `attention-feedback visible ${type}`;
}


function clearAttentionFeedback() {
    const element =
        document.getElementById(
            "attention-feedback"
        );

    if (!element) return;

    element.textContent = "";

    element.className =
        "attention-feedback";
}


/* ============================================================
   DEFAULT RANKING
   ============================================================ */

async function loadDefaultAttentionRanking() {
    const data =
        await attentionFetchJson(
            `${ATTENTION_UI_API_BASE}/ranking`
        );

    attentionCurrentRanking =
        data.projects || [];

    renderAttentionSummary(
        data.summary || {}
    );

    renderAttentionRanking(
        attentionCurrentRanking
    );
}


/* ============================================================
   CUSTOM RERANK
   ============================================================ */

async function applyAttentionRerank() {
    clearAttentionFeedback();

    const button =
        document.getElementById(
            "attention-apply"
        );

    if (button) {
        button.disabled = true;
        button.textContent = "Reranking...";
    }

    try {
        const data =
            await attentionFetchJson(
                `${ATTENTION_UI_API_BASE}/rerank`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            attentionCurrentConfig
                        )
                }
            );

        attentionCurrentRanking =
            data.projects || [];

        renderAttentionSummary(
            data.summary || {}
        );

        renderAttentionRanking(
            attentionCurrentRanking
        );

        setAttentionFeedback(
            "Portfolio reranked using the current scenario.",
            "success"
        );

    } catch (error) {
        setAttentionFeedback(
            error.message,
            "error"
        );

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent =
                "Apply & Rerank";
        }
    }
}


/* ============================================================
   RESET
   ============================================================ */

async function resetAttentionDefaults() {
    attentionCurrentConfig =
        deepCloneAttention(
            attentionDefaultConfig
        );

    renderAttentionControls();

    await loadDefaultAttentionRanking();

    setAttentionFeedback(
        "Default ControlSight methodology restored.",
        "success"
    );
}


/* ============================================================
   SUMMARY
   ============================================================ */

function renderAttentionSummary(summary) {
    const container =
        document.getElementById(
            "attention-summary"
        );

    if (!container) return;

    container.innerHTML = `
        <div class="attention-summary-card">
            <span>Critical</span>
            <strong>
                ${attentionEscape(
                    summary.critical_projects ?? 0
                )}
            </strong>
        </div>

        <div class="attention-summary-card">
            <span>Watch</span>
            <strong>
                ${attentionEscape(
                    summary.watch_projects ?? 0
                )}
            </strong>
        </div>

        <div class="attention-summary-card">
            <span>Review</span>
            <strong>
                ${attentionEscape(
                    summary.review_projects ?? 0
                )}
            </strong>
        </div>

        <div class="attention-summary-card">
            <span>Stable</span>
            <strong>
                ${attentionEscape(
                    summary.stable_projects ?? 0
                )}
            </strong>
        </div>
    `;
}


/* ============================================================
   RANKING
   ============================================================ */

function renderAttentionRanking(projects) {
    const container =
        document.getElementById(
            "attention-ranking-container"
        );

    if (!container) return;

    if (!projects.length) {
        container.innerHTML =
            "No portfolio ranking available.";

        return;
    }

    container.innerHTML = `
        <div class="attention-table-wrap">

            <table class="attention-table">

                <thead>

                    <tr>
                        <th>Rank</th>
                        <th>Project</th>
                        <th>Score</th>
                        <th>Level</th>
                        <th>Primary Driver</th>
                        <th>Score Breakdown</th>
                    </tr>

                </thead>

                <tbody>

                    ${projects
                        .map(project =>
                            renderAttentionProjectRow(
                                project
                            )
                        )
                        .join("")}

                </tbody>

            </table>

        </div>
    `;
}


function renderAttentionProjectRow(project) {
    const scoreMaximum =
        Number(
            project.attention_score_maximum
            || 100
        );

    const components =
        project.score_components || {};

    const breakdownOrder = [
        ["cost", "Cost"],
        ["progress", "Progress"],
        ["critical_schedule", "Schedule"],
        ["procurement", "Procurement"],
        ["data_quality", "Data Quality"]
    ];

    const breakdownHtml =
        breakdownOrder
            .map(([key, label]) => {
                const item =
                    components[key] || {};

                const score =
                    Number(item.score || 0);

                const maximum =
                    Number(item.maximum || 0);

                const percent =
                    maximum > 0
                        ? Math.min(
                            100,
                            score / maximum * 100
                        )
                        : 0;

                return `
                    <div class="attention-breakdown-row">

                        <span class="attention-breakdown-label">
                            ${attentionEscape(label)}
                        </span>

                        <div class="attention-breakdown-track">

                            <div
                                class="attention-breakdown-fill"
                                style="
                                    width:
                                    ${percent.toFixed(1)}%;
                                "
                            ></div>

                        </div>

                        <span class="attention-breakdown-value">
                            ${attentionNumber(score, 1)}
                            /
                            ${attentionNumber(maximum, 0)}
                        </span>

                    </div>
                `;
            })
            .join("");

    const level =
        String(
            project.attention_level
            || "Stable"
        );

    return `
        <tr>

            <td>
                <span class="attention-rank">
                    ${attentionEscape(
                        project.rank
                    )}
                </span>
            </td>

            <td>
                <strong>
                    ${attentionEscape(
                        project.project_name
                    )}
                </strong>

                <div
                    style="
                        color:#94a3b8;
                        font-size:7px;
                        margin-top:2px;
                    "
                >
                    ${attentionEscape(
                        project.project_code
                    )}
                </div>
            </td>

            <td class="attention-score-cell">

                <strong>
                    ${attentionNumber(
                        project.attention_score,
                        1
                    )}
                </strong>

                <span>
                    of
                    ${attentionNumber(
                        scoreMaximum,
                        0
                    )}
                    ·
                    ${attentionNumber(
                        project.attention_score_pct,
                        1
                    )}%
                </span>

            </td>

            <td>

                <span
                    class="
                        attention-level
                        ${level.toLowerCase()}
                    "
                >
                    ${attentionEscape(level)}
                </span>

            </td>

            <td>
                ${attentionEscape(
                    project.primary_driver
                )}
            </td>

            <td>
                <div class="attention-breakdown">
                    ${breakdownHtml}
                </div>
            </td>

        </tr>
    `;
}


/* ============================================================
   EVENTS
   ============================================================ */

function initialiseAttentionEvents() {
    document
        .getElementById(
            "attention-apply"
        )
        ?.addEventListener(
            "click",
            applyAttentionRerank
        );

    document
        .getElementById(
            "attention-reset"
        )
        ?.addEventListener(
            "click",
            resetAttentionDefaults
        );
}


/* ============================================================
   INITIALISE
   ============================================================ */

async function initialiseAttentionUI() {
    if (attentionInitialised) {
        return;
    }

    attentionInitialised = true;

    installAttentionStyles();
    installAttentionPage();
    installAttentionNavigation();
    initialiseAttentionEvents();

    try {
        await loadAttentionConfig();
        await loadDefaultAttentionRanking();

    } catch (error) {
        console.error(
            "Attention UI failed:",
            error
        );

        setAttentionFeedback(
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
        initialiseAttentionUI();
    }
);
