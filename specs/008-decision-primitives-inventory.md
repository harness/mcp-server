# Spec 008: Decision-Primitive Application Inventory

**Status:** Draft (documentation only — no implementation commitment)
**Author:** Decision Primitives Follow-up
**Date:** 2026-09-19
**Depends on:** 007 (dynamic blast-radius risk scoring — the only site implemented so far)
**Related:** `harness-evals` DP-1..DP-4, `docs/adr/011-decision-primitives.md`
**Unblocks:** nothing — this is a map to decide *what to build next*, not a build spec itself

---

## Purpose

Spec 007 prototyped exactly one decision-primitive application: a `Score`
call that lowers `pipeline.delete`'s effective risk when the specific
instance is confidently low-stakes. That prototype raised an obvious
question — where else in this server would a decision primitive actually
earn its keep, versus where would it just be complexity looking for a
justification?

This spec is the answer to that question, written down before more code
gets written, for two reasons:

1. **Force-fit is a real failure mode here.** Decision primitives are
   validated (DP-4) for one specific shape of problem — fast, narrow,
   fixed-rubric classification over short state. They are not a general
   substitute for the calling agent's reasoning, and not a replacement for
   deterministic logic that already works. Every candidate below is
   evaluated against that shape explicitly, and the rejected candidates are
   listed with the reason they were rejected — not just the accepted ones.
2. **Every candidate must degrade to today's behavior with zero
   TypeSafe access.** This server ships to operators who will never set
   `TYPESAFE_API_KEY`. None of what follows is allowed to become a load-bearing
   dependency. See "The fallback contract" below — it's the one rule every
   future decision-primitive site must satisfy, and it's normative, not just
   descriptive of spec 007.

---

## The fallback contract (normative — applies to every site below)

**A decision primitive may only ever make an already-correct behavior
*better*. It may never be required for an already-correct behavior to
happen at all.**

Concretely, for any future integration:

1. **No TypeSafe configured → behave exactly as if the feature doesn't
   exist.** Not degraded, not blocked, not warned-per-call — identical to
   the code path that existed before the integration. Spec 007 does this by
   construction: `riskFloor` defaults to `risk` (zero-width band) and
   `scoreEffectiveRisk()` returns `{ effectiveRisk: risk, status: "skipped" }`
   whenever `HARNESS_DYNAMIC_RISK_SCORING` is off or no scorer is registered.
2. **TypeSafe configured but the call fails/times out/is unconfident →
   same fallback as (1), not a new error.** A live TypeSafe outage must
   degrade the feature to a no-op, never to a blocked operation or a
   crash. Spec 007's fail-closed design (timeout → `error` status →
   `effectiveRisk = risk`) is the template for this.
3. **One config flag per site, off by default, each independently
   documented.** `HARNESS_DYNAMIC_RISK_SCORING` gates exactly one thing.
   A future site gets its own flag (e.g. a hypothetical
   `HARNESS_DIAGNOSE_TRIAGE`), not a shared "enable all primitives" switch —
   sites have different blast radii if wrong, and should be independently
   turned on, watched, and turned off.
4. **A missing credential is a startup warning, not a per-call
   warning.** `TYPESAFE_API_KEY` absent + a site's flag on → log once at
   startup, behave as flag-off for every call. Never repeat the warning
   per request (log spam) and never throw (an optional credential cannot be
   a hard startup failure).
5. **The deterministic thing it's augmenting must still exist in code,
   not just as a fallback path that atrophies.** If a site currently has a
   working regex/exact-match/static-policy check, that check stays the
   real fallback — it is not deleted in favor of "TypeSafe will handle it
   now." The primitive is additive; the deterministic path is still the
   correctness baseline.

Point 5 is why nothing below proposes *removing* an existing deterministic
check in favor of a primitive. Every candidate is framed as "on top of," not
"instead of."

---

## How to read the ratings

Each primitive wants a different problem shape:

- **Score** — a graded spectrum against an ordered rubric ("how much").
- **Noul** — yes/no against explicit criteria for each outcome.
- **Choice** — pick one of N named, mutually exclusive alternatives.

A candidate is rated **Good fit**, **Speculative**, or **Rejected**.
"Speculative" means the shape is right but there's no evidence yet of real
friction to justify building it — same trap spec 007 itself flagged for a
3-way band ("tune once real data exists").

