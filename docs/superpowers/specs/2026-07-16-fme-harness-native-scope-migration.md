# FME → Harness-Native Scope Migration: Impact Spec

> **Status:** Implemented. The plan at `docs/superpowers/plans/2026-08-12-fme-harness-native-scope-migration.md` built the full dual-mode contract described below: all 11 `fme_*` resources now branch per-call on `workspace_id` (legacy) vs `org_id`+`project_id` (Harness-native) via the shared `resolveFmeDualMode` resolver and the new `EndpointSpec.routeResolver` field. `fme_feature_flag` list is wired to a real Harness-native endpoint and confirmed working (200); `fme_feature_flag` get/delete, `fme_environment` list, and `fme_standard_segment`/`fme_rule_based_segment` list/get/delete are wired through to real endpoints but currently return 500 pending a backend fix (not an MCP-side bug). Every other operation across the 11 resources throws a clear "not yet implemented" error in new mode while legacy mode remains fully functional and byte-for-byte unchanged. See "What was built" below for the confirmed route table.
>
> **Companion doc:** `docs/superpowers/specs/2026-06-29-fme-agent-platform-vision.md` (the platform vision this is step 1 of).

---

## Context

FME (Feature Management & Experimentation) is currently exposed in this MCP server as 11 `fme_*` resource types (toolset `feature-flags`, `src/registry/toolsets/feature-flags.ts`) that talk directly to the Split.io Admin API (`https://api.split.io`) and are identified by a Split `workspace_id` — not by Harness `account`/`org`/`project`. This is called out explicitly in the vision doc: *"The tools speak workspace/org, not account/org/project… Split's workspace model and the Split.io API are internal FME details now. They shouldn't leak out to any agent."* This spec is the first concrete step toward that vision: **revamp the MCP contract now**, ahead of the new Harness-native FME endpoints being built, so that once those endpoints exist, wiring them in is a small, mechanical change rather than a breaking rewrite.

**Correction to the original premise:** research confirmed there is no `fme-org` identifier anywhere in the current codebase (registry, schemas, docs, or prompts) — only `workspace_id`. The "old contract" being deprecated is `workspace_id` alone; the "new contract" is `org_id` + `project_id` (account is always implicit, exactly like every other Harness resource).

**Goal of this pass:** produce the full file-by-file impact map and the new dual-mode contract shape. At the time this spec was written, per explicit direction, **no registry code changes were implemented in this pass** — the real Harness-native endpoints didn't exist yet. Groundwork that didn't depend on those endpoints (types, shared resolver, validation, deprecation logging, prompt updates, docs) was scoped as immediately buildable; everything that depended on the real API paths was called out as blocked. That groundwork, plus wiring of the endpoints that had since become available, was subsequently implemented in `docs/superpowers/plans/2026-08-12-fme-harness-native-scope-migration.md` — see "What was built" below for the confirmed result.

---

## Current contract (verified from source)

Every `fme_*` resource in `src/registry/toolsets/feature-flags.ts` declares `scope: "account"`, `product: "fme"`, and is identified via flat top-level params resolved through the generic `identifierFields`/`pathParams` machinery in `src/registry/index.ts` — there is no FME-specific scope-resolution code today.

`product: "fme"` only affects two things:
- **Base URL** — `resolveProductBaseUrl` (`src/config.ts`, the `resolveProductBaseUrl(config, product)` helper → `HARNESS_FME_BASE_URL`, default `https://api.split.io`).
- **Auth** — `src/client/harness-client.ts` sends a Bearer token via `HARNESS_FME_API_KEY` (or a non-placeholder `HARNESS_API_KEY` fallback), with no `Harness-Account` header and no `accountIdentifier`/`orgIdentifier`/`projectIdentifier` injection.

Critically, `product` is read **once, statically, per operation from the `ResourceDefinition`** (`const product = def.product ?? "harness"` in `Registry.executeSpec()`, `src/registry/index.ts` ~L779) — **not** from the `EndpointSpec`. Base URL is resolved from that value on the next line. This is the one real structural gap the new contract has to close (see *Mechanism* below).

