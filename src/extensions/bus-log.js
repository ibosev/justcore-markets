/**
 * Plugs into the onMessagePublish hook and records every message on the bus,
 * so a module can show the traffic without any other module knowing about it.
 */
export const busLog = {
    name: "bus-log",
    install(core) {
        const entries = [];
        const listeners = new Set();

        core.serviceLocator.addService("busLog", () => ({
            entries: () => entries,
            subscribe(listener) {
                listeners.add(listener);
                return () => listeners.delete(listener);
            }
        }));

        return {
            onMessagePublish(next, message) {
                entries.unshift({ at: Date.now(), message });
                entries.length = Math.min(entries.length, 200);
                listeners.forEach(listener => listener(entries));
                return next();
            }
        };
    }
};
