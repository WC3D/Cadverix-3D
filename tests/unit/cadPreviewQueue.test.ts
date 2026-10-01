import { describe, expect, it } from "vitest";
import { createCadPreviewQueue } from "@/lib/cadPreviewQueue";

describe("CAD preview queue", () => {
  it("keeps one request in flight and only the newest waiting payload", () => {
    const sent: Array<{ amount: number }> = [];
    const queue = createCadPreviewQueue((payload: { amount: number }) => {
      sent.push(payload);
      return sent.length;
    });
    expect(queue.request({ amount: 1 }).status).toBe("sent");
    for (let amount = 2; amount <= 10; amount += 1) queue.request({ amount });
    expect(sent).toEqual([{ amount: 1 }]);
    expect(queue.queuedPayload).toEqual({ amount: 10 });
    expect(queue.settle(1)).toEqual({ status: "sent", requestId: 2 });
    expect(sent).toEqual([{ amount: 1 }, { amount: 10 }]);
  });

  it("ignores stale responses and clears queued work on reset", () => {
    const sent: number[] = [];
    const queue = createCadPreviewQueue((payload: number) => {
      sent.push(payload);
      return sent.length;
    });
    queue.request(1);
    queue.request(2);
    expect(queue.settle(99).status).toBe("idle");
    expect(queue.queuedPayload).toBe(2);
    queue.reset();
    expect(queue.settle(1).status).toBe("idle");
    expect(sent).toEqual([1]);
  });
});
