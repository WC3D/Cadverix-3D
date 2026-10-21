import { createLocalId } from "@/lib/localIds";

export type CustomShape = { id: string; name: string; bytes: Uint8Array; createdAt: number };
export type CustomShapeInfo = Omit<CustomShape, "bytes">;
export const MAX_CUSTOM_SHAPE_BYTES = 16 * 1024 * 1024;
const MAX_LIBRARY_BYTES = 128 * 1024 * 1024;

function openLibrary() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("cadverix.customShapes", 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("shapes", { keyPath: "id" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function listCustomShapes(): Promise<CustomShapeInfo[]> {
  const db = await openLibrary();
  try {
    return await new Promise((resolve, reject) => {
      const metadata: CustomShapeInfo[] = [];
      const request = db.transaction("shapes", "readonly").objectStore("shapes").openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { resolve(metadata); return; }
        const record = cursor.value as CustomShape;
        metadata.push({ id: record.id, name: record.name, createdAt: record.createdAt });
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function loadCustomShape(id: string): Promise<Uint8Array> {
  const db = await openLibrary();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("shapes", "readonly").objectStore("shapes").get(id);
      request.onsuccess = () => request.result?.bytes instanceof Uint8Array ? resolve(request.result.bytes) : reject(new Error("This reusable shape is unavailable"));
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function saveCustomShape(name: string, bytes: Uint8Array) {
  name = name.trim();
  if (!name || name.length > 120) throw new Error("Choose a name of 1–120 characters");
  if (!bytes.byteLength || bytes.byteLength > MAX_CUSTOM_SHAPE_BYTES) throw new Error("Reusable shapes are limited to 16 MB each");
  const record: CustomShape = { id: createLocalId("custom-shape"), name, bytes, createdAt: Date.now() };
  const db = await openLibrary();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("shapes", "readwrite"), store = transaction.objectStore("shapes");
      const request = store.openCursor();
      let failure: Error | null = null;
      let totalBytes = bytes.byteLength;
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { store.put(record); return; }
        totalBytes += (cursor.value as CustomShape).bytes.byteLength;
        if (totalBytes > MAX_LIBRARY_BYTES) { failure = new Error("The reusable-shape library is full (128 MB)"); transaction.abort(); return; }
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(failure ?? transaction.error ?? new Error("Could not save reusable shape"));
    });
    return record;
  } finally { db.close(); }
}
export async function deleteCustomShape(id: string) {
  const db = await openLibrary();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("shapes", "readwrite"); transaction.objectStore("shapes").delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error("Could not delete reusable shape"));
    });
  } finally { db.close(); }
}
