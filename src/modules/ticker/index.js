import { number, pct, trend } from "../../lib/format.js";

const INSTRUMENTS = [
    ["^GSPC", "S&P 500"], ["^IXIC", "Nasdaq"], ["^DJI", "Dow 30"], ["^RUT", "Russell 2000"],
    ["^VIX", "VIX"], ["^STOXX50E", "Euro Stoxx 50"], ["^N225", "Nikkei 225"], ["GC=F", "Gold"],
    ["CL=F", "Crude oil"], ["EURUSD=X", "EUR/USD"], ["BTC-USD", "Bitcoin"]
];

/** Market pulse strip, plain DOM. Refreshes every minute until the module stops. */
export const ticker = sandbox => {
    const market = sandbox.getService("market");
    let root;

    async function refresh() {
        try {
            const quotes = await market.quotes(INSTRUMENTS.map(([symbol]) => symbol));
            if (sandbox.signal.aborted) return;
            root.querySelectorAll("[data-symbol]").forEach(button => {
                const q = quotes[button.dataset.symbol];
                if (!q) return;
                button.querySelector(".tick-price").textContent = number(q.price);
                const change = button.querySelector(".tick-change");
                change.textContent = pct(q.changePct);
                change.className = `tick-change ${trend(q.changePct)}`;
            });
        } catch (err) {
            console.warn("ticker: refresh failed", err);
        }
    }

    return {
        sandbox,
        init({ root: element }) {
            root = element;
            root.innerHTML = `<div class="ticker">${INSTRUMENTS.map(([symbol, label]) => `
                <button type="button" class="tick" data-symbol="${symbol}" title="${symbol}">
                    <span class="tick-label">${label}</span>
                    <span class="tick-price">…</span>
                    <span class="tick-change flat"></span>
                </button>`).join("")}</div>`;

            root.addEventListener("click", event => {
                const button = event.target.closest("[data-symbol]");
                if (button) {
                    sandbox.publishAsync({ type: "symbol.selected", symbol: button.dataset.symbol });
                }
            }, { signal: sandbox.signal });

            const timer = setInterval(refresh, 60000);
            sandbox.signal.addEventListener("abort", () => clearInterval(timer));
            refresh();
        },
        destroy() {
            root.innerHTML = "";
        }
    };
};
