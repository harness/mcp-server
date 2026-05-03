import type { AuditEvent, AuditSink } from "./types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("audit-manager");

/**
 * Fan-out orchestrator for audit events.
 * Distributes each event to all registered sinks. Sink failures are
 * logged but never propagate — audit must never break tool execution.
 */
export class AuditManager {
  private sinks: AuditSink[] = [];

  addSink(sink: AuditSink): void {
    this.sinks.push(sink);
    log.debug(`Audit sink registered: ${sink.name}`);
  }

  emit(event: AuditEvent): void {
    for (const sink of this.sinks) {
      try {
        const result = sink.emit(event);
        if (result && typeof (result as Promise<void>).catch === "function") {
          (result as Promise<void>).catch((err) => {
            log.warn(`Audit sink "${sink.name}" async emit failed`, { error: String(err) });
          });
        }
      } catch (err) {
        log.warn(`Audit sink "${sink.name}" emit failed`, { error: String(err) });
      }
    }
  }

  async flush(): Promise<void> {
    await Promise.allSettled(
      this.sinks
        .filter((s) => s.flush)
        .map(async (s) => {
          try {
            await s.flush!();
          } catch (err) {
            log.warn(`Audit sink "${s.name}" flush failed`, { error: String(err) });
          }
        }),
    );
  }

  async close(): Promise<void> {
    await this.flush();
    await Promise.allSettled(
      this.sinks
        .filter((s) => s.close)
        .map(async (s) => {
          try {
            await s.close!();
          } catch (err) {
            log.warn(`Audit sink "${s.name}" close failed`, { error: String(err) });
          }
        }),
    );
  }
}
