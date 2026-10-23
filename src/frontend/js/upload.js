/* ============================================================
   CONTROLSIGHT
   BYO DATA / CSV UPLOAD UI
   v1.0.0
   ============================================================ */

const CONTROL_UPLOAD_API_BASE = "/api/uploads";

let controlUploadSelectedDataset = "cost";
let controlUploadSelectedFile = null;
let controlUploadTemplates = [];
let controlUploadHistory = [];
let controlUploadInitialised = false;


/* ============================================================
   HELPERS
   ============================================================ */

function uploadEscape(value) {

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


function uploadFormatNumber(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return new Intl.NumberFormat(
        "en-GB"
    ).format(number);
}


function uploadFormatPercentage(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "0.0%";
    }

    return `${number.toFixed(1)}%`;
}


function uploadFormatFileSize(bytes) {

    const size = Number(bytes);

    if (
        !Number.isFinite(size) ||
        size <= 0
    ) {
        return "0 KB";
    }

    if (size < 1024) {
        return `${size} B`;
    }

    if (size < 1024 * 1024) {

        return `${(
            size / 1024
        ).toFixed(1)} KB`;
    }

    return `${(
        size /
        1024 /
        1024
    ).toFixed(2)} MB`;
}


function uploadFormatDateTime(value) {

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
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(date);
}


function uploadDatasetLabel(dataset) {

    const match =
        controlUploadTemplates.find(
            item =>
                item.dataset === dataset
        );

    return match?.label || dataset;
}


/* ============================================================
   FETCH
   ============================================================ */

