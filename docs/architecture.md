# Architecture: OperationPolicy & Registry Contract

This document describes the design and architecture of the OperationPolicy system introduced in [Spec 001](../specs/001-registry-contract.md). It covers the type hierarchy, data flow, behavioral contracts, and integration points.

---

## Design Goals

1. **Every operation declares its risk.** No implicit defaults. The registry contract is absolute — `operationPolicy` is required on every `EndpointSpec`.
2. **Risk drives confirmation behavior.** Tool handlers pass `risk: RiskLevel` from `operationPolicy` into `confirmViaElicitation`, which applies `requiresConfirmation()` (failure path on clients without elicitation) and `shouldAutoApprove()` (`HARNESS_AUTO_APPROVE_RISK` / autonomous mode).
3. **Retry policy is per-operation.** Non-idempotent POSTs are marked `do_not_retry`; idempotent GETs and PUTs are `safe`. The HTTP client will read this in a future spec (P5).
4. **Zero code in toolset files.** Risk classification is pure data on each `EndpointSpec` — no functions, no imports, no conditional logic.

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
| `harness_execute` | `actionSpec.operationPolicy.risk` (per action) | Same |
| `harness_delete` | Hardcoded `risk: "destructive"` | Same (always confirms unless auto-approved) |

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

These tests run on every `pnpm test` invocation and validate all ~500+ endpoint specs across 31 toolset files.

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

`PreflightContext` types `client` as `HarnessClientInterface` and `registry` as `RegistryDispatchInterface` — structural interfaces that the concrete `HarnessClient` and `Registry` classes satisfy without explicit `implements` declarations. This eliminates the previous `unknown` typing while avoiding circular imports.

Hooks that need concrete-only methods (e.g. `getCurrentUserId()`) narrow via double-cast:
```typescript
const hc = client as unknown as HarnessClient;
```

`HarnessClientInterface` exposes only `readonly account: string` — the minimum surface needed for structural compatibility. The `request()` method is intentionally omitted because its `RequestOptions` parameter type lives in `client/types.ts` and would create a cross-module dependency. Preflight hooks that call `request` cast to the concrete type anyway.

### Resource Scope Selection

Resource definitions declare a default `scope` (`account`, `org`, or `project`). Multi-scope APIs also set `supportedScopes`, and callers can pass `resource_scope` through the generic tools to choose the request level explicitly. The registry validates the requested scope, injects only the identifiers required for that scope, and fails before the API call if `resource_scope: "org"` is missing `org_id`/`HARNESS_ORG` or `resource_scope: "project"` is missing `project_id`/`HARNESS_PROJECT`.

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

### HTTP Client Retry (Future: P5)

The `retryPolicy` field is declared on every spec but NOT yet consumed by the HTTP client. In P5, the dispatch layer will read `operationPolicy.retryPolicy` to decide:
- `safe` → retry on 429/5xx with exponential backoff
- `do_not_retry` → surface failure immediately
- `idempotency_key_required` → retry only with a stable key (for APIs that support it)

---

## Backfill Coverage

| Group | Files | Specs | Classification |
|---|---|---|---|
| A: Read-only | 8 | ~30 | All `read` / `safe` |
| B: Simple write | 10 | ~60 | Default CRUD rules |
| C: Complex + execute | 13 | ~400+ | Per-action judgment |
| **Total** | **31** | **~500+** | **Every spec covered** |

---

## What This Does NOT Cover

This architecture focuses on the registry contract and the confirmation gating derived from it. The following are separate systems built on top of `operationPolicy`:

| Spec | What it does | How it uses operationPolicy |
|---|---|---|
| **P3** (fail-closed elicitation) | Chat-based confirmation fallback | Reads `risk` to decide fallback behavior |
| **P4** (autonomous modes) | `HARNESS_AUTONOMOUS_MODE` env var | Compares `risk` against mode threshold |
| **P5** (retry policy) | HTTP client retry decisions | Reads `retryPolicy` to control retry |
| **P10** (write quality contract) | Structural linter for writes | Extends registry-as-contract pattern |
