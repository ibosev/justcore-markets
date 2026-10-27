<script>
    import { untrack } from "svelte";
    import { nearestIndex, plot } from "../../lib/chart.js";
    import { compact, date, dateTime, dayKey, money, number, pct, signed, trend } from "../../lib/format.js";
    import { RANGE_NAMES } from "../../lib/market.js";

    let { market, view, onToggleWatch, onAddLot } = $props();

    const W = 640, H = 220;
    let range = $state("1Y");
    let data = $state(null);
    let error = $state(null);
    let loading = $state(false);
    let hover = $state(null);

    $effect(() => {
        const symbol = view.symbol, r = range;
        if (!symbol) return;
        let current = true;
        loading = true;
        error = null;
        market.history(symbol, r).then(
            d => { if (current) { data = d; loading = false; } },
            e => { if (current) { data = null; error = e.message; loading = false; } }
        );
        return () => { current = false; };
    });

    const points = $derived(data?.points ?? []);
    const chart = $derived(plot(points.map(p => p.close), W, H, { pad: 10 }));
    const base = $derived(data?.previousClose ?? points[0]?.close);
    const rangeChange = $derived(points.length ? points.at(-1).close - base : NaN);
    const rangeChangePct = $derived(rangeChange / base * 100);
    const watched = $derived(!!data && view.watchlist.includes(data.symbol));
    const markers = $derived(points.length < 2 ? [] : view.lots
        .filter(l => l.symbol === data.symbol && l.date >= points[0].t - 86400000)
        .map(l => ({ ...l, i: nearestIndex(points, l.date) })));
    const hovered = $derived(hover === null ? null : points[hover]);
    const intraday = $derived(range === "1D" || range === "5D");

    function track(event) {
        const rect = event.currentTarget.getBoundingClientRect();
        hover = Math.max(0, Math.min(points.length - 1, Math.round((event.clientX - rect.left) / rect.width * (points.length - 1))));
    }

    // Record a purchase: the price defaults to that day's close.
    let buyDate = $state(dayKey(Date.now()));
    let qty = $state(1);
    let price = $state("");
    let hint = $state("");

    async function prefill() {
        const symbol = data?.symbol, t = Date.parse(buyDate);
        if (!symbol || !Number.isFinite(t)) return;
        hint = "Looking up that day's close…";
        try {
            const point = await market.closeOn(symbol, t);
            if (symbol !== data?.symbol) return;
            const value = point?.close ?? data.price;
            price = value.toFixed(value < 10 ? 4 : 2);
            hint = point ? `Close on ${date(point.t)}` : "Latest price";
        } catch {
            hint = "No close found, enter the price you paid";
        }
    }

    let prefilledFor;
    $effect(() => {
        const symbol = data?.symbol;
        if (symbol && symbol !== prefilledFor) {
            prefilledFor = symbol;
            untrack(prefill);
        }
    });

    function addLot(event) {
        event.preventDefault();
        const lot = { symbol: data.symbol, name: data.name, currency: data.currency, date: Date.parse(buyDate), qty: Number(qty), price: Number(price) };
        if (!(lot.qty > 0) || !(lot.price >= 0) || !Number.isFinite(lot.date) || lot.date > Date.now()) {
            hint = "Enter a past date, a quantity above zero and a price";
            return;
        }
        onAddLot(lot);
        hint = `Added ${number(lot.qty, 4)} × ${lot.symbol} to your wallet`;
    }
</script>

