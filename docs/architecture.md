# Architecture: OperationPolicy & Registry Contract

This document describes the design and architecture of the `OperationPolicy` and `Registry` dispatch system. It covers the type hierarchy, data flow, behavioral contracts, and integration points.

---

## Design Goals

1. **Every operation declares its risk.** No implicit defaults. The registry contract is absolute — `operationPolicy` is required on every `EndpointSpec`.
2. **Risk drives confirmation behavior.** Tool handlers pass `risk: RiskLevel` from `operationPolicy` into `confirmViaElicitation`, which applies `requiresConfirmation()` (failure path on clients without elicitation) and `shouldAutoApprove()` (`HARNESS_AUTO_APPROVE_RISK` / autonomous mode).
3. **Retry policy is per-operation.** Non-idempotent POSTs are marked `do_not_retry`; idempotent GETs and PUTs are `safe`. `HarnessClient` (`isSafeRetry()`) enforces `retryPolicy` on transient 429/5xx and network failures.
4. **Pure-data toolset files.** Risk classification, scoping (`scope`, `supportedScopes`, per-operation `EndpointSpec.scope`), and routing are declarative data on each `ResourceDefinition` / `EndpointSpec`.

---

## Type Hierarchy

All types live in `src/registry/types.ts`.

```
EndpointSpec
  ├── method: HttpMethod
  ├── path: string
  ├── operationPolicy ─────────────────── required on every spec
  │     ├── risk: RiskLevel
  │     │     read | low_write | medium_write | high_write | destructive
  │     └── retryPolicy: RetryPolicy
  │           safe | idempotency_key_required | do_not_retry
  ├── pathParams, queryParams, ...
  ├── bodyBuilder, bodySchema, ...
  └── preflight, ...
```

### RiskLevel Spectrum

```
read ──── low_write ──── medium_write ──── high_write ──── destructive
 │            │               │                │               │
 │            │               │                │               │
 no side      reversible,     meaningful       production      irreversible
 effects      low blast       impact, may      blast radius    (all deletes)
 (list/get)   radius          need review      (run, sync,
              (most CRUD)     (stop, config)   kill, approve)
```

### RetryPolicy Values

| Value | When to Use | Examples |
|---|---|---|
| `safe` | Idempotent — retry freely | GET, idempotent PUT |
| `idempotency_key_required` | Retry only with a stable key | Future APIs with idempotency support |
| `do_not_retry` | Surface failure, no automatic retry | Non-idempotent POST, DELETE |

---

## Data Flow: Risk-Gated Confirmation

```
Agent calls tool (e.g. harness_execute)
  │
  ▼
Tool handler validates resource_type + action
  │
  ▼
confirmViaElicitation({
  risk: endpoint.operationPolicy.risk,  // execute: per-action; delete: destructive
  autoApproveRisk: config.HARNESS_AUTO_APPROVE_RISK
})
  │
  ▼
shouldAutoApprove(risk, HARNESS_AUTO_APPROVE_RISK)?
  │  └─ yes → proceed (no confirmation; CI/autonomous mode)
  │
  ▼
Client supports MCP form elicitation?
  │
  ├─ no  &&  requiresConfirmation(risk)?  (medium_write, high_write, destructive)
  │       └─ BLOCK (return declined)
  │
  ├─ no  &&  !requiresConfirmation(risk)?  (read, low_write)
  │       └─ proceed silently
  │
  └─ yes → prompt user (form elicitation)
            ├─ accept → proceed
            └─ decline / cancel → BLOCK
```

### Per-Tool Behavior

| Tool | How risk is read | Confirmation gate |
|---|---|---|
| `harness_create` | `def.operations.create!.operationPolicy.risk` | Passed to `confirmViaElicitation`; `requiresConfirmation(risk)` when client lacks elicitation |
| `harness_update` | `def.operations.update!.operationPolicy.risk` | Same |
| `harness_execute` | `actionSpec.operationPolicy.risk` (per action) | Same (`read` and `low_write` actions proceed without confirmation; `read` actions are also allowed in `HARNESS_READ_ONLY=true` mode) |
| `harness_delete` | `def.operations.delete!.operationPolicy.risk` | Same (all delete operations declare `risk: "destructive"`) |

---

## Risk Classification Rules

### CRUD Operations (Default)

| Pattern | Risk | Retry | Rationale |
|---|---|---|---|
| `list` | `read` | `safe` | No side effects |
| `get` | `read` | `safe` | No side effects |
| `create` (general) | `low_write` | `do_not_retry` | POST is not idempotent |
| `create` (protection/security rules) | `medium_write` | `do_not_retry` | Security-sensitive |
| `update` (general) | `low_write` | `safe` | PUT is idempotent |
| `update` (protection/security rules) | `high_write` | `safe` | Security-sensitive, idempotent |
| `delete` (all) | `destructive` | `do_not_retry` | Irreversible |

