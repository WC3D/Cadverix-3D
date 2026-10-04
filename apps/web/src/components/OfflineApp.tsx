"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RefreshCw, WifiOff, X } from "lucide-react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global { interface Window { cadverixInstallPrompt?: InstallPrompt | null } }
type OfflineStatus = { ready: boolean; progress?: number; total?: number; bytes?: number; error?: string };
const DISMISSED = "cadverix.offlineInstallDismissed";
const installedApp = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function useOfflineApp() {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<OfflineStatus>({ ready: false });
  const [updateReady, setUpdateReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [instructions, setInstructions] = useState("Use your browser’s Install app or Add to Home Screen option, if available.");
  const [attempt, setAttempt] = useState(0);
  const registration = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STATIC_EXPORT !== "true" || !window.isSecureContext || !("serviceWorker" in navigator) || "cadverixDesktop" in window) return;
    let alive = true;
    const cleanups: Array<() => void> = [];
    setEnabled(true);
    setInstalled(installedApp());
    try { setDismissed(localStorage.getItem(DISMISSED) === "1"); } catch { /* optional preference */ }
    if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)) setInstructions("In Safari, choose Share → Add to Home Screen.");
    else if (/Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent)) setInstructions("In Safari on Mac, choose File → Add to Dock when available.");

    const installAvailable = () => { if (alive) setPrompt(window.cadverixInstallPrompt ?? null); };
    const appInstalled = () => { if (alive) { setInstalled(true); setPrompt(null); } };
    installAvailable();
    window.addEventListener("cadverix-install-available", installAvailable);
    window.addEventListener("appinstalled", appInstalled);

    const probe = async () => {
      const reg = registration.current;
      if (!reg || !alive) return;
      setUpdateReady(Boolean(reg.waiting));
      if (!reg.active) return;
      const channel = new MessageChannel();
      const timer = window.setTimeout(() => channel.port1.close(), 5000);
      channel.port1.onmessage = (event: MessageEvent<OfflineStatus & { type: string }>) => {
        window.clearTimeout(timer); channel.port1.close();
        if (alive && event.data.type === "CADVERIX_OFFLINE") setStatus((previous) => ({ ...event.data, error: event.data.ready ? undefined : previous.error }));
      };
      reg.active.postMessage({ type: "CADVERIX_OFFLINE_STATUS" }, [channel.port2]);
      cleanups.push(() => { window.clearTimeout(timer); channel.port1.close(); });
    };
    const workerMessage = (event: MessageEvent<OfflineStatus & { type: string }>) => {
      if (!alive || event.data?.type !== "CADVERIX_OFFLINE") return;
      if (event.data.error) setStatus((previous) => ({ ...previous, error: event.data.error }));
      // A waiting update can be complete while the active version is not. Only
      // the active worker's status response can confirm current offline use.
      if (event.data.ready || registration.current?.active) { void probe(); return; }
      setStatus((previous) => ({ ...previous, ...event.data }));
    };
    const watch = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const change = () => {
        if (!alive) return;
        if (worker.state === "redundant" && !registration.current?.active) setStatus({ ready: false, error: "Offline setup did not finish. Check your connection and browser storage, then retry." });
        void probe();
      };
      worker.addEventListener("statechange", change);
      cleanups.push(() => worker.removeEventListener("statechange", change));
      change();
    };
    navigator.serviceWorker.addEventListener("message", workerMessage);
    navigator.serviceWorker.addEventListener("controllerchange", probe);
    window.addEventListener("online", probe);
    navigator.serviceWorker.getRegistration("/").then((existing) => {
      if (existing?.active?.scriptURL === new URL("/sw.js", window.location.origin).href) return existing;
      return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    }).then((reg) => {
      if (!alive) return;
      registration.current = reg;
      const found = () => watch(reg.installing);
      reg.addEventListener("updatefound", found);
      cleanups.push(() => reg.removeEventListener("updatefound", found));
      watch(reg.installing); watch(reg.waiting); watch(reg.active);
      void probe();
      if (attempt && reg.active) reg.active.postMessage({ type: "CADVERIX_OFFLINE_REPAIR" });
      void reg.update().catch(() => {}); // Offline startup must not require an update check.
    }).catch(() => {
      if (alive) setStatus({ ready: false, error: "Could not prepare offline use. Check your connection, HTTPS hosting, and browser storage." });
    });
    return () => {
      alive = false;
      for (const cleanup of cleanups) cleanup();
      window.removeEventListener("cadverix-install-available", installAvailable);
      window.removeEventListener("appinstalled", appInstalled);
      window.removeEventListener("online", probe);
      navigator.serviceWorker.removeEventListener("message", workerMessage);
      navigator.serviceWorker.removeEventListener("controllerchange", probe);
    };
  }, [attempt]);

  const install = useCallback(async () => {
    if (!prompt || !status.ready) return;
    try {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === "accepted") setInstalled(true);
    } catch { setInstructions("Use your browser’s Install app or Add to Home Screen option."); }
    finally { window.cadverixInstallPrompt = null; setPrompt(null); }
  }, [prompt, status.ready]);
  const dismiss = () => { setDismissed(true); try { localStorage.setItem(DISMISSED, "1"); } catch { /* optional preference */ } };
  return { enabled, status, updateReady, installed, dismissed, prompt, instructions, install, dismiss, retry: () => { setStatus({ ready: false }); setAttempt((value) => value + 1); }, expand: () => setDismissed(false) };
}

export function OfflineAppBanner({ app }: { app: ReturnType<typeof useOfflineApp> }) {
  if (!app.enabled) return null;
  if (app.dismissed && app.status.ready && !app.updateReady) return <button className="offline-app-chip" type="button" onClick={app.expand}><WifiOff size={15} />Offline ready · App options</button>;
  return <aside className="offline-app-banner" aria-label="Install Cadverix for offline use">
    <WifiOff size={25} aria-hidden="true" />
    <div className="offline-app-copy">
      <strong>{app.installed ? "Cadverix 3D offline app" : "Cadverix 3D as an app"}</strong>
      <span role="status" aria-label="Offline app status">{app.status.ready ? "Ready for offline use" : app.status.error ?? `Preparing offline files${app.status.total ? ` · ${app.status.progress ?? 0}/${app.status.total}` : "…"}${app.status.bytes ? ` (${Math.ceil(app.status.bytes / 1024 / 1024)} MB)` : ""}`}</span>
      {app.updateReady ? <span className="offline-app-update">Update ready. Finish your work, close all Cadverix tabs and app windows, then reopen to apply it.</span> : app.status.ready && !app.installed ? <span>{app.prompt ? "Install with its own icon and window, then launch without internet." : app.instructions}</span> : null}
      {!app.status.ready && !app.status.error ? <span>Keep this page open until the offline files finish downloading.</span> : null}
    </div>
    {app.prompt && !app.installed ? <button type="button" className="offline-app-install" disabled={!app.status.ready} onClick={() => void app.install()}><Download size={17} />Install now</button> : null}
    {!app.status.ready && (app.status.error || app.status.total) ? <button type="button" onClick={app.retry}><RefreshCw size={16} />Retry offline setup</button> : null}
    {app.status.ready && !app.updateReady ? <button type="button" aria-label="Dismiss install suggestion" onClick={app.dismiss}><X size={18} /></button> : null}
  </aside>;
}
