# Architecture: OperationPolicy & Registry Contract

This document describes the design and architecture of the OperationPolicy system introduced in [Spec 001](../specs/001-registry-contract.md). It covers the type hierarchy, data flow, behavioral contracts, and integration points.

---

## Design Goals

1. **Every operation declares its risk.** No implicit defaults. The registry contract is absolute — `operationPolicy` is required on every `EndpointSpec`.
2. **Risk drives confirmation behavior.** Tool handlers derive `destructive` from `operationPolicy.risk` instead of ad-hoc booleans. High-risk operations block on clients without MCP elicitation.
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
Reads operationPolicy from EndpointSpec
  │  actionSpec.operationPolicy.risk
  │
  ▼
isBlockingRisk(risk)?
  │
  ├─ false (read, low_write, medium_write)
  │    │
  │    ▼
  │  confirmViaElicitation(destructive: false)
  │    ├─ client supports elicitation → prompt, proceed on accept
  │    └─ client lacks elicitation → proceed silently
  │
  └─ true (high_write, destructive)
       │
       ▼
     confirmViaElicitation(destructive: true)
       ├─ client supports elicitation → prompt, block on decline
       └─ client lacks elicitation → BLOCK (return error)
```

### Per-Tool Behavior

| Tool | How risk is read | Destructive gate |
|---|---|---|
| `harness_create` | `def.operations.create!.operationPolicy.risk` | `isBlockingRisk(risk)` |
| `harness_update` | `def.operations.update!.operationPolicy.risk` | `isBlockingRisk(risk)` |
| `harness_execute` | `actionSpec.operationPolicy.risk` (per action) | `isBlockingRisk(risk)` |
| `harness_delete` | Hardcoded `destructive: true` | Always blocks without confirmation |

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
- **STO:** `security_exemption.approve`, `security_exemption.reject`, `security_exemption.promote`
- **IDP:** `idp_workflow.execute`

---

## Module Dependency Graph

```
src/registry/types.ts         ← defines RiskLevel, RetryPolicy, OperationPolicy,
                                 isBlockingRisk(), EndpointSpec, PreflightContext

src/registry/toolsets/*.ts    ← 31 toolset files; each EndpointSpec declares
                                 operationPolicy as pure data (no imports needed)

src/registry/index.ts         ← Registry class; dispatch() passes specs to
                                 executeSpec(); does NOT read operationPolicy
                                 (that's for tool handlers and future P5)

src/tools/harness-create.ts   ┐
src/tools/harness-update.ts   ├─ import { isBlockingRisk } from types.ts
src/tools/harness-execute.ts  ┘  read operationPolicy.risk, derive destructive

src/utils/elicitation.ts      ← confirmViaElicitation(destructive: boolean)
                                 unchanged; receives derived boolean from handlers
```

Key design choice: the elicitation module (`src/utils/elicitation.ts`) does NOT know about `RiskLevel`. It continues to accept a plain `destructive: boolean`. The risk→boolean mapping happens in tool handlers via `isBlockingRisk()`. This keeps the elicitation module decoupled from the registry type system.

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

No changes. The `destructive` boolean parameter stays. Tool handlers call `isBlockingRisk(operationPolicy.risk)` to produce the boolean. The module's behavior:

| `destructive` | Client supports elicitation | Behavior |
|---|---|---|
| `false` | Yes | Prompt user, proceed on accept |
| `false` | No | Proceed silently |
| `true` | Yes | Prompt user, block on decline |
| `true` | No | **Block** (return declined) |
| any | — | If `HARNESS_SKIP_ELICITATION=true`, always proceed |

### Preflight Hooks

`PreflightContext` types `client` as `HarnessClientInterface` and `registry` as `RegistryDispatchInterface` — structural interfaces that the concrete `HarnessClient` and `Registry` classes satisfy without explicit `implements` declarations. This eliminates the previous `unknown` typing while avoiding circular imports.

Hooks that need concrete-only methods (e.g. `getCurrentUserId()`) narrow via double-cast:
```typescript
const hc = client as unknown as HarnessClient;
```

`HarnessClientInterface` exposes only `readonly account: string` — the minimum surface needed for structural compatibility. The `request()` method is intentionally omitted because its `RequestOptions` parameter type lives in `client/types.ts` and would create a cross-module dependency. Preflight hooks that call `request` cast to the concrete type anyway.

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
