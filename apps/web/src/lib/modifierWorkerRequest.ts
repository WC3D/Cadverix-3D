// One worker per job bounds kernel memory and makes cancellation immediate.
export function modifierWorkerRequest<T>(worker: Worker, request: unknown, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error?: Error, result?: T) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer); signal.removeEventListener("abort", cancel); worker.terminate();
      if (error) reject(error); else resolve(result as T);
    };
    const cancel = () => finish(new Error("Modifier cancelled; original retained"));
    const timer = setTimeout(() => finish(new Error("Modifier timed out; original retained. Try a simpler body.")), 90_000);
    signal.addEventListener("abort", cancel, { once: true });
    worker.onerror = () => finish(new Error("Modifier worker failed; original retained"));
    worker.onmessage = (event: MessageEvent<T & { error?: string; type?: string; message?: string }>) => {
      if (event.data.error || event.data.type === "error") finish(new Error(event.data.error ?? event.data.message ?? "Modifier failed"));
      else finish(undefined, event.data);
    };
    if (signal.aborted) cancel();
    else {
      try { worker.postMessage(request); }
      catch (error) { finish(error instanceof Error ? error : new Error("Could not send modifier geometry to worker")); }
    }
  });
}
