import { createEffect, createMemo, createResource, createSignal, For, on, onCleanup, Show } from "solid-js";
import { plot } from "../../lib/chart.js";
import { date, money, number, pct, signed, trend } from "../../lib/format.js";
import { positions, totals, valueSeries } from "./holdings.js";

const W = 640, H = 160;

function Sparkline(props) {
    const path = () => props.values.length > 1 ? plot(props.values, 80, 24, { pad: 2 }).line : "";
    return (
        <svg class={`spark ${trend(props.values.at(-1) - props.values[0])}`} viewBox="0 0 80 24" preserveAspectRatio="none" aria-hidden="true">
            <path d={path()} fill="none" stroke="currentColor" stroke-width="1.4" vector-effect="non-scaling-stroke" />
        </svg>
    );
}

export function Portfolio(props) {
    const [tab, setTab] = createSignal("wallet");
    const [quotes, setQuotes] = createSignal({});
    const [expanded, setExpanded] = createSignal(null);
    const [hover, setHover] = createSignal(null);

    // Re-quote whenever the set of symbols changes, and every minute while mounted.
    const symbols = createMemo(() => [...new Set([
        ...props.state.watchlist.map(w => w.symbol),
        ...props.state.lots.map(l => l.symbol)
    ])].sort().join(","));
    createEffect(on(symbols, list => {
        if (!list) return;
        const load = () => props.market.quotes(list.split(",")).then(setQuotes, err => console.warn("portfolio: quotes failed", err));
        load();
        const timer = setInterval(load, 60000);
        onCleanup(() => clearInterval(timer));
    }));

    const rows = createMemo(() => positions(props.state.lots, quotes()));
    const sum = createMemo(() => totals(rows()));

    // Daily history of every held symbol since its first purchase, folded into a wallet value series.
    const [series] = createResource(() => props.state.lots.length > 0 && props.state.lots, async lots => {
        const first = {};
        for (const l of lots) first[l.symbol] = Math.min(first[l.symbol] ?? Infinity, l.date);
        const histories = await Promise.all(Object.entries(first).map(([symbol, from]) =>
            props.market.historySince(symbol, from).then(h => [symbol, h.points], () => [symbol, []])));
        return valueSeries(lots, Object.fromEntries(histories));
    });
    const chart = createMemo(() => {
        const s = series() || [];
        const domain = s.flatMap(p => [p.value, p.cost]);
        return {
            s,
            value: plot(s.map(p => p.value), W, H, { pad: 8, domain }),
            cost: plot(s.map(p => p.cost), W, H, { pad: 8, domain })
        };
    });
    const hovered = () => hover() === null ? null : chart().s[hover()];
    const track = event => {
        const rect = event.currentTarget.getBoundingClientRect();
        const n = chart().s.length;
        setHover(Math.max(0, Math.min(n - 1, Math.round((event.clientX - rect.left) / rect.width * (n - 1)))));
    };

    return (
        <div class="portfolio">
            <div class="segmented" role="tablist">
                <button role="tab" aria-selected={tab() === "wallet"} onClick={() => setTab("wallet")}>Wallet · {rows().length}</button>
                <button role="tab" aria-selected={tab() === "watchlist"} onClick={() => setTab("watchlist")}>Watchlist · {props.state.watchlist.length}</button>
                <span class="muted small storage-note">Saved in this browser (IndexedDB)</span>
            </div>
            <Show when={props.state.error}><p class="error">Storage error: {props.state.error}</p></Show>

            <Show when={tab() === "wallet"}>
                <Show when={rows().length} fallback={<p class="muted pad">No purchases yet. Pick a symbol, then use <b>Record a purchase</b> in the quote panel. Pick a past date to see the history of your wallet.</p>}>
                    <div class="summary">
                        <div><span>Value</span><b class="mono">{money(sum().value)}</b></div>
                        <div><span>Invested</span><b class="mono">{money(sum().cost)}</b></div>
                        <div><span>Profit / loss</span><b class={`mono ${trend(sum().pl)}`}>{signed(sum().pl)}</b></div>
                        <div><span>Return</span><b class={`mono ${trend(sum().pl)}`}>{pct(sum().plPct)}</b></div>
                    </div>

                    <div class="wallet-chart">
                        <Show when={chart().s.length > 1} fallback={<p class="muted pad">{series.loading ? "Loading wallet history…" : "History appears after the first trading day."}</p>}>
                            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Wallet value and invested amount over time"
                                 onPointerMove={track} onPointerLeave={() => setHover(null)}>
                                <path class="cost-line" d={chart().cost.line} fill="none" vector-effect="non-scaling-stroke" />
                                <path class={`value-line ${trend(sum().pl)}`} d={chart().value.line} fill="none" stroke="currentColor" vector-effect="non-scaling-stroke" />
                                <Show when={hovered()}>
                                    <line class="crosshair" x1={chart().value.x(hover())} x2={chart().value.x(hover())} y1="0" y2={H} vector-effect="non-scaling-stroke" />
                                </Show>
                            </svg>
                            <div class="mono small chart-readout">
                                <Show when={hovered()} fallback={<span class="muted">{date(chart().s[0].t)} – today · <span class="legend-value">━ value</span> <span class="legend-cost">┅ invested</span></span>}>
                                    {date(hovered().t)} · value <b>{money(hovered().value)}</b> · invested {money(hovered().cost)} · <span class={trend(hovered().value - hovered().cost)}>{signed(hovered().value - hovered().cost)}</span>
                                </Show>
                            </div>
                        </Show>
                    </div>

                    <div class="table-wrap">
                        <table class="table">
                            <thead><tr><th>Symbol</th><th class="num">Qty</th><th class="num">Avg cost</th><th class="num">Last</th><th class="num">Value</th><th class="num">P/L</th><th /></tr></thead>
                            <tbody>
                                <For each={rows()}>{p => <>
                                    <tr onClick={() => props.select(p.symbol, p.name)}>
                                        <td><b class="mono">{p.symbol}</b><div class="muted small ellipsis">{p.name}</div></td>
                                        <td class="num mono">{number(p.qty, 4)}</td>
                                        <td class="num mono">{money(p.avg, p.currency)}</td>
                                        <td class="num mono">{money(p.price, p.currency)}<div class={`small ${trend(p.changePct)}`}>{pct(p.changePct)}</div></td>
                                        <td class="num mono">{money(p.value, p.currency)}</td>
                                        <td class={`num mono ${trend(p.pl)}`}>{signed(p.pl, p.currency)}<div class="small">{pct(p.plPct)}</div></td>
                                        <td>
                                            <button class="link" aria-expanded={expanded() === p.symbol}
                                                    onClick={e => { e.stopPropagation(); setExpanded(expanded() === p.symbol ? null : p.symbol); }}>
                                                {p.lots.length} lot{p.lots.length > 1 ? "s" : ""} {expanded() === p.symbol ? "▴" : "▾"}
                                            </button>
                                        </td>
                                    </tr>
                                    <Show when={expanded() === p.symbol}>
                                        <For each={p.lots}>{lot =>
                                            <tr class="lot-row">
                                                <td class="muted">{date(lot.date)}</td>
                                                <td class="num mono">{number(lot.qty, 4)}</td>
                                                <td class="num mono">{money(lot.price, lot.currency)}</td>
                                                <td />
                                                <td class="num mono">{money(lot.qty * p.price, lot.currency)}</td>
                                                <td class={`num mono ${trend(p.price - lot.price)}`}>{pct((p.price - lot.price) / lot.price * 100)}</td>
                                                <td><button class="link danger" onClick={() => props.removeLot(lot.id)}>Remove</button></td>
                                            </tr>
                                        }</For>
                                    </Show>
                                </>}</For>
                            </tbody>
                        </table>
                    </div>
                </Show>
            </Show>

            <Show when={tab() === "watchlist"}>
                <Show when={props.state.watchlist.length} fallback={<p class="muted pad">Your watchlist is empty. Star a row in the explorer or press <b>Watch</b> on a quote.</p>}>
                    <div class="table-wrap">
                        <table class="table">
                            <thead><tr><th /><th>Symbol</th><th class="num">Last</th><th class="num">Day</th><th>1 month</th></tr></thead>
                            <tbody>
                                <For each={props.state.watchlist}>{w => {
                                    const q = () => quotes()[w.symbol];
                                    return (
                                        <tr onClick={() => props.select(w.symbol, w.name)}>
                                            <td><button class="star on" aria-label={`Remove ${w.symbol} from watchlist`} onClick={e => { e.stopPropagation(); props.toggleWatch(w.symbol); }}>★</button></td>
                                            <td><b class="mono">{w.symbol}</b><div class="muted small ellipsis">{w.name}</div></td>
                                            <td class="num mono">{number(q()?.price)}</td>
                                            <td class={`num mono ${trend(q()?.changePct)}`}>{pct(q()?.changePct)}</td>
                                            <td><Sparkline values={q()?.closes || []} /></td>
                                        </tr>
                                    );
                                }}</For>
                            </tbody>
                        </table>
                    </div>
                </Show>
            </Show>
        </div>
    );
}
