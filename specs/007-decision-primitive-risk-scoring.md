# Spec 007: Dynamic Blast-Radius Scoring via Decision Primitives

**Status:** Draft
**Author:** Decision Primitives Follow-up
**Date:** 2026-09-19
**Depends on:** 001 (OperationPolicy), 003 (P3/P4 elicitation + autonomous mode)
**Related:** `harness-evals` DP-1..DP-4 (`ChoiceMetric`/`ScoreMetric`/`NoulMetric` against `TypeSafeDecisionProvider`; `docs/designs/2026-09-19-decision-primitives/efficacy-results.md`)
**Unblocks:** nothing (additive, opt-in); precedes any future per-call intent routing

---

## Problem

Spec 003 made the elicitation gate risk-aware, but risk is still a **static
label on the operation type**, assigned once at dev time in a toolset file:

```typescript
// src/registry/toolsets/pipelines.ts
delete: {
  operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
  ...
}
```

`pipeline.delete` is `destructive` for every call, whether the target is an
empty sandbox pipeline created five minutes ago or a production pipeline
with a year of execution history. The gate cannot tell those two calls
apart — it classifies the *operation*, never the *instance*. Two concrete
costs of this:

1. **False-positive friction.** Every low-stakes delete/update on a
   `medium_write`+ resource interrupts the user (or blocks a
   non-elicitation client) exactly as hard as a high-stakes one. There is
   no way to reduce this without lowering the static label for the whole
   operation type — which would also lower it for the high-stakes case.
2. **No signal in the audit trail about *why* something was risky.**
   `AuditEvent` today records the outcome (`auto_approved` /
   `elicited` / `blocked`) and the static risk label, but nothing about the
   actual state of the resource being acted on. Two `pipeline.delete` audit
   rows with `risk: "destructive"` look identical whether or not the delete
   actually mattered.

This spec proposes a narrow, opt-in mechanism to score the *actual call* —
using the decision-primitive vocabulary already shipped in `harness-evals`
(Choice / Score / Noul against a live TypeSafe decision provider) — and use
that score to move the effective risk within a band the operation's static
policy already permits. It does not replace the static risk system from
spec 001/003; it adds a second, narrower signal on top of it, for a small,
explicit set of pilot resources.

---

## Why a decision primitive and not an LLM-judge call

This gate runs inline, in the hot path, before every gated write. Latency
here is user-facing latency on every `medium_write`+ tool call, not
background batch cost. `harness-evals` DP-4 (live comparison, 108 calls, 3
dimensions) found decision primitives against TypeSafe were **7-9x faster**
than a comparable LLM-as-judge prompt against Claude (0.15-0.19s vs.
1.3-1.4s mean, on fixed-rubric classification tasks) — the one result that
held across every dimension tested, independent of which side won on
accuracy. An LLM-judge call added to every gated write would be a
user-visible latency regression; a TypeSafe `Score` call, on the numbers
we already have, is close to free relative to the surrounding tool-call
round trip.

This is supporting evidence, not a guarantee for this specific workload —
DP-4 tested short-text classification, not resource-state scoring. Section
"Rollout" below treats the latency assumption as something to verify against
this actual call shape before enabling by default anywhere.

---

