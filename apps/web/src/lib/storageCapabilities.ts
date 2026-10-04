export type StorageCapabilities = { sharedProjects: boolean; folders: boolean; versions: boolean; localSnapshots: boolean; backupDownload: boolean };
export const BROWSER_STORAGE_CAPABILITIES: StorageCapabilities = { sharedProjects: false, folders: false, versions: false, localSnapshots: true, backupDownload: true };
export function storageCapabilities(payload: unknown): StorageCapabilities {
  const data = payload as { enabled?: boolean; capabilities?: Partial<StorageCapabilities> } | null;
  return { ...BROWSER_STORAGE_CAPABILITIES, sharedProjects: data?.enabled === true, folders: data?.enabled === true && data.capabilities?.folders === true, versions: data?.enabled === true && data.capabilities?.versions === true };
}
