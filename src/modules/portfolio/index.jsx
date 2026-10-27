import { createStore } from "solid-js/store";
import { render } from "solid-js/web";
import { openDb } from "./db.js";
import { Portfolio } from "./Portfolio.jsx";
import "./portfolio.css";

const isLot = l => l && typeof l.symbol === "string" && l.symbol.length > 0 &&
    Number.isFinite(l.date) && l.date <= Date.now() &&
    Number.isFinite(l.qty) && l.qty > 0 &&
    Number.isFinite(l.price) && l.price >= 0;

/**
 * Wallet and watchlist (SolidJS). Owns the browser database: other modules ask for changes with
 * messages and learn about them from "portfolio.changed".
 */
export const portfolio = sandbox => {
    let dispose;
    let db;
    const [state, setState] = createStore({ watchlist: [], lots: [], error: null });

    async function reload() {
        const [watchlist, lots] = await Promise.all([db.all("watchlist"), db.all("lots")]);
        watchlist.sort((a, b) => a.symbol.localeCompare(b.symbol));
        setState({ watchlist, lots, error: null });
        sandbox.publishAsync({ type: "portfolio.changed", watchlist, lots });
    }

    // Every change goes through here: wait for the database, write, then reload and announce.
    let queue;
    const change = write => (queue = queue.then(() => write(db)).then(reload).catch(err => {
        console.error("portfolio:", err);
        setState("error", err.message || String(err));
    }));

    const actions = {
        select: (symbol, name) => sandbox.publishAsync({ type: "symbol.selected", symbol, name }),
        toggleWatch: (symbol, name) => change(db => state.watchlist.some(w => w.symbol === symbol)
            ? db.delete("watchlist", symbol)
            : db.put("watchlist", { symbol, name: String(name || symbol), addedAt: Date.now() })),
        removeLot: id => change(db => db.delete("lots", id))
    };

    return {
        sandbox,
        init(props) {
            queue = openDb().then(opened => { db = opened; });
            change(() => { /* first load */ });
            dispose = render(() => <Portfolio market={sandbox.getService("market")} state={state} {...actions} />, props.root);
        },
        moduleWillSubscribe: () => ["watchlist.toggle", "lot.add", "portfolio.requested"],
        moduleDidReceiveMessage(message) {
            switch (message.type) {
                case "watchlist.toggle":
                    if (typeof message.symbol === "string" && message.symbol) actions.toggleWatch(message.symbol, message.name);
                    break;
                case "lot.add": {
                    // Messages are input from other modules: validate before anything reaches the database.
                    const l = message.lot;
                    if (!isLot(l)) return console.warn("portfolio: ignored invalid lot", l);
                    change(db => db.put("lots", {
                        symbol: l.symbol, name: String(l.name || l.symbol), currency: String(l.currency || "USD"),
                        date: l.date, qty: l.qty, price: l.price
                    }));
                    break;
                }
                case "portfolio.requested":
                    change(() => { /* reload re-announces the current state */ });
                    break;
            }
        },
        destroy() {
            dispose();
            return queue.then(() => db?.close());
        }
    };
};
