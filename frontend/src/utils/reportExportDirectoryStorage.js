const DB_NAME = "dev-productivity-platform";
const STORE_NAME = "file-handles";
const REPORTS_DIRECTORY_KEY = "reports-save-directory";

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function withStore(mode, handler) {
    if (!window.indexedDB) {
        return null;
    }

    const db = await openDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, mode);
            const store = transaction.objectStore(STORE_NAME);
            const result = handler(store, resolve, reject);

            transaction.oncomplete = () => {
                if (result !== undefined) {
                    resolve(result);
                }
            };
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally {
        db.close();
    }
}

export async function getStoredReportsSaveDirectoryHandle() {
    return withStore("readonly", (store, resolve) => {
        const request = store.get(REPORTS_DIRECTORY_KEY);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => resolve(null);
    });
}

export async function setStoredReportsSaveDirectoryHandle(handle) {
    await withStore("readwrite", (store) => {
        store.put(handle, REPORTS_DIRECTORY_KEY);
    });
}

export async function clearStoredReportsSaveDirectoryHandle() {
    await withStore("readwrite", (store) => {
        store.delete(REPORTS_DIRECTORY_KEY);
    });
}