async function uploadFetchJson(
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

function installUploadStyles() {

    if (
        document.getElementById(
            "controlsight-upload-styles"
        )
    ) {
        return;
    }

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "controlsight-upload-styles";

    style.textContent = `

        #upload-data {
            scroll-margin-top: 90px;
        }

        .upload-page-shell {
            display: grid;
            gap: 16px;
        }

        .upload-page-header {

            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;

            padding: 18px 20px;

            background:
                linear-gradient(
                    135deg,
                    #0b1628,
                    #132c48
                );

            border-radius: 10px;
            color: #ffffff;

            box-shadow:
                0 10px 28px
                rgba(
                    15,
                    23,
                    42,
                    0.14
                );
        }

        .upload-page-header-copy {
            max-width: 760px;
        }

        .upload-page-eyebrow {

            display: block;
            margin-bottom: 5px;

            color: #60a5fa;

            font-size: 8px;
            font-weight: 850;

            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .upload-page-header h2 {

            margin: 0;

            color: #ffffff;

            font-size: 19px;
            font-weight: 800;
        }

        .upload-page-header p {

            margin: 7px 0 0;

            color: #cbd5e1;

            font-size: 9px;
            line-height: 1.6;
        }

        .upload-safety-badge {

            flex: 0 0 auto;

            padding: 7px 10px;

            border-radius: 999px;

            color: #bbf7d0;

            background:
                rgba(
                    34,
                    197,
                    94,
                    0.12
                );

            border:
                1px solid
                rgba(
                    34,
                    197,
                    94,
                    0.25
                );

            font-size: 8px;
            font-weight: 800;
        }

        .upload-main-grid {

            display: grid;

            grid-template-columns:
                minmax(0, 1.15fr)
                minmax(0, 0.85fr);

            gap: 16px;
        }

        .upload-panel {

            padding: 18px;

            background: #ffffff;

            border: 1px solid #e5e7eb;

            border-radius: 10px;

            box-shadow:
                0 2px 8px
                rgba(
                    15,
                    23,
                    42,
                    0.05
                );
        }

        .upload-panel-header {

            display: flex;
            justify-content: space-between;
            align-items: flex-start;

            gap: 16px;

            margin-bottom: 14px;
        }

        .upload-panel-header h3 {

            margin: 0;

            color: #0f172a;

            font-size: 14px;
            font-weight: 800;
        }

        .upload-panel-header p {

            margin: 5px 0 0;

            color: #64748b;

            font-size: 8px;
            line-height: 1.5;
        }

        .upload-dataset-grid {

            display: grid;

            grid-template-columns:
                repeat(
                    4,
                    minmax(0, 1fr)
                );

            gap: 7px;

            margin-bottom: 14px;
        }

        .upload-dataset-button {

            appearance: none;

            padding: 10px 8px;

            background: #f8fafc;

            color: #475569;

            border:
                1px solid
                #dbe3ec;

            border-radius: 7px;

            font-family: inherit;

            font-size: 8px;
            font-weight: 800;

            cursor: pointer;
        }

        .upload-dataset-button.active {

            color: #ffffff;

            background: #2563eb;

            border-color: #2563eb;
        }

        .upload-template-box {

            display: flex;
            justify-content: space-between;
            align-items: center;

            gap: 12px;

            margin-bottom: 14px;
            padding: 10px 12px;

            background: #eff6ff;

            border: 1px solid #bfdbfe;

            border-radius: 7px;
        }

        .upload-template-box strong {

            display: block;

            color: #1e3a8a;

            font-size: 8px;
        }

        .upload-template-box span {

            display: block;

            margin-top: 2px;

            color: #1d4ed8;

            font-size: 7px;
        }

        .upload-template-button {

            appearance: none;

            padding: 7px 10px;

            color: #1d4ed8;

            background: #ffffff;

            border: 1px solid #93c5fd;

            border-radius: 6px;

            font-family: inherit;

            font-size: 8px;
            font-weight: 800;

            cursor: pointer;

            text-decoration: none;

            white-space: nowrap;
        }

        .upload-drop-zone {

            position: relative;

            display: flex;
            flex-direction: column;

            align-items: center;
            justify-content: center;

            min-height: 190px;

            padding: 24px;

            text-align: center;

            background:
                linear-gradient(
                    180deg,
                    #f8fafc,
                    #ffffff
                );

            border: 2px dashed #cbd5e1;

            border-radius: 10px;

            cursor: pointer;
        }

        .upload-drop-zone:hover,
        .upload-drop-zone.drag-active {

            border-color: #3b82f6;

            background: #eff6ff;
        }

        .upload-drop-icon {

            display: flex;
            align-items: center;
            justify-content: center;

            width: 44px;
            height: 44px;

            margin-bottom: 10px;

            border-radius: 50%;

            color: #2563eb;

            background: #dbeafe;

            font-size: 20px;
            font-weight: 900;
        }

        .upload-drop-zone strong {

            color: #0f172a;

            font-size: 11px;
            font-weight: 800;
        }

        .upload-drop-zone p {

            margin: 5px 0 0;

            color: #64748b;

            font-size: 8px;
            line-height: 1.5;
        }

        .upload-file-input {

            position: absolute;

            width: 1px;
            height: 1px;

            opacity: 0;

            pointer-events: none;
        }

        .upload-file-preview {

            display: none;

            margin-top: 12px;
            padding: 11px 12px;

            background: #f8fafc;

            border: 1px solid #e2e8f0;

            border-radius: 7px;
        }

        .upload-file-preview.visible {

            display: flex;
            justify-content: space-between;
            align-items: center;

            gap: 12px;
        }

        .upload-file-preview strong {

            display: block;

            color: #0f172a;

            font-size: 9px;
        }

        .upload-file-preview span {

            display: block;

            margin-top: 3px;

            color: #64748b;

            font-size: 7px;
        }

        .upload-clear-file {

            appearance: none;

            padding: 6px 8px;

            color: #b91c1c;

            background: #fef2f2;

            border: 1px solid #fecaca;

            border-radius: 6px;

            font-family: inherit;

            font-size: 7px;
            font-weight: 800;

            cursor: pointer;
        }

        .upload-action-row {

            display: flex;
            justify-content: space-between;
            align-items: center;

            gap: 12px;

            margin-top: 14px;
        }

        .upload-action-note {

            color: #64748b;

            font-size: 7px;
            line-height: 1.5;
        }

        .upload-submit-button {

            appearance: none;

            min-width: 138px;

            padding: 9px 14px;

            color: #ffffff;

            background: #2563eb;

            border: none;

            border-radius: 7px;

            font-family: inherit;

            font-size: 8px;
            font-weight: 850;

            cursor: pointer;
        }

        .upload-submit-button:disabled {

            cursor: not-allowed;

            background: #94a3b8;
        }

        .upload-schema-list {

            display: flex;
            flex-wrap: wrap;

            gap: 6px;
        }

        .upload-schema-pill {

            padding: 5px 7px;

            color: #475569;

            background: #f8fafc;

            border: 1px solid #e2e8f0;

            border-radius: 999px;

            font-size: 7px;
            font-weight: 750;
        }

        .upload-control-list {

            display: grid;

            gap: 7px;

            margin-top: 14px;
        }

        .upload-control-item {

            display: flex;
            align-items: flex-start;

            gap: 8px;

            padding: 8px 9px;

            background: #f8fafc;

            border: 1px solid #e5eaf1;

            border-radius: 7px;
        }

        .upload-control-check {

            display: flex;
            align-items: center;
            justify-content: center;

            width: 18px;
            height: 18px;

            border-radius: 50%;

            color: #166534;

            background: #dcfce7;

            font-size: 8px;
            font-weight: 900;
        }

        .upload-control-item strong {

            display: block;

            color: #334155;

            font-size: 8px;
        }

        .upload-control-item span {

            display: block;

            margin-top: 2px;

            color: #64748b;

            font-size: 7px;
            line-height: 1.4;
        }

        .upload-feedback {

            display: none;

            margin-top: 12px;
            padding: 9px 11px;

            border-radius: 7px;

            font-size: 8px;
            line-height: 1.5;
        }

        .upload-feedback.visible {
            display: block;
        }

        .upload-feedback.info {

            color: #1d4ed8;

            background: #eff6ff;

            border: 1px solid #bfdbfe;
        }

        .upload-feedback.success {

            color: #166534;

            background: #f0fdf4;

            border: 1px solid #bbf7d0;
        }

        .upload-feedback.error {

            color: #991b1b;

            background: #fef2f2;

            border: 1px solid #fecaca;
        }

        .upload-results-panel {
            display: none;
        }

        .upload-results-panel.visible {
            display: block;
        }

        .upload-result-heading {

            display: flex;
            justify-content: space-between;
            align-items: flex-start;

            gap: 12px;

            margin-bottom: 12px;
        }

        .upload-result-heading h3 {

            margin: 0;

            color: #0f172a;

            font-size: 14px;
        }

        .upload-result-heading p {

            margin: 4px 0 0;

            color: #64748b;

            font-size: 8px;
        }

        .upload-status-badge {

            display: inline-flex;

            padding: 6px 9px;

            border-radius: 999px;

            font-size: 7px;
            font-weight: 850;
        }

        .upload-status-badge.passed {

            color: #166534;

            background: #dcfce7;

            border: 1px solid #bbf7d0;
        }

        .upload-status-badge.passed-with-warnings {

            color: #92400e;

            background: #fef3c7;

            border: 1px solid #fde68a;
        }

        .upload-status-badge.partially-accepted {

            color: #9a3412;

            background: #ffedd5;

            border: 1px solid #fed7aa;
        }

        .upload-status-badge.failed {

            color: #991b1b;

            background: #fee2e2;

            border: 1px solid #fecaca;
        }

        .upload-result-grid {

            display: grid;

            grid-template-columns:
                repeat(
                    4,
                    minmax(0, 1fr)
                );

            gap: 8px;
        }

        .upload-result-card {

            padding: 11px 12px;

            background: #f8fafc;

            border: 1px solid #e5eaf1;

            border-radius: 7px;
        }

        .upload-result-card span {

            display: block;

            color: #64748b;

            font-size: 7px;
            font-weight: 700;
        }

        .upload-result-card strong {

            display: block;

            margin-top: 4px;

            color: #0f172a;

            font-size: 15px;
            font-weight: 850;
        }

        .upload-result-card.accepted strong {
            color: #15803d;
        }

        .upload-result-card.quarantined strong {
            color: #c2410c;
        }

        .upload-result-card.issues strong {
            color: #b91c1c;
        }

        .upload-pass-bar {
            margin-top: 12px;
        }

        .upload-pass-bar-header {

            display: flex;
            justify-content: space-between;

            margin-bottom: 5px;

            color: #475569;

            font-size: 7px;
            font-weight: 750;
        }

        .upload-pass-track {

            height: 7px;

            overflow: hidden;

            background: #e2e8f0;

            border-radius: 999px;
        }

        .upload-pass-fill {

            height: 100%;

            background:
                linear-gradient(
                    90deg,
                    #22c55e,
                    #16a34a
                );

            border-radius: 999px;
        }

        .upload-download-row {

            display: flex;
            flex-wrap: wrap;

            gap: 7px;

            margin-top: 12px;
        }

        .upload-download-button {

            display: inline-flex;
            align-items: center;
            justify-content: center;

            padding: 6px 9px;

            color: #334155;

            background: #ffffff;

            border: 1px solid #dbe3ec;

            border-radius: 6px;

            font-size: 7px;
            font-weight: 800;

            text-decoration: none;
        }

        .upload-history-table-wrap {

            overflow-x: auto;

            border: 1px solid #e5eaf1;

            border-radius: 8px;
        }

        .upload-history-table {

            width: 100%;

            min-width: 780px;

            border-collapse: collapse;

            font-size: 8px;
        }

        .upload-history-table th {

            padding: 9px 10px;

            text-align: left;

            color: #64748b;

            background: #f8fafc;

            border-bottom: 1px solid #e5eaf1;

            font-size: 7px;
            font-weight: 850;

            text-transform: uppercase;
        }

        .upload-history-table td {

            padding: 9px 10px;

            color: #334155;

            border-bottom: 1px solid #eef2f7;
        }

        .upload-history-table tbody tr {
            cursor: pointer;
        }

        .upload-history-table tbody tr:hover {
            background: #f8fafc;
        }

        .upload-history-empty {

            padding: 26px;

            text-align: center;

            color: #64748b;

            font-size: 8px;
        }

        .upload-issues-panel {
            display: none;
        }

        .upload-issues-panel.visible {
            display: block;
        }

        .upload-issue-summary {

            display: flex;
            flex-wrap: wrap;

            gap: 7px;

            margin-bottom: 10px;
        }

        .upload-issue-chip {

            padding: 5px 7px;

            border-radius: 999px;

            font-size: 7px;
            font-weight: 800;
        }

        .upload-issue-chip.error {

            color: #991b1b;

            background: #fee2e2;

            border: 1px solid #fecaca;
        }

        .upload-issue-chip.warning {

            color: #92400e;

            background: #fef3c7;

            border: 1px solid #fde68a;
        }

        .upload-issue-table-wrap {

            overflow-x: auto;

            border: 1px solid #e5eaf1;

            border-radius: 8px;
        }

        .upload-issue-table {

            width: 100%;

            min-width: 850px;

            border-collapse: collapse;

            font-size: 8px;
        }

        .upload-issue-table th {

            padding: 9px 10px;

            text-align: left;

            color: #64748b;

            background: #f8fafc;

            border-bottom: 1px solid #e5eaf1;

            font-size: 7px;
            font-weight: 850;
        }

        .upload-issue-table td {

            padding: 9px 10px;

            color: #334155;

            border-bottom: 1px solid #eef2f7;
        }

        .upload-issue-severity {

            display: inline-flex;

            padding: 4px 6px;

            border-radius: 999px;

            font-size: 7px;
            font-weight: 850;
        }

        .upload-issue-severity.error {

            color: #991b1b;

            background: #fee2e2;
        }

        .upload-issue-severity.warning {

            color: #92400e;

            background: #fef3c7;
        }

        .upload-staging-notice {

            margin-top: 12px;
            padding: 10px 11px;

            color: #475569;

            background: #f8fafc;

            border: 1px solid #e2e8f0;

            border-radius: 7px;

            font-size: 7px;
            line-height: 1.5;
        }

        .upload-staging-notice strong {
            color: #0f172a;
        }

        @media (max-width: 1100px) {

            .upload-main-grid {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 850px) {

            .upload-dataset-grid,
            .upload-result-grid {

                grid-template-columns:
                    repeat(
                        2,
                        minmax(0, 1fr)
                    );
            }

            .upload-page-header {
                flex-direction: column;
            }
        }

        @media (max-width: 520px) {

            .upload-dataset-grid,
            .upload-result-grid {

                grid-template-columns:
                    1fr;
            }

            .upload-action-row {

                flex-direction: column;
                align-items: stretch;
            }

            .upload-submit-button {
                width: 100%;
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

function installUploadPage() {

    if (
        document.getElementById(
            "upload-data"
        )
    ) {
        return;
    }

    const main =
        document.querySelector(
            "main"
        )
        ||
        document.querySelector(
            ".main-content"
        )
        ||
        document.body;

    const section =
        document.createElement(
            "section"
        );

    section.id =
        "upload-data";

    section.className =
        "dashboard-section";

    section.innerHTML = `

        <div class="upload-page-shell">

            <div class="upload-page-header">

                <div class="upload-page-header-copy">

                    <span class="upload-page-eyebrow">
                        Bring Your Own Data
                    </span>

                    <h2>
                        Upload & Validate Project-Control Data
                    </h2>

                    <p>
                        Upload external cost, progress,
                        schedule or procurement CSV files
                        through a controlled validation layer.
                        Invalid records are quarantined and
                        issues are logged before data enters
                        an analytical workflow.
                    </p>

                </div>

                <div class="upload-safety-badge">
                    ✓ Staging Only · Main DB Protected
                </div>

            </div>


            <div class="upload-main-grid">

                <div class="upload-panel">

                    <div class="upload-panel-header">

                        <div>

                            <h3>
                                1. Select & Upload Data
                            </h3>

                            <p>
                                Choose a dataset type,
                                download a template if needed,
                                then upload a CSV file.
                            </p>

                        </div>

                    </div>


                    <div
                        id="upload-dataset-grid"
                        class="upload-dataset-grid"
                    ></div>


                    <div class="upload-template-box">

                        <div>

                            <strong>
                                Need the correct format?
                            </strong>

                            <span
                                id="upload-template-description"
                            >
                                Download template
                            </span>

                        </div>


                        <a
                            id="upload-template-link"
                            class="upload-template-button"
                            href="#"
                        >
                            Download Template
                        </a>

                    </div>


                    <div
                        id="upload-drop-zone"
                        class="upload-drop-zone"
                    >

                        <input
                            id="upload-file-input"
                            class="upload-file-input"
                            type="file"
                            accept=".csv,text/csv"
                        >

                        <div class="upload-drop-icon">
                            ⇧
                        </div>

                        <strong>
                            Drop CSV file here
                        </strong>

                        <p>
                            or click to browse
                            · maximum 5 MB
                            · maximum 10,000 rows
                        </p>

                    </div>


                    <div
                        id="upload-file-preview"
                        class="upload-file-preview"
                    >

                        <div>

                            <strong
                                id="upload-file-name"
                            >
                                —
                            </strong>

                            <span
                                id="upload-file-meta"
                            >
                                —
                            </span>

                        </div>

                        <button
                            id="upload-clear-file"
                            type="button"
                            class="upload-clear-file"
                        >
                            Remove
                        </button>

                    </div>


                    <div class="upload-action-row">

                        <div class="upload-action-note">

                            Files are validated first.
                            Accepted records remain in
                            staging and do not overwrite
                            the main analytical database.

                        </div>

                        <button
                            id="upload-submit-button"
                            type="button"
                            class="upload-submit-button"
                            disabled
                        >
                            Validate Upload
                        </button>

                    </div>


                    <div
                        id="upload-feedback"
                        class="upload-feedback"
                    ></div>

                </div>


                <div class="upload-panel">

                    <div class="upload-panel-header">

                        <div>

                            <h3>
                                2. Validation Controls
                            </h3>

                            <p>
                                Required schema and data-quality
                                rules applied before acceptance.
                            </p>

                        </div>

                    </div>


                    <div
                        id="upload-schema-list"
                        class="upload-schema-list"
                    ></div>


                    <div class="upload-control-list">

                        <div class="upload-control-item">

                            <span class="upload-control-check">
                                ✓
                            </span>

                            <div>

                                <strong>
                                    Schema validation
                                </strong>

                                <span>
                                    Required columns must match
                                    the selected dataset.
                                </span>

                            </div>

                        </div>


                        <div class="upload-control-item">

                            <span class="upload-control-check">
                                ✓
                            </span>

                            <div>

                                <strong>
                                    Type & range validation
                                </strong>

                                <span>
                                    Numeric, percentage,
                                    date and binary fields
                                    are checked.
                                </span>

                            </div>

                        </div>


                        <div class="upload-control-item">

                            <span class="upload-control-check">
                                ✓
                            </span>

                            <div>

                                <strong>
                                    Quarantine controls
                                </strong>

                                <span>
                                    Invalid records are kept
                                    separate from accepted
                                    staging data.
                                </span>

                            </div>

                        </div>


                        <div class="upload-control-item">

                            <span class="upload-control-check">
                                ✓
                            </span>

                            <div>

                                <strong>
                                    Issue logging
                                </strong>

                                <span>
                                    Validation errors and
                                    warnings are retained
                                    with row-level detail.
                                </span>

                            </div>

                        </div>

                    </div>


                    <div class="upload-staging-notice">

                        <strong>
                            Control design:
                        </strong>

                        passing validation does not
                        automatically write uploaded data
                        into the main analytical tables.

                    </div>

                </div>

            </div>


            <div
                id="upload-results-panel"
                class="
                    upload-panel
                    upload-results-panel
                "
            ></div>


            <div
                id="upload-issues-panel"
                class="
                    upload-panel
                    upload-issues-panel
                "
            ></div>


            <div class="upload-panel">

                <div class="upload-panel-header">

                    <div>

                        <h3>
                            Upload History
                        </h3>

                        <p>
                            Audit trail of CSV validation
                            batches processed by ControlSight.
                        </p>

                    </div>

                    <button
                        id="upload-refresh-history"
                        type="button"
                        class="upload-template-button"
                    >
                        Refresh
                    </button>

                </div>

                <div
                    id="upload-history-container"
                >

                    <div class="upload-history-empty">
                        Loading upload history...
                    </div>

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

function installUploadNavigation() {

    const nav =
        document.querySelector(
            ".sidebar-nav"
        );

    if (!nav) {
        return;
    }

    if (
        nav.querySelector(
            'a[href="#upload-data"]'
        )
    ) {
        return;
    }

    const link =
        document.createElement(
            "a"
        );

    link.href =
        "#upload-data";

    link.className =
        "nav-item";

    link.innerHTML = `

        <span class="nav-icon">
            ⇧
        </span>

        <span>
            Upload Data
        </span>
    `;

    link.addEventListener(
        "click",
        event => {

            event.preventDefault();

            document
                .getElementById(
                    "upload-data"
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
   TEMPLATES
   ============================================================ */

async function loadUploadTemplates() {

    const data =
        await uploadFetchJson(
            `${CONTROL_UPLOAD_API_BASE}/templates`
        );

    controlUploadTemplates =
        Array.isArray(
            data.datasets
        )
            ? data.datasets
            : [];

    renderUploadDatasetButtons();

    renderUploadSchema();
}


function renderUploadDatasetButtons() {

    const container =
        document.getElementById(
            "upload-dataset-grid"
        );

    if (!container) {
        return;
    }

    container.innerHTML =
        controlUploadTemplates
            .map(
                item => `

                    <button
                        type="button"
                        class="
                            upload-dataset-button
                            ${
                                item.dataset ===
                                controlUploadSelectedDataset
                                    ? "active"
                                    : ""
                            }
                        "
                        data-upload-dataset="${uploadEscape(
                            item.dataset
                        )}"
                    >
                        ${uploadEscape(
                            item.label
                        )}
                    </button>
                `
            )
            .join("");

    container
        .querySelectorAll(
            "[data-upload-dataset]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        controlUploadSelectedDataset =
                            button.dataset
                                .uploadDataset;

                        controlUploadSelectedFile =
                            null;

                        renderUploadDatasetButtons();

                        renderUploadSchema();

                        renderSelectedFile();

                        resetUploadFeedback();
                    }
                );
            }
        );
}


function renderUploadSchema() {

    const schemaContainer =
        document.getElementById(
            "upload-schema-list"
        );

    const templateLink =
        document.getElementById(
            "upload-template-link"
        );

    const description =
        document.getElementById(
            "upload-template-description"
        );

    const dataset =
        controlUploadTemplates.find(
            item =>
                item.dataset ===
                controlUploadSelectedDataset
        );

    if (!dataset) {
        return;
    }

    if (schemaContainer) {

        schemaContainer.innerHTML =
            dataset.required_columns
                .map(
                    column => `

                        <span class="upload-schema-pill">
                            ${uploadEscape(
                                column
                            )}
                        </span>
                    `
                )
                .join("");
    }

    if (templateLink) {

        templateLink.href =
            dataset.download_endpoint;
    }

    if (description) {

        description.textContent =
            `${dataset.label} template · ` +
            `${dataset.required_columns.length} required columns`;
    }
}


/* ============================================================
   FILE HANDLING
   ============================================================ */

function setUploadFile(file) {

    if (!file) {
        return;
    }

    const fileName =
        String(
            file.name || ""
        );

    if (
        !fileName
            .toLowerCase()
            .endsWith(
                ".csv"
            )
    ) {

        setUploadFeedback(
            "Only CSV files are supported.",
            "error"
        );

        return;
    }

    if (
        file.size >
        5 *
        1024 *
        1024
    ) {

        setUploadFeedback(
            "The selected file exceeds the 5 MB limit.",
            "error"
        );

        return;
    }

    controlUploadSelectedFile =
        file;

    renderSelectedFile();

    setUploadFeedback(
        "CSV ready for validation.",
        "info"
    );
}


function clearUploadFile() {

    controlUploadSelectedFile =
        null;

    const input =
        document.getElementById(
            "upload-file-input"
        );

    if (input) {
        input.value = "";
    }

    renderSelectedFile();

    resetUploadFeedback();
}


function renderSelectedFile() {

    const preview =
        document.getElementById(
            "upload-file-preview"
        );

    const fileName =
        document.getElementById(
            "upload-file-name"
        );

    const fileMeta =
        document.getElementById(
            "upload-file-meta"
        );

    const submitButton =
        document.getElementById(
            "upload-submit-button"
        );

    if (
        !preview ||
        !submitButton
    ) {
        return;
    }

    if (
        !controlUploadSelectedFile
    ) {

        preview.classList.remove(
            "visible"
        );

        submitButton.disabled =
            true;

        return;
    }

    preview.classList.add(
        "visible"
    );

    fileName.textContent =
        controlUploadSelectedFile.name;

    fileMeta.textContent =
        (
            `${uploadFormatFileSize(
                controlUploadSelectedFile.size
            )}` +
            ` · ` +
            `${uploadDatasetLabel(
                controlUploadSelectedDataset
            )} dataset`
        );

    submitButton.disabled =
        false;
}


/* ============================================================
   DROP ZONE
   ============================================================ */

function initialiseUploadDropZone() {

    const zone =
        document.getElementById(
            "upload-drop-zone"
        );

    const input =
        document.getElementById(
            "upload-file-input"
        );

    const clearButton =
        document.getElementById(
            "upload-clear-file"
        );

    if (
        !zone ||
        !input
    ) {
        return;
    }

    zone.addEventListener(
        "click",
        () => {

            input.click();
        }
    );

    input.addEventListener(
        "change",
        () => {

            const file =
                input.files?.[0];

            if (file) {

                setUploadFile(
                    file
                );
            }
        }
    );

    zone.addEventListener(
        "dragover",
        event => {

            event.preventDefault();

            zone.classList.add(
                "drag-active"
            );
        }
    );

    zone.addEventListener(
        "dragleave",
        event => {

            event.preventDefault();

            zone.classList.remove(
                "drag-active"
            );
        }
    );

    zone.addEventListener(
        "drop",
        event => {

            event.preventDefault();

            zone.classList.remove(
                "drag-active"
            );

            const file =
                event.dataTransfer
                    ?.files
                    ?.[0];

            if (file) {

                setUploadFile(
                    file
                );
            }
        }
    );

    clearButton
        ?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                clearUploadFile();
            }
        );
}


/* ============================================================
   FEEDBACK
   ============================================================ */

function setUploadFeedback(
    message,
    type = "info"
) {

    const element =
        document.getElementById(
            "upload-feedback"
        );

    if (!element) {
        return;
    }

    element.textContent =
        message;

    element.className =
        `upload-feedback visible ${type}`;
}


function resetUploadFeedback() {

    const element =
        document.getElementById(
            "upload-feedback"
        );

    if (!element) {
        return;
    }

    element.textContent =
        "";

    element.className =
        "upload-feedback";
}


/* ============================================================
   SUBMIT
   ============================================================ */

async function submitUpload() {

    if (
        !controlUploadSelectedFile
    ) {

        setUploadFeedback(
            "Select a CSV file first.",
            "error"
        );

        return;
    }

    const button =
        document.getElementById(
            "upload-submit-button"
        );

    button.disabled =
        true;

    button.textContent =
        "Validating...";

    setUploadFeedback(
        "Running validation controls...",
        "info"
    );

    try {

        const url =
            (
                `${CONTROL_UPLOAD_API_BASE}/csv` +
                `?dataset=` +
                encodeURIComponent(
                    controlUploadSelectedDataset
                ) +
                `&filename=` +
                encodeURIComponent(
                    controlUploadSelectedFile.name
                )
            );

        const response =
            await fetch(
                url,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "text/csv"
                    },

                    body:
                        controlUploadSelectedFile
                }
            );

        if (!response.ok) {

            let detail =
                `Upload failed with HTTP ${response.status}`;

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

        const result =
            await response.json();

        renderUploadResults(
            result
        );

        await loadUploadIssues(
            result.batch_id
        );

        await loadUploadHistory();

        setUploadFeedback(
            (
                `Validation completed: ` +
                `${result.accepted_rows} accepted, ` +
                `${result.quarantined_rows} quarantined.`
            ),
            (
                result.quarantined_rows > 0
                    ? "info"
                    : "success"
            )
        );

    } catch (error) {

        console.error(
            "Upload failed:",
            error
        );

        setUploadFeedback(
            error.message,
            "error"
        );

    } finally {

        button.disabled =
            !controlUploadSelectedFile;

        button.textContent =
            "Validate Upload";
    }
}


