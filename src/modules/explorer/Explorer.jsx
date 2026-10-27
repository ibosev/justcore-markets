import { useDeferredValue, useEffect, useMemo, useState } from "react";

const PAGE = 50;

export function Explorer({ market, selected, watched, select, toggleWatch }) {
    const [source, setSource] = useState("us");
    const [query, setQuery] = useState("");
    const [exchange, setExchange] = useState("");
    const [type, setType] = useState("");
    const [page, setPage] = useState(0);
    const [listings, setListings] = useState(null);
    const [world, setWorld] = useState({ query: "", rows: [], loading: false });
    const [error, setError] = useState(null);
    const deferredQuery = useDeferredValue(query.trim().toLowerCase());

    const loadListings = () => {
        setError(null);
        market.listings().then(setListings, err => setError(err.message));
    };
    useEffect(loadListings, [market]);

    useEffect(() => {
        const q = query.trim();
        if (source !== "world" || q.length < 1) return;
        let current = true;
        setWorld(w => ({ ...w, loading: true }));
        const timer = setTimeout(() => market.search(q).then(
            rows => current && setWorld({ query: q, rows, loading: false }),
            err => current && (setWorld({ query: q, rows: [], loading: false }), setError(err.message))
        ), 300);
        return () => { current = false; clearTimeout(timer); };
    }, [market, source, query]);

    const exchanges = useMemo(() => {
        const counts = {};
        for (const l of listings || []) counts[l.exchange] = (counts[l.exchange] || 0) + 1;
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [listings]);

    const filtered = useMemo(() => (listings || []).filter(l =>
        (!exchange || l.exchange === exchange) &&
        (!type || l.type === type) &&
        (!deferredQuery || l.symbol.toLowerCase().startsWith(deferredQuery) || l.name.toLowerCase().includes(deferredQuery))
    ), [listings, exchange, type, deferredQuery]);

    useEffect(() => setPage(0), [source, exchange, type, deferredQuery]);

    const rows = source === "us" ? filtered.slice(page * PAGE, (page + 1) * PAGE) : query.trim() ? world.rows : [];
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

    return (
        <div className="explorer">
            <div className="segmented" role="tablist">
                <button role="tab" aria-selected={source === "us"} onClick={() => setSource("us")}>US listings{listings && ` · ${listings.length.toLocaleString()}`}</button>
                <button role="tab" aria-selected={source === "world"} onClick={() => setSource("world")}>Worldwide search</button>
            </div>

            <div className="explorer-filters">
                <input
                    type="search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={source === "us" ? "Filter by symbol or name…" : "Search any market: VWCE, Siemens, 7203.T…"}
                    aria-label="Search symbols"
                />
                {source === "us" && <>
                    <select value={exchange} onChange={e => setExchange(e.target.value)} aria-label="Exchange">
                        <option value="">All exchanges</option>
                        {exchanges.map(([name, count]) => <option key={name} value={name}>{name} ({count.toLocaleString()})</option>)}
                    </select>
                    <select value={type} onChange={e => setType(e.target.value)} aria-label="Type">
                        <option value="">Stocks &amp; ETFs</option>
                        <option value="Stock">Stocks</option>
                        <option value="ETF">ETFs</option>
                    </select>
                </>}
            </div>

            {error && <p className="error">Could not load data: {error} <button className="link" onClick={loadListings}>Retry</button></p>}

            <div className="table-wrap">
                <table className="table">
                    <thead>
                        <tr><th aria-label="Watch" /><th>Symbol</th><th>Name</th><th>Exchange</th><th>Type</th></tr>
                    </thead>
                    <tbody>
                        {rows.map(row => (
                            <tr key={row.symbol} className={row.symbol === selected ? "is-selected" : ""} onClick={() => select(row.symbol, row.name)}>
                                <td>
                                    <button
                                        className={`star ${watched.has(row.symbol) ? "on" : ""}`}
                                        aria-label={`${watched.has(row.symbol) ? "Remove" : "Add"} ${row.symbol} ${watched.has(row.symbol) ? "from" : "to"} watchlist`}
                                        aria-pressed={watched.has(row.symbol)}
                                        onClick={e => { e.stopPropagation(); toggleWatch(row.symbol, row.name); }}
                                    >★</button>
                                </td>
                                <td className="mono strong">{row.symbol}</td>
                                <td className="ellipsis" title={row.name}>{row.name}</td>
                                <td className="muted nowrap">{row.exchange}</td>
                                <td><span className={`tag tag-${String(row.type).toLowerCase()}`}>{row.type}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {source === "us" && !listings && !error && <p className="muted pad">Loading every US listing…</p>}
                {source === "world" && !query.trim() && <p className="muted pad">Type to search stocks, ETFs, indices, funds and crypto on every exchange Yahoo covers.</p>}
                {source === "world" && world.loading && <p className="muted pad">Searching…</p>}
                {rows.length === 0 && (source === "us" ? listings : world.query && !world.loading) && <p className="muted pad">No matches.</p>}
            </div>

            {source === "us" && listings && (
                <div className="pager">
                    <span className="muted">
                        {filtered.length ? `${(page * PAGE + 1).toLocaleString()}–${Math.min((page + 1) * PAGE, filtered.length).toLocaleString()} of ${filtered.length.toLocaleString()}` : "0 results"}
                    </span>
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
                    <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>Next ›</button>
                </div>
            )}
        </div>
    );
}