### Execute Actions Classified as `high_write`

These actions have production blast radius and block on clients without elicitation:

- **Pipelines:** `pipeline.run`, `pipeline_v1.run`, `pipeline.retry`
- **Chaos:** `chaos_experiment.run`, `chaos_loadtest.run`
- **GitOps:** `gitops_application.sync`, `gitops_application.bulk_sync`
- **Feature Flags:** `fme_feature_flag.kill`, `fme_feature_flag.restore`, `fme_feature_flag.archive`, `fme_feature_flag.unarchive`
- **Approvals:** `approval_instance.approve`, `approval_instance.reject`
- **Freeze:** `freeze_window.toggle_status`, `global_freeze.manage`
- **STO:** `security_exemption.create`, `security_exemption.approve`, `security_exemption.reject`, `security_exemption.promote`
- **IDP:** `idp_workflow.execute`

---

## Module Dependency Graph

```
src/registry/types.ts         ← defines RiskLevel, RetryPolicy, OperationPolicy,
                                 requiresConfirmation(), shouldAutoApprove(),
                                 isBlockingRisk() (deprecated), EndpointSpec,
                                 PreflightContext

src/registry/toolsets/*.ts    ← toolset modules; each EndpointSpec declares
                                 operationPolicy as pure data (no imports needed)

src/registry/index.ts         ← Registry class; dispatch() passes specs to
                                 executeSpec(); does NOT read operationPolicy for
                                 elicitation (that's for tool handlers and future P5)

src/tools/harness-create.ts   ┐
src/tools/harness-update.ts   ├─ pass operationPolicy.risk and session config
src/tools/harness-execute.ts   │  autoApproveRisk to confirmViaElicitation()
src/tools/harness-delete.ts   ┘

src/utils/elicitation.ts      ← confirmViaElicitation({ risk, autoApproveRisk })
                                 uses requiresConfirmation(), shouldAutoApprove(),
                                 clientSupportsElicitation(server)
```

Key design choice: tool handlers thread `risk: RiskLevel` from the endpoint spec and `autoApproveRisk` from the session config directly into `confirmViaElicitation`. The elicitation module imports confirmation helpers from `types.ts`, so failure behavior stays aligned with the registry contract (including `medium_write` blocking without elicitation). `isBlockingRisk()` remains in `types.ts` as deprecated and is not used for this gate anymore.

---

## Structural Invariants (Enforced by Tests)

The structural validation test suite (`tests/registry/structural-validation.test.ts`) enforces:

1. **Every operations EndpointSpec has operationPolicy** — no implicit defaults.
2. **Every executeActions EndpointSpec has operationPolicy** — execute actions included.
3. **`operationPolicy.risk` is a valid RiskLevel** — catches typos and invalid values.
4. **`operationPolicy.retryPolicy` is a valid RetryPolicy** — same.
5. **All `delete` operations have `risk: "destructive"`** — deletes are always irreversible.
6. **All `list` and `get` operations have `risk: "read"`** — reads never have side effects.
7. **No EndpointSpec has `blockWithoutConfirmation`** — removed field, fully replaced.

These tests run on every `pnpm test` and `pnpm standards:check` invocation and validate all endpoint specs across all 50 toolset files.

---

## Integration with Existing Systems

### Elicitation Module (`src/utils/elicitation.ts`)

Confirmation is driven by `risk: RiskLevel` plus optional auto-approve level from the session config (`HARNESS_AUTO_APPROVE_RISK`; deprecated `HARNESS_SKIP_ELICITATION` maps to approving all risks at startup). HTTP sessions may lower the deployment default during initialize with `X-Harness-Auto-Approve-Risk`, but cannot raise it above the server-configured threshold; tool handlers pass the resolved session value explicitly, so different sessions do not mutate shared process state.

| Risk level | Client supports elicitation | Behavior |
|---|---|---|
| `read`, `low_write` | any | Proceed silently (no confirmation) |
| `medium_write`, `high_write`, `destructive` | Yes | Prompt user; proceed on accept, block on decline/cancel/error |
| `medium_write`, `high_write`, `destructive` | No | **Block** |
| Any risk at or below `HARNESS_AUTO_APPROVE_RISK` | any | Auto-approve — proceed without prompt |

### Preflight Hooks

`PreflightContext` types `client` as `HarnessClientInterface` and `registry` as `RegistryDispatchInterface` — structural interfaces that the concrete `HarnessClient` and `Registry` classes satisfy without explicit `implements` declarations. `HarnessClientInterface` exposes `readonly account: string`, `getCurrentUserId(): Promise<string>`, and `request<T>(options: RequestOptions): Promise<T>`, allowing preflight hooks to resolve actor identities or default entities without circular imports.

