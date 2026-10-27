import { dayKey } from "../../lib/format.js";

/** Groups purchase lots into positions and values them at the latest quotes. */
export function positions(lots, quotes) {
    const bySymbol = new Map();
    for (const lot of lots) {
        const p = bySymbol.get(lot.symbol) || { symbol: lot.symbol, name: lot.name, currency: lot.currency, qty: 0, cost: 0, lots: [] };
        p.qty += lot.qty;
        p.cost += lot.qty * lot.price;
        p.lots.push(lot);
        bySymbol.set(lot.symbol, p);
    }
    return [...bySymbol.values()]
        .map(p => {
            const q = quotes[p.symbol];
            const value = q && Number.isFinite(q.price) ? p.qty * q.price : NaN;
            return {
                ...p,
                lots: p.lots.sort((a, b) => a.date - b.date),
                avg: p.cost / p.qty,
                price: q?.price,
                changePct: q?.changePct,
                value,
                pl: value - p.cost,
                plPct: (value - p.cost) / p.cost * 100
            };
        })
        .sort((a, b) => b.cost - a.cost);
}

// shortcut: amounts in different currencies are summed without FX conversion; add an FX service if the wallet goes multi-currency.
export function totals(rows) {
    // A position without a quote yet counts at cost, so it does not show up as a loss.
    const value = rows.reduce((sum, p) => sum + (Number.isFinite(p.value) ? p.value : p.cost), 0);
    const cost = rows.reduce((sum, p) => sum + p.cost, 0);
    return { value, cost, pl: value - cost, plPct: cost ? (value - cost) / cost * 100 : NaN };
}

/**
 * Daily wallet value and invested amount from the first purchase until today.
 * `histories` maps symbol -> [{ t, close }]. A missing close carries the last known one forward.
 */
export function valueSeries(lots, histories) {
    if (!lots.length) return [];
    const days = new Map();
    for (const [symbol, points] of Object.entries(histories)) {
        for (const p of points) {
            const key = dayKey(p.t);
            (days.get(key) || days.set(key, {}).get(key))[symbol] = p.close;
        }
    }
    const sorted = [...lots].sort((a, b) => a.date - b.date);
    const start = dayKey(sorted[0].date);
    const last = {}, held = {};
    let cost = 0, next = 0;
    const series = [];

    for (const key of [...days.keys()].sort()) {
        Object.assign(last, days.get(key));
        for (; next < sorted.length && dayKey(sorted[next].date) <= key; next++) {
            const lot = sorted[next];
            held[lot.symbol] = (held[lot.symbol] || 0) + lot.qty;
            last[lot.symbol] ??= lot.price;
            cost += lot.qty * lot.price;
        }
        if (key < start) continue;
        const value = Object.entries(held).reduce((sum, [symbol, qty]) => sum + qty * last[symbol], 0);
        series.push({ t: Date.parse(key), value, cost });
    }
    return series;
}
