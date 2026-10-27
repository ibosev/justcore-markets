import { svelte } from "@sveltejs/vite-plugin-svelte";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// Yahoo Finance and Nasdaq Trader send no CORS headers, so the dev/preview server forwards
// /api/* to them. Our app has no backend code: this is only a pass-through.
// Yahoo answers 429 to full browser user agents without its cookies, so send a plain one.
const passThrough = target => ({
    target,
    changeOrigin: true,
    rewrite: path => path.replace(/^\/api\/[^/]+/, ""),
    configure: proxy => proxy.on("proxyReq", req => {
        for (const header of ["origin", "referer", "cookie"]) req.removeHeader(header);
        req.setHeader("user-agent", "Mozilla/5.0");
    })
});
const proxy = {
    "/api/yahoo": passThrough("https://query1.finance.yahoo.com"),
    "/api/nasdaq": passThrough("https://www.nasdaqtrader.com")
};

export default defineConfig({
    // React and Solid both compile .jsx, so each plugin only sees its own module's folder.
    plugins: [
        react({ include: /\/modules\/explorer\/.*\.jsx$/ }),
        solid({ include: /\/modules\/portfolio\/.*\.jsx$/ }),
        svelte()
    ],
    server: { port: 5180, proxy },
    preview: { port: 5181, proxy }
});
