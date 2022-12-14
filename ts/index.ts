/**
 * @file Handle web inspector
 * @name index.ts
 * @license MIT
 */

let logs = {
    general: [] as any[],

    // bind functions
    f: {
        log: console.log.bind(console),
        error: console.error.bind(console),
        warn: console.warn.bind(console),
    },
};

console.log = (data: any) => {
    if (data === undefined) return;
    logs.f.log.apply(console, [data]);
    logs.general.push({
        ts: performance.now(),
        data,
    });
};

console.error = (data: any) => {
    if (data === undefined) return;
    logs.f.error.apply(console, [data]);
    logs.general.push({
        ts: performance.now(),
        data,
    });
};

console.warn = (data: any) => {
    if (data === undefined) return;
    logs.f.warn.apply(console, [data]);
    logs.general.push({
        ts: performance.now(),
        data,
    });
};

window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
        logs.general.push({
            ts: performance.now(),
            data: event.reason,
        });
    }
);

window.addEventListener("error", (event: ErrorEvent) => {
    logs.general.push({
        ts: performance.now(),
        data: event.error,
    });
});

/**
 * @class Inspector
 */
class Inspector {
    active: boolean;
    id: string;

    styleSheetElement: HTMLStyleElement;
    window: HTMLDivElement;

    selected?: HTMLElement; // track selected element
    tab: "display" | "console" | "storage" | "performance"; // track current tab

    sr: ShadowRoot;

