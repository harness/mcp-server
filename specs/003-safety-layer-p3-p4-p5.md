# Spec 003: Safety Layer — Fail-Closed Elicitation, Autonomous Modes, Retry Policy

**Status:** Draft
**Author:** Quality Review Follow-up
**Date:** 2026-05-02
**Depends on:** 001 (OperationPolicy — provides `RiskLevel` and `retryPolicy` on every `EndpointSpec`)
**Unblocks:** P10 (write quality contract enforcement)

---

## Problem

Three safety gaps remain after P11 (OperationPolicy):

1. **P3 — Silent mutations on non-elicitation clients.** `low_write` and `medium_write`
   operations proceed without any confirmation on Claude Desktop, Windsurf, and other
   clients that lack MCP form elicitation. Only `high_write`/`destructive` block.
   Security-sensitive creates (protection rules, remediation PRs) classified as
   `medium_write` silently proceed.

2. **P4 — `HARNESS_SKIP_ELICITATION` is all-or-nothing.** A single boolean bypasses
   ALL confirmation — including destructive deletes. There is no way to say "auto-approve
   low-risk writes but still confirm high-risk ones." Autonomous CI/CD agents need
   granular control.

3. **P5 — Retries can create duplicate resources.** The HTTP client retries all requests
   identically on 429/5xx, including non-idempotent POST creates. A 502 after a
   successful server-side create causes a retry that creates a duplicate. `retryPolicy`
   exists on every `EndpointSpec` via `OperationPolicy` but is not wired to the HTTP
   client.

---

## Solution Overview

All three feed into the same two code paths:
- **Elicitation** (`confirmViaElicitation`) — P3 + P4
- **HTTP retry** (`HarnessClient.request`) — P5

```
┌─────────────────────────────────────────────────────────────┐
│                    Tool Handler                             │
│  (harness-create / update / delete / execute)               │
│                                                             │
│  1. Read operationPolicy.risk from EndpointSpec             │
│  2. Call confirmViaElicitation({ risk })      ← P3 + P4    │
│  3. Call registry.dispatch(...)                             │
│     └─→ executeSpec() passes retryPolicy     ← P5         │
│         └─→ client.request({ retryPolicy })                │
└─────────────────────────────────────────────────────────────┘
```

---

## P3: Fail-Closed Elicitation

### Current Behavior

| Client supports elicitation? | `destructive` flag | Result |
|---|---|---|
| Yes | any | Prompt user |
| No | `true` | **BLOCK** |
| No | `false` | Proceed silently |

`destructive` is `true` only for `high_write` / `destructive` operations (via
`isBlockingRisk`). All `medium_write` operations proceed silently.

### New Behavior

Replace `destructive: boolean` with `risk: RiskLevel` on `confirmViaElicitation`.
Add `requiresConfirmation()` helper:

```typescript
export function requiresConfirmation(risk: RiskLevel): boolean {
  return risk === "medium_write" || risk === "high_write" || risk === "destructive";
}
```

| Client supports elicitation? | Risk level | Result |
|---|---|---|
| Yes | any | Prompt user |
| No | `read` / `low_write` | Proceed silently |
| No | `medium_write` | **BLOCK** (new) |
| No | `high_write` | **BLOCK** (unchanged) |
| No | `destructive` | **BLOCK** (unchanged) |

### Breaking Change Notice

This is a **breaking behavior change** for users on clients without elicitation
(Claude Desktop, Windsurf). Operations previously classified as `medium_write`
that proceeded silently will now block. Affected operations include:

- `repo_rule.create`, `repo_rule.update`, `space_rule.create`, `space_rule.update`
- `scs_remediation.create` (PR remediation)

**Must be called out in release notes.**

#### Reclassification: `execution.interrupt` and `chaos_experiment.stop`

These are currently `medium_write` but should be reclassified to `low_write`.
Stopping a runaway pipeline or chaos experiment is a **safety action** — blocking
it on non-elicitation clients could leave a pipeline running longer than intended,
making things worse. Same principle as the `chaos_dr_test.create` reclassification
in spec 001.

### API Change

```typescript
// Before
confirmViaElicitation({ server, toolName, message, destructive: boolean })

// After
confirmViaElicitation({ server, toolName, message, risk: RiskLevel })
```

### Callers Updated

| File | Before | After |
|---|---|---|
| `harness-create.ts` | `destructive: isBlockingRisk(risk)` | `risk` |
| `harness-update.ts` | `destructive: isBlockingRisk(risk)` | `risk` |
| `harness-execute.ts` | `destructive: isBlockingRisk(risk)` | `risk` |
| `harness-delete.ts` | `destructive: true` | `risk: "destructive"` |

`isBlockingRisk()` is no longer used by tool handlers after this change.
Mark as `@deprecated` with JSDoc pointing to `requiresConfirmation()`.
After P3, the meaningful APIs are:
- `requiresConfirmation(risk)` — does this risk level block on non-elicitation clients?
- `shouldAutoApprove(risk, threshold)` — does the autonomous mode skip this risk level?

