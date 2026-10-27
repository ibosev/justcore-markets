/**
 * Scales a series into an SVG viewBox. X is by index, not time, the way trading charts skip
 * nights and weekends. `domain` lets two series share one scale. Each framework renders the paths its own way.
 */
export function plot(values, width, height, { pad = 4, domain = values } = {}) {
    const finite = domain.filter(Number.isFinite);
    const min = Math.min(...finite), max = Math.max(...finite);
    const span = max - min || 1;
    const x = i => values.length < 2 ? width / 2 : (i / (values.length - 1)) * width;
    const y = v => pad + (1 - (v - min) / span) * (height - 2 * pad);
    const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    return {
        min, max, x, y, line,
        area: values.length ? `${line}L${x(values.length - 1).toFixed(1)},${height}L0,${height}Z` : ""
    };
}

/** Index of the point closest in time to t (points sorted by t). */
export function nearestIndex(points, t) {
    let lo = 0, hi = points.length - 1;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (points[mid].t < t) lo = mid + 1; else hi = mid;
    }
    return lo > 0 && t - points[lo - 1].t < points[lo].t - t ? lo - 1 : lo;
}