| resourceType | identifierFields | operations |
|---|---|---|
| `fme_workspace` | `workspace_id` | list |
| `fme_environment` | `workspace_id`, `environment_id` | list |
| `fme_feature_flag` | `workspace_id`, `feature_flag_name` | list/get/create/update/delete + kill/restore/archive/unarchive |
| `fme_feature_flag_definition` | `workspace_id`, `environment_id`, `feature_flag_name` | get/create/update |
| `fme_rollout_status` | `workspace_id` | list |
| `fme_rule_based_segment` | `workspace_id`, `segment_name` | list/get/create/delete |
| `fme_rule_based_segment_definition` | `workspace_id`, `environment_id`, `segment_name` | list/update + enable/disable/change_request |
| `fme_traffic_type` | `workspace_id` | list |
| `fme_identity` | `traffic_type_id`, `environment_id`, `key` (no `workspace_id`) | create/update |
| `fme_standard_segment` | `workspace_id`, `segment_name` | list/get |
| `fme_segment_keys` | `environment_id`, `segment_name` (no `workspace_id`) | list/update |

The one live FME-aware MCP prompt, `src/prompts/feature-flag-rollout.ts`, hardcodes `workspaceId: z.string()` as a **required** arg and bakes `workspace_id="…"` into every generated tool-call instruction (6 call templates: 1× `harness_get` flag, 1× `harness_list` environment, 1× `harness_get` definition, 1× `harness_list` rollout_status, and the `harness_execute` kill/restore instruction).

---

## New contract (decided)

- **Dual mode, backward-compatible, per-call.** Same `resourceType`, same tool names (`harness_list`/`harness_get`/`harness_execute`). The registry inspects which params a given call supplies and routes accordingly:
  - **Legacy mode** (deprecated): caller passes `workspace_id` (+ existing children). Routes exactly as today — Split.io, `product: "fme"`, Bearer auth.
  - **New mode**: caller passes `org_id` **and** `project_id` together (never one alone — new mode is strictly project-scoped, no account-only or org-only FME calls). Routes to a Harness-native endpoint/`product` (paths TBD) with standard `x-api-key`/`Harness-Account` auth, exactly like every other Harness NG resource. `account_id` stays implicit from config/PAT — never a caller-supplied input, consistent with the rest of the platform.
  - **Mixed** (`workspace_id` present together with `org_id`/`project_id`): **hard error** — `"Pass either workspace_id (deprecated) OR org_id+project_id, not both."` No silent precedence either way.
  - **Deprecation notice**: a single `console.error("[DEPRECATION] …")` line to stderr on every legacy-mode call, mirroring the existing `HARNESS_DEFAULT_ORG_ID` → `HARNESS_ORG` precedent in `src/config.ts` (~L193-201). Not surfaced in the tool response payload.
- **Applies uniformly to all 11 resource types**, with two resolved exceptions:
  - **`fme_workspace`** — kept **legacy-mode only**, permanently. Its sole purpose is discovering `workspace_id` values for the other 10 resources; under the new contract callers already know their `org_id`/`project_id` from the rest of the platform, so there's no new-mode equivalent. It is marked deprecated in its description **and still emits the `[DEPRECATION]` stderr line on every call** (decision: treat it uniformly with the other 10 legacy-mode calls — consistency over suppressing one line of noise). It simply has no new-mode branch to route to.
  - **`fme_identity`** and **`fme_segment_keys`** — these don't take `workspace_id` today (they're identified by `environment_id`/`traffic_type_id`/`key` or `environment_id`/`segment_name`, one level below workspace). They gain **optional `org_id`+`project_id` as pure mode-selector fields**, decoupled from their existing identifiers, so the same shared dual-mode resolver logic applies uniformly across all 11 resources without a special case.

### Side-by-side (representative resource: `fme_feature_flag`)

| | Legacy (deprecated) | New |
|---|---|---|
| Caller passes | `workspace_id`, `feature_flag_name` | `org_id`, `project_id`, `feature_flag_name` |
| Routes to | Split.io (`api.split.io`, `product: "fme"`) | Harness-native endpoint (TBD, `product: "harness"` or new placeholder) |
| Auth | Bearer (`HARNESS_FME_API_KEY` / fallback) | standard `x-api-key` + `Harness-Account` |
| Body schemas (create/update) | unchanged | unchanged — only identification/routing changes, not payload shape |