---

## Score candidates

### Implemented: `pipeline.delete` blast-radius (spec 007)
The only site built so far. Ceiling `destructive`, floor `high_write`,
signal = 30-day execution history + prod-tag heuristic. See spec 007.

### Good fit: `repository.update` (repo rules) / `repository.delete`
**Where:** `src/registry/toolsets/repositories.ts`. Repo-level branch/push
rule updates sit at `risk: "high_write"`; repo/branch/tag deletes sit at
`risk: "destructive"`. **Signal:** default-branch protection status, open-PR
count, recent commit activity — all already fetched by sibling ops in the
same file, same shape as `pipeline.delete`'s execution-history heuristic.
**Why good fit, not speculative:** this is the only toolset file found
where *both* an update and a delete sit at elevated risk in the same
resource family — it mirrors the two-pilot structure spec 007 itself
anticipated (`pipeline.delete` + `feature_flag.update`), with a cheap
signal that's already in-file rather than requiring a new fetch.
**Recommended as the next pilot to build**, ahead of the other candidates
below.

### Good fit: `database_schema.delete` / `database_instance.delete`
**Where:** `src/registry/toolsets/dbops.ts:424-432, 559-567`. Both
`risk: "destructive"`; the tool descriptions themselves warn about
cascading deletes ("also delete all linked instances and migration
history" / "removes the instance and its migration execution history").
**Signal:** linked-instance/migration-history count for the schema, already
listable via `database_instance` ops in the same file. **Why good fit:**
same shape as `pipeline.delete` (count of dependents as the blast-radius
proxy), narrower blast radius than repo rules, no new fetch required.

### Speculative: `freeze.toggle_status` / `freeze.manage`
**Where:** `src/registry/toolsets/freeze.ts`, `risk: "high_write"`, gates
org/account-wide deploy freezes. **Candidate signal:** number of pipelines
currently under the freeze window, proximity to freeze start — plausible,
but not obviously already exposed by a sibling op in the same file the way
the two "good fit" candidates are. **Why speculative, not good-fit:** the
false-positive story is real (toggling off a freeze early in a quiet window
is low blast-radius; toggling one off mid-incident is not), but building it
means adding a new signal fetch rather than reusing one that already
exists — a materially different cost than #1/#2.

### Speculative: `delegate_token.revoke`
**Where:** `src/registry/toolsets/delegates.ts`, `risk: "high_write"`.
**Signal:** active-delegate count using that token, queryable via the
delegate list in the same file. Revoking a token with zero active delegates
is near-zero blast radius vs. one backing production delegates. Rated
speculative rather than good-fit only because it hasn't been checked
against real usage data the way the top two candidates' descriptions
already self-document their cascading-delete risk.

### Rejected as currently specced: `feature_flag.update` (targeting/rollout)
This is spec 007's own second pilot (`riskFloor: "low_write"`, signal =
rollout % + prod env + evaluation volume) — but the survey found both
`fme_feature_flag.update` and `fme_feature_flag_definition.update` already
sitting at `risk: "low_write"` in `feature-flags.ts:711, 1012`, below the
`medium_write` ceiling the spec assumes. **This is a spec/implementation
mismatch, not a ready candidate**: dynamic risk scoring has nothing to
lower from if the static ceiling is already at the floor spec 007 proposed.
Finishing this pilot as specced would first require deciding whether to
raise the static risk to `medium_write` (a real risk-posture change, not a
scoring change) — that's a separate decision from anything in this
inventory.

### Checked, no viable candidate found
`secrets.ts` exposes only reads in this server (no destructive/high_write
write op to gate). `iacm.ts`'s destructive-feeling actions (apply/plan) sit
at `medium_write`, not `destructive`/`high_write`, and don't have a
`delete` op shaped like the others here.

---

## Noul candidates

