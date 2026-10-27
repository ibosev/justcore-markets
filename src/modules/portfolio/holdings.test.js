import assert from "node:assert/strict";
import { test } from "node:test";
import { positions, totals, valueSeries } from "./holdings.js";

const day = s => Date.parse(s);
const lots = [
    { id: 1, symbol: "AAA", name: "A", currency: "USD", date: day("2024-01-02"), qty: 2, price: 10 },
    { id: 2, symbol: "AAA", name: "A", currency: "USD", date: day("2024-01-04"), qty: 2, price: 20 },
    { id: 3, symbol: "BBB", name: "B", currency: "USD", date: day("2024-01-03"), qty: 1, price: 100 }
];

test("lots group into positions valued at the latest quote", () => {
    const rows = positions(lots, { AAA: { price: 25 }, BBB: { price: 90 } });
    const a = rows.find(r => r.symbol === "AAA");
    assert.equal(a.qty, 4);
    assert.equal(a.cost, 60);
    assert.equal(a.avg, 15);
    assert.equal(a.value, 100);
    assert.equal(a.pl, 40);
    assert.deepEqual(totals(rows), { value: 190, cost: 160, pl: 30, plPct: 18.75 });
});

test("a position without a quote counts at cost", () => {
    assert.equal(totals(positions(lots, {})).pl, 0);
});

test("value series holds each lot from its date and carries missing closes forward", () => {
    const series = valueSeries(lots, {
        AAA: [{ t: day("2024-01-01"), close: 9 }, { t: day("2024-01-02"), close: 10 }, { t: day("2024-01-03"), close: 12 }, { t: day("2024-01-04"), close: 20 }],
        BBB: [{ t: day("2024-01-03"), close: 100 }]
    });
    assert.deepEqual(series.map(p => [new Date(p.t).toISOString().slice(0, 10), p.value, p.cost]), [
        ["2024-01-02", 20, 20],
        ["2024-01-03", 2 * 12 + 100, 120],
        ["2024-01-04", 4 * 20 + 100, 160]
    ]);
    assert.deepEqual(valueSeries([], {}), []);
});
