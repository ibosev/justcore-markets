const formatters = new Map();
const nf = (key, options) => formatters.get(key) || formatters.set(key, new Intl.NumberFormat(undefined, options)).get(key);

export function money(value, currency = "USD") {
    if (!Number.isFinite(value)) return "—";
    const digits = Math.abs(value) < 10 ? 4 : 2;
    try {
        return nf(currency + digits, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: digits }).format(value);
    } catch {
        return nf("n" + digits, { maximumFractionDigits: digits }).format(value);
    }
}

export const number = (value, digits = 2) => Number.isFinite(value) ? nf("n" + digits, { maximumFractionDigits: digits }).format(value) : "—";

export const compact = value => Number.isFinite(value) ? nf("c", { notation: "compact", maximumFractionDigits: 1 }).format(value) : "—";

export const pct = value => Number.isFinite(value) ? `${value > 0 ? "+" : ""}${value.toFixed(2)}%` : "—";

export const signed = (value, currency) => Number.isFinite(value) ? (value > 0 ? "+" : "") + money(value, currency) : "—";

export const trend = value => !Number.isFinite(value) || value === 0 ? "flat" : value > 0 ? "up" : "down";

export const date = ms => new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export const dateTime = ms => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** yyyy-mm-dd in UTC, the form <input type=date> uses and the key purchases are grouped by. */
export const dayKey = ms => new Date(ms).toISOString().slice(0, 10);
