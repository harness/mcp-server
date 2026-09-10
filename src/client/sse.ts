import { HarnessApiError } from "../utils/errors.js";
import type { JsonEventStreamLimits } from "./types.js";

export function assertJsonEventStreamLimits(limits: JsonEventStreamLimits | undefined): asserts limits is JsonEventStreamLimits {
  if (!limits || ![limits.maxEvents, limits.durationMs, limits.maxBytes].every(value => Number.isSafeInteger(value) && value > 0)
      || limits.durationMs > 2_147_483_647) {
    throw new Error("SSE requires explicit positive integer maxEvents, durationMs, and maxBytes limits; durationMs must fit a timer.");
  }
}

export interface JsonEventBatch {
  events: unknown[];
  stop_reason: "end" | "event_limit" | "duration_limit";
}

/** Read a finite batch of JSON data events; this is not a reconnecting EventSource. */
export async function readJsonEventStream(
  response: Response,
  signal: AbortSignal | undefined,
  limits: JsonEventStreamLimits,
): Promise<JsonEventBatch> {
  assertJsonEventStreamLimits(limits);
  if (response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "text/event-stream") {
    void response.body?.cancel().catch(() => {});
    throw new HarnessApiError("Expected a text/event-stream response", 502);
  }
  if (!response.body) throw new HarnessApiError("Event stream has no response body", 502);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: unknown[] = [];
  let pending = "";
  let dataLines: string[] = [];
  let bytes = 0;
  let stop: (reason: "duration_limit" | "cancelled") => void = () => {};
  const stopped = new Promise<"duration_limit" | "cancelled">((resolve) => { stop = resolve; });
  const timer = setTimeout(() => stop("duration_limit"), limits.durationMs);
  const onAbort = () => stop("cancelled");
  signal?.addEventListener("abort", onAbort, { once: true });

  function processLine(line: string): void {
    if (line === "") {
      if (dataLines.length > 0) {
        const data = dataLines.join("\n");
        dataLines = [];
        if (data === "") return;
        try {
          events.push(JSON.parse(data));
        } catch (cause) {
          // Do not echo event contents: streams may contain logs or signed URLs.
          throw new HarnessApiError("Event stream contains invalid JSON data", 502, undefined, undefined, cause);
        }
      }
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") dataLines.push(value);
  }

  try {
    while (true) {
      if (signal?.aborted) throw new HarnessApiError("Request cancelled", 499);
      const chunk = await Promise.race([reader.read(), stopped]);
      if (chunk === "cancelled" || signal?.aborted) throw new HarnessApiError("Request cancelled", 499);
      if (chunk === "duration_limit") return { events, stop_reason: chunk };
      if (!chunk.done) {
        bytes += chunk.value.byteLength;
        if (bytes > limits.maxBytes) throw new HarnessApiError(`Event stream exceeded the ${limits.maxBytes} byte batch size limit`, 502);
      }
      pending += decoder.decode(chunk.value, { stream: !chunk.done });
      while (true) {
        const end = pending.search(/[\r\n]/);
        if (end < 0) break;
        // A CR at a chunk boundary may be the first half of CRLF.
        if (!chunk.done && pending[end] === "\r" && end === pending.length - 1) break;
        const line = pending.slice(0, end);
        const width = pending[end] === "\r" && pending[end + 1] === "\n" ? 2 : 1;
        pending = pending.slice(end + width);
        processLine(line);
        if (events.length >= limits.maxEvents) return { events, stop_reason: "event_limit" };
      }
      // SSE dispatch requires a blank line; an unterminated final event is discarded.
      if (chunk.done) return { events, stop_reason: "end" };
    }
  } catch (cause) {
    if (cause instanceof HarnessApiError) throw cause;
    // A broken stream must not become a retried HTTP timeout: diffs have no replay cursor.
    throw new HarnessApiError(signal?.aborted ? "Request cancelled" : "Event stream read failed", signal?.aborted ? 499 : 502, undefined, undefined, cause);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    // Cancellation is best effort; slow source cleanup must not extend the batch deadline.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
