import assert from "node:assert/strict";
import { test } from "node:test";
import { createMarket, parseChart, parseListings, toYahooSymbol } from "./market.js";

test("symbol directory rows become listings; test issues and the footer are dropped", () => {
    const other = [
        "ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol",
        "BRK.B|Berkshire Hathaway Inc. New Common Stock|N|BRK.B|N|40|N|BRK.B",
        "SPY|SPDR S&P 500 ETF Trust|P|SPY|Y|100|N|SPY",
        "ZZZTX|TXSE Test Stk 5 Common Stock|F|ZZZTX|N|40|Y|ZZZTX",
        "File Creation Time: 1026202614:01||||||"
    ].join("\n");
    assert.deepEqual(parseListings(other), [
        { symbol: "BRK-B", name: "Berkshire Hathaway Inc. New", exchange: "NYSE", type: "Stock" },
        { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", exchange: "NYSE Arca", type: "ETF" }
    ]);

    const nasdaq = "Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares\nAAPL|Apple Inc. - Common Stock|Q|N|N|100|N|N\n";
    assert.deepEqual(parseListings(nasdaq), [{ symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "Stock" }]);
    assert.equal(toYahooSymbol("ABR$D"), "ABR-PD");
});

test("chart responses drop empty closes and surface Yahoo errors", () => {
    const h = parseChart({ chart: { result: [{
        meta: { symbol: "AAPL", longName: "Apple Inc.", currency: "USD", regularMarketPrice: 3, chartPreviousClose: 1 },
        timestamp: [1, 2, 3],
        indicators: { quote: [{ close: [1, null, 3] }] }
    }] } });
    assert.deepEqual(h.points, [{ t: 1000, close: 1 }, { t: 3000, close: 3 }]);
    assert.equal(h.name, "Apple Inc.");
    assert.throws(() => parseChart({ chart: { result: null, error: { description: "No data found" } } }), /No data found/);
});

test("concurrent requests share one fetch and failures are retried", async () => {
    let calls = 0;
    const market = createMarket(async () => {
        calls++;
        if (calls === 1) throw new Error("offline");
        return { ok: true, json: async () => ({ AAPL: { symbol: "AAPL", fulldayPrice: 10, fulldayChangePercent: 1, close: [9, null, 10] } }) };
    });
    await assert.rejects(market.quotes(["AAPL"]), /offline/);
    const [a, b] = await Promise.all([market.quotes(["AAPL"]), market.quotes(["AAPL"])]);
    assert.equal(calls, 2);
    assert.deepEqual(a.AAPL, { price: 10, change: undefined, changePct: 1, closes: [9, 10] });
    assert.deepEqual(a, b);
});