### Speculative: dynamic retryability classification
**Where:** `EndpointSpec.emptyOnErrorPatterns` and `OperationPolicy.retryPolicy`
(`src/registry/types.ts`) are static per-endpoint: a regex list or a fixed
enum decided once at dev time, guessing whether a given backend's errors are
retryable or mean "no data yet." **Signal:** the actual error response body
on this specific failed call. **Fit:** matches DP-4's benchmarked shape
almost exactly — short text, fixed criteria ("is this error transient" /
"does this mean empty result, not failure"), inline in the hot path where
latency matters. **Why speculative, not good-fit yet:** no evidence the
current regex-based approach is actually causing wrong retries/false
empties in practice. Worth instrumenting (are `emptyOnErrorPatterns` misses
observed in production logs?) before building — this is exactly the kind of
"tune against no data" spec 007 warned against for its own threshold design.

### Speculative: duplicate-detection preflight
**Where:** `EndpointSpec.preflight` hooks already run duplicate-checks
before `create` (per AGENTS.md). Some of these are exact-match; near-duplicate
detection (same secret under a slightly different name, same connector
config with a typo'd identifier) is unhandled today. **Fit:** yes/no against
explicit criteria, on short structured state (candidate + new input) — Noul
shape. **Why speculative:** needs a concrete case of near-duplicate creation
actually happening and causing pain before it's worth the added latency on
every `create` call for resources with a preflight hook. Per the fallback
contract, this would only ever supplement an existing exact-match check, never
replace it.

---

## Choice candidates

### Speculative: failure-category triage in `harness_diagnose`
**Where:** `harness_diagnose` returns raw step-level errors, log snippets,
delegate info, and chained-pipeline traversal; the calling agent currently
does all failure-category interpretation itself, every time. **Signal:**
the same log/step data already fetched for the response. **Fit:** Choice
over a fixed rubric (infra-flake / test-failure / config-error / dependency
/ permission / timeout) is squarely DP-shaped — short(ish) text,
enumerable categories, and running it server-side once could save the
calling agent a reasoning pass on every diagnose call. **Why speculative:**
this is the most promising Choice candidate but needs the rubric validated
against real diagnose transcripts before committing — a wrong category
returned confidently is worse than no category, since it can steer the
agent's next action.

### Speculative: entity disambiguation before tool dispatch
**Where:** any tool call with an ambiguous natural-language resource
reference that matches multiple candidates from a prior `harness_list`/
`harness_search`. **Signal:** the candidate list + the ambiguous reference.
**Fit:** literally "pick one of N named alternatives" — the canonical Choice
case. **Why speculative, and a different call site than everything else
here:** this runs *before* resource selection, not on an already-identified
resource like every other candidate in this doc — it would live in the
agent/prompt layer, not the write-gating layer, and needs its own
call-site design (spec 007's pattern doesn't transfer directly). Flagged
here for completeness since it came up in discussion, not because the
integration shape is worked out.

---

## Explicitly rejected (no further consideration without new evidence)

- **Anything requiring long-context reasoning** — full pipeline YAML review,
  governance-policy interpretation, multi-step diagnosis synthesis. Outside
  the validated shape (DP-4 tested short-text classification); this is what
  the calling LLM agent is for.
- **Replacing working deterministic logic** — scope resolution, existing
  regex matches with no observed failure mode, static risk labels for
  resource types with no usage/activity signal to grade. If it isn't
  causing friction, a primitive is complexity without payoff (see fallback
  contract, point 5).
- **A single global "enable decision primitives" flag** — rejected by the
  fallback contract's point 3: each site has a different blast radius when
  wrong and needs independent rollout, not a shared switch.

---

## Pilot 2 implementation spec: `repo_rule` update + delete

This is the "good fit" repo-rules candidate above, specced to the level
spec 007 specced `pipeline.delete` — concrete enough to implement, scoped
narrowly per the fallback contract (one resource family, not the whole
`repositories.ts` file; `space_rule` and `branch`/`tag` deletes are
explicitly out of scope for this pilot, to keep blast radius of the
*feature itself* small and reviewable).

**Ops covered:** `repo_rule.update` (`risk: "high_write"` →
`riskFloor: "medium_write"`), `repo_rule.delete` (`risk: "destructive"` →
`riskFloor: "high_write"`) — same one-level floor pattern as
`pipeline.delete`.

**Signal (one scorer, shared by both ops), fetched concurrently, not
sequentially — see "review findings" below for why that matters:**
1. `GET /code/api/v1/repos/{repoIdentifier}/rules/{ruleIdentifier}` — the
   rule's current `type` (branch/tag/push) and `state`
   (active/disabled/monitor), and whether its `pattern` targets the
   default branch. Cheap, already-exposed (same shape as `repo_rule.get`).
   For `update`, the requested PATCH body's `state`/`pattern` (when
   present) override the fetched values — the scorer rates the state
   being asked for, not just the state that's live before the call.
