# justcore markets

A stocks and ETFs explorer built from five justcore modules, each in a different stack, running in one core:

| Module | Framework | Does |
|---|---|---|
| `ticker` | Vanilla JS | Indices, gold, oil, FX and bitcoin, refreshed every minute |
| `explorer` | React | All ~13k US-listed stocks and ETFs (filter by exchange and type), plus worldwide search |
| `quote` | Svelte 5 | Quote, price history chart (1D…MAX), watch button, record a purchase on any past date |
| `portfolio` | SolidJS | Wallet and watchlist saved in IndexedDB: positions, P/L, wallet value over time, sparklines |
| `inspector` | Vanilla JS | Live view of every message on the bus |

## Run

```sh
npm install
npm run dev      # http://localhost:5180
npm test         # parsing and wallet math
npm run build && npm run preview   # http://localhost:5181
```

justcore is installed from [ibosev/justcore](https://github.com/ibosev/justcore) on GitHub.

## How it fits together

- **Modules never import each other.** They talk over the message bus:
  `symbol.selected`, `watchlist.toggle`, `lot.add`, `portfolio.requested` and `portfolio.changed`.
- **The portfolio module owns the browser database.** Others ask it for changes and learn about them from `portfolio.changed`, so stopping it leaves the rest running.
- **Extensions:** `market-data` registers the shared, cached `market` service; `bus-log` plugs into the `onMessagePublish` hook to record traffic for the inspector.
- **The shell** (`src/main.js`) keeps the selected symbol in the URL hash and puts start/stop switches for each module in the header.

## Data

- [Yahoo Finance](https://finance.yahoo.com) chart, spark and search endpoints: quotes, history and worldwide search. Free, no key.
- [Nasdaq Trader symbol directory](https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs): every US listing with its exchange and ETF flag.

Neither sends CORS headers, so `vite.config.js` forwards `/api/yahoo` and `/api/nasdaq` to them from the dev and preview servers. There is no backend code. A static host needs the same two pass-through rules.
Data is delayed and unofficial, for demonstration only.
