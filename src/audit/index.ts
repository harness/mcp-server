import type { Config } from "../config.js";
import { AuditManager } from "./manager.js";
import { StderrSink } from "./sinks/stderr.js";
import { JsonlFileSink } from "./sinks/jsonl-file.js";
import { WebhookSink } from "./sinks/webhook.js";
import { OTelSink } from "./sinks/otel.js";
import { createLogger } from "../utils/logger.js";

export { AuditManager } from "./manager.js";
export type { AuditEvent, AuditContext, AuditSink, ConfirmationMethod } from "./types.js";

const log = createLogger("audit");

/**
 * Create an AuditManager with sinks enabled based on configuration.
 *
 * - StderrSink is always active
 * - JsonlFileSink activates when HARNESS_AUDIT_FILE is set
 * - WebhookSink activates when HARNESS_AUDIT_WEBHOOK_URL is set
 * - OTelSink activates when @opentelemetry/api is importable + OTEL endpoint is set
 */
export function createAuditManager(config: Config): AuditManager {
  const manager = new AuditManager();

  manager.addSink(new StderrSink());

  const auditFile = (config as Record<string, unknown>).HARNESS_AUDIT_FILE as string | undefined;
  if (auditFile) {
    manager.addSink(new JsonlFileSink(auditFile));
    log.info("JSONL audit file sink enabled", { path: auditFile });
  }

  const webhookUrl = (config as Record<string, unknown>).HARNESS_AUDIT_WEBHOOK_URL as string | undefined;
  if (webhookUrl) {
    const token = (config as Record<string, unknown>).HARNESS_AUDIT_WEBHOOK_TOKEN as string | undefined;
    const batchSize = (config as Record<string, unknown>).HARNESS_AUDIT_WEBHOOK_BATCH_SIZE as number | undefined;
    const flushMs = (config as Record<string, unknown>).HARNESS_AUDIT_WEBHOOK_FLUSH_MS as number | undefined;
    manager.addSink(new WebhookSink({
      url: webhookUrl,
      token,
      batchSize,
      flushIntervalMs: flushMs,
    }));
    log.info("Webhook audit sink enabled", { url: webhookUrl });
  }

  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    manager.addSink(new OTelSink());
    log.info("OTel audit sink enabled (pending @opentelemetry/api availability)");
  }

  return manager;
}
