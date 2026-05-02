# Spec 004: Enterprise Audit Sink Abstraction (P9)

**Status**: Implementing  
**Priority**: P9 — final quality review item  
**Depends on**: P3/P4 (risk-based elicitation), P5 (retry policy), P11 (registry contract)

---

## Problem

`logAudit()` in `src/utils/logger.ts` writes `AuditEntry` records to stderr. Limitations:

- **Minimal schema**: Missing `event_id`, `risk`, `confirmation_method`, `duration_ms`, `account_id`, `timestamp`, HTTP status/method/path
- **No pluggable sinks**: Only stderr; no file, webhook, or OTel destinations
- **Scattered call sites**: Called from 4 tool handlers with inconsistent shapes
- **No read audit**: List/get/describe/search leave no trail
- **Internal repo gap**: `mcpServerInternal` has identical unused `logAudit()`; this design provides a plugin interface both repos can share

## Design

### AuditEvent (enriched)

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
  confirmation?: "auto_approved" | "elicited" | "skipped" | "blocked" | "not_required";
  outcome: "success" | "error";
  error?: string;
  duration_ms: number;
  http_status?: number;
  http_method?: string;
  http_path?: string;
}
```

### AuditSink interface

```typescript
interface AuditSink {
  name: string;
  emit(event: AuditEvent): void | Promise<void>;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}
```

### Sinks

1. **StderrSink** — always on, JSON to stderr via logger
2. **JsonlFileSink** — append NDJSON to `HARNESS_AUDIT_FILE`, auto-mkdir
3. **WebhookSink** — POST to `HARNESS_AUDIT_WEBHOOK_URL` with Bearer token, batched
4. **OTelSink** — optional peer dep, dynamic `import("@opentelemetry/api")`, span events

### AuditManager

Fan-out orchestrator. Errors in sinks are logged but never propagate.

### Emission point

Wraps `executeSpec()` in `Registry` — captures ALL registry-mediated operations. Tool handlers pass `AuditContext` (tool name, confirmation method) through `dispatch`/`dispatchExecute`.

### Config

| Env Var | Default | Description |
|---------|---------|-------------|
| `HARNESS_AUDIT_FILE` | (none) | JSONL file path |
| `HARNESS_AUDIT_WEBHOOK_URL` | (none) | Webhook endpoint |
| `HARNESS_AUDIT_WEBHOOK_TOKEN` | (none) | Bearer token |
| `HARNESS_AUDIT_WEBHOOK_BATCH_SIZE` | 10 | Batch size |
| `HARNESS_AUDIT_WEBHOOK_FLUSH_MS` | 5000 | Flush interval |

### Breaking changes

- `logAudit()` and `AuditEntry` deprecated (still exported, delegate to AuditManager)
- `dispatch`/`dispatchExecute` gain optional `AuditContext` parameter (backward compatible)

### Internal repo integration

Import `AuditManager` from `harness-mcp-v2`, add custom sinks. No monkey-patching.
