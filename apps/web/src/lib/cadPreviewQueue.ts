export type CadPreviewDispatch =
  | { status: "sent"; requestId: number }
  | { status: "queued" | "failed"; requestId: null };

export type CadPreviewSettle =
  | { status: "sent"; requestId: number }
  | { status: "idle" | "failed"; requestId: null };

export function createCadPreviewQueue<T>(send: (payload: T) => number | null) {
  let inFlightId: number | null = null;
  let queuedPayload: T | null = null;
  let hasQueuedPayload = false;

  const dispatch = (payload: T): CadPreviewDispatch => {
    const requestId = send(payload);
    if (requestId === null) {
      inFlightId = null;
      return { status: "failed", requestId: null };
    }
    inFlightId = requestId;
    return { status: "sent", requestId };
  };

  return {
    get inFlightId() { return inFlightId; },
    get queuedPayload() { return hasQueuedPayload ? queuedPayload : null; },
    request(payload: T): CadPreviewDispatch {
      if (inFlightId !== null) {
        queuedPayload = payload;
        hasQueuedPayload = true;
        return { status: "queued", requestId: null };
      }
      const result = dispatch(payload);
      return result.status === "sent" ? result : { status: "failed", requestId: null };
    },
    settle(requestId: number): CadPreviewSettle {
      if (inFlightId !== requestId) return { status: "idle", requestId: null };
      inFlightId = null;
      if (!hasQueuedPayload) return { status: "idle", requestId: null };
      const payload = queuedPayload as T;
      queuedPayload = null;
      hasQueuedPayload = false;
      const result = dispatch(payload);
      return result.status === "sent" ? result : { status: "failed", requestId: null };
    },
    reset() {
      inFlightId = null;
      queuedPayload = null;
      hasQueuedPayload = false;
    },
  };
}
