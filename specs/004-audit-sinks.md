# Spec 004: Enterprise Audit Sink Abstraction (P9)

**Status**: Implemented  
**Priority**: P9 — final quality review item  
**Depends on**: P3/P4 (risk-based elicitation), P5 (retry policy), P11 (registry contract)

---

## Problem

`logAudit()` in `src/utils/logger.ts` writes `AuditEntry` records to stderr. Limitations:

- **Minimal schema**: Missing `event_id`, `risk`, `confirmation_method`, `duration_ms`, `account_id`, `timestamp`, HTTP status/method/path
- **No pluggable sinks**: Only stderr; no file, webhook, or OTel destinations
- **Scattered call sites**: Called from 4 tool handlers with inconsistent shapes
- **No read audit**: List/get/describe/search leave no trail
- **No extension point**: No way for downstream consumers to add custom sinks

---

## Architecture

### Data Flow

```
Tool Handler                    Registry                     AuditManager
     |                             |                              |
     |-- dispatch(AuditContext) -->|                              |
     |                             |-- executeSpec() ----------->|
     |                             |   (measures duration,        |
     |                             |    captures outcome)         |
     |                             |                              |-- emit() --> StderrSink
     |                             |<-- result/error ------------|-- emit() --> JsonlFileSink
     |<-- result/error ------------|                              |-- emit() --> WebhookSink
     |                             |                              |-- emit() --> OTelSink
```

### Emission Point

Audit events are emitted from `Registry.executeSpecWithAudit()` — a wrapper around `executeSpec()`. This guarantees 100% coverage of all registry-mediated operations without requiring individual tool handlers to emit events. Tool handlers pass an `AuditContext` (tool name, confirmation method, resource_id, action) through `dispatch`/`dispatchExecute`.

---

## AuditEvent Schema

```typescript
interface AuditEvent {
  event_id: string;           // randomUUID()
  timestamp: string;          // ISO 8601
  tool: string;               // "harness_create" | "harness_list" | ...
  operation: string;          // "create" | "list" | "get" | "delete" | "update" | "execute"
  resource_type: string;
  resource_id?: string;
  action?: string;            // for execute actions
  org_id?: string;
  project_id?: string;
  account_id: string;
  risk: RiskLevel;
  confirmation?: ConfirmationMethod;
  outcome: "success" | "error";
  error?: string;
  duration_ms: number;
  http_status?: number;
  http_method?: string;
  http_path?: string;
}

type ConfirmationMethod = "auto_approved" | "elicited" | "caller_confirmed" | "blocked" | "not_required";
//
// - auto_approved:    risk was at or below HARNESS_AUTO_APPROVE_RISK
// - elicited:         user explicitly accepted an MCP elicitation prompt
//                     with content.confirm === true
// - caller_confirmed: caller passed confirm: true and the client could not
//                     surface a usable elicitation prompt (no capability,
//                     elicitInput failed, or degenerate accept). Used by
//                     non-interactive automation; distinct from `elicited`
//                     so audits can tell automation overrides apart from
//                     genuine human consents
// - not_required:     risk was read or low_write — no confirmation needed
// - blocked:          pre-dispatch audit row emitted by Registry.auditBlockedAttempt()
//                     when an operation is gated by elicitation. The
//                     operation itself does NOT run; the row exists for
//                     record-keeping so operators can see blocked attempts
```

## AuditSink Interface

```typescript
interface AuditSink {
  readonly name: string;
  emit(event: AuditEvent): void | Promise<void>;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}
```

## AuditManager

Fan-out orchestrator. Errors in individual sinks are logged but **never propagate** to the tool handler — audit failures must not break tool execution.

```typescript
class AuditManager {
  addSink(sink: AuditSink): void;
  emit(event: AuditEvent): void;
  flush(): Promise<void>;
  close(): Promise<void>;
}
```

Created via `createAuditManager(config)` in `src/audit/index.ts`. Wired into the server lifecycle in `src/index.ts` — `close()` is called on SIGINT/SIGTERM (stdio) and session destruction (HTTP).

---

## Sinks

### 1. StderrSink (`src/audit/sinks/stderr.ts`)

**Always active.** Writes each `AuditEvent` as a JSON object to stderr via the logger utility. Success events log at `info` level, error events at `warn`.

No configuration required.

