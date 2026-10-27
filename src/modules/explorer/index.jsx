import { createRoot } from "react-dom/client";
import { Explorer } from "./Explorer.jsx";
import "./explorer.css";

/** Market explorer (React). Browses every US listing or searches worldwide; selecting a row is a message. */
export const explorer = sandbox => {
    let root;
    const state = { selected: null, watched: new Set() };
    const actions = {
        select: (symbol, name) => sandbox.publishAsync({ type: "symbol.selected", symbol, name }),
        toggleWatch: (symbol, name) => sandbox.publishAsync({ type: "watchlist.toggle", symbol, name })
    };
    // The view is a function of the latest messages: re-render with new props on each one.
    const render = () => root.render(<Explorer market={sandbox.getService("market")} {...state} {...actions} />);

    return {
        sandbox,
        init(props) {
            state.selected = props.symbol;
            root = createRoot(props.root);
            render();
            sandbox.publishAsync({ type: "portfolio.requested" });
        },
        moduleWillSubscribe: () => ["symbol.selected", "portfolio.changed"],
        moduleDidReceiveMessage(message) {
            if (message.type === "symbol.selected") state.selected = message.symbol;
            if (message.type === "portfolio.changed") state.watched = new Set(message.watchlist.map(w => w.symbol));
            render();
        },
        destroy() {
            root.unmount();
        }
    };
};