/* ============================================================
   RESULTS
   ============================================================ */

function uploadStatusClass(
    status
) {

    return String(
        status || "failed"
    )
    .toLowerCase()
    .replaceAll(
        "_",
        "-"
    );
}


function renderUploadResults(
    result
) {

    const panel =
        document.getElementById(
            "upload-results-panel"
        );

    if (!panel) {
        return;
    }

    const issueEvents =
        (
            Number(
                result.error_events
            )
            || 0
        )
        +
        (
            Number(
                result.warning_events
            )
            || 0
        );

    const passRate =
        Number(
            result.validation_pass_rate
        )
        || 0;

    panel.classList.add(
        "visible"
    );

    panel.innerHTML = `

        <div class="upload-result-heading">

            <div>

                <h3>
                    Validation Result
                </h3>

                <p>
                    Batch
                    ${uploadEscape(
                        result.batch_id
                    )}
                    ·
                    ${uploadEscape(
                        result.filename
                    )}
                </p>

            </div>

            <span
                class="
                    upload-status-badge
                    ${uploadStatusClass(
                        result.status
                    )}
                "
            >
                ${uploadEscape(
                    String(
                        result.status
                    )
                    .replaceAll(
                        "_",
                        " "
                    )
                )}
            </span>

        </div>


        <div class="upload-result-grid">

            <div class="upload-result-card">

                <span>
                    Source Rows
                </span>

                <strong>
                    ${uploadFormatNumber(
                        result.source_rows
                    )}
                </strong>

            </div>


            <div
                class="
                    upload-result-card
                    accepted
                "
            >

                <span>
                    Accepted Rows
                </span>

                <strong>
                    ${uploadFormatNumber(
                        result.accepted_rows
                    )}
                </strong>

            </div>


            <div
                class="
                    upload-result-card
                    quarantined
                "
            >

                <span>
                    Quarantined Rows
                </span>

                <strong>
                    ${uploadFormatNumber(
                        result.quarantined_rows
                    )}
                </strong>

            </div>


            <div
                class="
                    upload-result-card
                    issues
                "
            >

                <span>
                    Issue Events
                </span>

                <strong>
                    ${uploadFormatNumber(
                        issueEvents
                    )}
                </strong>

            </div>

        </div>


        <div class="upload-pass-bar">

            <div class="upload-pass-bar-header">

                <span>
                    Validation Pass Rate
                </span>

                <strong>
                    ${uploadFormatPercentage(
                        passRate
                    )}
                </strong>

            </div>


            <div class="upload-pass-track">

                <div
                    class="upload-pass-fill"
                    style="
                        width:
                        ${Math.min(
                            Math.max(
                                passRate,
                                0
                            ),
                            100
                        )}%;
                    "
                ></div>

            </div>

        </div>


        <div class="upload-download-row">

            <a
                class="upload-download-button"
                href="${CONTROL_UPLOAD_API_BASE}/${encodeURIComponent(
                    result.batch_id
                )}/file/accepted"
            >
                Accepted CSV
            </a>

            <a
                class="upload-download-button"
                href="${CONTROL_UPLOAD_API_BASE}/${encodeURIComponent(
                    result.batch_id
                )}/file/quarantine"
            >
                Quarantine CSV
            </a>

            <a
                class="upload-download-button"
                href="${CONTROL_UPLOAD_API_BASE}/${encodeURIComponent(
                    result.batch_id
                )}/file/issues"
            >
                Issue Register
            </a>

            <a
                class="upload-download-button"
                href="${CONTROL_UPLOAD_API_BASE}/${encodeURIComponent(
                    result.batch_id
                )}/file/metadata"
            >
                Metadata
            </a>

        </div>


        <div class="upload-staging-notice">

            <strong>
                Staging status:
            </strong>

            this validated batch has not been loaded
            into the main analytical database.

        </div>
    `;
}


