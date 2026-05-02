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
 * periodically. Failures are logged but never block tool execution.
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

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ events: batch }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        log.warn("Webhook returned non-OK status", {
          status: response.status,
          eventCount: batch.length,
        });
      }
    } catch (err) {
      log.warn("Webhook POST failed", {
        url: this.url,
        eventCount: batch.length,
        error: String(err),
      });
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
