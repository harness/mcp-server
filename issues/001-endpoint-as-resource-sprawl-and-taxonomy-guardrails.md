# Issue 001: Endpoint-as-Resource Sprawl, Duplicate-Endpoint Resources, Per-Operation Scope Override (`EndpointSpec.scope`), and Taxonomy Guardrails

**Status:** Guardrails & Dispatch Primitives Implemented (`fix/registry-taxonomy-and-dispatch-guardrails`); Legacy Toolset Consolidation Plan Recorded
**Date:** 2026-11-13
**Related PRs:** #1605, #1606, #1607, #1608

---

## 1. Problem Statement

The Harness MCP Server is architected around **11 consolidated tools** (`harness_list`, `harness_get`, `harness_create`, `harness_update`, `harness_delete`, `harness_execute`, `harness_diagnose`, `harness_search`, `harness_describe`, `harness_status`, `harness_schema`) that dispatch over cohesive domain entities (`pipeline`, `service`, `connector`, `environment`, `pull_request`, etc.).

However, across 50 toolsets, resource definitions have increasingly drifted into a **1-API-endpoint = 1-`resource_type`** pattern — and in several cases, **multiple `resource_type`s wrapping the exact same HTTP endpoint**:

1. **Missing per-operation scope override (`EndpointSpec.scope`)** forced authors to split `list` and `get` of the same entity into separate resource types (e.g., `file_v3` for `GET /har/api/v3/files` at project scope vs. `file_detail_v3` for `GET /har/api/v3/files/{id}` at account scope in #1605).
2. **`EndpointSpec.scopeParams` was declared in `src/registry/types.ts:330` but never wired in `src/registry/index.ts:775`**, silently dropping per-operation scope query parameter overrides.
3. **Sub-endpoints (`*_stats`, `*_detail`, `*_count`, `*_summary`, `*_items`) and single-action RPCs (`work_item_resume`, `pipeline_dynamic_execution`)** were registered as standalone top-level `resource_type`s rather than `operations.get` or `executeActions` on the parent entity.
4. **Duplicate HTTP endpoints registered as separate `resource_type`s** (e.g. `scs_artifact_remediation` and `scs_component_remediation` both hit `GET .../artifacts/{artifact}/component/remediation`; `cost_budget` and `cost_budget_variance` both hit `GET /ccm/api/budgets/{budgetId}`; `pipeline` and `pipeline_resolved_yaml` both hit `GET /pipeline/api/pipelines/{pipelineIdentifier}`).
5. **Backend URL route versions (`/v1`, `/v2`, `/v3`)** leaked into public `resource_type` names (`lifecycle_rule_v3`, `conan_package_v3`, `firewall_exception_v3`) even when no v1 resource of the same name exists.

---

## 2. Quantitative Evaluation on `main` (`v3.2.41`)

### 2.1 Registry Operation Distribution

Measured across all **50 toolsets** (**321 total resource types**; **274 default-enabled** across 44 default toolsets):

| Category | Count | % of Registry (321) | Notes |
|---|---:|---:|---|
| Multi-operation resources (`>= 2` ops/actions) | 186 | 57.9% | Cohesive CRUD + execute domain entities |
| **Single-operation resources (`1` op/action total)** | **135** | **42.1%** | 1-endpoint wrapper types |
| ├── `list`-only resources | 70 | 21.8% | e.g., `file_v3`, `scs_artifact_component`, `cost_timeseries` |
| ├── `get`-only resources | 56 | 17.4% | e.g., `cost_recommendation_detail`, `cost_recommendation_stats`, `cost_recommendation_count`, `*_metadata_v3` |
| ├── `execute`-only (single action, 0 CRUD ops) | 8 | 2.5% | `pipeline_dynamic_execution.run`, `work_item_resume.run`, `work_item_approve.run`, `budget_grant.run`, `scs_sbom_drift.calculate`, `database_execute_llm_authoring_pipeline.run`, `online_eval.evaluate`, `eval_git_registration.register` |
| └── `create`-only resources | 1 | 0.3% | `security_exemption_bulk` |

### 2.2 Toolsets with the Highest Single-Operation Ratio

| Toolset | Default / Opt-In | Total Types | Single-Op Types | Single-Op % |
|---|---|---:|---:|---:|
| `registries-v3` | Opt-In | 9 | 9 | **100.0%** |
| `sto` | Default | 7 | 6 | **85.7%** |
| `scs` | Default | 20 | 15 | **75.0%** |
| `release-management` | Default | 11 | 8 | **72.7%** |
| `dbops` | Default | 7 | 4 | **57.1%** |
| `idp` | Default | 9 | 5 | **55.6%** |
| `gitops` | Default | 17 | 9 | **52.9%** |
| `sei` | Default | 12 | 6 | **50.0%** |
| `pipelines` | Default | 12 | 6 | **50.0%** |
| `registries-firewall` | Default | 4 | 2 | **50.0%** |
| `ccm` | Default | 25 | 12 | **48.0%** |
| `autonomous_work` | Opt-In | 20 | 8 | **40.0%** |
| `chaos` | Default | 41 | 12 | **29.3%** |

### 2.3 Duplicate HTTP Endpoints Exposed as Multiple `resource_type`s

| HTTP Endpoint | Resource Type A | Resource Type B | Consolidation Target |
|---|---|---|---|
| `GET /pipeline/api/pipelines/{pipelineIdentifier}` | `pipeline.get` | `pipeline_resolved_yaml.get` (`resolveTemplates=true`) | `pipeline.get` (via `params.resolve_templates`) or `pipeline.executeActions.resolve_yaml` (`risk: "read"`); alias `pipeline_resolved_yaml` |
| `GET /ccm/api/budgets/{budgetId}` | `cost_budget.get` | `cost_budget_variance.get` | `cost_budget.executeActions.variance` (`risk: "read"`) or `cost_budget.get`; alias `cost_budget_variance` |
| `GET /ssca-manager/v1/orgs/{org}/projects/{project}/artifacts/{artifact}/component/remediation` | `scs_artifact_remediation.get` | `scs_component_remediation.get` | Keep `scs_component_remediation`, alias `scs_artifact_remediation` |
| `POST /ng/api/environmentsV2/listV2` | `environment.list` (`environments`) | `chaos_environment.list` (`chaos`) | Use `environment` and alias `chaos_environment` -> `environment` |

### 2.4 Complete Inventory of All 8 Single-Action `execute`-Only Resource Types

Each of these has `operations: {}` and a single `executeActions` entry, forcing agents to discover a separate noun for what is actually a verb on an existing resource:

| Current `resource_type` | Single Action | Backend Endpoint | Target Parent Resource & Action |
|---|---|---|---|
| `pipeline_dynamic_execution` | `run` | `POST /v1/orgs/{org}/projects/{project}/pipelines/{pipeline}/execute/dynamic` | `pipeline_v1.executeActions.run_dynamic` |
| `scs_sbom_drift` | `calculate` | `POST /ssca-manager/v1/orgs/{org}/projects/{project}/orchestration/{orchestration}/sbom-drift` | `scs_sbom.executeActions.calculate_drift` (or `artifact_security.executeActions.sbom_drift`) |
| `database_execute_llm_authoring_pipeline` | `run` | `POST /dbops/v1/orgs/{org}/projects/{project}/llm-authoring/execute-pipeline` | `database_llm_authoring_pipeline.executeActions.run` |
| `work_item_resume` | `run` | `POST /adlc/api/workitems/{workItemId}/resume` | `work_item.executeActions.resume` |
| `work_item_approve` | `run` | `POST /adlc/api/workitems/{workItemId}/approve` | `work_item.executeActions.approve` |
| `budget_grant` | `run` | `POST /adlc/api/budgets/{budgetId}/grant` | `budget.executeActions.grant` |
| `online_eval` | `evaluate` | `POST .../online-evaluations` | `evaluation.executeActions.evaluate_online` |
| `eval_git_registration` | `register` | `POST .../git-registration` | `eval_git_settings.executeActions.register` |

### 2.5 Complete Inventory of All 17 `*_detail` / `*_stats` / `*_count` / `*_summary` / `*_metadata_v3` Resource Types

| Current `resource_type` | Toolset | Op | Endpoint | Consolidation Path |
|---|---|---|---|---|
| `registry_metadata_v3` | `registries-v3` | `get` | `GET /har/api/v3/registries/{id}/metadata` | Single `artifact_metadata_v3` (`entity_type` + `entity_id`) or parent `executeActions.metadata` (`risk: "read"`) |
| `package_metadata_v3` | `registries-v3` | `get` | `GET /har/api/v3/packages/{id}/metadata` | Fold into `package_v3` (`executeActions.metadata` or `artifact_metadata_v3`) |
| `version_metadata_v3` | `registries-v3` | `get` | `GET /har/api/v3/versions/{id}/metadata` | Fold into `version_v3` (`executeActions.metadata` or `artifact_metadata_v3`) |
| `file_metadata_v3` | `registries-v3` | `get` | `GET /har/api/v3/files/{id}/metadata` | Fold into `file_v3` (`executeActions.metadata` or `artifact_metadata_v3`) |
| `cost_recommendation_detail` | `ccm` | `get` | `GET /ccm/api/recommendation/details/{typePath}` | Fold into `cost_recommendation.get` (route via `routeResolver` when `type_path` is passed) |
| `cost_recommendation_stats` | `ccm` | `get` | `POST /ccm/api/recommendation/overview/stats` | Fold into `cost_recommendation.executeActions.stats` (`risk: "read"`) |
| `cost_recommendation_count` | `ccm` | `get` | `POST /ccm/api/recommendation/overview/count` | Fold into `cost_recommendation.executeActions.count` (`risk: "read"`) |
| `cost_anomaly_summary` | `ccm` | `get` | `POST /ccm/api/anomaly/v2/summary` | Fold into `cost_anomaly.executeActions.summary` (`risk: "read"`) |
| `cost_summary` | `ccm` | `list`/`get` | `POST /ccm/api/graphql` | Keep as overview resource or fold into `cost_breakdown` |
| `scorecard_stats` | `idp` | `get` | `GET /v1/scorecards/{scorecardIdentifier}/stats` | Fold into `scorecard.executeActions.stats` (`risk: "read"`) |
| `scorecard_check_stats` | `idp` | `get` | `GET /v1/checks/{checkIdentifier}/stats` | Fold into `scorecard_check.executeActions.stats` (`risk: "read"`) |
| `idp_score_summary` | `idp` | `get` | `GET /v1/scores/summary` | Fold into `idp_score.get` (`identifierFields: []`) |
| `sei_team_detail` | `sei` | `list` | `GET /gateway/sei/api/v2/teams` | Fold into `sei_team` |
| `sei_org_tree_detail` | `sei` | `get` | `GET /gateway/sei/api/v2/org-trees/{id}` | Fold into `sei_org_tree.get` |
| `pipeline_summary` | `pipelines` | `get` | `GET /pipeline/api/pipelines/summary/{pipelineIdentifier}` | Fold into `pipeline.executeActions.summary` (`risk: "read"`) |
| `scs_oss_risk_summary` | `scs` | `get` | `GET /ssca-manager/v1/orgs/{org}/projects/{project}/oss-risks/summary` | Fold into `scs_project_security_overview` / `artifact_security` |
| `kg_queryable_type_summary` | `knowledge-graph` | `list` | `POST .../getQueryableTypes` | Keep (primary discovery list for `knowledge-graph`) |

### 2.6 Schema & Discovery Payload Cost

| Payload Surface | Default Registry (274 types) | Full Registry w/ Opt-Ins (321 types) | Impact of Un-Consolidated Sprawl |
|---|---:|---:|---|
| `tools/list` (`HARNESS_SCHEMA_MODE=compact`) | **21,972 B** (budget: 22,500 B; **528 B headroom**) | **21,972 B** | Unaffected by resource count, but relies on `harness_describe` & `resolveAlias()` |
| `tools/list` (`HARNESS_SCHEMA_MODE=full`) | **53,253 B** | **56,448 B** | Every new default resource type adds its name to 2–6 tool `z.enum` lists (~70–120 B/type) |
| `harness_describe()` (`describeSummary()`) | **38,156 B** (~9.5k tokens) | **43,224 B** (~10.8k tokens) | **~115–140 B per resource type** returned on every unfiltered catalog call |
| `harness_describe(operation="list")` | **20,572 B** | **23,402 B** | Bloated by `*_stats` POSTs and child-item endpoints disguised as top-level `list` types |
| `harness_describe(operation="get")` | **18,530 B** | **21,273 B** | Bloated by `*_detail`, `*_stats`, `*_count`, and `*_metadata` `get`-only types |
| `harness_describe(operation="execute")` | **10,641 B** | **11,385 B** | Lowest-noise discovery surface (**48% smaller than `list`**) |

---

## 3. Solution Implemented in This Branch

1. **Per-Operation Scope Override (`EndpointSpec.scope?: ResourceScope`)**
   - Added `scope?: ResourceScope` to `EndpointSpec` in `src/registry/types.ts`.
   - Wired `spec.scope` in `Registry.dispatch`, `Registry.executeSpec`, and `Registry.emitAuditEvent` (`src/registry/index.ts`).
2. **Wire `EndpointSpec.scopeParams` in `Registry.executeSpec`**
   - Fixed `src/registry/index.ts` so `effectiveScopeParams = resolvedRoute?.scopeParams ?? spec.scopeParams ?? def.scopeParams` honors `EndpointSpec.scopeParams`.
3. **Automated Taxonomy Guardrails in `tests/coding-standards/registry-contract.test.ts` and `docs/coding-standards.md`**
   - Validates `EndpointSpec.scope` values across all registered resources.
   - Blocks new `_v[0-9]+` version-suffixed resource types unless explicitly allowlisted for coexisting same-name versions.
   - Blocks new single-action `execute`-only resource types.
   - Blocks new `*_detail` / `*_stats` / `*_count` resource types.
