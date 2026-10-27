/** The wallet's browser database (IndexedDB). Only the portfolio module talks to it. */

const request = req => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});

export async function openDb() {
    const open = indexedDB.open("justcore-markets", 1);
    open.onupgradeneeded = () => {
        open.result.createObjectStore("watchlist", { keyPath: "symbol" });
        open.result.createObjectStore("lots", { keyPath: "id", autoIncrement: true });
    };
    const db = await request(open);
    const store = (name, mode) => db.transaction(name, mode).objectStore(name);

    return {
        all: name => request(store(name, "readonly").getAll()),
        put: (name, value) => request(store(name, "readwrite").put(value)),
        delete: (name, key) => request(store(name, "readwrite").delete(key)),
        close: () => db.close()
    };
}
