import type { AuditEvent, AuditSink } from "../types.js";
import { createLogger } from "../../utils/logger.js";

const auditLog = createLogger("audit");

/**
 * Emits audit events as structured JSON to stderr via the existing logger.
 * Always active — this is the baseline audit trail.
 */
export class StderrSink implements AuditSink {
  readonly name = "stderr";

  emit(event: AuditEvent): void {
    const { outcome, error, ...rest } = event;
    const data: Record<string, unknown> = { ...rest, outcome };
    if (error) data.error = error;

    if (outcome === "error") {
      auditLog.warn("audit", data);
    } else {
      auditLog.info("audit", data);
    }
  }
}
