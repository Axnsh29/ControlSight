/* ============================================================
   CONTROLSIGHT
   PAGE HEADER CONTROLLER
   v1.0.0

   Presentation only.
   Navigation remains owned by dashboard.js.
   ============================================================ */

(function () {

    "use strict";


    const PAGE_META = {

        "#portfolio-overview": {
            eyebrow: "PORTFOLIO CONTROL",
            title: "ControlSight — Portfolio Overview"
        },

        "#project-portfolio": {
            eyebrow: "PORTFOLIO CONTROL",
            title: "ControlSight — Projects"
        },

        "#project-detail": {
            eyebrow: "PROJECT CONTROLS",
            title: "ControlSight — Project Detail"
        },

        "#cost-performance": {
            eyebrow: "PROJECT CONTROLS",
            title: "ControlSight — Cost & Forecast"
        },

        "#schedule-risk-panel": {
            eyebrow: "PROJECT CONTROLS",
            title: "ControlSight — Progress & Schedule"
        },

        "#procurement-risk-panel": {
            eyebrow: "PROJECT CONTROLS",
            title: "ControlSight — Procurement"
        },

        "#data-quality": {
            eyebrow: "DATA & ASSURANCE",
            title: "ControlSight — Data Quality"
        },

        "#change-control": {
            eyebrow: "PROJECT CONTROLS",
            title: "ControlSight — Change Control"
        },

        "#risk-cashflow": {
            eyebrow: "PROJECT CONTROLS",
            title: "ControlSight — Risk & Cash Flow"
        },

        "#attention-tuning": {
            eyebrow: "MANAGEMENT",
            title: "ControlSight — Attention Tuning"
        },

        "#report-pack": {
            eyebrow: "MANAGEMENT",
            title: "ControlSight — Report Pack"
        },

        "#upload-data": {
            eyebrow: "DATA & ASSURANCE",
            title: "ControlSight — Upload Data"
        },

        "#workflow": {
            eyebrow: "MANAGEMENT",
            title: "ControlSight — Management Workflow"
        }
    };


    function getTopbarTitle() {

        return document.querySelector(
            ".topbar h1"
        );
    }


    function getTopbarEyebrow() {

        return document.querySelector(
            ".topbar-eyebrow"
        );
    }


    function currentHash() {

        return (
            window.location.hash
            ||
            "#portfolio-overview"
        );
    }


    function pageMeta() {

        return (
            PAGE_META[currentHash()]
            ||
            {
                eyebrow: "PROJECT CONTROLS",
                title: "ControlSight — Project Intelligence"
            }
        );
    }


    function updateHeader() {

        const meta =
            pageMeta();


        const title =
            getTopbarTitle();


        const eyebrow =
            getTopbarEyebrow();


        if (title) {

            title.textContent =
                meta.title;
        }


        if (eyebrow) {

            eyebrow.textContent =
                meta.eyebrow;
        }


        document.title =
            meta.title;
    }


    function initialise() {

        updateHeader();


        window.addEventListener(
            "hashchange",
            updateHeader
        );


        document.addEventListener(
            "click",
            function (event) {

                const navItem =
                    event.target.closest(
                        ".sidebar-nav .nav-item"
                    );


                if (!navItem) {
                    return;
                }


                window.setTimeout(
                    updateHeader,
                    60
                );
            }
        );


        console.info(
            "ControlSight page header ready"
        );
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialise
        );

    } else {

        initialise();
    }

})();
