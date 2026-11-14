# Issue 006: What Belongs in Toolsets — Content & Design Audit of Monolithic Toolset Definitions

**Status:** Documented & Guardrailed (`fix/registry-taxonomy-and-dispatch-guardrails`)
**Date:** 2026-11-13
**Related:** `docs/coding-standards.md` Rule 2, Rule 3, & Rule 13; `src/registry/toolsets/{chaos,chaos-descriptions,scs,sto,ai-evals,ccm,feature-flags,gitops,iacm}.ts`

---

## 1. Executive Summary

File line counts (`chaos.ts` at 7,230 lines + `chaos-descriptions.ts` at 2,151 lines = **9,381 lines**; `ai-evals.ts` at 2,900 lines; `ccm.ts` at 2,841 lines; `feature-flags.ts` at 2,526 lines; `gitops.ts` at 2,302 lines; `scs.ts` at 1,549 lines; `iacm.ts` at 1,404 lines) are a **symptom**, not the root cause.

Auditing **what is actually written inside toolset files** across all 50 toolsets reveals **5 systemic design anti-patterns** where concerns that belong in prompts, client normalizers, or backend APIs were stuffed into declarative toolset definitions:

| # | Anti-Pattern | Quantitative Evidence on `main` | Where It Actually Belongs |
|---|---|---|---|
| **1** | **Multi-page agent playbooks & system prompts stuffed into `description` and `diagnosticHint`** | **79 resources** have `description > 500 chars` (up to **3,258 chars** on `chaos_dr_test`, **2,942 chars** on `chaos_experiment`); `chaos-descriptions.ts` is **260.6 KB (2,151 lines)** of prose playbooks | `src/prompts/*.ts` (MCP Prompt templates) for multi-step workflows; resource `description`s should be **1–2 sentences (≤ 500 chars)** |
| **2** | **Prompt-engineering side-channels (`_reminder`, `_action_hint`, `_next_step`) & fake summary objects appended inside `items[]`** | **5 list extractors in `scs.ts`** (`lines 114-262`) append `{ _summary }` or `{ _total_cves, _reminder }` **inside the returned array**, corrupting `items[]` and inflating `total` by +1; `sto.ts` injects a 400-char `"STOP using this resource"` `_action_hint` into every `security_issue` list | Clean envelope fields (`{ items, total }`) in `src/registry/extractors.ts`; never append non-entity objects into `items[]` |
| **3** | **Exposing internal UI `<select>` dropdown / filter-panel / duplicate `list_metadata` endpoints** | **12 endpoints** (`security_issue_filter`, `cost_recommendation_filter`, `cost_filter_value`, and 5 `chaos_*.exec:list_metadata` actions that duplicate `list` with incompatible ID shapes) | Omit UI dropdown endpoints; expose filter enums via `listFilterFields` and keep one canonical `list` per entity |
| **4** | **Abusing `bodyBuilder` on `GET` requests (which have no HTTP body) to mutate `input` query params as a side effect** | **9 `GET`/`DELETE` endpoints** (`chaos_experiment.get`, `chaos_experiment_variable.list`, `delegate_token.get`, `chaos_loadtest_run.exec:ai_insights`, etc.) use `bodyBuilder` returning `undefined` to mutate `input` before `queryParams` mapping | Declarative `defaultQueryParams` or a dedicated `inputNormalizer` / `queryParams` resolver |
| **5** | **Embedding 500–1,700 lines of imperative DTO compilers, HAR parsers, and multi-call preflight orchestration in toolsets** | **7,789 lines** of pre-toolset imperative code across the top 10 toolset files (`chaos.ts` 1,693 lines, `ai-evals.ts` 1,424 lines, `ccm.ts` 894 lines, `iacm.ts` 748 lines, `feature-flags.ts` 568 lines, `pipelines.ts` 531 lines, `gitops.ts` 460 lines, `scs.ts` 352 lines) | Domain helper modules (`src/registry/<domain>/` or `src/utils/`) |

---

## 2. Deep Dive & Empirical Evidence

### 2.1 Anti-Pattern 1: Prompt-Engineering Playbooks Inside Resource Descriptions (`260.6 KB` in `chaos-descriptions.ts`)

79 resource definitions exceed 500 characters in `description`, and 22 exceed 400 characters in `diagnosticHint`:

