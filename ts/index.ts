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
    logs.f.log.apply(console, [data]);
    logs.general.push({
        ts: performance.now(),
        data,
    });
};

console.error = (data: any) => {
    logs.f.error.apply(console, [data]);
    logs.general.push({
        ts: performance.now(),
        data,
    });
};

console.warn = (data: any) => {
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
    tab: "display" | "console"; // track current tab

    constructor() {
        this.active = false;
        this.styleSheetElement = document.createElement("style");
        this.id = `inspector-${window.crypto.randomUUID()}`;
        this.tab = "display"; // set default tab

        // append stylesheet element
        document.head.appendChild(this.styleSheetElement);

        // add styles
        this.styleSheetElement.innerHTML = `html[data-mode="inspect"] *:hover {
            outline: dashed 1px rgb(255, 87, 87);
            cursor: crosshair;
        }

        #${this.id}.inspect\\.window, 
        #${this.id}.inspect\\.window * {
            outline: none !important;
            cursor: initial !important;

            margin: 0;
            padding: 0;
            word-wrap: break-word;
            flex-wrap: wrap;
            white-space: initial;
            overflow-wrap: break-word;
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
            font-family: monospace !important;
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

        #${this.id}.inspect\\.window.off {
            display: none;
        }
        
        #${this.id}.inspect\\.window .inspect\\.element {
            border-top: solid 1px darkgray;
            /* border-bottom: solid 1px darkgray; */
            padding: 0.4rem 0;
            display: flex;
            align-items: center;
            gap: 0.2rem;
        }
        
        #${this.id}.inspect\\.window .inspect\\.element:hover {
            background: whitesmoke;
        }

        /* side mode */
        #${this.id}.inspect\\.window[side-mode] {
            top: 0% !important;
            left: calc(100% - 20rem) !important;
            height: 100vh;
            overflow: auto !important;
        }

        html[inspector-side-mode] body {
            padding-right: 20rem;
        }`;

        // create inspector window
        this.window = document.createElement("div");
        this.window.innerHTML = `<div class="inspect.window off" id="${this.id}"></div>`;

        // append inspector window
        document.body.appendChild(this.window);
        this.window = document.getElementById(this.id) as HTMLDivElement;

        // bind document contextmenu to a function
        document.addEventListener("contextmenu", (event: Event) => {
            if (!this.active) return;
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
                if (dataName === "sideMode") {
                    // toggle sideMode attribute
                    this.window.toggleAttribute("side-mode");
                    document.documentElement.toggleAttribute(
                        "inspector-side-mode"
                    );
                } else if (dataName === "display") this.tab = "display";
                else if (dataName === "console") this.tab = "console";

                // inspect again
                this.inspectElement(this.selected, {
                    x: (event as any).pageX,
                    y: (event as any).pageY,
                });
            },
        };
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

        // add basic element information
        this.window.innerHTML = `<h2>${element.nodeName} #${element.id} .${
            element.className
        }</h2>

        <p>Press ESCAPE to disable.</p><br>

        <!-- tabs -->
        <div class="inspect.element">
            <button onclick="window['${
                this.id
            }'].sp(event, 'display')">Display</button>

            <button onclick="window['${
                this.id
            }'].sp(event, 'console')">Console</button>

            <button onclick="window['${
                this.id
            }'].sp(event, 'reload')">Refresh</button>
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
                </div>
                
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
                
                <div class="inspect.element">Side Mode: <input type="checkbox" rows="5" cols="35" 
                    onchange="window['${this.id}'].sp(event, 'sideMode')" ${
                      this.window.hasAttribute("side-mode") === true
                          ? "checked"
                          : ""
                  }>
                </div>`
                : this.tab === "console"
                ? `
                <!-- console tab -->
                ${_logs}
                `
                : undefined
        }`;

        this.selected = element;
    }
}

// export for DOM
(window as any).inspector = Inspector;
