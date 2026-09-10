import { describe, it, expect, vi, afterEach } from "vitest";
import { readJsonEventStream } from "../../src/client/sse.js";

const limits = { maxEvents: 2, durationMs: 50, maxBytes: 1024 };
function stream(chunks: Uint8Array[], close = true) {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ start(controller) { chunks.forEach(c => controller.enqueue(c)); if (close) controller.close(); }, cancel });
  return { cancel, response: new Response(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8" } }) };
}
const bytes = (value: string) => new TextEncoder().encode(value);
afterEach(() => { vi.useRealTimers(); });

describe("bounded JSON SSE consumption", () => {
  it("handles UTF-8, BOM, CRLF split across chunks, comments, and multiline data", async () => {
    const raw = bytes('\uFEFF: comment\r\nevent: stage_updated\r\ndata: {"type":"stage_updated",\r\ndata: "payload":{"label":"café"},"at":"now"}\r\n\r\n');
    const { response } = stream(Array.from(raw, b => Uint8Array.of(b)));
    await expect(readJsonEventStream(response, undefined, limits)).resolves.toEqual({ events: [{ type: "stage_updated", payload: { label: "café" }, at: "now" }], stop_reason: "end" });
  });

  it("supports CR and LF lines and discards an unterminated final event", async () => {
    const { response } = stream([bytes('data: {"n":1}\r\rdata: {"n":2}\n')]);
    await expect(readJsonEventStream(response, undefined, limits)).resolves.toEqual({ events: [{ n: 1 }], stop_reason: "end" });
  });

  it("stops at the event limit even if the stream remains open", async () => {
    const { response, cancel } = stream([bytes('data: {"n":1}\n\ndata: {"n":2}\n\ndata: {"n":3}\n\n')], false);
    await expect(readJsonEventStream(response, undefined, limits)).resolves.toEqual({ events: [{ n: 1 }, { n: 2 }], stop_reason: "event_limit" });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each([{ chunks: [] }, { chunks: [bytes('data: {"n":1}\n\n')] }])("returns a partial batch at the time limit and cancels the reader", async ({ chunks }) => {
    vi.useFakeTimers();
    const { response, cancel } = stream(chunks, false);
    const result = readJsonEventStream(response, undefined, limits);
    await vi.advanceTimersByTimeAsync(50);
    expect(await result).toEqual({ events: chunks.length ? [{ n: 1 }] : [], stop_reason: "duration_limit" });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("cancels promptly on client disconnect and does not report a successful partial batch", async () => {
    const controller = new AbortController();
    const { response, cancel } = stream([], false);
    const result = readJsonEventStream(response, controller.signal, limits);
    const rejection = expect(result).rejects.toMatchObject({ statusCode: 499 });
    controller.abort();
    await rejection;
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("rejects an already-aborted request", async () => {
    const { response, cancel } = stream([], false);
    await expect(readJsonEventStream(response, AbortSignal.abort(), limits)).rejects.toMatchObject({ statusCode: 499 });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("bounds bytes even when there are no complete events", async () => {
    const { response, cancel } = stream([bytes(`: ${"x".repeat(1025)}`)], false);
    await expect(readJsonEventStream(response, undefined, limits)).rejects.toThrow("batch size limit");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid JSON without including its contents in the error", async () => {
    const { response, cancel } = stream([bytes('data: signed-url-secret\n\n')], false);
    await expect(readJsonEventStream(response, undefined, limits)).rejects.toMatchObject({ message: "Event stream contains invalid JSON data", statusCode: 502 });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("rejects an unexpected content type and cancels the body", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    await expect(readJsonEventStream(new Response(body, { headers: { "Content-Type": "application/json" } }), undefined, limits)).rejects.toThrow("text/event-stream");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("does not wait for slow stream cancellation after the batch deadline", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const body = new ReadableStream<Uint8Array>({ cancel });
    const result = readJsonEventStream(new Response(body, { headers: { "Content-Type": "text/event-stream" } }), undefined, limits);
    await vi.advanceTimersByTimeAsync(50);
    await expect(result).resolves.toEqual({ events: [], stop_reason: "duration_limit" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });
});
