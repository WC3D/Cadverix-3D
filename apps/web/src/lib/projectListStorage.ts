// Adapted from henmedia/layerling designListStorage.ts (AGPL-3.0), f3092321.
export function writeProjectList(storage: Pick<Storage, "setItem">, key: string, serialized: string) {
  // A replacing write already frees the old value; deleting it first risks losing the list.
  storage.setItem(key, serialized);
}

export function projectListWithoutPictures<T extends { thumbnailUrl?: string | null }>(projects: T[]): T[] {
  return projects.map((project) => project.thumbnailUrl?.startsWith("data:") ? { ...project, thumbnailUrl: null } : project);
}

function openThumbnails() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("cadverix.projectThumbnails", 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("pictures"); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeProjectPictures(projects: Array<{ id: string; thumbnailUrl?: string | null }>) {
  const pictures = projects.filter((project) => project.thumbnailUrl?.startsWith("data:"));
  if (!pictures.length) return;
  const db = await openThumbnails();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("pictures", "readwrite");
      for (const project of pictures) transaction.objectStore("pictures").put(project.thumbnailUrl, project.id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error("Could not save project pictures"));
    });
  } finally { db.close(); }
}

export async function loadProjectPictures(ids: string[]) {
  const db = await openThumbnails();
  try {
    return await new Promise<Map<string, string>>((resolve, reject) => {
      const pictures = new Map<string, string>();
      const transaction = db.transaction("pictures", "readonly");
      for (const id of ids) {
        const request = transaction.objectStore("pictures").get(id);
        request.onsuccess = () => { if (typeof request.result === "string") pictures.set(id, request.result); };
      }
      transaction.oncomplete = () => resolve(pictures);
      transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error("Could not load project pictures"));
    });
  } finally { db.close(); }
}

export async function deleteProjectPicture(id: string) {
  const db = await openThumbnails();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("pictures", "readwrite"); transaction.objectStore("pictures").delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove project picture"));
    });
  } finally { db.close(); }
}