### Resource Scope Selection

Resource definitions declare a default `scope` (`account`, `org`, or `project`). Multi-scope APIs also set `supportedScopes`, and callers can pass `resource_scope` through the generic tools to choose the request level explicitly. When an individual operation's backend endpoint has a fixed scope that differs from the resource's default `scope` (for example, a project-scoped `list` paired with an account-scoped `get`-by-UUID on the same resource), `EndpointSpec.scope` overrides the scope for that operation so both operations remain on a single `resourceType`. The registry validates the requested scope, injects only the identifiers required for that scope, and fails before the API call if `resource_scope: "org"` is missing `org_id`/`HARNESS_ORG` or `resource_scope: "project"` is missing `project_id`/`HARNESS_PROJECT`.

`harness_describe` exposes `supportedScopes` and `scopeHint` from local registry metadata so agents can discover when account/org/project variants are available without making a Harness API call.

### Structured MCP Output

All 11 generic tools declare `outputSchema` in `src/tools/output-schemas.ts`. Because MCP `structuredContent` must be an object, `harness_list` normalizes list payloads in `src/utils/response-formatter.ts` before returning:

- top-level arrays become `{ items, total, page? }`;
- object wrappers such as `content`, `data`, `body`, `objects`, or `features` are hoisted to `items` when no `items` array exists;
- existing object payloads keep additional fields via catchall schemas.

This keeps strict clients compatible with Harness APIs that return arrays or module-specific list envelopes while preserving the compact JSON text response.

### HTTP Transport Security Layers

HTTP transport has three separate controls:

1. **Bearer auth** (`HARNESS_MCP_AUTH_TOKEN`) gates `/mcp` `POST`, `GET`, and `DELETE` before body parsing. `/health` and `OPTIONS` remain unauthenticated.
2. **Bind-host enforcement** (`src/utils/http-auth.ts`) requires `HARNESS_MCP_AUTH_TOKEN` for non-loopback binds unless `HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP=true` is set explicitly. Single-user HTTP mode without a token emits a warning because the configured Harness API key may be exposed through proxies or tunnels.
3. **Host/CORS controls** (`HARNESS_MCP_ALLOWED_HOSTS` plus the HTTP adapter) protect against DNS rebinding and browser-origin abuse. These are not authentication; they complement the bearer token or an external authenticated gateway.

In multi-user mode, per-session Harness credentials come from initialize headers (`x-harness-api-key`, `x-harness-account-id`, optional org/project). `HARNESS_MCP_AUTH_TOKEN` remains an independent transport-layer gate.

### Server-Side Pipeline Wait

`harness_execute` supports `wait: true` for pipeline run/retry actions. After the trigger succeeds, the tool extracts the execution ID and calls `pollExecutionToTerminal()` with progress notifications over the MCP request context. The wait result is merged into the response envelope with fields such as `execution_status`, `execution_terminal`, `execution_timed_out`, and `_wait`.

Wait failure is intentionally non-fatal to the trigger: if polling errors or the client cancels, the response includes `_wait.error` or `_wait.cancelled` and tells the caller to recheck the returned `execution_id`. This avoids duplicate pipeline runs caused by treating a poll failure as a failed trigger.

### Audit Sinks

`createAuditManager()` always installs `StderrSink`. Optional sinks are configured from environment:

- `HARNESS_AUDIT_FILE` enables newline-delimited JSON file writes.
- `HARNESS_AUDIT_WEBHOOK_URL` enables batched webhook delivery with optional bearer token, batch size, and flush interval.
- `OTEL_EXPORTER_OTLP_ENDPOINT` enables OpenTelemetry audit spans when the optional OpenTelemetry packages are available.

The registry emits audit events for every registry-dispatched Harness API operation (`list`, `get`, `create`, `update`, `delete`, and `execute`). Mutating operations record the elicitation or auto-approval path when a confirmation context is present; read operations currently omit confirmation metadata. Tools that bypass registry dispatch for local metadata or schema discovery are outside this audit stream. Sinks are telemetry outputs; they should not change the outcome of the Harness API operation.

### HTTP Client Retry (`HarnessClient`)

`Registry.executeSpec` forwards `spec.operationPolicy.retryPolicy` to `HarnessClient.request()`. `HarnessClient` (`isSafeRetry()`) uses `retryPolicy` to decide:
- `safe` → retry on transient HTTP status codes (`429`, `500`, `502`, `503`, `504`) and transient network codes (`EAI_AGAIN`, `ECONNRESET`, `UND_ERR_CONNECT_TIMEOUT`, `UND_ERR_SOCKET`) with exponential backoff
- `do_not_retry` / `idempotency_key_required` → surface failure immediately without automatic retry
