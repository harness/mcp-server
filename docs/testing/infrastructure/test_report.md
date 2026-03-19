# Module: CD/CI

## INFRASTRUCTURE — Test Report

**Date:** 2026-03-19 (Updated: 2026-03-19)
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** `[MCP_PROMPT_PARITY_RUN_2026-03-19.md](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)`


| Check             | v1                                 | v2                                                                    | Match      |
| ----------------- | ---------------------------------- | --------------------------------------------------------------------- | ---------- |
| List + env filter | N/A — no infrastructure tool in v1 | `harness_list` (`infrastructure`, `environment_id=aws_sam`) → 3 items | ⚠️ v2 only |
| Get by ID         | N/A — no infrastructure tool in v1 | `harness_get` (`infrastructure`, `azure_fu`) → AzureFunction detail   | ⚠️ v2 only |


*v1 MCP server has no `list_infrastructure` or `get_infrastructure` tool. All infrastructure tests are v2-only.*

### Summary


| Metric      | Count |
| ----------- | ----- |
| Total Tests | 9     |
| ✅ Passed    | 6     |
| ❌ Failed    | 0     |
| ⏭️ Skipped  | 3     |


---

### Test Results


| Test ID | Test                          | v1 Result                 | v2 Result                                             | Notes                                                                       |
| ------- | ----------------------------- | ------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| INF-001 | List at Project scope (+ env) | N/A — no infra tool in v1 | ✅ 3 items (`azure_fu`, `google_cloud_run`, `aws_sam`) | `environment_id=aws_sam`, org=AI_Devops, project=Sanity                     |
| INF-002 | List at Org scope (+ env)     | N/A — no infra tool in v1 | ✅ 3 items (same set)                                  | Omitted `project_id`; server returned project-level infra (default project) |
| INF-003 | Page 1, size 5                | N/A — no infra tool in v1 | ✅ 3 items (page 0, size 5)                            | All 3 fit in first page                                                     |
| INF-004 | Page 2, size 5                | N/A — no infra tool in v1 | ✅ 0 items (page 1, size 5, total=3)                   | Correct empty second page                                                   |
| INF-005 | Get by ID                     | N/A — no infra tool in v1 | ✅ `azure_fu` — AzureFunction, env `aws_sam`           | Returns full YAML, connectorRef, deploymentType                             |
| INF-006 | Create                        | N/A                       | ⏭️ Skipped — destructive                              | v2 only (`harness_create`)                                                  |
| INF-007 | Update                        | N/A                       | ⏭️ Skipped — destructive                              | v2 only (`harness_update`)                                                  |
| INF-008 | Delete                        | N/A                       | ⏭️ Skipped — destructive                              | v2 only (`harness_delete`)                                                  |
| INF-009 | Required field validation     | N/A — no infra tool in v1 | ✅ Returns validation error without `environment_id`   | Fix verified: `Missing required filter fields for infrastructure list: environment_id` |


> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/A = Not Applicable | N/T = Not Tested

---
