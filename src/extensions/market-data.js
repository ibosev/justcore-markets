import { createMarket } from "../lib/market.js";

/** Gives modules a shared, cached market data client: sandbox.getService("market"). */
export const marketData = {
    name: "market-data",
    install(core) {
        core.serviceLocator.addService("market", createMarket);
    }
};
