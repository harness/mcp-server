# MCP v1 vs v2 — Prompt / tool parity run (2026-03-19)

**Environment:** QA (`qa.harness.io`)  
**Account:** `px7xd_BFRCi-pfWPYXVjvw` | **Org:** `AI_Devops` | **Project:** `Sanity`  
**Method:** For each resource, the **intent** of the natural-language prompts in `test_plan.md` was exercised via **MCP v1 named tools** vs **MCP v2** `harness_list` / `harness_get` (and required `filters` / `pipeline_id` / `target_identifier` where applicable). Executed from Cursor with `user-harness-mcp-v1` and `user-harness-mcp-v2`.

**Note:** This is a **smoke / count parity** pass, not a full re-run of every CON-/PIP- ID in each plan (e.g. CRUD, deep links, pagination edge cases). Update row-level tables in each `test_report.md` when those cases are re-executed.

---

## Summary table

<!-- Anchor names match `docs/testing/<folder>/` for deep links -->

| Resource (folder) | v1 tool / status | v2 `resource_type` / status | List totals / notes |
|-------------------|------------------|-----------------------------|---------------------|
| connectors | `list_connectors` | `connector` | v2 `total`: **15**; v1 returns full objects (pagination metadata sometimes inconsistent) — **aligned** |
| secrets | `list_secrets` | `secret` | **10** = **10** ✅ |
| templates | `list_templates` | `template` | v1 default page returned **5** in one call; v2 `total` **11** — compare with same page size / fetch all pages ⚠️ |
| dashboards | `list_dashboards` | `dashboard` | **44** = **44** ✅ |
| delegates | *(no list tool in configured v1 server)* | `delegate` | v2: **5** connected delegate groups |
| users | `get_all_users` | `user` | Scope differs by design (v1 often project-ish; v2 may default broader) — compare with explicit `org_id` / `project_id` |
| roles | `list_available_roles` | `role` | Not re-counted this run — see prior reports |
| user_groups | *(no dedicated list in v1 MCP toolset)* | `user_group` | v2 list only this run |
| resource_groups | *(no dedicated list in v1 MCP toolset)* | `resource_group` | v2 list only this run |
| role_assignments | `list_role_assignments` | `role_assignment` | Not re-run this session |
| service_accounts | *(get-by-id tools; no list)* | `service_account` | v2 list only |
| audit | `list_user_audits` | `audit_event` | High volume; spot-check filters |
| services | *(no v1 list in toolset)* | `service` | v2 `total`: **14** |
| environments | *(no v1 list in toolset)* | `environment` | v2 `total`: **9** |
| infrastructure | *(v1 tools not in Cursor MCP config)* | `infrastructure` + `filters.environment_id=aws_sam` | v2 `total`: **3** |
| pipeline_tests | `list_pipelines` | `pipeline` | **259** = **259** ✅ |
| executions | `list_executions` | `execution` | **3** = **3** ✅ |
| triggers | `list_triggers` + `target_identifier=custom_stage_pipeline` | `trigger` + `filters.pipeline_id` | **0** = **0** ✅ |
| input_sets | `list_input_sets` + `pipeline_identifier=custom_stage_pipeline` | `input_set` + `filters.pipeline_id` | **0** = **0** ✅ |
| repositories | `list_repositories` | `repository` | **1** repo (`r1`) ✅ |
| pull_requests | `list_pull_requests` + `repo_id=r1` | `pull_request` + `filters.repo_id` | **[]** = **[]** ✅ |
| idp_entities | `list_entities` *(needs `scope_level`)* | `idp_entity` | v1 call failed without param; v2 returned large catalog (paginated) |
| idp_workflows | *(check v1 toolset)* | `idp_workflow` | Not run this session |
| scorecards | `list_scorecards` | `scorecard` | v2 page `total` **180** (paginate for full set) |
| scorecard_checks | `list_scorecard_checks` | `scorecard_check` | Different shapes: v1 returns rich nested scorecard payload; v2 returns flat check list with `total` **100** on first page — **compare semantics**, not raw count |
| security_issues | `get_all_security_issues` | `security_issue` | Often **0** in empty project |
| security_exemptions | v1 STO tools | `security_exemption` | License / scope dependent |
| feature_flags | *(not in v1 Cursor tool list)* | `feature_flag` / FME types | v2 only unless v1 extended |
| artifact_registry | *(not in v1 Cursor tool list)* | `registry` / `artifact` | v2 only |
| chaos_engineering | *(not in v1 Cursor tool list)* | `chaos_*` | License |
| gitops | *(not in v1 Cursor tool list)* | `gitops_*` | License |
| srm | *(not in v1 Cursor tool list)* | *(SRM resources)* | License |
| ccm | *(not in v1 Cursor tool list)* | `cost_*` | License |
| sei | *(not in v1 Cursor tool list)* | `sei_*` | License |

---

## How to re-run

1. Enable **Harness MCP v1** and **Harness MCP v2** in Cursor with valid QA credentials.  
2. For each `test_plan.md`, map the prompt to the v1 tool name or v2 `resource_type` + `filters`.  
3. Update the **Prompt parity** table in the matching `test_report.md` and adjust row-level **Test Results** if outcomes changed.  
4. Keep this file as the **cross-resource** log; per-resource nuance stays in each `test_report.md`.

---

## Changelog

- **2026-03-19:** Initial automated MCP tool parity run documented; per-resource sections added to all `test_report.md` files under `docs/testing/*/`.
