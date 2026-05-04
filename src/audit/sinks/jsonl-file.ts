import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AuditEvent, AuditSink } from "../types.js";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("audit-jsonl");

/**
 * Appends audit events as NDJSON (one JSON object per line) to a file.
 * Enabled when HARNESS_AUDIT_FILE is set.
 */
export class JsonlFileSink implements AuditSink {
  readonly name = "jsonl-file";
  private dirEnsured = false;

  constructor(private readonly filePath: string) {}

  emit(event: AuditEvent): void {
    if (!this.dirEnsured) {
      try {
        mkdirSync(dirname(this.filePath), { recursive: true });
      } catch {
        // Directory may already exist
      }
      this.dirEnsured = true;
    }

    try {
      appendFileSync(this.filePath, JSON.stringify(event) + "\n");
    } catch (err) {
      log.warn("Failed to write audit event to file", {
        path: this.filePath,
        error: String(err),
      });
    }
  }
}
