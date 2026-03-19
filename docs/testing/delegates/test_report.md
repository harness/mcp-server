# Module: PLATFORM

## DELEGATES — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** `[MCP_PROMPT_PARITY_RUN_2026-03-19.md](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)`


| Check    | v1                         | v2                              | Match                               |
| -------- | -------------------------- | ------------------------------- | ----------------------------------- |
| List     | *(no delegate tool in v1)* | `harness_list` (`delegate`)     | ✅ v2 **5** delegate groups          |
| Diagnose | *(no tool)*                | `harness_diagnose` (`delegate`) | ✅ v2 **4** healthy, **0** unhealthy |


*Re-run: use the same scope as `[test_plan.md](./test_plan.md)`; then update the **Test Results** table below if any row changed.*

### Summary


| Metric      | Count |
| ----------- | ----- |
| Total Tests | 7     |
| ✅ Passed    | 6     |
| ❌ Failed    | 0     |
| ⚠️ Partial  | 1     |
| ⏭️ Skipped  | 0     |


---

### Test Results


| Test ID | Test                     | v1 Result     | v2 Result                | Notes                                                                                                    |
| ------- | ------------------------ | ------------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| DEL-001 | List all delegates       | N/A (no tool) | ✅ 5 delegate groups      | helm-delegate, test-yaml-version, qa-ssca-attt, docker-delegate, kubernetes-delegate-idp — all connected |
| DEL-002 | Page 1, size 5           | N/A (no tool) | ✅ 5 delegates returned   | Total = 5 so page fills exactly; type, name, tags, replicas, connected status, autoUpgrade all present   |
| DEL-003 | Page 2, size 5           | N/A (no tool) | ⚠️ Same 5 as page 0      | Delegate list API does not support pagination — returns all delegates regardless of page param             |
| DEL-004 | Diagnose delegate health | N/A (no tool) | ✅ 4 healthy, 0 unhealthy | Searched across account for "helm-delegate" matches; all 4/4 healthy with heartbeats                     |
| DEL-005 | List at Account scope    | N/A (no tool) | ✅ 5 delegates             | No org_id/project_id — all account-level delegates returned |
| DEL-006 | List at Org scope       | N/A (no tool) | ✅ 0 delegates             | org_id=AI_Devops — no org-scoped delegates exist; account-level delegates not returned |
| DEL-007 | List at Project scope   | N/A (no tool) | ✅ 0 delegates             | org_id=AI_Devops, project_id=Sanity — no project-scoped delegates exist |


> **Legend:** ✅ Pass | ❌ Fail | ⚠️ Partial | ⏭️ Skipped | N/A = Not Applicable | N/T = Not Tested

---

### Issues Found


| #   | Test ID | Severity | Description                                                           | Status |
| --- | ------- | -------- | --------------------------------------------------------------------- | ------ |
| 1   | DEL-003 | Low      | Delegate list API ignores page/size params — always returns full list | Open |


---

### Manual MCP tool invocation (2026-03-19)

Invoked delegate-related tools on both MCP servers to compare:

| Tool | v1 (user-harness-mcp-v1) | v2 (user-harness-mcp-v2) |
|------|---------------------------|---------------------------|
| **List delegates** | `core_list_delegates` — **not found** (not in v1 tool set) | `harness_list(resource_type=delegate)` — ✅ **works** → 5 delegates |
| **List page 0, size 5** | N/A | `harness_list(delegate, page=0, size=5)` — ✅ 5 items |
| **List page 1, size 5** | N/A | Same as page 0 (no pagination) |
| **Diagnose delegate** | No equivalent | `harness_diagnose(resource_type=delegate, resource_id=helm-delegate)` — ✅ **works** → 4 healthy delegates |

**Finding:** The configured MCP v1 server exposes 60 tools (e.g. `list_pipelines`, `list_connectors`, `get_audit_yaml`) but **no delegate tools**. The test plan’s `core_list_delegates` is not present in the Cursor MCP v1 descriptor (`mcps/user-harness-mcp-v1/tools/`). Comparison is v2-only until v1 adds delegate support.

---

### Notes

- v1 has no `list_delegates` or delegate-related tool; all delegate tests are v2-only.
- v2 `harness_list(resource_type=delegate)` returns 5 delegate groups at account scope, each with replica-level details (uuid, hostName, version, expiringAt, status).
- v2 `harness_diagnose(resource_type=delegate)` searches across all scopes (account + org/project) for matching delegate names; found 4 helm-delegate instances across different orgs/projects.
- Delegate list does not paginate — page and size params are ignored; all delegates are returned in every call.
- docker-delegate has 2 replicas (both connected); all others have 1 replica each.

