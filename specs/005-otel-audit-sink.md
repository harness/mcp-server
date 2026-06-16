# Spec 005: OpenTelemetry Audit Sink

**Status**: Implemented  
**Depends on**: Spec 004 (Audit Sink Abstraction)

---

## Overview

The OTel sink (`src/audit/sinks/otel.ts`) exports audit events as OpenTelemetry spans to any OTLP-compatible backend (Jaeger, Grafana Tempo, Datadog, etc.). It is self-bootstrapping — no external OTel setup is required beyond setting `OTEL_EXPORTER_OTLP_ENDPOINT` and installing the SDK packages.

**Activates when** `OTEL_EXPORTER_OTLP_ENDPOINT` is set and `@opentelemetry/api` is importable.

---

## Modes

The sink operates in one of two modes, determined at startup:

### Mode A — External TracerProvider

When a host application has already registered a `TracerProvider` before the MCP server starts (e.g. wrapping tool calls with OTel tracing), the sink detects it and reuses the existing provider. It does not bootstrap its own.

At emit time:

- **Active span exists** (per-request trace context from the host): the audit event is added as a **span event** on the active span. This preserves the trace hierarchy — audit data appears nested under the parent tool call trace.
- **No active span**: a standalone root span is created via the external provider's tracer.

### Mode B — Standalone (no external provider)

When no external `TracerProvider` is registered, the sink dynamically imports the OTel SDK packages and bootstraps its own:

- `NodeTracerProvider` with `BatchSpanProcessor` + `OTLPTraceExporter`
- Resource attributes from `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES`, and `service.version`
- Each audit event becomes a root span named `audit.{operation}.{resource_type}`
- Error events set `otel.status_code=ERROR` with the error message

### Emit Decision Flow

```
emit(event)
  |
  |-- active span exists? --> addEvent("audit", attributes) on active span
  |
  |-- no active span, tracer available? --> startSpan("audit.op.type", {attributes}), end()
  |
  |-- no tracer? --> no-op
```

---

## Configuration

The sink respects standard OpenTelemetry environment variables. No custom config variables are needed.

| Env Var | Default | Description |
|---------|---------|-------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (none) | OTLP collector URL. **Required** to activate the sink. |
| `OTEL_SERVICE_NAME` | `harness-mcp-server` | Override the `service.name` resource attribute |
| `OTEL_RESOURCE_ATTRIBUTES` | (none) | Additional resource attributes as `key=val,key=val`. Example: `deployment.environment=prod,team=platform` |
| `OTEL_EXPORTER_OTLP_HEADERS` | (none) | Custom headers on OTLP export requests. Example: `x-api-key=abc123` |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` | Protocol: `http/protobuf`, `http/json`, or `grpc` |
| `OTEL_BSP_SCHEDULE_DELAY` | `5000` | Batch export interval in ms |
| `OTEL_BSP_MAX_EXPORT_BATCH_SIZE` | `512` | Max spans per export batch |

---

## Required Packages

All declared as optional `peerDependencies` in `package.json`. If the SDK packages are missing but `OTEL_EXPORTER_OTLP_ENDPOINT` is set, the sink logs a warning and degrades to no-op.

| Package | Purpose |
|---------|---------|
| `@opentelemetry/api` | Trace API, active span detection |
| `@opentelemetry/sdk-trace-node` | `NodeTracerProvider`, `BatchSpanProcessor` |
| `@opentelemetry/exporter-trace-otlp-http` | `OTLPTraceExporter` for OTLP/HTTP |
| `@opentelemetry/resources` | Service resource attributes |

Install with:

```bash
pnpm add -D @opentelemetry/api @opentelemetry/sdk-trace-node \
  @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources
```

---

## Span Attributes

Every audit span carries these attributes:

| Attribute | Source | Always present |
|-----------|--------|----------------|
| `audit.event_id` | `randomUUID()` | Yes |
| `audit.timestamp` | ISO 8601 | Yes |
| `audit.tool` | `harness_list`, `harness_create`, etc. | Yes |
| `audit.operation` | `list`, `get`, `create`, `update`, `delete`, `execute` | Yes |
| `audit.resource_type` | e.g. `pipeline`, `service`, `connector` | Yes |
| `audit.outcome` | `success`, `error`, or `blocked` (pre-dispatch elicitation block) | Yes |
| `audit.risk` | `read`, `low_write`, `medium_write`, `high_write`, `destructive` | Yes |
| `audit.duration_ms` | End-to-end API call duration | Yes |
| `audit.account_id` | Harness account identifier | Yes |
| `audit.resource_id` | Specific resource identifier | When available |
| `audit.action` | Execute action (e.g. `run`, `stop`) | Execute operations |
| `audit.confirmation` | `auto_approved`, `elicited`, `caller_confirmed`, `blocked`, `not_required` | Write operations (and `blocked` rows from `Registry.auditBlockedAttempt()`) |
| `audit.error` | Error message | On failure |
| `audit.http_method` | `GET`, `POST`, `PUT`, `DELETE` | When available |
| `audit.http_path` | API path | When available |
| `audit.http_status` | HTTP response status code | When available |
| `audit.org_id` | Organization identifier | When available |
| `audit.project_id` | Project identifier | When available |

---

## Dynamic Import Strategy

All OTel packages are imported at runtime via a `Function("m", "return import(m)")` trick that prevents TypeScript from statically resolving the modules. This ensures zero bundle impact when OTel packages are not installed.

---

## Lifecycle

- **Async init**: The constructor kicks off an async `init()` that resolves packages and bootstraps the provider. All methods await this before acting.
- **`flush()`**: Awaits init, then calls `forceFlush()` on the self-bootstrapped provider (no-op if using external provider).
- **`close()`**: Awaits init, then calls `shutdown()` on the self-bootstrapped provider. Called automatically during server shutdown.
- **Span export**: `BatchSpanProcessor` exports spans asynchronously — zero impact on tool call latency.

---

## Verification

```bash
# Install OTel packages
pnpm add -D @opentelemetry/api @opentelemetry/sdk-trace-node \
  @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources

# Run verification script against any OTLP-compatible backend
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-collector/otlp node scripts/verify-otel.js

# Check your tracing UI for service "harness-mcp-server"
# You should see spans: audit.list.pipeline, audit.get.service, etc.
```

---

## Files

| File | Role |
|------|------|
| `src/audit/sinks/otel.ts` | OTel sink implementation |
| `scripts/verify-otel.js` | Verification script |
