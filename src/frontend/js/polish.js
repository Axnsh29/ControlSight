/* ============================================================
   CONTROLSIGHT
   FRONTEND POLISH / EXPERIENCE LAYER

   Sits on top of dashboard.js.
   Core project-control calculations remain in dashboard.js.
   ============================================================ */


const POLISH_API_BASE =
    "/api";


/* ============================================================
   HELPERS
   ============================================================ */

function polishCurrency(
    value
) {

    const number =
        Number(value || 0);


    const absolute =
        Math.abs(number);


    const sign =
        number < 0
            ? "-"
            : "";


    if (
        absolute >=
        1_000_000_000
    ) {

        const billions =
            absolute /
            1_000_000_000;


        return `${sign}£${billions.toFixed(
            billions >= 10
                ? 0
                : 1
        )}bn`;
    }


    if (
        absolute >=
        1_000_000
    ) {

        const millions =
            absolute /
            1_000_000;


        return `${sign}£${millions.toFixed(
            millions >= 10
                ? 1
                : 1
        )}m`;
    }


    if (
        absolute >=
        1_000
    ) {

        return `${sign}£${(
            absolute /
            1_000
        ).toFixed(0)}k`;
    }


    return `${sign}£${absolute.toFixed(0)}`;
}



/* ============================================================
   FETCH WITH TIMEOUT
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


    container.innerHTML = `

        <div class="skeleton-chart">

            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>

        </div>

    `;


    try {

        const response =
            await polishFetch(
                `${POLISH_API_BASE}/projects`
            );


        const projects =
            await response.json();


        if (
            !Array.isArray(
                projects
            ) ||
            !projects.length
        ) {

            throw new Error(
                "No portfolio projects returned"
            );
        }


        const ranked =
            [...projects]
                .sort(
                    (a, b) => {

                        const aVariance =

                            Number(
                                a.forecast_at_completion ||
                                0
                            ) -

                            Number(
                                a.approved_budget ||
                                0
                            );


                        const bVariance =

                            Number(
                                b.forecast_at_completion ||
                                0
                            ) -

                            Number(
                                b.approved_budget ||
                                0
                            );


                        return (
                            bVariance -
                            aVariance
                        );
                    }
                );


        const maximum =
            Math.max(

                ...ranked.map(
                    project =>

                        Math.max(

                            Number(
                                project.approved_budget ||
                                0
                            ),

                            Number(
                                project.forecast_at_completion ||
                                0
                            )

                        )
                ),

                1

            );


        const rows =
            ranked
                .map(
                    project => {

                        const budget =
                            Number(
                                project.approved_budget ||
                                0
                            );


                        const forecast =
                            Number(
                                project.forecast_at_completion ||
                                0
                            );


                        const variance =
                            forecast -
                            budget;


                        const budgetWidth =
                            Math.max(

                                0,

                                Math.min(
                                    100,
                                    (
                                        budget /
                                        maximum
                                    ) *
                                    100
                                )

                            );


                        const forecastWidth =
                            Math.max(

                                0,

                                Math.min(
                                    100,
                                    (
                                        forecast /
                                        maximum
                                    ) *
                                    100
                                )

                            );


                        let forecastClass =
                            "";


                        let forecastLabel =
                            "At budget";


                        if (
                            forecast >
                            budget
                        ) {

                            forecastClass =
                                "overrun";

                            forecastLabel =
                                "Over budget";

                        } else if (
                            forecast <
                            budget
                        ) {

                            forecastClass =
                                "under";

                            forecastLabel =
                                "Under budget";
                        }


                        const varianceClass =
                            variance > 0
                                ? "negative"
                                : "positive";


                        return `

                            <div
                                class="exposure-row"
                                title="${project.project_name} | Budget: ${polishCurrency(
                                    budget
                                )} | Forecast: ${polishCurrency(
                                    forecast
                                )} | ${forecastLabel}"
                            >

                                <div class="exposure-project">

                                    <strong>
                                        ${project.project_name}
                                    </strong>

                                    <span>
                                        ${project.project_code}
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
                                                ${forecastClass}
                                            "
                                            style="
                                                width:
                                                ${forecastWidth}%;
                                            "
                                        ></div>

                                    </div>

                                </div>


                                <div class="exposure-values">

                                    <strong>
                                        ${polishCurrency(
                                            forecast
                                        )}
                                    </strong>


                                    <span class="${varianceClass}">

                                        ${
                                            variance > 0
                                                ? "+"
                                                : ""
                                        }

                                        ${polishCurrency(
                                            variance
                                        )}

                                    </span>

                                </div>

                            </div>

                        `;

                    }
                )
                .join("");


        container.innerHTML = `

            <div class="exposure-list">

                ${rows}

            </div>

        `;


    } catch (error) {

        console.error(
            "Unable to load portfolio cost exposure:",
            error
        );


        container.innerHTML = `

            <div class="retry-state">

                <strong>
                    Portfolio cost exposure could not be loaded.
                </strong>

                <span>
                    The demo service may still be starting.
                </span>

                <button
                    type="button"
                    class="retry-button"
                    data-polish-retry="exposure"
                >
                    Retry
                </button>

            </div>

        `;


        const retryButton =
            container.querySelector(
                "[data-polish-retry='exposure']"
            );


        if (retryButton) {

            retryButton.addEventListener(
                "click",
                loadPortfolioExposure
            );
        }

    }
}



/* ============================================================
   REPORTING SNAPSHOT
   ============================================================ */

