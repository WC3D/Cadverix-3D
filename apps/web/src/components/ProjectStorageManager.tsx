"use client";
import { useEffect, useState } from "react";
import { currentProjectPackage, listProjectBackups, saveProjectBackup, type ProjectBackup } from "@/lib/projectBackups";
import { BROWSER_STORAGE_CAPABILITIES, storageCapabilities } from "@/lib/storageCapabilities";

type SharedFile = { fileName: string; name: string; revision: string; updatedAt: number; size: number };
function download(name: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/vnd.sketchforge.project+zip" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.hidden = true; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function ProjectStorageManager({ projects, onClose, onRestore, onOpenShared }: {
  projects: Array<{ id: string; name: string }>; onClose: () => void;
  onRestore: (file: File) => Promise<unknown>; onOpenShared: (project: SharedFile) => Promise<unknown>;
}) {
  const [capabilities, setCapabilities] = useState(BROWSER_STORAGE_CAPABILITIES);
  const [backups, setBackups] = useState<ProjectBackup[]>([]);
  const [folder, setFolder] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [destination, setDestination] = useState("");
  const [versions, setVersions] = useState<{ file: SharedFile; names: string[] } | null>(null);
  const [archives, setArchives] = useState<string[]>([]);
  const refresh = async () => {
    setBackups(await listProjectBackups());
    if (process.env.NEXT_PUBLIC_STATIC_EXPORT === "true") return;
    try {
      const response = await fetch(`/api/shared-projects?folder=${encodeURIComponent(folder)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not read storage");
      setCapabilities(storageCapabilities(payload)); setFolders(payload.folders ?? []); setFiles(payload.projects ?? []);
      if (payload.enabled && payload.capabilities?.versions) {
        const response = await fetch("/api/shared-projects?archives=1", { cache: "no-store" });
        if (response.ok) setArchives((await response.json()).archives ?? []);
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Shared storage unavailable"); }
  };
  useEffect(() => { void refresh().catch((error) => setNotice(String(error))); }, [folder]);
  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true); setNotice("");
    try { await operation(); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Storage operation failed"); }
    finally { setBusy(false); }
  };
  const change = async (action: string, path: string, file?: SharedFile) => {
    const response = await fetch("/api/shared-projects", { method: "PATCH", headers: { "Content-Type": "application/json", ...(file ? { "If-Match": `"${file.revision}"` } : {}) }, body: JSON.stringify({ action, path, destination }) });
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Storage change failed");
  };
  const restore = async (name: string, bytes: Uint8Array) => { await onRestore(new File([new Uint8Array(bytes)], name.endsWith(".skf") ? name : `${name}.skf`)); onClose(); };
  return <div className="workspace-modal" role="dialog" aria-modal="true" aria-label="Project storage and backups"><section className="storage-manager">
    <header><h2>Project storage & backups</h2><button type="button" onClick={onClose}>Close</button></header>
    <p>Modeling runs in your browser. Storage options below reflect this installation's capabilities.</p>
    <fieldset disabled={busy}><legend>Browser projects</legend>
      <p>Recovery snapshots: at most five per project, twenty total, 64 MB total. Automatic snapshots are spaced two minutes apart while editing. Download an SKF for an independent backup.</p>
      {projects.map((project) => <div className="storage-row" key={project.id}><span>{project.name}</span>
        <button type="button" onClick={() => void run(async () => download(`${project.name}.skf`, await currentProjectPackage(project.id)))}>Download backup</button>
        <button type="button" onClick={() => void run(async () => saveProjectBackup(project.id, project.name, await currentProjectPackage(project.id), true))}>Snapshot now</button>
        {capabilities.sharedProjects ? <button type="button" onClick={() => void run(async () => {
          const name = `${project.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")}.skf`;
          const response = await fetch(`/api/shared-projects?fileName=${encodeURIComponent(folder ? `${folder}/${name}` : name)}`, { method: "POST", headers: { "If-None-Match": "*" }, body: new Uint8Array(await currentProjectPackage(project.id)) });
          const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Upload failed");
        })}>Copy to folder</button> : null}
      </div>)}
    </fieldset>
    <fieldset disabled={busy}><legend>Local recovery snapshots</legend>
      {!backups.length ? <p>No snapshots yet. Open a project and make an edit, or choose Snapshot now.</p> : backups.map((backup) => <div className="storage-row" key={backup.id}><span>{backup.name} · {new Date(backup.createdAt).toLocaleString()}</span><button type="button" onClick={() => download(`${backup.name}.skf`, backup.bytes)}>Download</button><button type="button" onClick={() => void run(() => restore(backup.name, backup.bytes))}>Restore as copy</button></div>)}
    </fieldset>
    {capabilities.folders ? <fieldset disabled={busy}><legend>Filesystem project folders</legend>
      <p>/{folder} · Changes use revision checks. This is shared file storage, not simultaneous editing.</p>
      {capabilities.versions && archives.length ? <label>Version archives (including moved/deleted projects)<select aria-label="Project version archive" value="" onChange={(event) => { const fileName = event.target.value; if (fileName) void run(async () => { const response = await fetch(`/api/shared-projects?fileName=${encodeURIComponent(fileName)}&versions=1`); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setVersions({ file: { fileName, name: fileName, revision: "", updatedAt: 0, size: 0 }, names: payload.versions }); }); }}><option value="">Choose a project archive</option>{archives.map((file) => <option key={file} value={file}>{file}</option>)}</select></label> : null}
      <button type="button" disabled={!folder} onClick={() => { setFolder(folder.split("/").slice(0, -1).join("/")); setVersions(null); }}>Parent folder</button>
      <label>New folder name<input aria-label="New shared folder" value={folderName} onChange={(e) => setFolderName(e.target.value)} /></label><button type="button" onClick={() => void run(() => change("mkdir", folder ? `${folder}/${folderName}` : folderName))}>Create folder</button>
      {folders.map((path) => <button type="button" key={path} onClick={() => { setFolder(path); setVersions(null); }}>{path.split("/").at(-1)}/</button>)}
      <label>Move/copy destination (path including .skf)<input aria-label="Project destination path" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Parts/Bracket.skf" /></label>
      {files.map((file) => <div className="storage-row" key={file.fileName}><span>{file.fileName.split("/").at(-1)}</span><button type="button" onClick={() => void run(async () => { await onOpenShared(file); onClose(); })}>Open</button><button type="button" onClick={() => void run(() => change("move", file.fileName, file))}>Move</button><button type="button" onClick={() => void run(() => change("copy", file.fileName, file))}>Copy</button>{capabilities.versions ? <button type="button" onClick={() => void run(async () => {
        const response = await fetch(`/api/shared-projects?fileName=${encodeURIComponent(file.fileName)}&versions=1`); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setVersions({ file, names: payload.versions });
      })}>Versions</button> : null}</div>)}
      {versions ? <div><h3>Previous versions of {versions.file.name}</h3>{!versions.names.length ? <p>No earlier saves yet. Up to ten versions are retained before overwriting a file.</p> : versions.names.map((name) => <button type="button" key={name} onClick={() => void run(async () => { const response = await fetch(`/api/shared-projects?fileName=${encodeURIComponent(versions.file.fileName)}&backup=${encodeURIComponent(name)}`); if (!response.ok) throw new Error("Could not read backup"); await restore(versions.file.name, new Uint8Array(await response.arrayBuffer())); })}>Restore copy · {new Date(Number(name.split("-")[0])).toLocaleString()}</button>)}</div> : null}
    </fieldset> : <p>Filesystem sharing is unavailable here. Local snapshots and downloadable backups remain available; cloud sharing requires a configured storage API.</p>}
    <p role="status">{busy ? "Working…" : notice}</p>
  </section></div>;
}