/* ============================================================
   ISSUES
   ============================================================ */

async function loadUploadIssues(
    batchId
) {

    const panel =
        document.getElementById(
            "upload-issues-panel"
        );

    if (
        !panel ||
        !batchId
    ) {
        return;
    }

    try {

        const data =
            await uploadFetchJson(
                `${CONTROL_UPLOAD_API_BASE}/${encodeURIComponent(
                    batchId
                )}/issues`
            );

        const issues =
            Array.isArray(
                data.issues
            )
                ? data.issues
                : [];

        if (!issues.length) {

            panel.classList.remove(
                "visible"
            );

            panel.innerHTML =
                "";

            return;
        }

        const errorCount =
            issues.filter(
                issue =>
                    issue.severity ===
                    "ERROR"
            ).length;

        const warningCount =
            issues.filter(
                issue =>
                    issue.severity ===
                    "WARNING"
            ).length;

        panel.classList.add(
            "visible"
        );

        panel.innerHTML = `

            <div class="upload-panel-header">

                <div>

                    <h3>
                        Upload Issue Register
                    </h3>

                    <p>
                        Row-level validation issues for batch
                        ${uploadEscape(
                            batchId
                        )}.
                    </p>

                </div>

            </div>


            <div class="upload-issue-summary">

                <span class="upload-issue-chip error">
                    ${errorCount} Errors
                </span>

                <span class="upload-issue-chip warning">
                    ${warningCount} Warnings
                </span>

            </div>


            <div class="upload-issue-table-wrap">

                <table class="upload-issue-table">

                    <thead>

                        <tr>

                            <th>
                                Row
                            </th>

                            <th>
                                Severity
                            </th>

                            <th>
                                Type
                            </th>

                            <th>
                                Column
                            </th>

                            <th>
                                Value
                            </th>

                            <th>
                                Message
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        ${issues
                            .map(
                                issue => `

                                    <tr>

                                        <td>
                                            ${uploadEscape(
                                                issue.row_number
                                            )}
                                        </td>

                                        <td>

                                            <span
                                                class="
                                                    upload-issue-severity
                                                    ${String(
                                                        issue.severity || ""
                                                    ).toLowerCase()}
                                                "
                                            >
                                                ${uploadEscape(
                                                    issue.severity
                                                )}
                                            </span>

                                        </td>

                                        <td>
                                            ${uploadEscape(
                                                issue.issue_type
                                            )}
                                        </td>

                                        <td>
                                            ${uploadEscape(
                                                issue.column_name
                                            )}
                                        </td>

                                        <td>
                                            ${uploadEscape(
                                                issue.value
                                            )}
                                        </td>

                                        <td>
                                            ${uploadEscape(
                                                issue.message
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

    } catch (error) {

        console.error(
            "Unable to load upload issues:",
            error
        );
    }
}


/* ============================================================
   HISTORY
   ============================================================ */

async function loadUploadHistory() {

    const container =
        document.getElementById(
            "upload-history-container"
        );

    if (!container) {
        return;
    }

    try {

        const data =
            await uploadFetchJson(
                CONTROL_UPLOAD_API_BASE
            );

        controlUploadHistory =
            Array.isArray(
                data.uploads
            )
                ? data.uploads
                : [];

        renderUploadHistory();

    } catch (error) {

        container.innerHTML = `

            <div class="upload-history-empty">
                Upload history could not be loaded.
            </div>
        `;

        console.error(
            "Unable to load upload history:",
            error
        );
    }
}


function renderUploadHistory() {

    const container =
        document.getElementById(
            "upload-history-container"
        );

    if (!container) {
        return;
    }

    if (
        !controlUploadHistory.length
    ) {

        container.innerHTML = `

            <div class="upload-history-empty">
                No upload batches have been processed yet.
            </div>
        `;

        return;
    }

    container.innerHTML = `

        <div class="upload-history-table-wrap">

            <table class="upload-history-table">

                <thead>

                    <tr>

                        <th>
                            Batch
                        </th>

                        <th>
                            Dataset
                        </th>

                        <th>
                            File
                        </th>

                        <th>
                            Uploaded
                        </th>

                        <th>
                            Source
                        </th>

                        <th>
                            Accepted
                        </th>

                        <th>
                            Quarantined
                        </th>

                        <th>
                            Pass Rate
                        </th>

                        <th>
                            Status
                        </th>

                    </tr>

                </thead>

                <tbody>

                    ${controlUploadHistory
                        .map(
                            item => `

                                <tr
                                    data-upload-history-batch="${uploadEscape(
                                        item.batch_id
                                    )}"
                                >

                                    <td>
                                        ${uploadEscape(
                                            item.batch_id
                                        )}
                                    </td>

                                    <td>
                                        ${uploadEscape(
                                            uploadDatasetLabel(
                                                item.dataset
                                            )
                                        )}
                                    </td>

                                    <td>
                                        ${uploadEscape(
                                            item.filename
                                        )}
                                    </td>

                                    <td>
                                        ${uploadEscape(
                                            uploadFormatDateTime(
                                                item.uploaded_at
                                            )
                                        )}
                                    </td>

                                    <td>
                                        ${uploadFormatNumber(
                                            item.source_rows
                                        )}
                                    </td>

                                    <td>
                                        ${uploadFormatNumber(
                                            item.accepted_rows
                                        )}
                                    </td>

                                    <td>
                                        ${uploadFormatNumber(
                                            item.quarantined_rows
                                        )}
                                    </td>

                                    <td>
                                        ${uploadFormatPercentage(
                                            item.validation_pass_rate
                                        )}
                                    </td>

                                    <td>

                                        <span
                                            class="
                                                upload-status-badge
                                                ${uploadStatusClass(
                                                    item.status
                                                )}
                                            "
                                        >
                                            ${uploadEscape(
                                                String(
                                                    item.status
                                                )
                                                .replaceAll(
                                                    "_",
                                                    " "
                                                )
                                            )}
                                        </span>

                                    </td>

                                </tr>
                            `
                        )
                        .join("")}

                </tbody>

            </table>

        </div>
    `;

    container
        .querySelectorAll(
            "[data-upload-history-batch]"
        )
        .forEach(
            row => {

                row.addEventListener(
                    "click",
                    async () => {

                        await openHistoricalBatch(
                            row.dataset
                                .uploadHistoryBatch
                        );
                    }
                );
            }
        );
}