function formatSnapshotDate(
    value
) {

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
            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric"
        }
    ).format(
        date
    );
}


async function loadReportingSnapshot() {

    const element =
        document.getElementById(
            "snapshot-date"
        );


    if (!element) {

        return;
    }


    try {

        const projectsResponse =
            await polishFetch(
                `${POLISH_API_BASE}/projects`
            );


        const projects =
            await projectsResponse.json();


        if (
            !Array.isArray(
                projects
            ) ||
            !projects.length
        ) {

            throw new Error(
                "No project data"
            );
        }


        const trendRequests =
            projects.map(
                project =>

                    polishFetch(

                        `${POLISH_API_BASE}/projects/${project.project_code}/cost-trend`,

                        15000

                    )
                        .then(
                            response =>
                                response.json()
                        )
                        .catch(
                            () =>
                                null
                        )

            );


        const trendResponses =
            await Promise.all(
                trendRequests
            );


        const dates =
            [];


        trendResponses.forEach(
            result => {

                if (
                    !result ||
                    !Array.isArray(
                        result.cost_trend
                    )
                ) {

                    return;
                }


                result.cost_trend
                    .forEach(
                        row => {

                            if (
                                row.date
                            ) {

                                dates.push(
                                    String(
                                        row.date
                                    )
                                );
                            }

                        }
                    );

            }
        );


        if (
            !dates.length
        ) {

            element.textContent =
                "Portfolio snapshot";

            return;
        }


        dates.sort();


        const latest =
            dates[
                dates.length - 1
            ];


        element.textContent =
            formatSnapshotDate(
                latest
            );


    } catch (error) {

        console.warn(
            "Unable to resolve reporting snapshot:",
            error
        );


        element.textContent =
            "Portfolio snapshot";
    }
}



/* ============================================================
   SCROLL-SPY NAVIGATION
   ============================================================ */

function initialiseScrollSpy() {

    const targets = [

        {
            id:
                "portfolio-overview",

            nav:
                "#portfolio-overview"
        },

        {
            id:
                "project-portfolio",

            nav:
                "#project-portfolio"
        },

        {
            id:
                "project-detail",

            nav:
                "#project-detail"
        },

        {
            id:
                "cost-performance",

            nav:
                "#cost-performance"
        },

        {
            id:
                "schedule-risk-panel",

            nav:
                "#schedule-risk-panel"
        },

        {
            id:
                "procurement-risk-panel",

            nav:
                "#procurement-risk-panel"
        },

        {
            id:
                "data-quality",

            nav:
                "#data-quality"
        }

    ];


    let scheduled =
        false;


    function activate(
        hash
    ) {

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
                        ) === hash

                    );

                }
            );
    }


    function resolveVisibleSection() {

        scheduled =
            false;


        const viewportMarker =
            120;


        let bestMatch =
            null;


        targets.forEach(
            target => {

                const element =
                    document.getElementById(
                        target.id
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
                    rect.top <=
                        viewportMarker &&
                    rect.bottom >
                        viewportMarker
                ) {

                    bestMatch =
                        target.nav;
                }

            }
        );


        if (
            !bestMatch
        ) {

            let closestDistance =
                Infinity;


            targets.forEach(
                target => {

                    const element =
                        document.getElementById(
                            target.id
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
                            viewportMarker
                        );


                    if (
                        distance <
                        closestDistance
                    ) {

                        closestDistance =
                            distance;


                        bestMatch =
                            target.nav;
                    }

                }
            );
        }


        if (
            bestMatch
        ) {

            activate(
                bestMatch
            );
        }
    }


    function requestResolve() {

        if (
            scheduled
        ) {

            return;
        }


        scheduled =
            true;


        window.requestAnimationFrame(
            resolveVisibleSection
        );
    }


    window.addEventListener(
        "scroll",
        requestResolve,
        {
            passive:
                true
        }
    );


    window.addEventListener(
        "resize",
        requestResolve
    );


    const mutationObserver =
        new MutationObserver(
            requestResolve
        );


    mutationObserver.observe(
        document.body,
        {
            childList:
                true,

            subtree:
                true,

            attributes:
                true,

            attributeFilter: [
                "class"
            ]
        }
    );


    window.setTimeout(
        requestResolve,
        100
    );
}



