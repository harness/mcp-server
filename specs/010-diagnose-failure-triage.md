# Spec 010: Failure-Category Triage in `harness_diagnose` (Choice)

**Status:** Implemented
**Date:** 2026-09-19

---

## Problem

`harness_diagnose` (`src/tools/diagnose/pipeline.ts`) fetches step-level
errors, log snippets, delegate info, and chained-pipeline traversal for a
failed execution, and returns it to the calling agent as-is. The agent then
has to re-derive, on every single call, whether a failure is an
infra-flake, a genuine test failure, a config error, a missing dependency, a
permission problem, or a timeout — from the same raw log text a triage step
could categorize once, server-side, using data already fetched for the
response.

## Why Choice

The categories are a closed, mutually exclusive set — "pick one of N named
alternatives" is exactly the TypeSafe Choice primitive's shape, not a graded
spectrum (Score) or a single yes/no condition (Noul).

## Mechanism — advisory only

A wrong category here costs the agent one bad first guess at what to do
next — it never touches a write path, never changes whether an operation
proceeds, and never gates anything. That bounded blast radius is why this
ships as pure enrichment from day one — no gating design to retire later.

```
1. harness_diagnose fetches step logs/errors/delegate info as it does today.
2. If HARNESS_DIAGNOSE_TRIAGE is on and a TypeSafe key is configured:
     category = await classifyFailure(logData)   // Choice, 6 categories
   else:
     category = undefined
3. Response JSON gains `triage: { "stage/step": { category, confidence,
   rationale } }` for each classified failed step. Every existing field is
   unchanged either way.
```

Nothing about the diagnose response's existing shape changes when the
flag/key is absent — a pure addition (no key → identical to before;
error/timeout/low confidence → `triage` omitted, not an error surfaced to
the agent).

## Signal

The same step-level error text, log snippet, and delegate status
`harness_diagnose` already fetches for its normal response — no new fetch.

## Categories (Choice, 6-way, mutually exclusive)

- `infra_flake` — delegate/runner/network transient failure, no code or
  config at fault.
- `test_failure` — the code under test genuinely failed its assertions.
- `config_error` — pipeline YAML, env var, or secret misconfiguration.
- `dependency_failure` — a downstream service/dependency the step calls
  failed or was unavailable.
- `permission_error` — auth/RBAC/scope failure calling an external system.
- `timeout` — the step exceeded its time budget with no clear error beyond that.

## Fallback contract

No `TYPESAFE_API_KEY` / `HARNESS_DIAGNOSE_TRIAGE` off → `triage` field
absent, response identical to today. Timeout/error/low confidence → same.
One dedicated flag — a read-tool enrichment is a structurally different
site from any write path, so it gets its own flag, not a shared one.

## Config

```typescript
HARNESS_DIAGNOSE_TRIAGE: booleanFromEnv.default(true),          // advisory; skips silently without a key
HARNESS_DIAGNOSE_TRIAGE_MIN_CONFIDENCE: ...number().min(0).max(1).default(0.6),
HARNESS_DIAGNOSE_TRIAGE_TIMEOUT_MS: ...number().int().positive().default(400),
```

## Pilot scope

One call site (`src/tools/diagnose/pipeline.ts`), per-step failures — a
chained-pipeline traversal with multiple failed steps returns triage for
each step independently in v1, no cross-step synthesis (that is closer to
"long-context reasoning" and stays out of scope).

## Test plan

- Unit tests for the classifier call: 6 categories return correctly shaped
  responses; timeout/error/low-confidence → `triage` omitted, no exception
  propagates to the tool's response.
- Snapshot test: `HARNESS_DIAGNOSE_TRIAGE=false` → diagnose response
  identical to pre-spec-010 output.
- No unit test for the rubric's category accuracy at ship time — validate
  the mechanism's fail-closed behavior exhaustively; validate the rubric's
  real-world accuracy via a live smoke test, not synthetic unit tests.

## What this spec does NOT do

- Does not change any diagnose behavior when the flag is off.
- Does not synthesize a triage category across multiple failed steps in a
  chained-pipeline traversal — one category per step.
- Does not feed `triage` into any retry/remediation logic automatically —
  it's information for the agent (or human) to act on, not an automated
  action trigger. If someone wants "auto-retry on infra_flake," that's a
  separate spec with its own blast-radius analysis, since automated retry
  is a different risk profile than an information field.