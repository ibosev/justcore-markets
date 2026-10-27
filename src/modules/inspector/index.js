const escape = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]);

/** Shows the message bus traffic recorded by the bus-log extension, plain DOM. */
export const inspector = sandbox => {
    const log = sandbox.getService("busLog");
    let root;

    function render(entries) {
        const list = root.querySelector("ol");
        list.innerHTML = entries.slice(0, 60).map(({ at, message }) => {
            const { type, ...payload } = message;
            const body = JSON.stringify(payload, (key, value) => Array.isArray(value) ? `[${value.length} items]` : value);
            return `<li><time>${new Date(at).toLocaleTimeString()}</time><b>${escape(type)}</b><code>${escape(body === "{}" ? "" : body)}</code></li>`;
        }).join("");
        root.querySelector(".bus-count").textContent = `${entries.length} message${entries.length === 1 ? "" : "s"}`;
    }

    return {
        sandbox,
        init({ root: element }) {
            root = element;
            root.innerHTML = `<div class="bus"><p class="muted">Every module talks only through these messages. Stop one from the header and the rest keep working.</p>
                <div class="bus-count muted"></div><ol class="bus-list" aria-live="polite"></ol></div>`;
            render(log.entries());
            sandbox.signal.addEventListener("abort", log.subscribe(render));
        },
        destroy() {
            root.innerHTML = "";
        }
    };
};
