# Module → Capability Rename — Master Plan

**Status:** Draft for architecture review (incorporates Sunil's naming-quality review + Rohan's decisions on chaos and FME). No implementation started.
**Scope:** Rename module/acronym-coded toolset names and public `resourceType` identifiers to their product **capabilities**, across the whole registry, non-breaking.

---

## 1. Objective & guiding principle

Harness resources are exposed to agents as `resourceType` strings passed to the 11 tools (`harness_list({type:"iacm_workspace"})`, etc.) and grouped into toolsets filtered by `HARNESS_TOOLSETS`. Several names are **internal module codes** (`iacm`, `scs`, `sto`, `fme`, `sei`, `idp`, `kg`) rather than the capability an agent reasons about.

**Principle:** Most toolsets already declare a `displayName` that *is* the capability. The rename aligns the machine identifiers (`name`, `resourceType` prefixes) to those existing capability names. We align to product naming that already exists — we do **not** invent new taxonomy (this is why `chaos` and `ai_configs` were reconsidered; see §8a).

**Constraints (locked with product):**
- Rename **both** toolset names and public `resourceType` identifiers.
- **Non-breaking**: every old name resolves via an alias layer. Deprecate later.
- All cross-references inside descriptions/prompts/docs updated to the new canonical names.
- Every renamed resource carries its **old module code as a `searchAlias`** (discovery continuity — see §4).

---

## 2. Full registry inventory (41 toolsets)

Legend: ✅ no change · 🔴 rename (name + resource prefix) · 🟠 toolset-name only (resources already capability-named)

| Toolset (`name`) | `displayName` (capability) | Resource prefix today | Verdict |
|---|---|---|---|
| access_control | Access Control | permission/role/user/… | ✅ |
| agents | Agents | agent | ✅ |
| ai-evals | AI Evals | eval_* | ✅ |
| alerts | Alerts | alert | ✅ |
| ansible | Ansible | ansible_* | ✅ |
| audit | Audit Trail | audit_event | ✅ |
| **ccm** | **Cloud Cost Management** | cost_* (already capability) | 🟠 **name → `cost`** |
| chaos | Chaos Engineering | chaos_* | ✅ **kept** — recognized industry term, not a module code (§8a) |
| connectors | Connectors | connector* | ✅ |
| dashboards | Dashboards | dashboard* | ✅ |
| **dbops** | **Database DevOps** | database_* (already capability) | 🟠 **name → `databases`** |
| delegates | Delegates | delegate* | ✅ |
| deploys | Deploys | deploy | ✅ |
| environments | Environments | environment | ✅ (receives `infrastructure_definition`) |
| evidence-vault | Evidence Vault | attestation | ✅ |
| **feature-flags** | Feature Management & Experimentation | **fme_*** | 🔴 **→ `feature_flags`** (`fme_`→`feature_flag_`) |
| file_store | File Store | file_store | ✅ |
| freeze | Deployment Freeze | freeze_window/global_freeze | ✅ |
| gitops | GitOps | gitops_* | ✅ (GitOps *is* the capability) |
| governance | Governance | policy* | ✅ |
| **iacm** | Infrastructure as Code Mgmt | iacm_* | 🔴 **→ infrastructure** (locked) |
| **idp** | Internal Developer Portal | **idp_*** + scorecard* | 🔴 **→ `developer_portal`** (`scorecard*` kept) |
| incidents | Incidents | incident | ✅ |
| **infrastructure** | Infrastructure | infrastructure (CD infra-def) | 🔴 **CD resource → environments** (locked) |
| **knowledge-graph** | Knowledge Graph | **kg_*** + hql_query | 🔴 **→ `software_delivery_knowledge_graph`** |
| logs | Execution Logs | execution_log | ✅ |
| overrides | Service Overrides | service_override | ✅ |
| pipelines | Pipelines | pipeline/execution/… | ✅ |
| platform | Platform | organization/project | ✅ |
| pull-requests | Pull Requests | pr_*/pull_request | ✅ (Harness Code) |
| registries | Artifact Registries | artifact*/registry | ✅ |
| release-management | Release Management | release_* | ✅ |
| repositories | Code Repositories | repository/branch/commit/… | ✅ (Harness Code) |
| **scs** | Software Supply Chain Assurance | scs_* + artifact_security, code_repo_security | 🔴 **→ application_security** (locked, merge) |
| secrets | Secrets | secret | ✅ |
| **sei** | Software Engineering Insights | **sei_*** | 🔴 **→ `developer_insights`** |
| **semantic-layer** | Semantic Layer | **kg_type/kg_related_type** | 🔴 **merges into `software_delivery_knowledge_graph`** |
| services | Services | service | ✅ |
| settings | Settings | setting | ✅ |
| **sto** | Security Testing Orchestration | security_*, pipeline_security_*, remediation_diff | 🔴 **→ application_security** (locked, merge) |
| templates | Templates | template* | ✅ |

