/* ============================================================
   CONTROLSIGHT
   FOOTER POSITION FIX
   ============================================================ */

(function () {

    "use strict";


    function moveFooterToBottom() {

        const main =
            document.querySelector(
                ".dashboard-content"
            );

        const footer =
            document.querySelector(
                ".dashboard-footer"
            );


        if (!main || !footer) {
            return;
        }


        if (
            main.lastElementChild !==
            footer
        ) {

            main.appendChild(
                footer
            );
        }
    }


    function initialise() {

        moveFooterToBottom();


        const main =
            document.querySelector(
                ".dashboard-content"
            );


        if (!main) {
            return;
        }


        const observer =
            new MutationObserver(
                moveFooterToBottom
            );


        observer.observe(
            main,
            {
                childList: true
            }
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