    constructor() {
        this.active = false;
        this.styleSheetElement = document.createElement("style");
        this.id = `inspector-${window.crypto.randomUUID()}`;
        this.tab = "display"; // set default tab

        // add styles
        this.styleSheetElement.innerHTML = `html[data-mode="inspect"] *:hover {
            outline: dashed 1px rgb(255, 87, 87);
            cursor: crosshair;
        }

        #${this.id}.inspect\\.window, 
        #${this.id}.inspect\\.window * {
            outline: none !important;
            cursor: initial !important;
            color: black !important;

            margin: 0;
            padding: 0;
            word-wrap: break-word;
            flex-wrap: wrap;
            white-space: initial;
            overflow-wrap: break-word;
            box-sizing: content-box;

            font-family: monospace !important;
            font-size: initial !important;
            line-spacing: initial !important;
            line-height: initial !important;
        }
        
        #${this.id}.inspect\\.window {
            background: white;
            color: black;
            border: solid 1px darkgray;
            padding: 0.4rem;
            /* display: flex;
            flex-direction: column;
            gap: 0.2rem; */
            position: fixed;
            max-width: 20rem;
            width: 20rem;
            overflow: hidden;
            text-overflow: ellipsis;
            transition: all 0.2s;
            box-shadow: 0 0 8px rgba(0, 0, 0, 0.25);
            top: -50px; /* position off-page at start */
            left: -50px; /* position off-page at start */
            z-index: 9999;
        }

        #${this.id}.inspect\\.window input, 
        #${this.id}.inspect\\.window textarea {
            width: initial !important;
            background: white !important;
            border: solid 1px darkgray !important;
        }

        #${this.id}.inspect\\.window input:disabled, 
        #${this.id}.inspect\\.window textarea:disabled {
            color: gray !important;
        }

        #${this.id}.inspect\\.window.off {
            display: none;
        }
        
        #${this.id}.inspect\\.window .inspect\\.element {
            border-top: solid 1px darkgray;
            /* border-bottom: solid 1px darkgray; */
            padding: 0.4rem;
            display: flex;
            align-items: center;
            gap: 0.2rem;
        }
        
        #${this.id}.inspect\\.window .inspect\\.element:hover {
            background: whitesmoke;
        }

        #${this.id}.inspect\\.window .inspect\\.element\\.tab {
            /* --size: 4rem; */

            background: white;

            /* width: var(--size);
            height: var(--size); */
            padding: 0.2rem 0.4rem;
            
            transition: all 0.05s;
            border: solid 1px transparent;
            border-radius: 1rem;
            outline: none;

            cursor: pointer !important;
        }

        #${this.id}.inspect\\.window .inspect\\.element\\.tab:hover {
            background: whitesmoke;
            border: solid 1px darkgray;
        }

        #${this.id}.inspect\\.window .inspect\\.element\\.tab.active {
            border: solid 1px hsl(226, 61%, 54%);
            background: hsla(226, 61%, 54%, 0.25);
        }

        #${this.id}.inspect\\.window .inspect\\.element\\.tab.active:hover {
            background: hsl(226, 61%, 49%);
            color: white !important;
            box-shadow: 0 0 8px hsl(226, 61%, 54%);
        }

        /* side mode */

        #${this.id}.inspect\\.window[side-mode] {
            top: 0% !important;
            left: calc(100% - 22rem) !important;
            height: 100vh;
            overflow: auto !important;
            padding: 1rem;
        }

        html[inspector-side-mode] body {
            padding-right: 22rem;
        }`;

        // create inspector window
        this.window = document.createElement("div");
        this.window.innerHTML = `<div id="${this.id}"></div>`;

        // append inspector window
        document.body.appendChild(this.window);

        // attach shadowroot
        this.sr = document
            .getElementById(this.id)!
            .attachShadow({ mode: "open" });

        this.sr.innerHTML = `<div 
            id="${this.id}" 
            class="inspect.window inspect.core off">
        </div>`; // we're going to put the actual inspector content in here

        // append stylesheet element
        // must be shared between the shadowroot and the document
        this.sr.innerHTML += `<style>${this.styleSheetElement.innerHTML}</style>`;
        document.head.appendChild(this.styleSheetElement);

        // get actual window
        this.window = this.sr.getElementById(this.id) as HTMLDivElement;

        // and now set it to the sr...
        this.window = this.sr.getElementById(this.id) as HTMLDivElement;

        // bind document contextmenu to a function
        document.addEventListener("contextmenu", (event: Event) => {
            if (
                !this.active ||
                (event.target as HTMLElement).classList.contains(
                    "inspect.core"
                ) ||
                (event.target as HTMLElement).id === this.id
            )
                return;

            event.preventDefault();
            this.inspectElement(event.target as HTMLElement, {
                x: (event as any).pageX,
                y: (event as any).pageY,
            });
        });

        // listen for escape key presses and hide the menu
        document.addEventListener("keydown", (event: KeyboardEvent) => {
            if (!this.active) return;
            if (event.key === "Escape") this.toggle();
        });

        // add window functions
        (window as any)[this.id] = {
            /**
             * @function ch
             * @description Update the value of the selected element's data
             *
             * @param {Event} event
             * @param {string} dataName
             * @returns {void}
             */
            ch: (event: Event, dataName: string) => {
                if (!this.selected) return;
                (this.selected as any)[dataName] = (
                    event.target as HTMLInputElement
                ).value;

                // inspect again
                this.inspectElement(this.selected, {
                    x: (event as any).pageX,
                    y: (event as any).pageY,
                });
            },
            /**
             * @function sp
             * @description Run a special action
             *
             * @param {Event} event
             * @param {string} dataName
             * @returns {void}
             */
            sp: (event: Event, dataName: string) => {
                if (!this.selected) return;

                // handle different dataName(s)
                switch (dataName) {
                    // mode change
                    case "sideMode":
                        // toggle sideMode attribute
                        this.window.toggleAttribute("side-mode");
                        document.documentElement.toggleAttribute(
                            "inspector-side-mode"
                        );
                        break;

                    // tab changes
                    case "display":
                        this.tab = "display";
                        break;

                    case "console":
                        this.tab = "console";
                        break;

                    case "storage":
                        this.tab = "storage";
                        break;

                    case "performance":
                        this.tab = "performance";
                        break;

                    // console
                    case "runjs":
                        const value = (event.target as HTMLTextAreaElement)
                            .value;

                        console.log(`~> ${value}`);
                        new Function(`(() => { ${value} })();`)(); // run code
                        break;

                    // performance
                    case "mark":
                        // create new performance mark
                        performance.mark("ins-mark");
                        break;

                    case "stamp":
                        // create end mark
                        performance.mark("ins-end-mark");

                        // measure
                        performance.measure(
                            "ins-s-to-e-measure",
                            "ins-mark",
                            "ins-end-mark"
                        );

                        // log results
                        const results =
                            performance.getEntriesByName("ins-s-to-e-measure");

                        console.log(
                            `STAMP RESULT: ${JSON.stringify({
                                start: `${results[0].startTime}ms`,
                                duration: `${results[0].duration}ms`,
                            })}`
                        );

                        // clear
                        performance.clearMarks();
                        performance.clearMeasures();

                        // load console tab
                        this.tab = "console";

                        break;

                    // default
                    default:
                        break;
                }

                // inspect again
                this.inspectElement(this.selected, {
                    x: (event as any).pageX,
                    y: (event as any).pageY,
                });
            },
        };

        // enable side mode
        this.window.toggleAttribute("side-mode");
        document.documentElement.toggleAttribute("inspector-side-mode");
    }

    /**
     * @function toggle
     *
     * @returns {void}
     */
    public toggle(): void {
        // toggle document.documentElement["data-mode"]
        if (document.documentElement.getAttribute("data-mode") === "inspect")
            document.documentElement.removeAttribute("data-mode");
        else document.documentElement.setAttribute("data-mode", "inspect");

        // toggle this.active
        this.active = !this.active;

        // toggle window visibility
        this.window.classList.toggle("off");

        // toggle side mode
        document.documentElement.toggleAttribute("inspector-side-mode");
        this.window.toggleAttribute("side-mode");
    }