**Answers to the two flagged:**
- **Cloud Cost (`ccm`)** — resources are *already* `cost_*`. Only the toolset **name** needs renaming (🟠 → `cost`). Cheap.
- **Harness Code** — `repositories`, `pull-requests`, `gitops` are **already capability-named**. No rename required unless we want a `harness_code` umbrella (optional, Wave 4).

**Correction (from review):** the SEI toolset's machine `name` **is** `"sei"` (`src/registry/toolsets/sei.ts:225`). An earlier draft mis-reported it as `"granularity"` — that was an extraction false positive (`granularity` is a time-granularity **field** enum at `sei.ts:54`, reused across metric endpoints). **There is no broken-name bug**; `HARNESS_TOOLSETS=sei` works today. No `granularity` alias needed.

---

## 3. Target names & exact mappings

### 3.1 Wave 1 — Locked (product-approved)

#### `iacm` → `infrastructure` (toolset), `iacm_*` → `infrastructure_*`
| Old | New |
|---|---|
| iacm_workspace | infrastructure_workspace |
| iacm_resource | infrastructure_resource |
| iacm_module | infrastructure_module |
| iacm_provider | infrastructure_provider |
| iacm_variable_set | infrastructure_variable_set |
| iacm_workspace_costs | infrastructure_workspace_costs |
| iacm_activity_resource_change | infrastructure_activity_resource_change |

