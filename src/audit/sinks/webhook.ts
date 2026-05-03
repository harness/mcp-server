import type { AuditEvent, AuditSink } from "../types.js";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("audit-webhook");

export interface WebhookSinkOptions {
  url: string;
  token?: string;
  batchSize?: number;
  flushIntervalMs?: number;
}

/**
 * POSTs audit events to an HTTP endpoint. Events are batched and flushed
 * periodically. Delivery is best-effort: failed batches are re-enqueued once
 * (up to 5x batch capacity), then dropped with a warning. Failures never
 * block tool execution.
 */
export class WebhookSink implements AuditSink {
  readonly name = "webhook";

  private buffer: AuditEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly url: string;
  private readonly token?: string;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;

  constructor(options: WebhookSinkOptions) {
    this.url = options.url;
    this.token = options.token;
    this.batchSize = options.batchSize ?? 10;
    this.flushIntervalMs = options.flushIntervalMs ?? 5000;

    this.timer = setInterval(() => {
      this.flush().catch((err) => {
        log.warn("Periodic webhook flush failed", { error: String(err) });
      });
    }, this.flushIntervalMs);

    if (this.timer.unref) this.timer.unref();
  }

  emit(event: AuditEvent): void {
    this.buffer.push(event);
    if (this.buffer.length >= this.batchSize) {
      this.flush().catch((err) => {
        log.warn("Webhook batch flush failed", { error: String(err) });
      });
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    let delivered = false;
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ events: batch }),
        signal: AbortSignal.timeout(10_000),
      });
      delivered = response.ok;
      if (!response.ok) {
        log.warn("Webhook returned non-OK status", {
          status: response.status,
          eventCount: batch.length,
        });
      }
    } catch (err) {
      let host: string | undefined;
      try { host = new URL(this.url).origin; } catch { /* ignore */ }
      log.warn("Webhook POST failed", {
        ...(host ? { host } : {}),
        eventCount: batch.length,
        error: String(err),
      });
    }

    if (!delivered && this.buffer.length + batch.length <= this.batchSize * 5) {
      this.buffer.unshift(...batch);
    } else if (!delivered) {
      log.warn("Webhook buffer full, dropping failed batch", { eventCount: batch.length });
    }
  }

  async close(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }
}
