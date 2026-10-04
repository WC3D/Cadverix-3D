import { createLocalId } from "@/lib/localIds";
export type ProjectBackup = { id: string; projectId: string; name: string; createdAt: number; bytes: Uint8Array };
const DATABASE = "cadverix.projectBackups";
const MAX_BYTES = 64 * 1024 * 1024;
const lastSaved = new Map<string, number>();
function openBackups() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("snapshots", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function listProjectBackups(): Promise<ProjectBackup[]> {
  const db = await openBackups();
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction("snapshots").objectStore("snapshots").getAll();
    request.onsuccess = () => resolve((request.result as ProjectBackup[]).sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
export async function saveProjectBackup(projectId: string, name: string, bytes: Uint8Array, force = false) {
  const now = Date.now();
  if (!force && now - (lastSaved.get(projectId) ?? 0) < 120000) return;
  if (bytes.byteLength > MAX_BYTES) throw new Error("Project is too large for local snapshots. Download an SKF backup instead.");
  const db = await openBackups();
  try { await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("snapshots", "readwrite"), store = transaction.objectStore("snapshots");
    const request = store.getAll();
    request.onsuccess = () => {
      const previous = (request.result as ProjectBackup[]).sort((a, b) => b.createdAt - a.createdAt);
      let size = bytes.byteLength, count = 1, perProject = 1;
      for (const backup of previous) {
        if (count >= 20 || size + backup.bytes.byteLength > MAX_BYTES || (backup.projectId === projectId && perProject >= 5)) { store.delete(backup.id); continue; }
        size += backup.bytes.byteLength; count++; if (backup.projectId === projectId) perProject++;
      }
      store.put({ id: `${projectId}:${createLocalId("backup")}`, projectId, name, createdAt: now, bytes } satisfies ProjectBackup);
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error("Could not save local backup"));
  }); lastSaved.set(projectId, now); } finally { db.close(); }
}
export async function currentProjectPackage(id: string): Promise<Uint8Array> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("sketchForge.projectShapes"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  try { return await new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains("projectShapes")) { reject(new Error("Open and save the project first")); return; }
    const request = db.transaction("projectShapes").objectStore("projectShapes").get(id);
    request.onsuccess = () => request.result?.skfPackage ? resolve(request.result.skfPackage) : reject(new Error("Open and save the project first"));
    request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