**CD infra-def relocation:** move the `infrastructure` resource out of `infrastructure.ts` **into the `environments` toolset**, and rename its resourceType `infrastructure` → `infrastructure_definition` (alias old `infrastructure`). Product-correct — infra defs live under Environments (list requires `environment_id`, body requires `environmentRef`, deep-link targets the environment's Infrastructure tab). Frees the `infrastructure` name/prefix for the IaCM capability.

End state (unambiguous): `infrastructure_definition` = CD infra def (under `environments`); `infrastructure_*` = IaCM.

#### `sto` + `scs` → single `application_security` toolset, `application_security_*` prefix

STO:
| Old | New |
|---|---|
| security_issue | application_security_issue |
| security_issue_filter | application_security_issue_filter |
| pipeline_security_issue | application_security_pipeline_issue |
| pipeline_security_step | application_security_pipeline_step |
| security_exemption | application_security_exemption |
| security_exemption_bulk | application_security_exemption_bulk |
| remediation_diff | application_security_remediation_diff |

SCS:
| Old | New |
|---|---|
| scs_artifact_source | application_security_artifact_source |
| scs_artifact_component | application_security_artifact_component |
| scs_artifact_remediation | application_security_artifact_remediation |
| scs_auto_pr_config | application_security_auto_pr_config |
| scs_bom_violation | application_security_bom_violation |
| scs_chain_of_custody | application_security_chain_of_custody |
| scs_compliance_result | application_security_compliance_result |
| scs_component_dependencies | application_security_component_dependencies |
| scs_component_drift | application_security_component_drift |
| scs_component_enrichment | application_security_component_enrichment |
| scs_component_remediation | application_security_component_remediation |
| scs_component_search | application_security_component_search |
| scs_component_vulnerability | application_security_component_vulnerability |
| scs_oss_risk_summary | application_security_oss_risk_summary |
| scs_project_security_overview | application_security_project_overview |
| scs_remediation_pr | application_security_remediation_pr |
| scs_sbom | application_security_sbom |
| scs_sbom_drift | application_security_sbom_drift |
| artifact_security *(un-prefixed today)* | application_security_artifact |
| code_repo_security *(un-prefixed today)* | application_security_code_repo |

Collision check STO×SCS after prefixing: **no clashes** (`_remediation_diff` vs `_remediation_pr`; `_artifact` vs `_artifact_source/_component/_remediation` are distinct full strings).

> **`chaos` is NOT renamed** (was proposed → `resilience`; reverted per §8a #2 / D2). "chaos" is the recognized industry term, not an internal module code.

### 3.2 Wave 2 — Toolset-name-only (resources already capability-named)
| Toolset old | Toolset new (**decided**) | Resource changes |
|---|---|---|
| ccm | **`cost`** | none — resources already `cost_*` |
| dbops | **`databases`** | none — resources already `database_*` |

### 3.3 Wave 3 — Name + prefix (**all decided**)
| Module | Toolset (**decided**) | Prefix | Keep un-renamed |
|---|---|---|---|
| sei | **`developer_insights`** | `sei_*` → `developer_insights_*` (e.g. `sei_dora_metric` → `developer_insights_dora_metric`) | — |
| idp | **`developer_portal`** | `idp_*` → `developer_portal_*` | `scorecard*` (generic) |
| feature-flags (fme) | **`feature_flags`** | `fme_*` → `feature_flag_*` **with token-collapse** (see below) | — |
| knowledge-graph (kg) | **`software_delivery_knowledge_graph`** | `kg_*` → `software_delivery_knowledge_graph_*` | `hql_query` (HQL = Harness Query Language, distinct) |
| semantic-layer (kg) | **merges into `software_delivery_knowledge_graph`** | `kg_type` → `software_delivery_knowledge_graph_type`; `kg_related_type` → `software_delivery_knowledge_graph_related_type` | — |

**FME token-collapse rule** (avoids `feature_flag_feature_flag`):
| Old | New |
|---|---|
| fme_feature_flag | feature_flag |
| fme_feature_flag_definition | feature_flag_definition |
| fme_environment | feature_flag_environment |
| fme_workspace | feature_flag_workspace |
| fme_identity | feature_flag_identity |
| fme_rollout_status | feature_flag_rollout_status |
| fme_segment | feature_flag_segment |
| fme_segment_definition | feature_flag_segment_definition |
| fme_segment_keys | feature_flag_segment_keys |
| fme_standard_segment | feature_flag_standard_segment |
| fme_rule_based_segment | feature_flag_rule_based_segment |
| fme_rule_based_segment_definition | feature_flag_rule_based_segment_definition |
| fme_traffic_type | feature_flag_traffic_type |

> Notes: `sei`/`developer_insights` (engineering metrics/DORA) and `idp`/`developer_portal` (IDP/scorecards) are intentionally distinct capabilities. The **semantic-layer toolset folds into `software_delivery_knowledge_graph`** (same capability = the KG type system) — a toolset merge like STO+SCS (see §8 caveat).

---

## 4. Back-compat / alias design

Three layers, all non-breaking:

1. **Toolset aliases** — extend existing `TOOLSET_ALIASES` (`src/registry/index.ts:65`):
   ```
   iacm → infrastructure
   sto → application_security
   scs → application_security
   ccm → cost
   dbops → databases
   sei → developer_insights
   idp → developer_portal
   feature-flags → feature_flags
   knowledge-graph → software_delivery_knowledge_graph
   semantic-layer → software_delivery_knowledge_graph   # merge
   ```
   Caveat (merges): `sto`+`scs` both alias to `application_security`; `knowledge-graph`+`semantic-layer` both alias to `software_delivery_knowledge_graph`. Enabling an old toolset name now enables the whole merged toolset. Accepted side-effect.

2. **NEW resourceType aliases** — no such layer exists today; build one:
   - `const RESOURCE_TYPE_ALIASES: Record<string,string>` (old→new), generated from the §3 tables (~58 entries; `chaos_*` no longer included).
   - Private `resolveType(t)` = `RESOURCE_TYPE_ALIASES[t] ?? t`, applied at the **single lookup choke point**: `getResource` (index.ts:309), `supportsOperation` (:362), `getExecuteActions` (:368).
   - `getAllResourceTypes()` returns **canonical names only** (aliases never enumerated in `harness_describe`/search/docs).
   - Old name in → resolves silently to canonical (optional one-line stderr deprecation log).

3. **Search aliases (discovery continuity)** — each renamed resource gets its old module code in `searchAliases` (`ResourceDefinition.searchAliases`, `types.ts:455`, matched at score 90 in `searchResources()`). So an agent searching `iacm`, `scs`, `sto`, `sei`, `idp`, `fme`, or `kg` still surfaces the renamed resource. This is the purpose-built recognition hook (corrects §8a #3).

No per-call-site surgery: dispatch/execute already funnel through `getResource`.

---

## 5. Blast radius & mechanical strategy

- `resourceType` strings are hardcoded in **hundreds of description strings** (cross-refs like "Use `resource_type=scs_artifact_source`…"), **~2500 test refs**, prompts, MCP resources, and generated docs.
- **Codemod rule:** replace **whole identifiers on word boundaries** (`\bscs_artifact_source\b`), driven by the explicit mapping tables — **never** bare substrings (`scs`, `iacm`), which would corrupt prose and generic shared types.
- **Tests:** rely on the alias layer so the ~2500 existing refs keep passing — **do not churn them**. Add targeted new tests instead (§7).
- **Files:** `iacm.ts`→`infrastructure.ts` (const `iacmToolset`→`infrastructureToolset`; old `infrastructure.ts` deleted after moving its resource to `environments.ts`); `sto.ts`+`scs.ts`→`application-security.ts` (assembled from two source modules to keep diffs reviewable); `knowledge-graph.ts`+`semantic-layer.ts`→`software-delivery-knowledge-graph.ts`; rename Wave-2/3 files similarly. `chaos.ts` untouched.

---

## 6. Execution phases (each capability = an independently shippable PR)

The alias net (P0) makes every subsequent phase non-breaking and reviewable in isolation.

- **P0 — Alias infrastructure.** Build `RESOURCE_TYPE_ALIASES` + `resolveType()`; extend `TOOLSET_ALIASES`; add `searchAliases` helper convention; tests for round-trip + global uniqueness. *Ships first.*
- **P1 — iacm → infrastructure** (+ move CD infra-def to `environments`, rename → `infrastructure_definition`).
- **P2 — sto + scs → application_security** (the merge; trickiest — two files → one toolset).
- **P3 — Wave 2:** ccm → `cost`; dbops → `databases` (toolset-name only + aliases).
- **P4 — Wave 3:** sei → `developer_insights`; idp → `developer_portal`; fme → `feature_flags` (token-collapse); knowledge-graph + semantic-layer merge → `software_delivery_knowledge_graph`.
- **P5 — Prompts + MCP resources + search aliases** referencing old types.
- **P6 — Docs + full test/standards pass.** `pnpm build && pnpm docs:generate`; fix `docs:check` counts; `pnpm standards:check`; full `pnpm test`.
- **Wave 4 (optional):** `harness_code` umbrella grouping for repositories/pull-requests; standardize toolset-name hyphen→underscore convention (`ai-evals`, `pull-requests`, `evidence-vault`, `release-management`, `feature-flags`).

---

## 7. Test & docs strategy

Add (don't churn existing):
- Alias round-trip: for every entry, `getResource(old)` === `getResource(new)`; `supportsOperation`/`getExecuteActions` parity.
- Canonical resolution: every new name resolves; `getAllResourceTypes()` contains only canonical, no aliases.
- Global uniqueness: no two canonical resourceTypes collide; no alias shadows a canonical name.
- Merge coverage: `application_security` contains all former STO+SCS resources; `software_delivery_knowledge_graph` contains all former knowledge-graph + semantic-layer resources; old toolset aliases resolve.
- Search-alias coverage: searching an old module code (`iacm`, `scs`, `fme`, …) returns the renamed resource.
- Docs count parity via `pnpm docs:generate` on a fresh build.

---

## 8. Risks & caveats (for architect sign-off)

1. **Public contract change (mitigated).** Old `type` values keep working via P0 aliases; no consumer breaks. Deprecation/removal is a later, separate decision.
2. **Toolset-merge alias fan-out (two merges).** STO+SCS → `application_security`, and knowledge-graph+semantic-layer → `software_delivery_knowledge_graph`. Enabling an old toolset name now enables the whole merged toolset. Documented behavior change.
3. **Verbose identifiers** — `application_security_*` and especially `software_delivery_knowledge_graph_*` produce long `type` strings (e.g. `software_delivery_knowledge_graph_queryable_type_summary`). Chose product-faithful clarity over brevity.
4. **Description drift** — if the codemod misses an inline cross-ref, descriptions would point at a name that only works via alias (still functional, just stale). `docs:generate` + a grep gate catch these.

---

## 8a. Naming-quality review (resolved)

The plan's principle (§1) is "align to *existing* product naming; don't invent." Two proposed targets failed that test and were reconsidered:

1. **`fme` → `ai_configs` — rejected.** `featureFlagsToolset.displayName` is `"Feature Management & Experimentation"` (`feature-flags.ts:259`); `ai_config`/"AI Config" appears **nowhere** in `src`. `ai_config_feature_flag` reads to an agent as "an AI model's configuration," hiding what the resource is. **Decision (D5):** rename to **`feature_flags`** (`feature_flag_*`) — matches the toolset's own capability, drops the module code, invents nothing.
2. **`chaos` → `resilience` — rejected.** Unlike `iacm`/`sto`/`scs`/`sei`/`idp`, "chaos" is not an internal module code — it's the widely-recognized industry term (chaos engineering) an agent already knows; "resilience" is broader/vaguer. **Decision (D2):** keep **`chaos`**.
3. **Recognition hook exists** — `ResourceDefinition.searchAliases` (`types.ts:455`, score-90 match in search) is the purpose-built place to preserve old-term findability. Applied to all renames (§4 layer 3). (Earlier review claim that displayName+description were the only signals was incomplete.)

Renames that pass the test cleanly: `iacm`→`infrastructure`, `sto`+`scs`→`application_security`, `sei`→`developer_insights`, `idp`→`developer_portal` (also resolves a real ambiguity — `idp` often reads as "identity provider"), `kg`→`software_delivery_knowledge_graph`, and Wave 2 (`ccm`→`cost`, `dbops`→`databases`).

---

## 9. Open decisions for architecture review

| # | Decision | Status |
|---|---|---|
| D1 | Rename chaos generic/shared types (`discovered_*`, `scanned_risk`)? | **N/A** — chaos not renamed. |
| D2 | chaos → resilience? | ✅ **DECIDED: keep `chaos`** (industry term, not a module code). |
| D3 | SEI → `developer_insights` / `developer_insights_*` (no granularity bug). | ✅ **DECIDED.** |
| D4 | IDP → `developer_portal`; `idp_*` → `developer_portal_*`; keep `scorecard*`. | ✅ **DECIDED.** |
| D5 | FME naming. | ✅ **DECIDED: `feature_flags`** (`fme_*` → `feature_flag_*`, token-collapse). Not `ai_configs`. |
| D6 | kg → `software_delivery_knowledge_graph`; semantic-layer merges in; keep `hql_query`. | ✅ **DECIDED.** |
| D7 | Wave 4 `harness_code` umbrella + hyphen→underscore standardization? | ⏳ Optional; defer. |
| D8 | ccm → `cost`; dbops → `databases`. | ✅ **DECIDED.** |

**Only open item: D7 (optional, deferrable).** Everything else is locked.
