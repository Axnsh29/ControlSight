/* ============================================================
   CONTROLSIGHT
   BUDGET & CHANGE CONTROL UI
   v1.0.0
   ============================================================ */

const CC_API_BASE = "/api/change-control";

let ccInitialised = false;
let ccSelectedProject = null;
let ccPortfolioData = null;
let ccConfig = null;


/* ============================================================
   HELPERS
   ============================================================ */

function ccEscape(value) {

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


function ccMoney(value) {

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


function ccDate(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
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


async function ccFetchJson(
    url,
    options = {}
) {

    const response = await fetch(
        url,
        options
    );

    if (!response.ok) {

        let detail =
            `Request failed with HTTP ${response.status}`;

        try {

            const payload =
                await response.json();

            if (
                typeof payload?.detail ===
                "string"
            ) {
                detail = payload.detail;
            }

        } catch {
            // ignore
        }

        throw new Error(detail);
    }

    return response.json();
}


/* ============================================================
   STYLES
   ============================================================ */

function installCCStyles() {

    if (
        document.getElementById(
            "controlsight-change-control-styles"
        )
    ) {
        return;
    }

    const style =
        document.createElement("style");

    style.id =
        "controlsight-change-control-styles";

    style.textContent = `

        #change-control {
            scroll-margin-top: 90px;
        }

        .cc-shell {
            display: grid;
            gap: 18px;
        }

        .cc-hero {

            display: flex;
            justify-content: space-between;
            align-items: flex-start;

            gap: 18px;

            padding: 20px 22px;

            color: white;

            background:
                linear-gradient(
                    135deg,
                    #0f172a,
                    #334155
                );

            border-radius: 12px;

            box-shadow:
                0 10px 28px
                rgba(15, 23, 42, 0.15);
        }

        .cc-eyebrow {

            display: block;

            margin-bottom: 6px;

            color: #93c5fd;

            font-size: 10px;
            font-weight: 850;

            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .cc-hero h2 {

            margin: 0;

            color: white;

            font-size: 22px;
            font-weight: 850;
        }

        .cc-hero p {

            max-width: 760px;

            margin: 8px 0 0;

            color: #cbd5e1;

            font-size: 11px;
            line-height: 1.6;
        }

        .cc-badge {

            flex: 0 0 auto;

            padding: 8px 11px;

            color: #bfdbfe;

            background:
                rgba(59, 130, 246, 0.12);

            border:
                1px solid
                rgba(147, 197, 253, 0.25);

            border-radius: 999px;

            font-size: 9px;
            font-weight: 850;
        }

        .cc-panel {

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

        .cc-header {

            display: flex;
            justify-content: space-between;
            align-items: flex-start;

            gap: 16px;

            margin-bottom: 16px;
        }

        .cc-header h3 {

            margin: 0;

            color: #0f172a;

            font-size: 16px;
            font-weight: 850;
        }

        .cc-header p {

            margin: 5px 0 0;

            color: #64748b;

            font-size: 10px;
            line-height: 1.5;
        }

        .cc-project-select {

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

        .cc-kpi-grid {

            display: grid;

            grid-template-columns:
                repeat(5, minmax(0, 1fr));

            gap: 10px;
        }

        .cc-kpi {

            padding: 14px;

            background: #f8fafc;

            border:
                1px solid
                #e5eaf1;

            border-radius: 8px;
        }

        .cc-kpi span {

            display: block;

            color: #64748b;

            font-size: 8px;
            font-weight: 750;
        }

        .cc-kpi strong {

            display: block;

            margin-top: 5px;

            color: #0f172a;

            font-size: 16px;
            font-weight: 850;
        }

        .cc-kpi.pending strong {
            color: #b45309;
        }

        .cc-kpi.approved strong {
            color: #166534;
        }

        .cc-bridge {

            display: grid;

            grid-template-columns:
                repeat(5, minmax(0, 1fr));

            gap: 6px;

            margin-top: 16px;
        }

        .cc-bridge-step {

            padding: 10px;

            text-align: center;

            background: #f8fafc;

            border:
                1px solid
                #e2e8f0;

            border-radius: 7px;

            font-size: 8px;
        }

        .cc-bridge-step strong {

            display: block;

            margin-top: 4px;

            color: #0f172a;

            font-size: 11px;
        }

        .cc-grid-two {

            display: grid;

            grid-template-columns:
                minmax(0, 0.9fr)
                minmax(0, 1.1fr);

            gap: 16px;
        }

        .cc-form-grid {

            display: grid;

            grid-template-columns:
                repeat(2, minmax(0, 1fr));

            gap: 10px;
        }

        .cc-field {

            display: grid;
            gap: 5px;
        }

        .cc-field.full {
            grid-column: 1 / -1;
        }

        .cc-field label {

            color: #475569;

            font-size: 8px;
            font-weight: 800;
        }

        .cc-input,
        .cc-select,
        .cc-textarea {

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

        .cc-textarea {

            min-height: 76px;

            resize: vertical;
        }

        .cc-button-row {

            display: flex;
            flex-wrap: wrap;

            gap: 8px;

            margin-top: 14px;
        }

        .cc-button {

            appearance: none;

            padding: 8px 11px;

            border-radius: 6px;

            font-family: inherit;

            font-size: 9px;
            font-weight: 850;

            cursor: pointer;
        }

        .cc-primary {

            color: white;

            background: #2563eb;

            border:
                1px solid
                #2563eb;
        }

        .cc-secondary {

            color: #334155;

            background: white;

            border:
                1px solid
                #cbd5e1;
        }

        .cc-success {

            color: #166534;

            background: #f0fdf4;

            border:
                1px solid
                #bbf7d0;
        }

        .cc-warning {

            color: #92400e;

            background: #fffbeb;

            border:
                1px solid
                #fde68a;
        }

        .cc-danger {

            color: #991b1b;

            background: #fef2f2;

            border:
                1px solid
                #fecaca;
        }

        .cc-table-wrap {

            overflow-x: auto;

            border:
                1px solid
                #e5eaf1;

            border-radius: 8px;
        }

        .cc-table {

            width: 100%;

            min-width: 1050px;

            border-collapse: collapse;

            font-size: 9px;
        }

        .cc-table th {

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

        .cc-table td {

            padding: 11px 10px;

            color: #334155;

            border-bottom:
                1px solid
                #eef2f7;

            vertical-align: top;
        }

        .cc-status {

            display: inline-flex;

            padding: 5px 7px;

            border-radius: 999px;

            font-size: 8px;
            font-weight: 850;
        }

        .cc-status.pending {

            color: #92400e;
            background: #fef3c7;
        }

        .cc-status.approved {

            color: #166534;
            background: #dcfce7;
        }

        .cc-status.draft {

            color: #475569;
            background: #e2e8f0;
        }

        .cc-status.rejected,
        .cc-status.cancelled {

            color: #991b1b;
            background: #fee2e2;
        }

        .cc-row-actions {

            display: flex;
            flex-wrap: wrap;

            gap: 5px;
        }

        .cc-row-button {

            appearance: none;

            padding: 5px 7px;

            border-radius: 5px;

            font-family: inherit;

            font-size: 7px;
            font-weight: 800;

            cursor: pointer;
        }

        .cc-feedback {

            display: none;

            margin-top: 12px;

            padding: 9px 11px;

            border-radius: 7px;

            font-size: 9px;
        }

        .cc-feedback.visible {
            display: block;
        }

        .cc-feedback.success {

            color: #166534;

            background: #f0fdf4;

            border:
                1px solid
                #bbf7d0;
        }

        .cc-feedback.error {

            color: #991b1b;

            background: #fef2f2;

            border:
                1px solid
                #fecaca;
        }

        .cc-empty {

            padding: 28px;

            text-align: center;

            color: #64748b;

            font-size: 10px;
        }

        .cc-note {

            padding: 12px;

            color: #475569;

            background: #f8fafc;

            border:
                1px solid
                #e2e8f0;

            border-radius: 8px;

            font-size: 9px;
            line-height: 1.5;
        }

        @media (max-width: 1150px) {

            .cc-kpi-grid {
                grid-template-columns:
                    repeat(3, minmax(0, 1fr));
            }

            .cc-grid-two {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 720px) {

            .cc-hero,
            .cc-header {

                flex-direction: column;
            }

            .cc-project-select {
                width: 100%;
                min-width: 0;
            }

            .cc-kpi-grid,
            .cc-bridge,
            .cc-form-grid {

                grid-template-columns: 1fr;
            }

            .cc-field.full {
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

function installCCPage() {

    if (
        document.getElementById(
            "change-control"
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
        "change-control";

    section.className =
        "dashboard-section";

    section.innerHTML = `

        <div class="cc-shell">

            <div class="cc-hero">

                <div>

                    <span class="cc-eyebrow">
                        Commercial Control
                    </span>

                    <h2>
                        Budget & Change Control
                    </h2>

                    <p>
                        Maintain original and current budget,
                        approved variations, pending exposure
                        and a traceable project change register.
                    </p>

                </div>

                <div class="cc-badge">
                    Controlled Budget Logic
                </div>

            </div>


            <div class="cc-panel">

                <div class="cc-header">

                    <div>

                        <h3>
                            Project Budget Position
                        </h3>

                        <p>
                            Current Budget =
                            Original Budget +
                            Approved Changes.
                        </p>

                    </div>


                    <select
                        id="cc-project-select"
                        class="cc-project-select"
                    ></select>

                </div>


                <div
                    id="cc-kpis"
                    class="cc-kpi-grid"
                ></div>


                <div
                    id="cc-budget-bridge"
                    class="cc-bridge"
                ></div>

            </div>


            <div class="cc-grid-two">

                <div class="cc-panel">

                    <div class="cc-header">

                        <div>

                            <h3>
                                Register Change
                            </h3>

                            <p>
                                Add project variations and
                                control their approval status.
                            </p>

                        </div>

                    </div>


                    <div class="cc-form-grid">

                        <div class="cc-field">

                            <label>
                                Change Reference
                            </label>

                            <input
                                id="cc-reference"
                                class="cc-input"
                                placeholder="VO-006-002"
                            >

                        </div>


                        <div class="cc-field">

                            <label>
                                Category
                            </label>

                            <select
                                id="cc-category"
                                class="cc-select"
                            ></select>

                        </div>


                        <div class="cc-field">

                            <label>
                                Status
                            </label>

                            <select
                                id="cc-status"
                                class="cc-select"
                            ></select>

                        </div>


                        <div class="cc-field">

                            <label>
                                Amount (£)
                            </label>

                            <input
                                id="cc-amount"
                                class="cc-input"
                                type="number"
                                step="1000"
                            >

                        </div>


                        <div class="cc-field">

                            <label>
                                Requested By
                            </label>

                            <input
                                id="cc-requested-by"
                                class="cc-input"
                                placeholder="Project Controls"
                            >

                        </div>


                        <div class="cc-field">

                            <label>
                                Approved By
                            </label>

                            <input
                                id="cc-approved-by"
                                class="cc-input"
                                placeholder="Project Manager"
                            >

                        </div>


                        <div class="cc-field full">

                            <label>
                                Title
                            </label>

                            <input
                                id="cc-title"
                                class="cc-input"
                                placeholder="Describe the change"
                            >

                        </div>


                        <div class="cc-field full">

                            <label>
                                Description
                            </label>

                            <textarea
                                id="cc-description"
                                class="cc-textarea"
                            ></textarea>

                        </div>

                    </div>


                    <div class="cc-button-row">

                        <button
                            id="cc-create"
                            class="
                                cc-button
                                cc-primary
                            "
                            type="button"
                        >
                            Add Change
                        </button>


                        <button
                            id="cc-clear"
                            class="
                                cc-button
                                cc-secondary
                            "
                            type="button"
                        >
                            Clear
                        </button>

                    </div>


                    <div
                        id="cc-feedback"
                        class="cc-feedback"
                    ></div>

                </div>


                <div class="cc-panel">

                    <div class="cc-header">

                        <div>

                            <h3>
                                Control Logic
                            </h3>

                        </div>

                    </div>


                    <div class="cc-note">

                        <strong>
                            Approved
                        </strong>
                        changes alter Current Budget

                        <br><br>

                        <strong>
                            Pending
                        </strong>
                        changes remain commercial exposure
                        and feed Potential Budget only

                        <br><br>

                        <strong>
                            Draft / Rejected / Cancelled
                        </strong>
                        records do not alter Current Budget

                    </div>

                </div>

            </div>


            <div class="cc-panel">

                <div class="cc-header">

                    <div>

                        <h3>
                            Change Register
                        </h3>

                        <p>
                            Review and control project
                            commercial changes.
                        </p>

                    </div>


                    <button
                        id="cc-refresh"
                        class="
                            cc-button
                            cc-secondary
                        "
                        type="button"
                    >
                        Refresh
                    </button>

                </div>


                <div id="cc-register">
                    Loading...
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

function installCCNavigation() {

    const nav =
        document.querySelector(
            ".sidebar-nav"
        );

    if (!nav) {
        return;
    }

    if (
        nav.querySelector(
            'a[href="#change-control"]'
        )
    ) {
        return;
    }

    const link =
        document.createElement(
            "a"
        );

    link.href =
        "#change-control";

    link.className =
        "nav-item";

    link.innerHTML = `

        <span class="nav-icon">
            ±
        </span>

        <span>
            Change Control
        </span>
    `;

    link.addEventListener(
        "click",
        event => {

            event.preventDefault();

            document
                .getElementById(
                    "change-control"
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

async function loadCCConfig() {

    ccConfig =
        await ccFetchJson(
            `${CC_API_BASE}/config`
        );


    const categories =
        ccConfig.categories
        ||
        ccConfig.change_categories
        ||
        [];


    const statuses =
        ccConfig.statuses
        ||
        ccConfig.change_statuses
        ||
        [];


    const categorySelect =
        document.getElementById(
            "cc-category"
        );


    const statusSelect =
        document.getElementById(
            "cc-status"
        );


    categorySelect.innerHTML =
        categories
            .map(
                value => `

                    <option
                        value="${ccEscape(value)}"
                    >
                        ${ccEscape(value)}
                    </option>
                `
            )
            .join("");


    statusSelect.innerHTML =
        statuses
            .map(
                value => `

                    <option
                        value="${ccEscape(value)}"
                        ${
                            value === "Pending"
                                ? "selected"
                                : ""
                        }
                    >
                        ${ccEscape(value)}
                    </option>
                `
            )
            .join("");
}


/* ============================================================
   PORTFOLIO
   ============================================================ */

async function loadCCPortfolio() {

    ccPortfolioData =
        await ccFetchJson(
            `${CC_API_BASE}/portfolio`
        );


    const projects =
        ccPortfolioData.projects
        ||
        ccPortfolioData.data
        ||
        [];


    const select =
        document.getElementById(
            "cc-project-select"
        );


    select.innerHTML =
        projects
            .map(
                project => `

                    <option
                        value="${ccEscape(
                            project.project_code
                        )}"
                    >
                        ${ccEscape(
                            project.project_code
                        )}
                        ·
                        ${ccEscape(
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
        !ccSelectedProject
        &&
        sharedProject
        &&
        projects.some(
            project =>
                project.project_code ===
                sharedProject
        )
    ) {

        ccSelectedProject =
            sharedProject;
    }


    if (
        !ccSelectedProject
        &&
        projects.length
    ) {

        ccSelectedProject =
            projects[0]
                .project_code;
    }


    if (
        ccSelectedProject
    ) {

        select.value =
            ccSelectedProject;

        await loadCCProject();
    }
}


/* ============================================================
   PROJECT DATA
   ============================================================ */

async function loadCCProject() {

    if (!ccSelectedProject) {
        return;
    }


    const [
        summary,
        changesPayload
    ] = await Promise.all(
        [

            ccFetchJson(
                `${CC_API_BASE}/projects/${encodeURIComponent(
                    ccSelectedProject
                )}/summary`
            ),

            ccFetchJson(
                `${CC_API_BASE}/projects/${encodeURIComponent(
                    ccSelectedProject
                )}/changes`
            )
        ]
    );


    const changes =
        Array.isArray(
            changesPayload
        )
            ? changesPayload
            :
        changesPayload.changes
            || [];


    renderCCSummary(
        summary
    );

    renderCCChanges(
        changes
    );
}


/* ============================================================
   SUMMARY
   ============================================================ */

function renderCCSummary(
    data
) {

    const container =
        document.getElementById(
            "cc-kpis"
        );


    container.innerHTML = `

        <div class="cc-kpi">

            <span>
                Original Budget
            </span>

            <strong>
                ${ccMoney(
                    data.original_budget
                )}
            </strong>

        </div>


        <div class="
            cc-kpi
            approved
        ">

            <span>
                Approved Changes
            </span>

            <strong>
                ${ccMoney(
                    data.approved_changes
                )}
            </strong>

        </div>


        <div class="cc-kpi">

            <span>
                Current Budget
            </span>

            <strong>
                ${ccMoney(
                    data.current_budget
                )}
            </strong>

        </div>


        <div class="
            cc-kpi
            pending
        ">

            <span>
                Pending Changes
            </span>

            <strong>
                ${ccMoney(
                    data.pending_changes
                )}
            </strong>

        </div>


        <div class="cc-kpi">

            <span>
                Potential Budget
            </span>

            <strong>
                ${ccMoney(
                    data.potential_budget_if_pending_approved
                    ??
                    data.potential_budget
                )}
            </strong>

        </div>
    `;


    const potential =
        data.potential_budget_if_pending_approved
        ??
        data.potential_budget
        ??
        data.current_budget;


    const bridge =
        document.getElementById(
            "cc-budget-bridge"
        );


    bridge.innerHTML = `

        <div class="cc-bridge-step">

            Original

            <strong>
                ${ccMoney(
                    data.original_budget
                )}
            </strong>

        </div>


        <div class="cc-bridge-step">

            + Approved

            <strong>
                ${ccMoney(
                    data.approved_changes
                )}
            </strong>

        </div>


        <div class="cc-bridge-step">

            = Current

            <strong>
                ${ccMoney(
                    data.current_budget
                )}
            </strong>

        </div>


        <div class="cc-bridge-step">

            + Pending

            <strong>
                ${ccMoney(
                    data.pending_changes
                )}
            </strong>

        </div>


        <div class="cc-bridge-step">

            = Potential

            <strong>
                ${ccMoney(
                    potential
                )}
            </strong>

        </div>
    `;
}


/* ============================================================
   CHANGE REGISTER
   ============================================================ */

function renderCCChanges(
    changes
) {

    const container =
        document.getElementById(
            "cc-register"
        );


    if (!changes.length) {

        container.innerHTML = `

            <div class="cc-empty">
                No changes registered for this project.
            </div>
        `;

        return;
    }


    container.innerHTML = `

        <div class="cc-table-wrap">

            <table class="cc-table">

                <thead>

                    <tr>

                        <th>Reference</th>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Requested By</th>
                        <th>Approved By</th>
                        <th>Approval Date</th>
                        <th>Actions</th>

                    </tr>

                </thead>


                <tbody>

                    ${changes
                        .map(
                            change =>
                                renderCCChangeRow(
                                    change
                                )
                        )
                        .join("")}

                </tbody>

            </table>

        </div>
    `;


    initialiseCCRowEvents();
}


function renderCCChangeRow(
    change
) {

    const status =
        String(
            change.status
            ||
            ""
        );


    let actions = "";


    if (
        status === "Pending"
        ||
        status === "Draft"
    ) {

        actions += `

            <button
                class="
                    cc-row-button
                    cc-success
                "
                data-cc-status="Approved"
                data-cc-id="${ccEscape(
                    change.change_id
                )}"
            >
                Approve
            </button>
        `;


        actions += `

            <button
                class="
                    cc-row-button
                    cc-warning
                "
                data-cc-status="Rejected"
                data-cc-id="${ccEscape(
                    change.change_id
                )}"
            >
                Reject
            </button>
        `;
    }


    if (
        status !== "Cancelled"
        &&
        status !== "Rejected"
    ) {

        actions += `

            <button
                class="
                    cc-row-button
                    cc-secondary
                "
                data-cc-status="Cancelled"
                data-cc-id="${ccEscape(
                    change.change_id
                )}"
            >
                Cancel
            </button>
        `;
    }


    actions += `

        <button
            class="
                cc-row-button
                cc-danger
            "
            data-cc-delete="${ccEscape(
                change.change_id
            )}"
        >
            Delete
        </button>
    `;


    return `

        <tr>

            <td>

                <strong>
                    ${ccEscape(
                        change.change_reference
                    )}
                </strong>

            </td>


            <td>

                ${ccEscape(
                    change.title
                )}

                ${
                    change.description
                        ? `
                            <div
                                style="
                                    margin-top:3px;
                                    color:#94a3b8;
                                    font-size:7px;
                                "
                            >
                                ${ccEscape(
                                    change.description
                                )}
                            </div>
                        `
                        : ""
                }

            </td>


            <td>
                ${ccEscape(
                    change.category
                )}
            </td>


            <td>

                <strong>
                    ${ccMoney(
                        change.change_amount
                    )}
                </strong>

            </td>


            <td>

                <span
                    class="
                        cc-status
                        ${status.toLowerCase()}
                    "
                >
                    ${ccEscape(
                        status
                    )}
                </span>

            </td>


            <td>
                ${ccEscape(
                    change.requested_by
                )}
            </td>


            <td>
                ${ccEscape(
                    change.approved_by
                )}
            </td>


            <td>
                ${ccEscape(
                    ccDate(
                        change.approval_date
                    )
                )}
            </td>


            <td>

                <div class="cc-row-actions">
                    ${actions}
                </div>

            </td>

        </tr>
    `;
}


/* ============================================================
   CREATE CHANGE
   ============================================================ */

async function createCCChange() {

    clearCCFeedback();


    const reference =
        document.getElementById(
            "cc-reference"
        ).value.trim();


    const category =
        document.getElementById(
            "cc-category"
        ).value;


    const status =
        document.getElementById(
            "cc-status"
        ).value;


    const amount =
        Number(
            document.getElementById(
                "cc-amount"
            ).value
        );


    const requestedBy =
        document.getElementById(
            "cc-requested-by"
        ).value.trim();


    const approvedBy =
        document.getElementById(
            "cc-approved-by"
        ).value.trim();


    const title =
        document.getElementById(
            "cc-title"
        ).value.trim();


    const description =
        document.getElementById(
            "cc-description"
        ).value.trim();


    if (!reference) {

        setCCFeedback(
            "Change reference is required.",
            "error"
        );

        return;
    }


    if (!title) {

        setCCFeedback(
            "Change title is required.",
            "error"
        );

        return;
    }


    if (
        !Number.isFinite(amount)
        ||
        amount === 0
    ) {

        setCCFeedback(
            "Enter a non-zero change amount.",
            "error"
        );

        return;
    }


    try {

        await ccFetchJson(
            `${CC_API_BASE}/changes`,
            {

                method:
                    "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(
                        {
                            project_code:
                                ccSelectedProject,

                            change_reference:
                                reference,

                            category:
                                category,

                            title:
                                title,

                            description:
                                description || null,

                            change_amount:
                                amount,

                            status:
                                status,

                            requested_by:
                                requestedBy || null,

                            approved_by:
                                approvedBy || null
                        }
                    )
            }
        );


        setCCFeedback(
            "Change registered successfully.",
            "success"
        );


        clearCCForm();

        await refreshCCProject();

    } catch (error) {

        setCCFeedback(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   UPDATE STATUS
   ============================================================ */

async function updateCCStatus(
    changeId,
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

        payload.approval_date =
            new Date()
                .toISOString()
                .slice(0, 10);
    }


    try {

        await ccFetchJson(
            `${CC_API_BASE}/changes/${encodeURIComponent(
                changeId
            )}`,
            {

                method:
                    "PATCH",

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


        setCCFeedback(
            `Change updated to ${status}.`,
            "success"
        );


        await refreshCCProject();

    } catch (error) {

        setCCFeedback(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   DELETE
   ============================================================ */

async function deleteCCChange(
    changeId
) {

    if (
        !window.confirm(
            "Delete this change record?"
        )
    ) {
        return;
    }


    try {

        await ccFetchJson(
            `${CC_API_BASE}/changes/${encodeURIComponent(
                changeId
            )}`,
            {
                method:
                    "DELETE"
            }
        );


        setCCFeedback(
            "Change deleted.",
            "success"
        );


        await refreshCCProject();

    } catch (error) {

        setCCFeedback(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   ROW EVENTS
   ============================================================ */

function initialiseCCRowEvents() {

    document
        .querySelectorAll(
            "[data-cc-status]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        updateCCStatus(
                            button.dataset.ccId,
                            button.dataset.ccStatus
                        );
                    }
                );
            }
        );


    document
        .querySelectorAll(
            "[data-cc-delete]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        deleteCCChange(
                            button.dataset.ccDelete
                        );
                    }
                );
            }
        );
}


/* ============================================================
   FORM
   ============================================================ */

function clearCCForm() {

    [
        "cc-reference",
        "cc-amount",
        "cc-requested-by",
        "cc-approved-by",
        "cc-title",
        "cc-description"
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
            "cc-status"
        );


    if (status) {
        status.value =
            "Pending";
    }
}


/* ============================================================
   FEEDBACK
   ============================================================ */

function setCCFeedback(
    message,
    type
) {

    const element =
        document.getElementById(
            "cc-feedback"
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.className =
        `cc-feedback visible ${type}`;
}


function clearCCFeedback() {

    const element =
        document.getElementById(
            "cc-feedback"
        );


    if (!element) {
        return;
    }


    element.textContent = "";

    element.className =
        "cc-feedback";
}


/* ============================================================
   REFRESH
   ============================================================ */

async function refreshCCProject() {

    await loadCCProject();
}


/* ============================================================
   EVENTS
   ============================================================ */

function initialiseCCEvents() {

    document
        .getElementById(
            "cc-project-select"
        )
        ?.addEventListener(
            "change",
            async event => {

                ccSelectedProject =
                    event.target.value;

                sessionStorage.setItem(
                    "controlsight:selected-project",
                    ccSelectedProject
                );

                await loadCCProject();
            }
        );


    document
        .getElementById(
            "cc-create"
        )
        ?.addEventListener(
            "click",
            createCCChange
        );


    document
        .getElementById(
            "cc-clear"
        )
        ?.addEventListener(
            "click",
            clearCCForm
        );


    document
        .getElementById(
            "cc-refresh"
        )
        ?.addEventListener(
            "click",
            refreshCCProject
        );
}


/* ============================================================
   INITIALISE
   ============================================================ */

async function initialiseChangeControlUI() {

    if (
        ccInitialised
    ) {
        return;
    }


    ccInitialised =
        true;


    installCCStyles();

    installCCPage();

    installCCNavigation();

    initialiseCCEvents();


    try {

        await loadCCConfig();

        await loadCCPortfolio();

    } catch (error) {

        console.error(
            "Change Control UI failed:",
            error
        );


        setCCFeedback(
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

        initialiseChangeControlUI();

    }
);