`isBlockingRisk` is redundant (it checks `high_write || destructive`, a subset
of `requiresConfirmation`'s `medium_write || high_write || destructive`).

---

## P4: Risk-Based Autonomous Mode

### New Config

```typescript
HARNESS_AUTO_APPROVE_RISK: z.enum([
  "none",          // (default) always confirm — fully interactive
  "low_write",     // auto-approve reads + low writes
  "medium_write",  // auto-approve up to medium writes
  "high_write",    // auto-approve up to high writes (dangerous)
  "all",           // auto-approve everything incl. destructive (CI/CD mode)
]).default("none"),
```

### Backward Compatibility

`HARNESS_SKIP_ELICITATION` remains in the config schema. Resolution:

| `SKIP_ELICITATION` | `AUTO_APPROVE_RISK` | Effective threshold |
|---|---|---|
| not set | not set | `none` (interactive) |
| not set | `low_write` | `low_write` |
| `true` | not set | `all` + deprecation warning |
| `true` | `medium_write` | `medium_write` (explicit wins) |
| `false` | not set | `none` |

Deprecation warning on stderr:
```
[DEPRECATION] HARNESS_SKIP_ELICITATION is deprecated. Use HARNESS_AUTO_APPROVE_RISK instead.
  HARNESS_SKIP_ELICITATION=true is equivalent to HARNESS_AUTO_APPROVE_RISK=all.
```

### Auto-Approve Logic

```typescript
/** Explicit numeric ordering — do not rely on array index. */
const RISK_SEVERITY: ReadonlyMap<RiskLevel, number> = new Map([
  ["read", 0],
  ["low_write", 1],
  ["medium_write", 2],
  ["high_write", 3],
  ["destructive", 4],
]);

export type AutoApproveRisk = "none" | RiskLevel | "all";

export function shouldAutoApprove(opRisk: RiskLevel, threshold: AutoApproveRisk): boolean {
  if (threshold === "none") return false;
  if (threshold === "all") return true;
  const opSeverity = RISK_SEVERITY.get(opRisk) ?? 999;
  const thresholdSeverity = RISK_SEVERITY.get(threshold as RiskLevel) ?? -1;
  return opSeverity <= thresholdSeverity;
}
```

### Updated `configureElicitation`

```typescript
export function configureElicitation(opts: {
  autoApproveRisk?: AutoApproveRisk;
}): void { ... }
```

### Full Decision Flow

```
Operation
  │
  ▼
shouldAutoApprove(risk, AUTO_APPROVE_RISK)?
  ├── yes → PROCEED
  └── no
       │
       ▼
     Client supports elicitation?
       ├── yes → Prompt user → accept/decline/cancel
       └── no
            │
            ▼
          requiresConfirmation(risk)?
            ├── yes (medium+) → BLOCK
            └── no (read/low) → PROCEED
```

---

## P5: Retry Policy Threading

### Current State

`HarnessClient.request()` retries on HTTP 429, 500, 502, 503, 504 for all
requests. `retryPolicy` exists on every `EndpointSpec.operationPolicy` but is
never read.

### Changes

**1. Add `retryPolicy` to `RequestOptions`** ([src/client/types.ts](src/client/types.ts)):

```typescript
export interface RequestOptions {
  // ...existing fields...
  /** Retry policy from OperationPolicy. When "do_not_retry", skip retries on 5xx. */
  retryPolicy?: "safe" | "idempotency_key_required" | "do_not_retry";
}
```

**2. Thread through `executeSpec`** ([src/registry/index.ts](src/registry/index.ts)):

```typescript
const requestOpts = {
  ...existing,
  retryPolicy: spec.operationPolicy.retryPolicy,
};
```

**3. Check in retry loop** ([src/client/harness-client.ts](src/client/harness-client.ts)):

Two locations where retry decisions are made:

```typescript
// Location 1: HTTP error retry (line ~280)
if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
  if (options.retryPolicy === "do_not_retry") {
    throw error;
  }
  lastError = error;
  continue;
}

// Location 2: Timeout retry (line ~323)
if (err.name === "AbortError" && !options.signal?.aborted) {
  lastError = new HarnessApiError("Request timed out", 408, ...);
  if (options.retryPolicy === "do_not_retry" || attempt >= this.maxRetries) {
    throw lastError;
  }
  continue;
}
```

**Note on `idempotency_key_required`:** This spec does NOT implement idempotency
key generation. `idempotency_key_required` is treated identically to `safe` for
now (retries are allowed). When Harness APIs support idempotency headers, a
follow-up can inject them. The type value exists as documentation of intent.

---

## Files Changed

### Core types (1 file)
- `src/registry/types.ts` — add `requiresConfirmation()`, `shouldAutoApprove()`, `RISK_SEVERITY`, `AutoApproveRisk` type, deprecate `isBlockingRisk()`

### Config (1 file)
- `src/config.ts` — add `HARNESS_AUTO_APPROVE_RISK`, backward compat logic

### Elicitation (1 file)
- `src/utils/elicitation.ts` — replace `destructive` with `risk`, add autonomous threshold

### Tool handlers (4 files)
- `src/tools/harness-create.ts` — pass `risk` instead of `destructive`
- `src/tools/harness-update.ts` — same
- `src/tools/harness-delete.ts` — same (pass `risk: "destructive"`)
- `src/tools/harness-execute.ts` — same

### HTTP client (2 files)
- `src/client/types.ts` — add `retryPolicy` to `RequestOptions`
- `src/client/harness-client.ts` — check `retryPolicy` before retry

### Registry dispatch (1 file)
- `src/registry/index.ts` — thread `retryPolicy` into `requestOpts`

### Server entrypoint (1 file)
- `src/index.ts` — pass `autoApproveRisk` to `configureElicitation`

---

## Test Plan

### Unit Tests (`tests/utils/elicitation.test.ts`)

- `requiresConfirmation` — read/low return false, medium/high/destructive return true
- `shouldAutoApprove` — all combinations of risk x threshold
- `confirmViaElicitation` with `risk` param:
  - `low_write` + no elicitation → proceed
  - `medium_write` + no elicitation → block (new behavior)
  - `high_write` + no elicitation → block
  - All levels + elicitation available → prompt user
  - `low_write` + `autoApproveRisk=low_write` → auto-approve
  - `high_write` + `autoApproveRisk=low_write` → not auto-approved
  - `destructive` + `autoApproveRisk=all` → auto-approve

### Integration Tests (`tests/integration/elicitation-flow.test.ts`)

- `medium_write` create blocks on non-elicitation client
- `low_write` create proceeds on non-elicitation client
- `HARNESS_AUTO_APPROVE_RISK=low_write` auto-approves low creates, blocks high
- `HARNESS_AUTO_APPROVE_RISK=all` auto-approves destructive deletes
- Backward compat: `HARNESS_SKIP_ELICITATION=true` → auto-approves all

### Retry Tests (`tests/registry/registry.test.ts` or new file)

- `retryPolicy` is threaded to `client.request` options
- `do_not_retry` request does not retry on 502
- `safe` request retries normally on 502
- `do_not_retry` request does not retry on timeout

### Config Tests

- `HARNESS_AUTO_APPROVE_RISK` parses all valid values
- `SKIP_ELICITATION=true` + no `AUTO_APPROVE_RISK` → effective `all` + deprecation warning
- Both set → `AUTO_APPROVE_RISK` wins

---

## Migration Checklist

- [ ] Add `AutoApproveRisk` type, `RISK_SEVERITY`, `shouldAutoApprove`, `requiresConfirmation` to `types.ts`; deprecate `isBlockingRisk`
- [ ] Add `HARNESS_AUTO_APPROVE_RISK` to config schema with backward compat
- [ ] Refactor `confirmViaElicitation` — `risk: RiskLevel` replaces `destructive: boolean`
- [ ] Wire `autoApproveRisk` threshold into elicitation module
- [ ] Update 4 tool handlers to pass `risk` instead of `destructive`
- [ ] Reclassify `execution.interrupt` and `chaos_experiment.stop` to `low_write`
- [ ] Add `retryPolicy` to `RequestOptions`
- [ ] Thread `retryPolicy` from `executeSpec` to `client.request`
- [ ] Check `retryPolicy` in retry loop (HTTP errors + timeout)
- [ ] Update `src/index.ts` to pass `autoApproveRisk` to `configureElicitation`
- [ ] Update unit tests (elicitation, requiresConfirmation, shouldAutoApprove)
- [ ] Update integration tests (risk-gated blocking, autonomous modes)
- [ ] Add retry policy threading tests
- [ ] `pnpm typecheck && pnpm test`

---

## What This Does NOT Cover

- **Idempotency key injection** — `idempotency_key_required` is a marker only.
  Actual header injection requires Harness API support and is a separate spec.
- **Chat-based confirmation fallback** — an alternative to form elicitation for
  non-elicitation clients. Out of scope; the current behavior (block or proceed)
  is sufficient. Can be added later as a P3 follow-on.
- **Per-resource autonomous overrides** — e.g. "auto-approve pipeline.run but
  confirm gitops_application.sync". The current threshold is global. Per-resource
  overrides can be layered on top of `HARNESS_AUTO_APPROVE_RISK` later.

---

## Shipping Strategy

Split into two commits/PRs since P5 is fully independent:

- **Commit 1 (P3+P4):** Elicitation refactor + autonomous mode. Touches
  `types.ts`, `elicitation.ts`, `config.ts`, `index.ts`, all 4 tool handlers,
  and their tests. Includes `execution.interrupt`/`chaos_experiment.stop`
  reclassification.
- **Commit 2 (P5):** Retry policy threading. Touches `client/types.ts`,
  `harness-client.ts`, `registry/index.ts`, and retry tests only.

If one fails CI, the other can still land.
