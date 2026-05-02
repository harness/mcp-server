import type { AuditEvent, AuditSink } from "../types.js";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("audit-otel");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let otelApi: any = null;
let otelResolved = false;

async function resolveOtelApi(): Promise<unknown> {
  if (otelResolved) return otelApi;
  otelResolved = true;
  try {
    // Dynamic import with variable to prevent TS from resolving the module statically
    const moduleName = "@opentelemetry/api";
    otelApi = await (Function("m", "return import(m)")(moduleName) as Promise<unknown>);
    return otelApi;
  } catch {
    return null;
  }
}

/**
 * Emits audit events as span events on the active OpenTelemetry span.
 * Activates only when @opentelemetry/api is importable AND
 * OTEL_EXPORTER_OTLP_ENDPOINT is set. Zero footprint otherwise.
 */
export class OTelSink implements AuditSink {
  readonly name = "otel";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private api: any = null;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = resolveOtelApi().then((api) => {
      this.api = api;
      if (api) {
        log.debug("OTel audit sink activated");
      } else {
        log.debug("@opentelemetry/api not available, OTel audit sink inactive");
      }
    });
  }

  emit(event: AuditEvent): void {
    if (!this.api) return;

    const span = this.api.trace?.getActiveSpan?.();
    if (!span) return;

    span.addEvent("audit", {
      "audit.event_id": event.event_id,
      "audit.tool": event.tool,
      "audit.operation": event.operation,
      "audit.resource_type": event.resource_type,
      "audit.outcome": event.outcome,
      "audit.risk": event.risk,
      "audit.duration_ms": event.duration_ms,
      ...(event.resource_id ? { "audit.resource_id": event.resource_id } : {}),
      ...(event.action ? { "audit.action": event.action } : {}),
      ...(event.confirmation ? { "audit.confirmation": event.confirmation } : {}),
      ...(event.error ? { "audit.error": event.error } : {}),
      ...(event.http_status ? { "audit.http_status": event.http_status } : {}),
      ...(event.http_method ? { "audit.http_method": event.http_method } : {}),
    });
  }

  async flush(): Promise<void> {
    await this.initPromise;
  }
}