    /**
     * @function inspectElement
     * @description Show the inspection window for a specific element
     *
     * @param {HTMLElement} element
     * @param {{ x: number, y: number }} position
     * @returns {void}
     */
    public inspectElement(
        element: HTMLElement,
        position: { x: number; y: number }
    ): void {
        if (!this.active) return; // make sure the inspector is this.active

        // position window
        this.window.style.left = `${position.x}px`;
        this.window.style.top = `${position.y}px`;

        // get styles
        const computed = window.getComputedStyle(element);
        let style = "";

        for (let i = 0; i < computed.length; i++) {
            style += `${computed[i]}: ${computed.getPropertyValue(
                computed[i]
            )};\n`;
        }

        // get console logs
        let _logs = "";
        for (let log of logs.general)
            _logs += `<div class="inspect.element">{${log.ts}} ${log.data}</div>`;

        // remove all event listeners
        for (let element of this.window.querySelectorAll("*") as any) {
            if (element.onsubmit) element.onsubmit = null;
            if (element.onclick) element.onclick = null;
            if (element.onchange) element.onchange = null;
        }

        // add basic element information
        this.window.innerHTML = `
        <!-- primary window -->
        <h2>${element.nodeName} #${element.id} .${element.className}</h2>

        <p>Press ESCAPE to disable.</p><br>

        <!-- tabs -->
        <div class="inspect.element" style="display: flex; flex-wrap: wrap; justify-content: center;">
            <button onclick="window['${
                this.id
            }'].sp(event, 'display')" class="inspect.element.tab ${
            this.tab === "display" ? "active" : ""
        }">Display</button>

            <button onclick="window['${
                this.id
            }'].sp(event, 'console')" class="inspect.element.tab ${
            this.tab === "console" ? "active" : ""
        }">Console</button>

            <button onclick="window['${
                this.id
            }'].sp(event, 'storage')" class="inspect.element.tab ${
            this.tab === "storage" ? "active" : ""
        }">Storage</button>

            <button onclick="window['${
                this.id
            }'].sp(event, 'performance')" class="inspect.element.tab ${
            this.tab === "performance" ? "active" : ""
        }">Performance</button>

            <button onclick="window['${
                this.id
            }'].sp(event, 'reload')" class="inspect.element.tab">Refresh</button>
        </div>

        <!-- extra menu -->
        <div class="inspect.element">Side Mode: <input type="checkbox" rows="5" cols="35" 
            onchange="window['${this.id}'].sp(event, 'sideMode')" ${
            this.window.hasAttribute("side-mode") === true ? "checked" : ""
        }>
        </div>
        
        <!-- tab -->
        ${
            this.tab === "display"
                ? `
                <!-- display tab -->
                <div class="inspect.element">nodeName: ${element.nodeName}</div>
        
                <div class="inspect.element">ID: <input 
                    onchange="window['${this.id}'].ch(event, 'id')" 
                    value="${element.id}">
                </div>
                
                <div class="inspect.element">className: <input 
                    onchange="window['${this.id}'].ch(event, 'className')" 
                    value="${element.className}">
                </div>

                <div class="inspect.element">outerHTML: <textarea rows="5" cols="35" 
                    onchange="window['${this.id}'].ch(event, 'outerHTML')">
                        ${new Option(element.outerHTML).innerHTML}
                    </textarea>
                </div>
                
                <div class="inspect.element">computed: <textarea rows="5" cols="35" 
                    onchange="window['${this.id}'].ch(event, '')" disabled>
                        ${style}
                    </textarea>
                </div>`
                : this.tab === "console"
                ? `
                <!-- console tab -->
                ${_logs}

                <div class="inspect.element">Run JavaScript: <textarea rows="5" cols="35" 
                    onchange="window['${this.id}'].sp(event, 'runjs')"></textarea>
                </div>
                `
                : this.tab === "storage"
                ? `
                <!-- storage tab -->
                <div class="inspect.element">localStorage: <textarea rows="5" cols="35" 
                    onchange="window['${this.id}'].ch(event, '')" disabled>
                        ${JSON.stringify({ ...localStorage })}
                    </textarea>
                </div>
                
                <div class="inspect.element">sessionStorage: <textarea rows="5" cols="35" 
                    onchange="window['${this.id}'].ch(event, '')" disabled>
                        ${JSON.stringify({ ...sessionStorage })}
                    </textarea>
                </div>
                
                <div class="inspect.element">cookie: <textarea rows="5" cols="35" 
                    onchange="window['${this.id}'].ch(event, '')" disabled>
                        ${document.cookie}
                    </textarea>
                </div>`
                : this.tab === "performance"
                ? `
                <!-- performance tab -->
                <div class="inspect.element">
                    <b>Timestamp Configuration</b>
                    ${
                        performance.getEntriesByName("ins-mark").length !== 0
                            ? 'Mark already active! Click "Stamp" below to end and measure mark.'
                            : ""
                    }
                </div>

                <div class="inspect.element">
                    <button onclick="window['${
                        this.id
                    }'].sp(event, 'mark')">Mark</button>
                    <button onclick="window['${
                        this.id
                    }'].sp(event, 'stamp')">Stamp</button>
                </div>
                `
                : undefined
        }`;

        this.selected = element;

        // add .inspect\.core to all elements under the inspector
        for (let element of this.sr.querySelectorAll(`#${this.id} *`) as any) {
            element.classList.add("inspect.core");
        }
    }
}

// export for DOM
(window as any).inspector = Inspector;
