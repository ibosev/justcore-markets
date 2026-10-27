import { mount, unmount } from "svelte";
import Quote from "./Quote.svelte";

/** Quote and price history (Svelte). Follows the selected symbol and records purchases as messages. */
export const quote = sandbox => {
    let app;
    // A rune-backed object: assigning to it from message handlers updates the mounted component.
    const view = $state({ symbol: null, watchlist: [], lots: [] });

    return {
        sandbox,
        init(props) {
            view.symbol = props.symbol;
            app = mount(Quote, {
                target: props.root,
                props: {
                    market: sandbox.getService("market"),
                    view,
                    onToggleWatch: (symbol, name) => sandbox.publishAsync({ type: "watchlist.toggle", symbol, name }),
                    onAddLot: lot => sandbox.publishAsync({ type: "lot.add", lot })
                }
            });
            sandbox.publishAsync({ type: "portfolio.requested" });
        },
        moduleWillSubscribe: () => ["symbol.selected", "portfolio.changed"],
        moduleDidReceiveMessage(message) {
            if (message.type === "symbol.selected") {
                view.symbol = message.symbol;
            } else {
                view.watchlist = message.watchlist.map(w => w.symbol);
                view.lots = message.lots;
            }
        },
        destroy() {
            return unmount(app);
        }
    };
};