2. `GET /code/api/v1/repos/{repoIdentifier}/commits` (last 30 days,
   page size 25) — a bounded recent-activity proxy, same idea as
   `pipeline.delete`'s execution-history fetch. Not a total count (the list
   endpoint doesn't expose one plainly); capped at 25 and described to
   TypeSafe as such. `since` is unix **seconds** (the Code API's convention),
   not milliseconds.
3. Both calls pass `orgIdentifier`/`projectIdentifier` explicitly — they're
   raw `client.request()` calls that bypass the registry's automatic scope
   injection, so a project-scoped repo would 404 without this.

**Rubric (Score, 0-3):**
0. Rule is disabled or monitor-only — not currently enforcing anything.
1. Active, but doesn't target the default branch, and low recent commit
   activity.
2. Active and targets the default branch, OR the repo has frequent recent
   commits.
3. Active, targets the default branch, AND the repo has frequent recent
   commits — actively enforcing on a live branch.

`blastRadius = score / 3`, same normalization as `pipeline.delete`.

**Fallback contract applied:** identical mechanism to `pipeline.delete` —
`HARNESS_DYNAMIC_RISK_SCORING` off, no credential, timeout, error, or
low confidence all resolve to `effectiveRisk = risk` (today's unchanged
`high_write`/`destructive` gating). No new config flag: this reuses
`HARNESS_DYNAMIC_RISK_SCORING` rather than a per-site flag, which is a
deliberate, documented deviation from point 3 of the fallback contract —
justified because this is a second instance of the *same* mechanism
(blast-radius write-gating) rather than a structurally different site; a
genuinely different mechanism (Noul, Choice) would still get its own flag.

**Test scope:** matches `pipeline.delete`'s precedent — the generic
`scoreEffectiveRisk()` engine (`tests/utils/risk-scoring.test.ts`) already
covers every branch of the fail-closed logic regardless of resource type;
no resource-specific scorer unit test was added for `pipeline.delete`
either, and this pilot follows the same scope decision rather than
introducing a new testing bar for the second instance.

**Review findings (fixed before merge):** an independent review of the
first pass caught three bugs that would have made this pilot a silent
no-op — worth recording because they're the kind of mistake this exact
pattern (raw `client.request()` calls bypassing the registry's usual
scope/param handling) will keep inviting at future sites:
- Missing `orgIdentifier`/`projectIdentifier` on both GETs → 404 on any
  project-scoped repo → fails closed on the common case, not just the edge
  case. Pilot 1 got this right (it passes org/project explicitly); pilot 2
  initially didn't.
- `since` passed in milliseconds where the Code API expects seconds →
  reads as a timestamp tens of thousands of years in the future → an empty
  commit window → biases blast radius *downward* for busy repos, the wrong
  direction for a safety mechanism.
- Two sequential GETs plus the TypeSafe call, all inside the same 400ms
  timeout budget pilot 1 uses for one GET plus one TypeSafe call — fixed by
  running the two GETs concurrently (`Promise.all`), which returns the
  latency shape to "two round trips," not three.

Also fixed: the scorer originally rated the rule's state *before* the
requested change, meaning a request to re-enable a disabled rule on the
default branch — exactly the high-blast-radius case this exists to catch —
would have scored the old, disabled state and confidently waved it
through. It now scores the requested PATCH body's fields when present.

---

## What this spec does NOT do

- Commit to building any of the "speculative" candidates. Each would need
  its own spec (mirroring 007's structure: problem, mechanism, fallback
  behavior, pilot scope, test plan) before implementation.
- Change anything about the already-implemented `pipeline.delete` pilot
  from spec 007.
- Prescribe an order. Sequencing (finish `feature_flag.update` vs. survey
  more Score siblings vs. prototype diagnose triage) is a planning
  conversation, not a fit conversation — this doc only answers "is the shape
  right," not "what's next."
