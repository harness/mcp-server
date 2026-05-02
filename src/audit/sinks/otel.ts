import type { AuditEvent, AuditSink } from "../types.js";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("audit-otel");

/**
 * Dynamically import a module by name, bypassing TypeScript static resolution.
 * Returns null if the module is not installed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tryImport(moduleName: string): Promise<any> {
  try {
    return await (Function("m", "return import(m)")(moduleName) as Promise<unknown>);
  } catch {
    return null;
  }
}

function buildAttributes(event: AuditEvent): Record<string, string | number> {
  const attrs: Record<string, string | number> = {
    "audit.event_id": event.event_id,
    "audit.tool": event.tool,
    "audit.operation": event.operation,
    "audit.resource_type": event.resource_type,
    "audit.outcome": event.outcome,
    "audit.risk": event.risk,
    "audit.duration_ms": event.duration_ms,
    "audit.account_id": event.account_id,
    "audit.timestamp": event.timestamp,
  };
  if (event.resource_id) attrs["audit.resource_id"] = event.resource_id;
  if (event.action) attrs["audit.action"] = event.action;
  if (event.confirmation) attrs["audit.confirmation"] = event.confirmation;
  if (event.error) attrs["audit.error"] = event.error;
  if (event.http_status) attrs["audit.http_status"] = event.http_status;
  if (event.http_method) attrs["audit.http_method"] = event.http_method;
  if (event.http_path) attrs["audit.http_path"] = event.http_path;
  if (event.org_id) attrs["audit.org_id"] = event.org_id;
  if (event.project_id) attrs["audit.project_id"] = event.project_id;
  return attrs;
}

/**
 * Emits audit events as OpenTelemetry spans/events.
 *
 * Two modes:
 * 1. **Active span** (host app with OTel tracing): adds audit as a span event
 * 2. **Standalone**: bootstraps its own TracerProvider with an OTLP HTTP
 *    exporter and creates a root span per audit event
 *
 * Requires `OTEL_EXPORTER_OTLP_ENDPOINT` to be set.
 *
 * Packages needed for standalone mode (all optional peer deps):
 * - @opentelemetry/api
 * - @opentelemetry/sdk-trace-node
 * - @opentelemetry/exporter-trace-otlp-http
 * - @opentelemetry/resources
 */
export class OTelSink implements AuditSink {
  readonly name = "otel";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private api: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tracer: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private provider: any = null;
  private ready = false;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    const api = await tryImport("@opentelemetry/api");
    if (!api) {
      log.debug("@opentelemetry/api not available, OTel audit sink inactive");
      return;
    }
    this.api = api;

    // Check if a TracerProvider was already registered by a host application
    // before the MCP server starts. The default no-op provider returns a
    // ProxyTracerProvider — a real provider is anything else.
    const existingProvider = api.trace?.getTracerProvider?.();
    const hasExternalProvider = existingProvider
      && existingProvider.constructor?.name !== "ProxyTracerProvider"
      && existingProvider.constructor?.name !== "NoopTracerProvider";

    if (hasExternalProvider) {
      // Another system owns the TracerProvider — use it. At emit() time, if there's
      // an active span (per-request), we attach as a span event; otherwise we create
      // a child-less root span via this tracer.
      this.tracer = api.trace.getTracer("harness-mcp-audit");
      this.ready = true;
      log.debug("OTel audit sink using external TracerProvider");
      return;
    }

    // No external provider — try to bootstrap our own for standalone mode
    const [sdkTrace, exporter, resources] = await Promise.all([
      tryImport("@opentelemetry/sdk-trace-node"),
      tryImport("@opentelemetry/exporter-trace-otlp-http"),
      tryImport("@opentelemetry/resources"),
    ]);

    if (!sdkTrace || !exporter) {
      log.warn(
        "OTEL_EXPORTER_OTLP_ENDPOINT is set but OTel SDK packages are missing. " +
        "Install @opentelemetry/sdk-trace-node and @opentelemetry/exporter-trace-otlp-http " +
        "to enable the OTel audit sink.",
      );
      return;
    }

    try {
      const serviceName = process.env.OTEL_SERVICE_NAME || "harness-mcp-server";
      const resourceAttrs: Record<string, string> = {
        "service.name": serviceName,
        "service.version": process.env.npm_package_version || "unknown",
      };

      // OTEL_RESOURCE_ATTRIBUTES=key1=val1,key2=val2
      const envAttrs = process.env.OTEL_RESOURCE_ATTRIBUTES;
      if (envAttrs) {
        for (const pair of envAttrs.split(",")) {
          const eq = pair.indexOf("=");
          if (eq > 0) {
            resourceAttrs[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
          }
        }
      }

      const resource = resources?.resourceFromAttributes
        ? resources.resourceFromAttributes(resourceAttrs)
        : undefined;

      const otlpExporter = new exporter.OTLPTraceExporter();

      this.provider = new sdkTrace.NodeTracerProvider({
        resource,
        spanProcessors: [new sdkTrace.BatchSpanProcessor(otlpExporter)],
      });
      this.provider.register();
      this.tracer = this.provider.getTracer("harness-mcp-audit");
      this.ready = true;
      log.info("OTel audit sink bootstrapped standalone TracerProvider", {
        endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      });
    } catch (err) {
      log.error("Failed to bootstrap OTel TracerProvider", { error: String(err) });
    }
  }

  emit(event: AuditEvent): void {
    if (!this.ready || !this.api || !this.tracer) return;

    // Path 1: if there's an active span, add as a span event (embedded mode)
    const activeSpan = this.api.trace?.getActiveSpan?.();
    if (activeSpan) {
      activeSpan.addEvent("audit", buildAttributes(event));
      return;
    }

    // Path 2: create a standalone root span (OSS standalone mode)
    const span = this.tracer.startSpan(`audit.${event.operation}.${event.resource_type}`, {
      attributes: buildAttributes(event),
    });
    if (event.outcome === "error") {
      span.setStatus?.({ code: 2, message: event.error || "unknown error" });
    }
    span.end();
  }

  async flush(): Promise<void> {
    await this.initPromise;
    if (this.provider?.forceFlush) {
      await this.provider.forceFlush();
    }
  }

  async close(): Promise<void> {
    await this.initPromise;
    if (this.provider?.shutdown) {
      await this.provider.shutdown();
    }
  }
}