## Solution Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                    Tool Handler (create/update/delete/execute)     │
│                                                                    │
│  1. Read operationPolicy.risk + riskFloor from EndpointSpec        │
│  2. If riskFloor < risk AND a riskScorer is registered:             │
│       effectiveRisk = await scoreBlastRadius(...)   ← NEW          │
│     else:                                                          │
│       effectiveRisk = risk                    (today's behavior)  │
│  3. Call confirmViaElicitation({ risk: effectiveRisk })            │
│  4. Call registry.dispatch(...)                                    │
│  5. Audit row includes risk, riskFloor, blastRadius score/conf,    │
│     effectiveRisk, scorerStatus                                    │
└────────────────────────────────────────────────────────────────────┘
```

Nothing changes for the 219+ resource types that don't opt in — `riskFloor`
defaults to `risk` (a zero-width band), so `effectiveRisk` is always `risk`,
identical to today. This is additive and off by default.

---

## Core mechanism: a risk *band*, not a risk *override*

### `OperationPolicy` gains an optional floor

```typescript
export interface OperationPolicy {
  risk: RiskLevel;             // unchanged — the ceiling. What a human decided
                                // this operation type deserves at its worst.
  retryPolicy: RetryPolicy;
  /**
   * Optional lower bound for dynamic risk scoring. When set and below `risk`,
   * a registered `riskScorer` may lower the effective risk for THIS CALL
   * down to (but not below) `riskFloor`, if it confidently scores the call
   * as low blast-radius. Defaults to `risk` (no band, no dynamic scoring
   * possible) when omitted.
   */
  riskFloor?: RiskLevel;
}
```

**The direction is deliberately one-way: scoring can only lower risk toward
`riskFloor`, never raise it above `risk`.** `risk` remains the ceiling a
human already assigned to the operation type in spec 001/003 — this spec
does not touch that judgment. A dynamic signal earns a *reduction* in
friction only when it actively and confidently says the specific call is
low-stakes; it can never talk the gate into being stricter than a human
already decided, and — critically — it can never talk the gate into being
laxer than the human-assigned ceiling by mistake, because the ceiling is
also the fail-closed default (next section).

### Fail-closed default

If the scorer is disabled, unregistered for this resource, times out,
errors, or returns low confidence, **`effectiveRisk = risk`** — the
original static ceiling, i.e. exactly today's behavior. A TypeSafe outage
degrades this feature to a no-op, not to reduced safety and not to new
blocking. The lowered floor is only ever reachable via an explicit,
confident, successful score.

```typescript
async function scoreEffectiveRisk(
  policy: OperationPolicy,
  scorer: RiskScorer | undefined,
  ctx: RiskScoringContext,
  cfg: Config,
): Promise<{ effectiveRisk: RiskLevel; scoring: RiskScoringOutcome }> {
  const floor = policy.riskFloor ?? policy.risk;
  if (floor === policy.risk || !scorer || !cfg.HARNESS_DYNAMIC_RISK_SCORING) {
    return { effectiveRisk: policy.risk, scoring: { status: "skipped" } };
  }
  try {
    const signal = await withTimeout(scorer(ctx), cfg.HARNESS_DYNAMIC_RISK_TIMEOUT_MS ?? 400);
    if (signal.confidence < (cfg.HARNESS_DYNAMIC_RISK_MIN_CONFIDENCE ?? 0.6)) {
      return { effectiveRisk: policy.risk, scoring: { status: "low_confidence", signal } };
    }
    const lowered = signal.blastRadius < (cfg.HARNESS_DYNAMIC_RISK_THRESHOLD ?? 0.5);
    return {
      effectiveRisk: lowered ? floor : policy.risk,
      scoring: { status: "scored", signal, effectiveRisk: lowered ? floor : policy.risk },
    };
  } catch (err) {
    log.warn("Risk scorer failed, falling back to static risk", { error: String(err) });
    return { effectiveRisk: policy.risk, scoring: { status: "error", error: String(err) } };
  }
}
```

A single scalar threshold (`blastRadius < 0.5` → floor, else ceiling) is
deliberately simple for v1. It is a Score primitive, not a Noul, because
blast-radius is a spectrum with a description per level (see below), not a
crisp yes/no condition — matching the "Noul and Score get confused" guidance
from the decision-primitives essay. A three-way band (floor / mid / ceiling)
is a natural v2 extension once real threshold data exists; introducing it
now would be tuning against no data.

### `RiskScorer` contract

```typescript
export interface RiskScoringContext {
  resourceType: string;
  operation: "create" | "update" | "delete" | "execute";
  input: Record<string, unknown>;
  client: HarnessClientInterface;
  accountId?: string;
  signal?: AbortSignal;
}

export interface RiskSignal {
  /** 0 (trivial to reverse / no real impact) .. 1 (severe, hard to reverse). */
  blastRadius: number;
  /** TypeSafe's own confidence in this Score answer, not a heuristic. */
  confidence: number;
  /** Short, human-readable justification — echoed to the user and the audit row. */
  rationale: string;
}

export type RiskScorer = (ctx: RiskScoringContext) => Promise<RiskSignal>;
```

Registered per resource+operation on `EndpointSpec`, alongside the existing
`preflight` hook — but invoked *before* `confirmViaElicitation` in the tool
handler, not inside `executeSpec`/dispatch where `preflight` runs today.
(`preflight` runs after the user has already confirmed; it exists for
things like duplicate-checks right before the API call. Risk scoring must
run *before* the confirmation decision, so it needs its own call site.)

```typescript
export interface EndpointSpec {
  // ...existing fields...
  riskScorer?: RiskScorer;
}
```

---

## Pilot resources (v1 scope: exactly two)

Dynamic scoring only ships for two pilot operations in v1. Every other
resource keeps `riskFloor` unset (= `risk`), so scoring is inert everywhere
else. Scope is deliberately narrow — this is a new inline dependency on an
external service in the write path, and it should prove out on operations
where the state signal is cheap to fetch and the stakes are legible before
it goes anywhere near the other 200+ resource types.

### `pipeline.delete`

- `operationPolicy: { risk: "destructive", riskFloor: "high_write", retryPolicy: "do_not_retry" }`
- State fetched in the scorer: execution count in the last 30 days (via the
  existing pipeline-execution list endpoint the registry already exposes),
  most recent execution's status, whether the pipeline is tagged for a
  production/prod-like environment.
- TypeSafe `Score` criteria (illustrative, to be finalized with product):
  - 0.0-0.2: no executions ever, or created and never run — sandbox/scratch pipeline.
  - 0.2-0.5: some executions, none in the last 30 days, no prod environment tag.
  - 0.5-0.8: active in the last 30 days, or touches a tagged prod environment.
  - 0.8-1.0: frequent recent executions AND a prod environment tag.
- Effect: an empty, never-run pipeline delete can drop to `high_write`
  (still gated, still auditable, but eligible for `HARNESS_AUTO_APPROVE_RISK
  = high_write` in autonomous mode). An active or prod-tagged pipeline stays
  `destructive` — unaffected by this feature; that is the existing spec
  001/003 behavior, chosen deliberately, not a regression.

### `feature_flag.update` (targeting rules / rollout percentage changes)

- `operationPolicy: { risk: "medium_write", riskFloor: "low_write", retryPolicy: "safe" }`
- State fetched: current rollout percentage, target environment
  (dev/staging vs. production), whether the flag has recent evaluation
  volume.
- Effect: a targeting change on a 0%-rollout dev flag can drop to
  `low_write` (silent proceed on non-elicitation clients, matching spec
  003's `read`/`low_write` behavior). A change to a flag serving real
  production traffic stays `medium_write` — gated as it is today.

Both pilots were chosen because the state signal is a single, cheap,
already-available read (execution list; flag evaluation metrics) — not
because they are the highest-value targets. If the pattern proves out,
expansion to more resources is a follow-up spec, not part of this one.

---

## Always-on: surfaced rationale, independent of gate outcome

Regardless of whether the score changes `effectiveRisk`, when a scorer runs
successfully its `rationale` is:

1. Appended to the elicitation `message` shown to the human (e.g. "Delete
   pipeline "nightly-build"? This is destructive and cannot be undone. Risk
   assessment: 340 executions in the last 30 days, most recent 2 hours ago —
   this pipeline is active.").
2. Included in the tool's JSON response under a `risk_assessment` field, on
   both the proceed and blocked paths — so a client that ignores elicitation
   prompts (many autonomous/non-interactive agents do, since they can
   override with `confirm: true`) still gets the reasoning in the response
   it reads, even though nothing here prevents that client from proceeding
   anyway.

This half of the feature does not need `riskFloor < risk` to be worth
shipping — it's the cheap, always-safe part: it never changes behavior, only
what's visible. It is the direct answer to "will agents actually use this":
mostly not as a reasoning input on the gate (the override path means many
agents won't be *stopped* by a better score), but the rationale text is
available in both the human-facing prompt and the machine-facing tool
response either way, which is what actually makes the audit trail and the
end-user's visibility better regardless of agent behavior. See "What this
does NOT solve" below — the agent's ability to override with `confirm: true`
is unchanged and out of scope.

---

## Audit enrichment

`AuditEvent` (`src/audit/types.ts`) gains, only for calls where a scorer ran:

```typescript
export interface AuditEvent {
  // ...existing fields...
  risk_scoring?: {
    static_risk: RiskLevel;
    risk_floor: RiskLevel;
    status: "skipped" | "scored" | "low_confidence" | "error";
    blast_radius?: number;
    confidence?: number;
    rationale?: string;
    effective_risk: RiskLevel;
  };
}
```

This is the actual payoff for the `harness-evals` connection: once these
rows exist, they're a decision trace in the same shape DP-4 evaluated
offline — "given this state, was `blast_radius=0.15` the right call for a
pipeline that turned out to have zero executions?" becomes a labelable,
gradeable eval case, the same way DP-4 graded Choice/Score/Noul answers
against hand labels. That eval loop is future work (a natural `harness-evals`
follow-up once enough audit rows accumulate), not part of this spec.

---

## Config

```typescript
HARNESS_DYNAMIC_RISK_SCORING: z.coerce.boolean().default(false),
HARNESS_DYNAMIC_RISK_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
HARNESS_DYNAMIC_RISK_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.6),
HARNESS_DYNAMIC_RISK_TIMEOUT_MS: z.coerce.number().int().positive().default(400),
```

`HARNESS_DYNAMIC_RISK_SCORING` defaults to `false` — this feature does
nothing unless explicitly enabled, and enabling it requires a TypeSafe
credential to be configured (`TYPESAFE_API_KEY` or equivalent, name TBD by
whatever the Node client expects). If the flag is `true` but no credential
is present, log a startup warning and behave as if the flag were `false`
(fail closed at startup, not per-call).

---

## Prerequisite: no TypeScript TypeSafe client exists yet

`harness-evals`'s decision primitives wrap the Python `typesafe-sdk` PyPI
package. `mcp-server` is TypeScript/Node. As of this writing, `typesafe-sdk`
on npm resolves to a placeholder (`0.0.0`, no real implementation) — there is
no usable Node client today. This spec's `RiskScorer` implementation is
blocked on one of:

1. A real Node/TS TypeSafe SDK shipping (mirrors the Python one), or
2. A minimal direct HTTP client against TypeSafe's decision API written for
   this repo, scoped to just the `Score` primitive (no Choice/Noul needed
   for the two v1 pilots).

Option 2 is smaller and unblocks this spec without waiting on an external
SDK's roadmap; recommended for v1. Whoever picks up implementation should
confirm this against TypeSafe's current API docs before writing code — this
spec defines the contract (`RiskScorer`/`RiskSignal`), not the transport.

---

## Files Changed

### Core types (1 file)
- `src/registry/types.ts` — add `riskFloor?` to `OperationPolicy`, add
  `RiskScoringContext`, `RiskSignal`, `RiskScorer` types, add `riskScorer?`
  to `EndpointSpec`

### New module (1-2 files)
- `src/utils/risk-scoring.ts` — `scoreEffectiveRisk()`, timeout wrapper,
  fail-closed logic
- `src/client/typesafe-client.ts` (new, per "Prerequisite" above) — minimal
  Score-primitive HTTP client, or swap for a real SDK if one lands first

### Config (1 file)
- `src/config.ts` — add `HARNESS_DYNAMIC_RISK_SCORING`,
  `HARNESS_DYNAMIC_RISK_THRESHOLD`, `HARNESS_DYNAMIC_RISK_MIN_CONFIDENCE`,
  `HARNESS_DYNAMIC_RISK_TIMEOUT_MS`; startup warning when enabled without a
  credential

### Elicitation call sites (2 files, pilot only)
- `src/tools/harness-delete.ts` — call `scoreEffectiveRisk()` before
  `confirmViaElicitation` when `resource_type === "pipeline"`; pass
  `effectiveRisk`; append `rationale` to the message; add `risk_assessment`
  to the response
- `src/tools/harness-update.ts` — same, when `resource_type === "feature_flag"`

### Pilot toolset defs (2 files)
- `src/registry/toolsets/pipelines.ts` — `pipeline.delete` gains
  `riskFloor: "high_write"` and a `riskScorer`
- `src/registry/toolsets/feature-flags.ts` — the targeting/rollout update
  endpoint gains `riskFloor: "low_write"` and a `riskScorer`

### Audit (2 files)
- `src/audit/types.ts` — add `risk_scoring?` to `AuditEvent`
- `src/audit/manager.ts` / relevant sinks — pass through the new field
  (no sink-specific logic needed; JSONL/webhook/OTel sinks already forward
  the full event)

---

## Test Plan

### Unit tests (`tests/utils/risk-scoring.test.ts`)
- `riskFloor` unset → `effectiveRisk === risk` always, scorer never called
- `riskFloor` set, scoring disabled (`HARNESS_DYNAMIC_RISK_SCORING=false`) →
  `effectiveRisk === risk`, status `skipped`
- `riskFloor` set, scorer returns `blastRadius < threshold`,
  confidence ≥ min → `effectiveRisk === riskFloor`, status `scored`
- Same, `blastRadius ≥ threshold` → `effectiveRisk === risk`
- Confidence below `HARNESS_DYNAMIC_RISK_MIN_CONFIDENCE` → `effectiveRisk
  === risk`, status `low_confidence`, regardless of `blastRadius`
- Scorer throws → `effectiveRisk === risk`, status `error`, no exception
  propagates
- Scorer exceeds `HARNESS_DYNAMIC_RISK_TIMEOUT_MS` → treated as `error`,
  `effectiveRisk === risk`
- `effectiveRisk` is never more severe than the static `risk` under any
  scorer output (property test: for all `blastRadius`/`confidence` inputs,
  `RISK_SEVERITY.get(effectiveRisk) <= RISK_SEVERITY.get(risk)`)

### Integration tests (`tests/integration/dynamic-risk-scoring.test.ts`)
- `pipeline.delete` on a pipeline with a mocked "zero executions" scorer
  response → `effectiveRisk = "high_write"`; with
  `HARNESS_AUTO_APPROVE_RISK=high_write` set, proceeds without elicitation
- Same pipeline, mocked "340 executions, active" scorer response →
  `effectiveRisk = "destructive"`; same auto-approve threshold still elicits
- TypeSafe client mocked to reject/timeout → falls back to `"destructive"`,
  identical to spec-003 behavior with scoring disabled
- Audit row for a scored call includes `risk_scoring.blast_radius`,
  `.confidence`, `.rationale`, `.effective_risk`
- Response payload includes `risk_assessment` on both the pipeline pilot
  path and (mocked) the feature-flag pilot path

### Config tests
- `HARNESS_DYNAMIC_RISK_SCORING=true` with no TypeSafe credential configured
  → startup warning logged, feature behaves as disabled
- Threshold/confidence env vars parse and clamp to `[0, 1]`

---

## Migration Checklist

- [ ] Confirm the Node/TS TypeSafe client story (see "Prerequisite") before
  writing `risk-scoring.ts`
- [ ] Add `riskFloor?`, `RiskScoringContext`, `RiskSignal`, `RiskScorer`,
  `riskScorer?` to `types.ts`
- [ ] Implement `scoreEffectiveRisk()` with timeout + fail-closed logic
- [ ] Add the four `HARNESS_DYNAMIC_RISK_*` config vars with startup
  credential check
- [ ] Wire `scoreEffectiveRisk()` into `harness-delete.ts` for
  `resource_type === "pipeline"` only
- [ ] Wire into `harness-update.ts` for `resource_type === "feature_flag"`
  targeting/rollout endpoint only
- [ ] Add `riskFloor` + `riskScorer` to the two pilot `EndpointSpec`s
- [ ] Add `risk_scoring?` to `AuditEvent`; verify existing sinks forward it
  without changes
- [ ] Append rationale to elicitation message; add `risk_assessment` to
  both pilot tool responses
- [ ] Unit + integration + config tests above
- [ ] `pnpm typecheck && pnpm test`
- [ ] Manual check: run both pilots against a real TypeSafe key, confirm
  observed latency stays within the DP-4-informed budget (target: p95
  scorer call time ≤ `HARNESS_DYNAMIC_RISK_TIMEOUT_MS`, i.e. the timeout
  should rarely fire in practice, not act as the normal path)

---

## What This Does NOT Cover

- **More than two pilot resources.** Every other resource type is
  unaffected; `riskFloor` stays unset. Expansion is a follow-up spec once
  the pilots have real audit data.
- **Raising risk above the static ceiling.** This spec only ever lowers
  friction, never adds it beyond what spec 001/003 already assigned. A
  resource that's currently `medium_write` cannot become `destructive`
  through this mechanism, even if a hypothetical scorer thought it should —
  that direction is out of scope and would need a different, more
  conservative design (false positives in the "more dangerous" direction
  are a very different risk profile than false positives in the "less
  dangerous" direction).
- **The `confirm: true` override path.** Nothing here changes the fact that
  non-elicitation-capable or fully autonomous callers can pass
  `confirm: true` and bypass confirmation regardless of `effectiveRisk`.
  Better scoring reduces false-positive friction for interactive users; it
  does not constrain callers who already opt out of confirmation entirely.
  Addressing that is a separate, harder problem (arguably not solvable at
  this layer at all) and is explicitly not attempted here.
- **A three-way (floor/mid/ceiling) band or per-resource-configurable
  thresholds.** v1 is a single scalar threshold shared across both pilots.
  Tune once real data exists.
- **The offline eval loop for scored decisions** (grading `blast_radius`
  answers against hand-labeled outcomes the way DP-4 graded Choice/Score/Noul
  against `dataset.py`). The audit enrichment in this spec produces the raw
  material for that; building the eval harness is separate follow-up work,
  naturally suited to `harness-evals` rather than this repo.

---

## Shipping Strategy

Single PR, entirely inert by default (`HARNESS_DYNAMIC_RISK_SCORING=false`):

1. Types + config + `risk-scoring.ts` + audit field (no behavior change by
   themselves — nothing calls the new code path yet).
2. Wire the two pilot call sites + toolset defs.
3. Tests from the plan above, including the fail-closed property test.

Land as one PR rather than splitting like spec 003's P3/P4 vs P5 — unlike
that spec, nothing here is a breaking change to existing behavior (the
default is off, and even when on, effective risk is never worse than
today's static value), so there's no independent-failure-isolation reason
to split it.

Enable `HARNESS_DYNAMIC_RISK_SCORING` in one internal/staging environment
first, watch the audit trail and p95 scorer latency for at least the two
pilots, before recommending it as a documented, supported config option.
