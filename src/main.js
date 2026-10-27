import { Core } from "justcore";
import { busLog } from "./extensions/bus-log.js";
import { marketData } from "./extensions/market-data.js";
import { explorer } from "./modules/explorer/index.jsx";
import { inspector } from "./modules/inspector/index.js";
import { portfolio } from "./modules/portfolio/index.jsx";
import { quote } from "./modules/quote/index.svelte.js";
import { ticker } from "./modules/ticker/index.js";
import "./styles.css";

const MODULES = { ticker, explorer, quote, portfolio, inspector };
const DEFAULT_SYMBOL = "SPY";

const core = new Core();
core.use([marketData, busLog]);

core.init(() => {
    const currentSymbol = () => decodeURIComponent(location.hash.slice(1)) || DEFAULT_SYMBOL;
    const panel = id => document.querySelector(`[data-module="${id}"]`);
    const start = id => core.startModule(id, { props: { root: panel(id).querySelector(".panel-body"), symbol: currentSymbol() } })
        .catch(err => console.error(`"${id}" failed to start`, err));

    // The shell owns the URL: the selected symbol lives in the hash, so reloads and links keep it.
    core.onMessage("symbol.selected", ({ symbol }) => {
        if (symbol !== currentSymbol()) history.replaceState(null, "", `#${encodeURIComponent(symbol)}`);
    });
    addEventListener("hashchange", () => core.publishAsync({ type: "symbol.selected", symbol: currentSymbol() }));

    // Header switches stop and start each module at runtime; the others keep working.
    const toggles = document.querySelector(".module-toggles");
    for (const [id, factory] of Object.entries(MODULES)) {
        core.addModule(id, factory);
        const label = document.createElement("label");
        label.className = "toggle";
        label.innerHTML = `<input type="checkbox" checked> ${id} <small>${panel(id).dataset.framework}</small>`;
        label.querySelector("input").addEventListener("change", event => {
            panel(id).classList.toggle("is-stopped", !event.target.checked);
            if (event.target.checked) start(id); else core.stopModule(id);
        });
        toggles.append(label);
        start(id);
    }
});