<div class="quote">
    {#if !data && loading}
        <p class="muted">Loading {view.symbol}…</p>
    {:else if !data}
        <p class="error">{error || "Pick a symbol from the explorer."}</p>
    {:else}
        <header class="quote-head">
            <div>
                <div class="quote-symbol">
                    <span class="mono">{data.symbol}</span>
                    <button class="star {watched ? 'on' : ''}" aria-pressed={watched} onclick={() => onToggleWatch(data.symbol, data.name)}>
                        ★ {watched ? "Watching" : "Watch"}
                    </button>
                </div>
                <div class="quote-name">{data.name}</div>
                <div class="muted small">{data.exchange} · {data.type} · {data.currency}</div>
            </div>
            <div class="quote-price">
                <div class="price mono">{money(data.price, data.currency)}</div>
                <div class="{trend(data.dayChangePct)} mono">{pct(data.dayChangePct)} today</div>
                <div class="{trend(rangeChange)} mono small">{signed(rangeChange, data.currency)} ({pct(rangeChangePct)}) · {range}</div>
            </div>
        </header>

        {#if error}<p class="error">{error}</p>{/if}

        <div class="segmented" role="tablist" aria-label="Range">
            {#each RANGE_NAMES as name}
                <button role="tab" aria-selected={range === name} onclick={() => (range = name)}>{name}</button>
            {/each}
        </div>

        <div class="chart" class:is-loading={loading}>
            {#if points.length > 1}
                <svg class={trend(rangeChange)} viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img"
                     aria-label="{data.symbol} closing prices, {range}"
                     onpointermove={track} onpointerleave={() => (hover = null)}>
                    <defs>
                        <linearGradient id="quote-fill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0" stop-color="currentColor" stop-opacity="0.25" />
                            <stop offset="1" stop-color="currentColor" stop-opacity="0" />
                        </linearGradient>
                    </defs>
                    <path d={chart.area} fill="url(#quote-fill)" />
                    <path d={chart.line} fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke" />
                    {#each markers as m (m.id)}
                        <line class="buy-line" x1={chart.x(m.i)} x2={chart.x(m.i)} y1="0" y2={H} vector-effect="non-scaling-stroke" />
                        <circle class="buy-dot" cx={chart.x(m.i)} cy={chart.y(m.price)} r="4"><title>Bought {number(m.qty, 4)} @ {money(m.price, m.currency)} on {date(m.date)}</title></circle>
                    {/each}
                    {#if hovered}
                        <line class="crosshair" x1={chart.x(hover)} x2={chart.x(hover)} y1="0" y2={H} vector-effect="non-scaling-stroke" />
                    {/if}
                </svg>
                <div class="chart-axis mono small muted">
                    <span>{money(chart.max, data.currency)}</span>
                    <span>{money(chart.min, data.currency)}</span>
                </div>
                <div class="chart-readout mono small">
                    {#if hovered}
                        {intraday ? dateTime(hovered.t) : date(hovered.t)} · <b>{money(hovered.close, data.currency)}</b>
                    {:else}
                        {date(points[0].t)} – {date(points.at(-1).t)}{markers.length ? ` · ${markers.length} purchase${markers.length > 1 ? "s" : ""} marked` : ""}
                    {/if}
                </div>
            {:else}
                <p class="muted pad">No price history for this range.</p>
            {/if}
        </div>

        <dl class="stats">
            <div><dt>Day range</dt><dd class="mono">{number(data.dayLow)} – {number(data.dayHigh)}</dd></div>
            <div><dt>52-week range</dt><dd class="mono">{number(data.low52)} – {number(data.high52)}</dd></div>
            <div><dt>Volume</dt><dd class="mono">{compact(data.volume)}</dd></div>
            <div><dt>Start of {range}</dt><dd class="mono">{money(base, data.currency)}</dd></div>
        </dl>

        <form class="buy" onsubmit={addLot}>
            <strong>Record a purchase</strong>
            <label>Date <input type="date" bind:value={buyDate} max={dayKey(Date.now())} onchange={prefill} required /></label>
            <label>Quantity <input type="number" bind:value={qty} min="0" step="any" required /></label>
            <label>Price ({data.currency}) <input type="number" bind:value={price} min="0" step="any" required /></label>
            <button class="primary" type="submit">Add to wallet</button>
            <span class="muted small hint" aria-live="polite">{hint}</span>
        </form>
    {/if}
</div>

<style>
    .quote { display: flex; flex-direction: column; gap: 12px; }
    .quote-head { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .quote-symbol { display: flex; align-items: center; gap: 10px; font-size: 1.5rem; font-weight: 700; }
    .quote-name { font-weight: 500; }
    .quote-price { text-align: right; }
    .price { font-size: 1.6rem; font-weight: 700; }
    .chart { position: relative; color: var(--text); transition: opacity .2s; }
    .chart.is-loading { opacity: .5; }
    svg { width: 100%; height: 220px; display: block; cursor: crosshair; touch-action: none; }
    .chart-axis { position: absolute; inset: 0 0 auto auto; height: 220px; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; padding: 4px 0; text-align: right; }
    .chart-readout { min-height: 1.4em; margin-top: 4px; }
    .crosshair { stroke: var(--muted); stroke-dasharray: 3 3; }
    .buy-line { stroke: var(--accent); stroke-opacity: .35; }
    .buy-dot { fill: var(--accent); stroke: var(--bg); stroke-width: 2; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin: 0; }
    .stats div { background: var(--surface-2); border-radius: 8px; padding: 8px 10px; }
    dt { color: var(--muted); font-size: .75rem; }
    dd { margin: 2px 0 0; }
    .buy { display: flex; flex-wrap: wrap; align-items: end; gap: 10px; padding-top: 12px; border-top: 1px solid var(--border); }
    .buy strong { width: 100%; }
    .buy label { display: flex; flex-direction: column; gap: 4px; font-size: .8rem; color: var(--muted); }
    .buy input { width: 140px; }
    .hint { flex-basis: 100%; }
</style>
