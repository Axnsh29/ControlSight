/* ============================================================
   CONTROLSIGHT DEMO LOGIN
   Safe standalone implementation
   ============================================================ */

(() => {
    "use strict";

    if (window.__controlsightDemoLoginLoaded) {
        return;
    }

    window.__controlsightDemoLoginLoaded = true;

    const STORAGE_KEY = "controlsight_demo_profile_v2";


    function loadUser() {
        try {
            return JSON.parse(
                localStorage.getItem(STORAGE_KEY)
            );
        } catch {
            return null;
        }
    }


    function saveUser(user) {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(user)
        );
    }


    function initials(name) {
        return String(name || "")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part =>
                part.charAt(0).toUpperCase()
            )
            .join("") || "U";
    }


    function findProfile() {

        const direct =
            document.querySelector(
                ".po-profile, " +
                ".po-user-profile, " +
                ".po-user"
            );

        if (direct) {
            return direct;
        }


        const avatar =
            [...document.querySelectorAll(
                "#premium-overview img"
            )]
            .find(img =>
                String(img.src)
                    .includes("avatar")
            );


        return avatar
            ? avatar.parentElement
            : null;
    }


    function applyProfile() {

        const user = loadUser();

        if (!user?.name) {
            return false;
        }


        const profile =
            findProfile();

        if (!profile) {
            return false;
        }


        profile.classList.add(
            "cs-demo-profile"
        );

        profile.title =
            "Click to change user";


        const name =
            profile.querySelector(
                "strong"
            );

        if (name) {
            name.textContent =
                user.name;
        }


        const roleCandidates =
            [...profile.querySelectorAll(
                "span"
            )];

        const role =
            roleCandidates.find(span =>
                /portfolio|owner|user/i.test(
                    span.textContent || ""
                )
            );

        if (role) {
            role.textContent =
                "ControlSight User";
        }


        const image =
            profile.querySelector(
                "img"
            );


        let generated =
            profile.querySelector(
                ".cs-generated-avatar"
            );


        if (user.photo) {

            if (generated) {
                generated.remove();
            }

            if (image) {
                image.src =
                    user.photo;

                image.alt =
                    user.name;

                image.style.display =
                    "";
            }

        } else {

            if (image) {
                image.style.display =
                    "none";
            }


            if (!generated) {

                generated =
                    document.createElement(
                        "div"
                    );

                generated.className =
                    "cs-generated-avatar";


                if (image) {
                    image.insertAdjacentElement(
                        "afterend",
                        generated
                    );
                } else {
                    profile.prepend(
                        generated
                    );
                }
            }


            generated.textContent =
                initials(user.name);
        }


        return true;
    }


    /*
     * Retry only briefly while Premium Overview renders.
     * Stops automatically — no observer and no infinite loop.
     */
    function refreshProfileSafely() {

        let attempts = 0;

        const timer =
            window.setInterval(() => {

                attempts += 1;

                const applied =
                    applyProfile();

                if (
                    applied ||
                    attempts >= 20
                ) {
                    clearInterval(timer);
                }

            }, 150);
    }


    function resizePhoto(file) {

        return new Promise(
            (resolve, reject) => {

                const reader =
                    new FileReader();


                reader.onerror =
                    reject;


                reader.onload = () => {

                    const image =
                        new Image();


                    image.onerror =
                        reject;


                    image.onload = () => {

                        const maxSize = 256;

                        const scale =
                            Math.min(
                                1,
                                maxSize /
                                Math.max(
                                    image.width,
                                    image.height
                                )
                            );


                        const width =
                            Math.round(
                                image.width *
                                scale
                            );

                        const height =
                            Math.round(
                                image.height *
                                scale
                            );


                        const canvas =
                            document.createElement(
                                "canvas"
                            );

                        canvas.width =
                            width;

                        canvas.height =
                            height;


                        const ctx =
                            canvas.getContext(
                                "2d"
                            );

                        ctx.drawImage(
                            image,
                            0,
                            0,
                            width,
                            height
                        );


                        resolve(
                            canvas.toDataURL(
                                "image/jpeg",
                                0.82
                            )
                        );
                    };


                    image.src =
                        reader.result;
                };


                reader.readAsDataURL(
                    file
                );
            }
        );
    }


    function showLogin({
        editing = false
    } = {}) {

        if (
            document.querySelector(
                ".cs-login-overlay"
            )
        ) {
            return;
        }


        const existing =
            loadUser();


        const overlay =
            document.createElement(
                "div"
            );

        overlay.className =
            "cs-login-overlay";


        overlay.innerHTML = `
            <div class="cs-login-card">

                <div class="cs-login-brand">
                    <strong>ControlSight</strong>
                    <span>
                        Project Controls Intelligence
                    </span>
                </div>

                <h2>
                    ${
                        editing
                            ? "Change profile"
                            : "Welcome to ControlSight"
                    }
                </h2>

                <p>
                    Enter your name to access the
                    demonstration environment.
                    A profile picture is optional.
                </p>

                <form id="cs-login-form">

                    <div class="cs-login-field">
                        <label for="cs-login-name">
                            Name *
                        </label>

                        <input
                            id="cs-login-name"
                            type="text"
                            maxlength="60"
                            autocomplete="name"
                            placeholder="Enter your name"
                        >
                    </div>

                    <div class="cs-login-field">

                        <label for="cs-login-photo">
                            Profile picture
                            <small>
                                Optional
                            </small>
                        </label>

                        <div class="cs-photo-row">

                            <div
                                id="cs-login-preview"
                                class="cs-login-preview"
                            >
                                U
                            </div>

                            <input
                                id="cs-login-photo"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                            >

                        </div>

                    </div>

                    <div
                        id="cs-login-error"
                        class="cs-login-error"
                    ></div>

                    <button
                        class="cs-login-submit"
                        type="submit"
                    >
                        ${
                            editing
                                ? "Save profile"
                                : "Enter ControlSight"
                        }
                    </button>

                    ${
                        editing
                            ? `
                            <button
                                id="cs-login-cancel"
                                class="cs-login-cancel"
                                type="button"
                            >
                                Cancel
                            </button>
                            `
                            : ""
                    }

                </form>

                <div class="cs-demo-note">
                    Demo access · No password required
                </div>

            </div>
        `;


        document.body.appendChild(
            overlay
        );

        document.body.classList.add(
            "cs-login-open"
        );


        const form =
            overlay.querySelector(
                "#cs-login-form"
            );

        const nameInput =
            overlay.querySelector(
                "#cs-login-name"
            );

        const photoInput =
            overlay.querySelector(
                "#cs-login-photo"
            );

        const preview =
            overlay.querySelector(
                "#cs-login-preview"
            );

        const error =
            overlay.querySelector(
                "#cs-login-error"
            );


        let selectedPhoto =
            existing?.photo || null;


        if (
            editing &&
            existing?.name
        ) {
            nameInput.value =
                existing.name;
        }


        function updatePreview() {

            if (selectedPhoto) {

                preview.innerHTML =
                    `<img
                        src="${selectedPhoto}"
                        alt="Profile preview"
                    >`;

            } else {

                preview.textContent =
                    initials(
                        nameInput.value
                    );
            }
        }


        updatePreview();


        nameInput.addEventListener(
            "input",
            () => {

                if (!selectedPhoto) {
                    updatePreview();
                }
            }
        );


        photoInput.addEventListener(
            "change",
            async () => {

                const file =
                    photoInput.files?.[0];


                if (!file) {
                    return;
                }


                if (
                    file.size >
                    5 * 1024 * 1024
                ) {

                    error.textContent =
                        "Please choose an image under 5 MB.";

                    error.style.display =
                        "block";

                    return;
                }


                try {

                    selectedPhoto =
                        await resizePhoto(
                            file
                        );

                    error.style.display =
                        "none";

                    updatePreview();

                } catch {

                    error.textContent =
                        "Unable to read that image.";

                    error.style.display =
                        "block";
                }
            }
        );


        form.addEventListener(
            "submit",
            event => {

                event.preventDefault();


                const name =
                    nameInput.value.trim();


                if (!name) {

                    error.textContent =
                        "Name is required.";

                    error.style.display =
                        "block";

                    nameInput.focus();

                    return;
                }


                saveUser({
                    name,
                    photo:
                        selectedPhoto || null
                });


                overlay.remove();

                document.body.classList.remove(
                    "cs-login-open"
                );


                refreshProfileSafely();
            }
        );


        overlay
            .querySelector(
                "#cs-login-cancel"
            )
            ?.addEventListener(
                "click",
                () => {

                    overlay.remove();

                    document.body
                        .classList.remove(
                            "cs-login-open"
                        );
                }
            );


        window.setTimeout(
            () => nameInput.focus(),
            50
        );
    }


    function initialise() {

        if (!loadUser()?.name) {
            showLogin();
        } else {
            refreshProfileSafely();
        }


        /*
         * Returning to Overview may reveal the premium profile.
         * One short refresh is enough.
         */
        window.addEventListener(
            "hashchange",
            () => {
                window.setTimeout(
                    refreshProfileSafely,
                    50
                );
            }
        );


        /*
         * Clicking the displayed profile opens edit mode.
         */
        document.addEventListener(
            "click",
            event => {

                const profile =
                    event.target.closest(
                        ".cs-demo-profile"
                    );

                if (!profile) {
                    return;
                }

                showLogin({
                    editing: true
                });
            }
        );
    }


    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialise,
            {
                once: true
            }
        );
    } else {
        initialise();
    }

})();
