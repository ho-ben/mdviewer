export type StoredDocument = {
  id: string;
  source: string;
  name: string;
  kind: string;
  scrollY: number;
};

export type StoredSession = {
  documents: StoredDocument[];
  activeDocumentId: string;
  nextDocumentId: number;
};

const databaseName = "mdviewer-local-session";
const storeName = "session";
const sessionKey = "open-documents";

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) {
          request.result.createObjectStore(storeName, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open local document storage"));
    });
  }
  return databasePromise;
}

export async function loadStoredSession(): Promise<StoredSession | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(sessionKey);
    request.onsuccess = () => resolve(request.result?.value as StoredSession | undefined);
    request.onerror = () => reject(request.error ?? new Error("Could not read the local document session"));
  });
}

export async function saveStoredSession(value: StoredSession): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put({ key: sessionKey, value });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the local document session"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Saving the local document session was interrupted"));
  });
}
