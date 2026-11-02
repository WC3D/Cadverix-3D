import { afterEach, describe, expect, it, vi } from "vitest";
import { modifierWorkerRequest } from "@/lib/modifierWorkerRequest";

const worker = () => ({ terminate: vi.fn(), postMessage: vi.fn(), onmessage: null, onerror: null }) as unknown as Worker;
afterEach(() => vi.useRealTimers());

describe("modifier worker lifecycle", () => {
  it("terminates after a successful response", async () => {
    const w = worker(), controller = new AbortController();
    const result = modifierWorkerRequest(w, { type: "test" }, controller.signal);
    w.onmessage!({ data: { meshes: [] } } as MessageEvent);
    await expect(result).resolves.toEqual({ meshes: [] });
    expect(w.terminate).toHaveBeenCalledOnce();
  });
  it("cancels a running job without accepting a result", async () => {
    const w = worker(), controller = new AbortController();
    const result = modifierWorkerRequest(w, {}, controller.signal);
    controller.abort();
    w.onmessage!({ data: { meshes: ["late"] } } as MessageEvent);
    await expect(result).rejects.toThrow("cancelled");
    expect(w.terminate).toHaveBeenCalledOnce();
  });
  it("does not send an already-cancelled job", async () => {
    const w = worker(), controller = new AbortController(); controller.abort();
    await expect(modifierWorkerRequest(w, {}, controller.signal)).rejects.toThrow("cancelled");
    expect(w.postMessage).not.toHaveBeenCalled(); expect(w.terminate).toHaveBeenCalledOnce();
  });
  it("terminates on failed message cloning", async () => {
    const w = worker(); vi.mocked(w.postMessage).mockImplementation(() => { throw new Error("Cannot clone geometry"); });
    await expect(modifierWorkerRequest(w, {}, new AbortController().signal)).rejects.toThrow("Cannot clone");
    expect(w.terminate).toHaveBeenCalledOnce();
  });
  it("bounds computation time and clears its timer", async () => {
    vi.useFakeTimers(); const w = worker();
    const result = modifierWorkerRequest(w, {}, new AbortController().signal);
    const rejected = expect(result).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(90_000); await rejected;
    expect(w.terminate).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
});
