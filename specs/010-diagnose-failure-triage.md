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
2. If HARNESS_DIAGNOSE_TRIAGE is on and a TYPESAFE_API_KEY is configured:
     category = await classifyFailure(logData)   // Choice, 6 categories
   else:
     category = undefined
3. Response JSON gains `triage: { "stage/step": { category, confidence } }`
   for each classified failed step. Every existing field is unchanged either
   way. (No fabricated `rationale` — category and confidence are the honest
   signal; the step's evidence is already in the response.)
```

Classification runs whenever failed steps exist — it is NOT gated on
`include_logs`, so the default summary call still gets `triage`. The log
snippet is included in the classifier state only when one was fetched as a
string. Classification is parallel across the capped failed-step list (at
most `max_failed_steps`, default 5), each call under its own timeout.

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

## Credentials and data egress

`TYPESAFE_API_KEY` / `TYPESAFE_BASE_URL` live on `ConfigSchema` (not raw
`process.env`), mirroring the FME pattern: parsed/validated by Zod, pinned
by config tests, exposed in the packaged manifests' `user_config`. They are
rejected in `multi-user` and `oauth` modes — triage egresses failure messages
and fetched log snippets to the TypeSafe API on behalf of every session, so
the key cannot be shared across users. The public contract (tool
description, README env table, `debug-pipeline-failure` prompt) documents the
`triage` field and this egress. The category rubric below is sent as the
Choice `criteria` values so the classifier sees definitions, not just labels.

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

- Wire-contract tests for the TypeSafe client: POST body is
  `{ state, model, questions: { category: { type: "choice", instructions,
  criteria, state } } }` with Bearer auth — `criteria` is a dict of
  name -> description, never a flat `choices` array; unrecognized choice,
  non-2xx, and malformed answers throw `TypeSafeError`.
- Unit tests for the classifier call: 6 categories return correctly shaped
  responses; the spec rubric is sent as `descriptions`; timeout/error/
  low-confidence → `triage` omitted, no exception propagates.
- Config tests: triage knob defaults, TYPESAFE key parse/unset handling,
  multi-user/oauth rejection, HTTPS validation for the base URL.
- Pipeline wiring tests with the real `classifyFailure` (only the TypeSafe
  client is spied): flag off → client never called; default summary path →
  `triage` attached with the rubric; `include_logs` skipped → still triaged.
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