/* ============================================================
   GENERIC RETRY ENHANCEMENT
   ============================================================ */

function enhanceErrorStates() {

    function enhance(
        error
    ) {

        if (
            error.dataset
                .retryEnhanced ===
            "true"
        ) {

            return;
        }


        error.dataset
            .retryEnhanced =
            "true";


        const wrapper =
            document.createElement(
                "div"
            );


        wrapper.className =
            "retry-action";


        const button =
            document.createElement(
                "button"
            );


        button.type =
            "button";


        button.className =
            "retry-button";


        button.textContent =
            "Retry";


        button.addEventListener(
            "click",
            () => {

                window.location.reload();

            }
        );


        wrapper.appendChild(
            button
        );


        error.appendChild(
            wrapper
        );
    }


    document
        .querySelectorAll(
            ".intelligence-error"
        )
        .forEach(
            enhance
        );


    const observer =
        new MutationObserver(
            mutations => {

                mutations.forEach(
                    mutation => {

                        mutation
                            .addedNodes
                            .forEach(
                                node => {

                                    if (
                                        !(
                                            node instanceof
                                            HTMLElement
                                        )
                                    ) {

                                        return;
                                    }


                                    if (
                                        node.classList
                                            .contains(
                                                "intelligence-error"
                                            )
                                    ) {

                                        enhance(
                                            node
                                        );
                                    }


                                    node
                                        .querySelectorAll(
                                            ".intelligence-error"
                                        )
                                        .forEach(
                                            enhance
                                        );

                                }
                            );

                    }
                );

            }
        );


    observer.observe(
        document.body,
        {
            childList:
                true,

            subtree:
                true
        }
    );
}



/* ============================================================
   DEMO NOTICE
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


    const hidden =
        sessionStorage.getItem(
            "controlsight-demo-notice-hidden"
        );


    if (
        hidden === "1"
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
   NAVIGATION CLICK POLISH
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


                        if (
                            !href
                        ) {

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

                                    element.scrollIntoView({
                                        behavior:
                                            "smooth",

                                        block:
                                            "start"
                                    });
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
   ACCESSIBILITY POLISH
   ============================================================ */

function initialiseAccessibilityPolish() {

    document
        .querySelectorAll(
            ".priority-project"
        )
        .forEach(
            element => {

                if (
                    !element.hasAttribute(
                        "aria-label"
                    )
                ) {

                    const project =
                        element.dataset
                            .projectCode ||
                        "project";


                    element.setAttribute(
                        "aria-label",
                        `Open management performance for ${project}`
                    );
                }

            }
        );


    const observer =
        new MutationObserver(
            () => {

                document
                    .querySelectorAll(
                        ".priority-project"
                    )
                    .forEach(
                        element => {

                            if (
                                !element.hasAttribute(
                                    "aria-label"
                                )
                            ) {

                                const project =
                                    element.dataset
                                        .projectCode ||
                                    "project";


                                element.setAttribute(
                                    "aria-label",
                                    `Open management performance for ${project}`
                                );
                            }

                        }
                    );

            }
        );


    observer.observe(
        document.body,
        {
            childList:
                true,

            subtree:
                true
        }
    );
}



/* ============================================================
   INITIALISE POLISH LAYER
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initialiseServiceNotice();

        initialiseScrollSpy();

        initialisePolishNavigation();

        enhanceErrorStates();

        initialiseAccessibilityPolish();

        loadPortfolioExposure();

        loadReportingSnapshot();

    }
);