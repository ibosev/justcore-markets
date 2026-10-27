/** Client for the free market data endpoints. Requests go through the dev server's /api pass-through. */

const EXCHANGES = { Q: "NASDAQ", A: "NYSE American", N: "NYSE", P: "NYSE Arca", Z: "Cboe BZX", V: "IEX", F: "TXSE" };

/** Yahoo spells class and preferred shares differently: BRK.B -> BRK-B, ABR$D -> ABR-PD. */
export const toYahooSymbol = symbol => symbol.replace(/\./g, "-").replace("$", "-P");

/** Parses Nasdaq Trader's pipe-delimited symbol directory (nasdaqlisted.txt or otherlisted.txt). */
export function parseListings(text) {
    const [header, ...rows] = text.trim().split(/\r?\n/);
    const cols = header.split("|");
    const at = name => cols.indexOf(name);
    const symbol = at("Symbol") >= 0 ? at("Symbol") : at("ACT Symbol");
    const name = at("Security Name"), etf = at("ETF"), test = at("Test Issue"), exchange = at("Exchange");

    return rows
        .map(row => row.split("|"))
        // The last row is "File Creation Time: ..."; test issues are not real securities.
        .filter(cells => cells.length === cols.length && cells[test] === "N")
        .map(cells => ({
            symbol: toYahooSymbol(cells[symbol]),
            name: cells[name].replace(/ - (Common Stock|Ordinary Shares?|Class [A-Z] .*)$| Common Stock$/i, "").trim(),
            exchange: exchange >= 0 ? EXCHANGES[cells[exchange]] || cells[exchange] : "NASDAQ",
            type: cells[etf] === "Y" ? "ETF" : "Stock"
        }));
}

/** Turns a Yahoo v8 chart response into a quote plus a close-price series. Throws on Yahoo errors. */
export function parseChart(json) {
    const result = json?.chart?.result?.[0];
    if (!result) {
        throw new Error(json?.chart?.error?.description || "No data for this symbol");
    }
    const m = result.meta;
    const closes = result.indicators?.quote?.[0]?.close || [];
    const points = (result.timestamp || [])
        .map((t, i) => ({ t: t * 1000, close: closes[i] }))
        .filter(p => Number.isFinite(p.close));
    const previousClose = m.chartPreviousClose ?? m.previousClose;
    return {
        symbol: m.symbol,
        name: m.longName || m.shortName || m.symbol,
        currency: m.currency || "USD",
        exchange: m.fullExchangeName || m.exchangeName,
        type: m.instrumentType,
        price: m.regularMarketPrice,
        dayChangePct: m.regularMarketChangePercent,
        previousClose,
        dayHigh: m.regularMarketDayHigh,
        dayLow: m.regularMarketDayLow,
        volume: m.regularMarketVolume,
        high52: m.fiftyTwoWeekHigh,
        low52: m.fiftyTwoWeekLow,
        points
    };
}

const RANGES = {
    "1D": "range=1d&interval=5m",
    "5D": "range=5d&interval=15m",
    "1M": "range=1mo&interval=1d",
    "6M": "range=6mo&interval=1d",
    "YTD": "range=ytd&interval=1d",
    "1Y": "range=1y&interval=1d",
    "5Y": "range=5y&interval=1wk",
    "MAX": "range=max&interval=1mo"
};
export const RANGE_NAMES = Object.keys(RANGES);

const DAY = 86400000;

export function createMarket(fetchImpl = (...args) => fetch(...args)) {
    const cache = new Map();

    // Concurrent callers share one request; failures are not cached so the next call retries.
    function get(url, ttl, parse) {
        const hit = cache.get(url);
        if (hit && Date.now() - hit.at < ttl) {
            return hit.promise;
        }
        const promise = fetchImpl(url)
            .then(res => res.ok || res.status === 404 ? (url.includes("/api/nasdaq/") ? res.text() : res.json()) : Promise.reject(new Error(`HTTP ${res.status}`)))
            .then(parse);
        promise.catch(() => cache.delete(url));
        cache.set(url, { at: Date.now(), promise });
        return promise;
    }

    const chart = (symbol, query, ttl) =>
        get(`/api/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?${query}&includePrePost=false`, ttl, parseChart);

    return {
        /** Every US-listed stock and ETF, ~12k rows. */
        listings() {
            const file = name => get(`/api/nasdaq/dynamic/SymDir/${name}`, 6 * 3600000, parseListings);
            return Promise.all([file("nasdaqlisted.txt"), file("otherlisted.txt")])
                .then(([a, b]) => a.concat(b).sort((x, y) => x.symbol.localeCompare(y.symbol)));
        },

        /** Worldwide symbol search. */
        search(query) {
            const url = `/api/yahoo/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=25&newsCount=0&listsCount=0`;
            return get(url, 300000, json => (json.quotes || [])
                .filter(q => q.symbol && q.quoteType !== "OPTION")
                .map(q => ({
                    symbol: q.symbol,
                    name: q.longname || q.shortname || q.symbol,
                    exchange: q.exchDisp || q.exchange,
                    type: q.typeDisp || q.quoteType
                })));
        },

        /** Quote and price history for one of {@link RANGE_NAMES}. */
        history(symbol, range = "1Y") {
            return chart(symbol, RANGES[range] || RANGES["1Y"], range === "1D" ? 60000 : 300000);
        },

        /** Daily closes from a date (ms) until now. */
        historySince(symbol, from) {
            const period1 = Math.floor((from - 7 * DAY) / 1000);
            return chart(symbol, `period1=${period1}&period2=${Math.floor(Date.now() / 1000)}&interval=1d`, 300000);
        },

        /** The first close on or after a date (ms), e.g. to prefill a purchase price. */
        closeOn(symbol, date) {
            const period1 = Math.floor(date / 1000);
            return chart(symbol, `period1=${period1}&period2=${period1 + 7 * 86400}&interval=1d`, 3600000)
                .then(h => h.points[0] || null);
        },

        /** Last price, day change and a one-month close series for many symbols at once. */
        quotes(symbols) {
            const chunks = [];
            for (let i = 0; i < symbols.length; i += 20) chunks.push(symbols.slice(i, i + 20));
            return Promise.all(chunks.map(chunk => get(
                `/api/yahoo/v8/finance/spark?symbols=${chunk.map(encodeURIComponent).join(",")}&range=1mo&interval=1d`,
                60000,
                json => json
            ))).then(results => {
                const quotes = {};
                for (const json of results) {
                    for (const s of Object.values(json || {})) {
                        quotes[s.symbol] = {
                            price: s.fulldayPrice ?? s.close?.at(-1),
                            change: s.fulldayChange,
                            changePct: s.fulldayChangePercent,
                            closes: (s.close || []).filter(Number.isFinite)
                        };
                    }
                }
                return quotes;
            });
        }
    };
}