This same pattern (minus `workspace_id`/`org_id+project_id` swapped for the resource's own identifiers where relevant) applies to `fme_environment`, `fme_feature_flag_definition`, `fme_rollout_status`, `fme_rule_based_segment`, `fme_rule_based_segment_definition`, `fme_traffic_type`, `fme_standard_segment`, and the mode-selector-only variant for `fme_identity`/`fme_segment_keys`.

---

## Mechanism: how dual-mode dispatch works internally

Precedent already in the codebase: `template_v1` (`src/registry/toolsets/templates.ts`) + `templateV1BasePathFromScope` (`src/registry/scope-utils.ts:14-44`) resolves path shape from explicit `resource_scope` OR infers it from `org_id`/`project_id` presence, and is wired in via the existing `EndpointSpec.pathBuilder` hook (`src/registry/types.ts:254`, invoked at `src/registry/index.ts:599-600`).

**But `pathBuilder` alone is insufficient for FME.** It returns only a path string. FME dual-mode needs a different **path, product/baseUrl, AND scope** per call, and — as noted above — `product` is read statically from the **`ResourceDefinition`** (`def.product`), not from the `EndpointSpec`, at `src/registry/index.ts` ~L815. (`ResourceDefinition.baseUrlOverride` was a dead field even before this change — nothing in `index.ts` ever reads it; only `def.product`, via `resolveProductBaseUrl`, drives base-URL resolution. The implementation removes the one place that set it, `fme_environment`'s unused `baseUrlOverride: "fme"` line, rather than trying to preserve a field that never did anything.) So `pathBuilder` can't reach the product/baseUrl decision at all today. That is the gap the new field closes.

**Shared resolver** — one new function in `src/registry/scope-utils.ts`, `resolveFmeDualMode(input)`, used by all 11 resources:
- Detects `workspace_id` vs `org_id`+`project_id` presence.
- Throws on mixed params (exact message above) and on partial new-mode input (`org_id` without `project_id` or vice versa).
- Emits the `[DEPRECATION]` stderr line on legacy-mode calls (including `fme_workspace`).
- Returns `{ mode: "legacy" | "harness_native", workspaceId?, orgId?, projectId? }`.

This mirrors the `HARNESS_DEFAULT_ORG_ID` env-var deprecation pattern (log-and-fall-through, not error) for the *legacy-still-works* path, while adding hard validation only for the genuinely ambiguous *mixed* case — nothing like that exists at the env-var level today because env vars don't have a "mixed" case.

**Type system:** add one new optional `EndpointSpec` field (in `src/registry/types.ts`) — a per-call route resolver that produces **path + product + baseUrl + scope + org/project together**, since these are not independent for FME — they're all determined by the same mode decision. Because today's static reads live at *two different levels* (`EndpointSpec.path`/`pathParams`/`pathBuilder` for the path, but `ResourceDefinition.product` for the backend), the new field's output must **supersede reads at both levels** when present:
- feeds the existing path-building site (`index.ts:597-626`) instead of `spec.path`/`spec.pathParams`/`spec.pathBuilder`, and
- feeds the existing product/baseUrl site (`index.ts` ~L779-780) instead of `def.product`/`resolveProductBaseUrl(...)`.

It is purely additive: the ~200 other non-FME resources never set the field, so their static `def.product`/`spec.path` reads are completely untouched. It hooks into `executeSpec` once, near the top (before or alongside today's `getRequestedScope` call at ~L581), and its output is threaded down to both sites.

> **Note for the implementer:** the original premise that "product is read once, statically, in `executeSpec`" is correct — but be aware it is read from `def.product` (resource-level), *not* from the spec. The new resolver has to override a resource-level read, and the existing `pathBuilder` hook (spec-level) can't do that. This is why a new field is genuinely required and `pathBuilder` can't simply be reused.

**Why this shape, not alternatives:** a global config-level mode switch was rejected (can't mix old/new callers in one session/agent conversation); new parallel resource types (`fme_feature_flag_v2`) were rejected (doubles resource surface, needs a later merge step anyway). Per-call resolution on the same `resourceType` matches the `template_v1` precedent and requires no new tool names, no new resource types, and no schema-visible mode flag beyond the params themselves.

---

## File-by-file impact

| File | Nature of change |
|---|---|
| `src/registry/types.ts` | Add one new optional `EndpointSpec` field for per-call route resolution (path + product + baseUrl + scope together). No change to existing `product` (on `ResourceDefinition`) or `path`/`pathBuilder` (on `EndpointSpec`) — they remain for non-FME resources and as legacy-mode fallback values. `ResourceDefinition.baseUrlOverride` stays defined on the type but is unused (see above) — the one call site that set it (`fme_environment`) is removed. |
| `src/registry/scope-utils.ts` | Add `resolveFmeDualMode(input)` — the one shared function for mode detection, mixed-param validation, and deprecation logging. Pure, unit-testable in isolation, reused by all 11 resources (mirrors `templateV1BasePathFromScope`). |
| `src/registry/index.ts` | In `executeSpec` (~L571-796): one new gated hook — if the operation's spec sets the new route-resolver field, use its output at **both** the existing path-building site (~L597-626) and the product/baseUrl site (~L779-780) instead of the current static reads (`def.product`, `resolveProductBaseUrl`, `spec.path`). Fully additive; zero behavior change for the ~200 non-FME resources. |
| `src/registry/toolsets/feature-flags.ts` | All 11 resources (~40+ endpoint specs across list/get/create/update/delete/execute actions): replace static `path`/`pathParams` (and rely on the new resolver for `product`/`baseUrl`) with the new per-call resolver, calling `resolveFmeDualMode` and branching — legacy branch reproduces today's exact behavior; new branch throws a clear "not yet implemented" error until real endpoints exist. `fme_workspace` stays legacy-only (no new-mode branch at all, marked deprecated in its description, still emits the deprecation line). `fme_identity`/`fme_segment_keys` gain optional `org_id`/`project_id` as mode-selector fields alongside their unchanged existing identifiers. |
| `src/prompts/feature-flag-rollout.ts` | `argsSchema` changes from `{ featureFlagName: required, workspaceId: required }` to `{ featureFlagName: required, workspaceId: optional, orgId: optional, projectId: optional }`. The generated prompt text (currently hardcodes `workspace_id="…"` into 6 tool-call templates) must branch on which were supplied, emitting the matching param set in each generated `harness_get`/`harness_list`/`harness_execute` call. This is a real logic change to the prompt body, not just a schema tweak. |
| `README.md` | Env var table: clarify `HARNESS_FME_API_KEY`/`HARNESS_FME_BASE_URL` apply to legacy/workspace-mode only. FME resource table + prose: replace "scoped by workspace ID rather than org/project" with a description of dual-mode + deprecation, and mark new-mode as not-yet-available per resource. Toolset table: no structural change. |
| `docs/testing/fme_workspace/`, `fme_environment/`, `fme_feature_flag/`, `fme_feature_flag_definition/` (`test_plan.md` + `test_report.md`) | Add rows for mixed-param rejection and legacy-deprecation behavior; note new-mode as "not yet implemented" until real endpoints land. (The other 7 resource types have no generated test-plan docs today — pre-existing gap, out of scope here.) |
| `manifest.json`, `mcp-directory/manifest.json` | Update `HARNESS_FME_API_KEY`/`HARNESS_FME_BASE_URL` descriptions to note they're legacy-mode-specific; likely no-op pending clarity on whether new mode needs its own credential var (probably not — it should reuse standard `HARNESS_API_KEY`). |
| `tests/registry/feature-flags.test.ts` | New test groups: `resolveFmeDualMode` unit tests (mixed→throw, partial-new→throw, legacy→deprecation log, new→no log, neither→legacy fallback); regression assertions that legacy-mode requests are byte-for-byte unchanged; new-mode calls throw "not yet implemented"; deprecation log fires exactly once per legacy call (guards against double-invocation of the resolver). |
| `tests/client/harness-client.test.ts` | No changes expected. Legacy-mode calls keep setting `product: "fme"` identically, so existing FME client tests (baseUrl override, Bearer auth, routing-id omission) continue to pass unmodified. New-mode calls throw before reaching the client in this pass, so there's nothing new to test at the client layer yet. |

---

## What was built

All 11 `fme_*` resources now dispatch through `resolveFmeDualMode` (`src/registry/scope-utils.ts`) and each operation's `routeResolver` (`EndpointSpec.routeResolver`, `src/registry/types.ts`). Legacy mode (`workspace_id`) is unchanged for every resource and operation. Harness-native mode (`org_id`+`project_id`) resolves as follows:

**Wired to real Harness-native endpoints:**
- `fme_feature_flag` — `list` confirmed working (200). `get`/`delete` are wired through but the backend currently returns 500 — a server-side bug, not an MCP defect.
- `fme_environment` — `list` wired through; currently 500 (same backend issue).
- `fme_standard_segment` — `list`/`get` wired through; currently 500.
- `fme_rule_based_segment` — `list`/`get`/`delete` wired through; currently 500. It shares the same `/fme/internal/api/v4/segments` collection as `fme_standard_segment` in new mode (they're the same underlying resource type in the Harness-native API even though legacy Split.io models them separately).

**Throws a clear "not yet implemented" error in new mode (legacy mode fully functional):**
- `fme_feature_flag` — `create`, `update`, `kill`, `restore`, `archive`, `unarchive`.
- `fme_rule_based_segment` — `create`.
- `fme_feature_flag_definition` — `get`, `create`, `update`.
- `fme_rule_based_segment_definition` — `list`, `update`, `enable`, `disable`, `change_request`.
- `fme_rollout_status` — `list`.
- `fme_traffic_type` — `list`.

**No Harness-native equivalent at all (legacy-only, permanently):**
- `fme_workspace.list` — passing `org_id`+`project_id` throws a dedicated "no Harness-native equivalent" error (not the generic NYI message), since this resource exists only to discover `workspace_id` values for the deprecated contract.

**Permissive mode-selector (not the strict `resolveFmeDualMode` resolver):**
- `fme_identity` (`create`/`update`) and `fme_segment_keys` (`list`/`update`) never had `workspace_id` in their contract, so there's no "legacy" shape to preserve. Passing `org_id`+`project_id` together throws the NYI error; anything else (including neither param) proceeds as today's normal call, with no error.

The 500s above are tracked as a backend follow-up, not MCP-side work — the routing, path construction, and `product: "harness"` auth are confirmed correct; the underlying Harness-native endpoints are the blocker.

---

## Verification (once implemented)

- `pnpm test` — run the expanded `tests/registry/feature-flags.test.ts` and confirm the full existing suite still passes unmodified (regression proof that legacy-mode behavior is untouched).
- `pnpm typecheck` — confirm the new `EndpointSpec` field doesn't break any of the ~200 other non-FME resource definitions.
- Manual smoke check via `pnpm inspect`:
  - `harness_list(resource_type="fme_feature_flag", workspace_id="…")` — legacy, should work unchanged.
  - `harness_list(resource_type="fme_feature_flag", org_id="…", project_id="…")` — new mode, should throw the clear "not yet implemented" error.
  - `harness_list(resource_type="fme_feature_flag", workspace_id="…", org_id="…")` — mixed, should throw the mixed-param error.
- `pnpm docs:generate` after `pnpm build` if any resource descriptions changed materially enough to affect generated docs.

---

## Appendix: FME "skills" status

No FME "skills" are shipped today. The only real, registered FME-aware prompt is `feature-flag-rollout` (`src/prompts/feature-flag-rollout.ts`), which is being updated as part of this change. The 14 Tier-1 + 7 Tier-2 "skills" (`flag-command`, `flag-discovery`, `guarded-rollout`, etc.) referenced in `docs/superpowers/specs/2026-06-29-fme-agent-platform-vision.md` are a **roadmap proposal only** — explicitly gated on this MCP revamp (step 2 of that doc's 5-step plan) and the not-yet-built Harness-native API layer (step 1). None exist as code, tests, or docs anywhere in this repo.