| Resource Type | Toolset | `description` Length | What Is Inside `description` |
|---|---|---:|---|
| `chaos_dr_test` | `chaos` | **3,258 chars** | Full multi-step DR test authoring & pipeline-linking tutorial |
| `chaos_experiment` | `chaos` | **2,942 chars** | Tag substring matching rules, V1 vs V2 manifest selector paths, 2-path discovery playbook |
| `chaos_loadtest` | `chaos` | **2,888 chars** | Full field taxonomy for k6, JMeter, and Locust script/zip modes |
| `security_exemption` | `sto` | **2,189 chars** | Multi-step exemption workflow, RBAC rules, and scope promotion rules |
| `gitops_agent_metrics` | `gitops` | **1,761 chars** | Metric range, feature flag, and row cap instructions |
| `chaos_k8s_infrastructure` | `chaos` | **1,679 chars** | Step-by-step K8s infra installation guide |
| `chaos_application_map` | `chaos` | **1,624 chars** | Service discovery eBPF promotion tutorial |
| `chaos_enabled_infrastructure` | `chaos` | **1,594 chars** | Cross-resource workflow guide |
| `gitops_app_project_mapping` | `gitops` | **1,587 chars** | Argo project mapping tutorial |
| `iacm_module` | `iacm` | **1,576 chars** | Scope vs. connector location tutorial |

Additionally, `descCreateChaosService` (`src/registry/toolsets/chaos-descriptions.ts:134-165`) embeds an interactive 4-step wizard script (`"STEP 1 — Select a Discovery Agent (REQUIRED FIRST; gate: do not continue without a chosen agent)... Ask the user to pick one... STEP 2 — Select the Service to onboard..."`) inside an `EndpointSpec.description`.

**Impact:**
- Calling `harness_describe(toolset="chaos")` in full mode returned **108,961 bytes (~27,240 tokens)**.
- Even single-resource `harness_describe(resource_type="chaos_experiment")` returns ~8 KB of prose before the agent even makes an API call.

---

### 2.2 Anti-Pattern 2: Corrupting `items[]` Arrays with Appended Prompt Objects (`src/registry/toolsets/scs.ts:114-262`)

In `src/registry/toolsets/scs.ts`, five list extractors append a metadata/prompt object directly onto the end of the returned array:

1. `artifactSourceListExtract` (`scs.ts:126`):
   ```ts
   return [...cleaned, { _summary: { total: cleaned.length, by_type: byType } }];
   ```
2. `componentVulnerabilityExtract` (`scs.ts:154`):
   ```ts
   return [...cleaned, { _total_cves: cleaned.length, _reminder: "Report ONLY these CVEs. Do NOT add CVEs from training knowledge." }];
   ```
3. `bomViolationListExtract` (`scs.ts:221`):
   ```ts
   return [...cleaned, { _total: cleaned.length, _violation_types_found: typeStr, _reminder: "..." }];
   ```
4. `codeRepoListExtract` (`scs.ts:237`):
   ```ts
   return [...cleaned, { _total: cleaned.length, _note: `This page contains exactly ${cleaned.length} code repositories.` }];
   ```
5. `artifactComponentListExtract` (`scs.ts:256`):
   ```ts
   return [...cleaned, { _next_step: "Components with risk detected. Use scs_component_enrichment..." }];
   ```

**Impact:**
- `normalizeHarnessListPayload()` in `src/utils/response-formatter.ts` converts a top-level array `arr` into `{ items: arr, total: arr.length }`.
- Because those 5 extractors pushed a trailing object into the array:
  - **`result.total` is off by +1** (e.g., 5 repositories + 1 `{ _total: 5, _note: ... }` element → `normalizeHarnessListPayload` sets `total: 6`!).
  - **`result.items[result.items.length - 1]` is not a resource item** — any caller or UI component iterating `result.items` encounters a fake `{ _reminder }` / `{ _summary }` row!
  - In `src/tools/harness-list.ts:104-118`, semantic-search entity indexing iterates `result.items` after `normalizeHarnessListPayload`.

---

### 2.3 Anti-Pattern 3: Internal UI Filter-Dropdown & Duplicate `list_metadata` Endpoints

