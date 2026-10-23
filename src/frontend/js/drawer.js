/* ============================================================
   CONTROLSIGHT
   SIDEBAR DRAWER CONTROLLER
   ============================================================ */

(function () {

    "use strict";


    function getSidebar() {

        return document.querySelector(
            ".sidebar"
        );
    }


    function getTopbar() {

        return document.querySelector(
            ".topbar"
        );
    }


    function getBackdrop() {

        return document.querySelector(
            ".drawer-backdrop"
        );
    }


    function getToggle() {

        return document.querySelector(
            ".drawer-toggle"
        );
    }


    function openDrawer() {

        const sidebar =
            getSidebar();


        const backdrop =
            getBackdrop();


        if (!sidebar) {
            return;
        }


        sidebar.classList.add(
            "drawer-open"
        );


        backdrop
            ?.classList
            .add(
                "visible"
            );


        document.body.classList.add(
            "drawer-visible"
        );


        getToggle()
            ?.setAttribute(
                "aria-expanded",
                "true"
            );
    }


    function closeDrawer() {

        const sidebar =
            getSidebar();


        const backdrop =
            getBackdrop();


        sidebar
            ?.classList
            .remove(
                "drawer-open"
            );


        backdrop
            ?.classList
            .remove(
                "visible"
            );


        document.body.classList.remove(
            "drawer-visible"
        );


        getToggle()
            ?.setAttribute(
                "aria-expanded",
                "false"
            );
    }


    function toggleDrawer() {

        const sidebar =
            getSidebar();


        if (!sidebar) {
            return;
        }


        if (
            sidebar.classList.contains(
                "drawer-open"
            )
        ) {

            closeDrawer();

        } else {

            openDrawer();
        }
    }


    function createBackdrop() {

        if (
            document.querySelector(
                ".drawer-backdrop"
            )
        ) {
            return;
        }


        const backdrop =
            document.createElement(
                "div"
            );


        backdrop.className =
            "drawer-backdrop";


        backdrop.setAttribute(
            "aria-hidden",
            "true"
        );


        backdrop.addEventListener(
            "click",
            closeDrawer
        );


        document.body.appendChild(
            backdrop
        );
    }


    function createToggle() {

        if (
            document.querySelector(
                ".drawer-toggle"
            )
        ) {
            return;
        }


        const topbar =
            getTopbar();


        if (!topbar) {

            console.warn(
                "ControlSight drawer: .topbar not found"
            );

            return;
        }


        const button =
            document.createElement(
                "button"
            );


        button.type =
            "button";


        button.className =
            "drawer-toggle";


        button.setAttribute(
            "aria-label",
            "Open navigation"
        );


        button.setAttribute(
            "aria-expanded",
            "false"
        );


        button.innerHTML =
            "☰";


        button.addEventListener(
            "click",
            toggleDrawer
        );


        topbar.insertBefore(
            button,
            topbar.firstChild
        );
    }


    function createCloseButton() {

        const sidebar =
            getSidebar();


        if (
            !sidebar
            ||
            sidebar.querySelector(
                ".drawer-close"
            )
        ) {
            return;
        }


        const button =
            document.createElement(
                "button"
            );


        button.type =
            "button";


        button.className =
            "drawer-close";


        button.setAttribute(
            "aria-label",
            "Close navigation"
        );


        button.innerHTML =
            "×";


        button.addEventListener(
            "click",
            closeDrawer
        );


        sidebar.appendChild(
            button
        );
    }


    function installNavClose() {

        /*
         * IMPORTANT:
         *
         * This does NOT preventDefault().
         * This does NOT stopPropagation().
         *
         * dashboard.js remains fully responsible
         * for page navigation.
         */

        document.addEventListener(
            "click",
            function (event) {

                const link =
                    event.target.closest(
                        ".sidebar-nav .nav-item"
                    );


                if (!link) {
                    return;
                }


                window.setTimeout(
                    closeDrawer,
                    50
                );
            }
        );
    }


    function installKeyboard() {

        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key ===
                    "Escape"
                ) {

                    closeDrawer();
                }
            }
        );
    }


    function initialise() {

        createBackdrop();

        createToggle();

        createCloseButton();

        installNavClose();

        installKeyboard();


        console.info(
            "ControlSight sidebar drawer ready"
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