async function openHistoricalBatch(
    batchId
) {

    try {

        const batch =
            await uploadFetchJson(
                `${CONTROL_UPLOAD_API_BASE}/${encodeURIComponent(
                    batchId
                )}`
            );

        renderUploadResults(
            batch
        );

        await loadUploadIssues(
            batchId
        );

    } catch (error) {

        setUploadFeedback(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   HEALTH
   ============================================================ */

async function validateUploadBackend() {

    try {

        const health =
            await uploadFetchJson(
                `${CONTROL_UPLOAD_API_BASE}/health/status`
            );

        return (
            health.status ===
            "ok"
        );

    } catch (error) {

        setUploadFeedback(
            (
                "Upload service unavailable: " +
                error.message
            ),
            "error"
        );

        return false;
    }
}


/* ============================================================
   EVENTS
   ============================================================ */

function initialiseUploadButtons() {

    document
        .getElementById(
            "upload-submit-button"
        )
        ?.addEventListener(
            "click",
            submitUpload
        );

    document
        .getElementById(
            "upload-refresh-history"
        )
        ?.addEventListener(
            "click",
            loadUploadHistory
        );
}


/* ============================================================
   INITIALISE
   ============================================================ */

async function initialiseControlSightUpload() {

    if (
        controlUploadInitialised
    ) {
        return;
    }

    controlUploadInitialised =
        true;

    installUploadStyles();

    installUploadPage();

    installUploadNavigation();

    initialiseUploadDropZone();

    initialiseUploadButtons();

    const backendAvailable =
        await validateUploadBackend();

    if (!backendAvailable) {
        return;
    }

    try {

        await loadUploadTemplates();

        await loadUploadHistory();

    } catch (error) {

        console.error(
            "Unable to initialise Upload Data UI:",
            error
        );

        setUploadFeedback(
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

        initialiseControlSightUpload();

    }
);