12 endpoints in the registry exist only to power web UI filter dropdowns or duplicate `list` with a incompatible ID shape:
- `chaos_experiment.exec:list_metadata`, `chaos_probe.exec:list_metadata`, `chaos_hub.exec:list_metadata`, `chaos_fault.exec:list_metadata`, `chaos_action.exec:list_metadata` (`POST /chaos/manager/api/v3/*/list-metadata`) — duplicate `harness_list` on the same 5 resources, except `chaos_experiment.exec:list_metadata` returns the `identity` slug instead of the `experimentID` UUID required by `update_cron`, `chaos_experiment_run`, etc.!
- `security_issue_filter.list` (`GET /sto/api/v2/frontend/all-issues/filters`) — UI filter dropdown endpoint.
- `cost_recommendation_filter.list` / `.get` (`GET /ccm/api/business-mapping/filter-panel`) — UI filter panel endpoint.

---

### 2.4 Anti-Pattern 4: `GET` / `DELETE` Operations Using `bodyBuilder` as a Side-Effect Hook

9 endpoints use `bodyBuilder` on `GET` or `DELETE` requests:
- `delegate_token.get` (`GET /ng/api/delegate-token-ng`)
- `delegate_token.delete` (`DELETE /ng/api/delegate-token-ng`)
- `delegate_token.exec:get_delegates` (`GET /ng/api/delegate-token-ng/delegate-groups`)
- `chaos_experiment.get` (`GET /chaos/manager/api/v3/experiments/{identity}`)
- `chaos_experiment.delete` (`DELETE /chaos/manager/api/v3/experiments/{identity}`)
- `chaos_experiment_variable.list` (`GET /chaos/manager/api/v3/experiments/{identity}/variables`)
- `chaos_loadtest_run.exec:ai_insights` (`GET /loadTest/manager/api/v1/runs/{runId}/ai-insights`)
- `gitops_application.delete` (`DELETE /gitops/api/v1/agents/{agentIdentifier}/applications/{appName}`)
- `gitops_application.exec:cancel_operation` (`DELETE /gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/operation`)

For example, `chaos_experiment.get` defines `bodyBuilder: (input) => { input.is_identity = false; return undefined; }` on a `GET` request because `Registry.executeSpec` happens to call `spec.bodyBuilder` before mapping `spec.queryParams`.

---

## 3. Guardrails & Standards Added on This Branch

1. **Compact Toolset Describe (`Registry.describeToolset`):**
   - Strips `listFilterFields`, `diagnosticHint`, and `relatedResources` and truncates multi-paragraph `description`s to ≤ 200 chars when `harness_describe(toolset=...)` is called in compact mode, cutting `chaos` from **108,961 B → 14,582 B (-86.6%)**.
2. **Resource Description Length Guardrail (`tests/coding-standards/registry-contract.test.ts`):**
   - Caps `ResourceDefinition.description` at **≤ 500 characters** for all new resources (with the 79 legacy verbose descriptions pinned in an explicit allowlist that may only shrink), enforcing that multi-step playbooks go into `src/prompts/*.ts` instead of `ResourceDefinition.description`.
3. **No `bodyBuilder` on `GET` Operations Guardrail (`tests/coding-standards/registry-contract.test.ts`) — Burned Down to 0:**
   - Added `EndpointSpec.inputNormalizer` (`src/registry/types.ts`, `src/registry/index.ts`) and migrated `delegate_token.get`, `delegate_token.exec:get_delegates`, `chaos_experiment.get`, and `chaos_experiment_variable.list` off `bodyBuilder`.
   - Removed `bodyBuilder: () => ({})` from `chaos_loadtest_run.exec:ai_insights` (`GET /loadTest/manager/api/v1/runs/{runId}/ai-insights`), which previously passed a `{}` JSON body on a `GET` request (causing Node `fetch()` to throw `TypeError: Request with GET/HEAD method cannot have body` at runtime).
   - `tests/coding-standards/registry-contract.test.ts` now enforces **0 `GET` endpoints with `bodyBuilder`** across the entire registry with no allowlist.
4. **Updated `docs/coding-standards.md` (§14 — *What Belongs in a Toolset Definition*):**
   - Explicitly forbids playbook essays in `description`, appending non-entity prompt objects to list `items[]`, exposing UI filter-dropdown BFF routes as standalone resources, and using `bodyBuilder` on `GET` requests.