### 2. JsonlFileSink (`src/audit/sinks/jsonl-file.ts`)

**Activates when `HARNESS_AUDIT_FILE` is set.** Appends each `AuditEvent` as a newline-delimited JSON (NDJSON) line to the specified file. Creates parent directories automatically. Write errors are logged but never thrown.

### 3. WebhookSink (`src/audit/sinks/webhook.ts`)

**Activates when `HARNESS_AUDIT_WEBHOOK_URL` is set.** Batches `AuditEvent`s and POSTs them as `{ events: [...] }` to the configured URL. Supports optional Bearer token authentication via `HARNESS_AUDIT_WEBHOOK_TOKEN`.

| Config | Default | Description |
|--------|---------|-------------|
| `HARNESS_AUDIT_WEBHOOK_URL` | (none) | Webhook endpoint URL |
| `HARNESS_AUDIT_WEBHOOK_TOKEN` | (none) | Bearer token for Authorization header |
| `HARNESS_AUDIT_WEBHOOK_BATCH_SIZE` | 10 | Events per batch before auto-flush |
| `HARNESS_AUDIT_WEBHOOK_FLUSH_MS` | 5000 | Timer-based flush interval (ms) |

**Delivery guarantee**: Best-effort with bounded retry. Failed batches are re-enqueued for the next flush cycle, up to 5x the configured batch size. Events exceeding this capacity are dropped with a warning. This prevents unbounded memory growth while giving transient failures a second chance.

### 4. OTelSink (`src/audit/sinks/otel.ts`)

**Activates when `OTEL_EXPORTER_OTLP_ENDPOINT` is set and `@opentelemetry/api` is importable.**

Self-bootstrapping sink that exports audit events as OpenTelemetry spans to any OTLP-compatible backend (Jaeger, Grafana Tempo, Datadog, etc.). Supports both standalone mode (bootstraps its own TracerProvider) and embedded mode (reuses an externally registered provider). All OTel packages are optional peer dependencies with zero bundle impact when not installed. Spans are exported asynchronously via `BatchSpanProcessor`.

See **[Spec 005: OpenTelemetry Audit Sink](005-otel-audit-sink.md)** for full details: modes, configuration, span attributes, and verification.

---

## Configuration Summary

| Env Var | Default | Sink | Description |
|---------|---------|------|-------------|
| *(none)* | always on | Stderr | JSON audit lines to stderr |
| `HARNESS_AUDIT_FILE` | (none) | JSONL | File path for NDJSON audit log |
| `HARNESS_AUDIT_WEBHOOK_URL` | (none) | Webhook | HTTP POST endpoint |
| `HARNESS_AUDIT_WEBHOOK_TOKEN` | (none) | Webhook | Bearer token |
| `HARNESS_AUDIT_WEBHOOK_BATCH_SIZE` | 10 | Webhook | Events per batch |
| `HARNESS_AUDIT_WEBHOOK_FLUSH_MS` | 5000 | Webhook | Flush interval (ms) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (none) | OTel | OTLP collector URL — see [Spec 005](005-otel-audit-sink.md) for all OTel env vars |

---

## Breaking Changes

- `logAudit()` and `AuditEntry` in `src/utils/logger.ts` are deprecated (still exported for backward compatibility)
- `dispatch`/`dispatchExecute` gain optional `AuditContext` parameter (backward compatible — `AbortSignal` still accepted in the same position)

## Extensibility

Downstream consumers can extend the audit system by:
1. Importing `AuditManager` and calling `addSink()` with custom `AuditSink` implementations
2. Registering their own `TracerProvider` before the MCP server starts — the OTel sink will detect it and use the existing tracing infrastructure

No monkey-patching required.

## Files

| File | Role |
|------|------|
| `src/audit/types.ts` | `AuditEvent`, `AuditContext`, `AuditSink`, `ConfirmationMethod` |
| `src/audit/manager.ts` | `AuditManager` orchestrator |
| `src/audit/sinks/stderr.ts` | Stderr sink |
| `src/audit/sinks/jsonl-file.ts` | JSONL file sink |
| `src/audit/sinks/webhook.ts` | Webhook sink |
| `src/audit/sinks/otel.ts` | OTel sink (self-bootstrapping) |
| `src/audit/index.ts` | `createAuditManager()` factory |
| `scripts/verify-otel.js` | OTel verification script |
