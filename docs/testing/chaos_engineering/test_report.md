# Module: CHAOS ENGINEERING (Requires License)

## CHAOS ENGINEERING — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List chaos experiments | N/A (no chaos tools in v1) | `harness_list` (`chaos_experiment`) → 0 items | ⏭️ v1 N/A |
| List chaos hubs | N/A (no chaos tools in v1) | `harness_list` (`chaos_hub`) → ❌ unknown resource_type | ⏭️ v1 N/A |
| List chaos infrastructure | N/A (no chaos tools in v1) | `harness_list` (`chaos_infrastructure`) → 0 items | ⏭️ v1 N/A |
| Get experiment | N/A (no chaos tools in v1) | `harness_get` (`chaos_experiment`) → Bad Request (no data) | ⏭️ v1 N/A |
| Run experiment | N/A (no chaos tools in v1) | `harness_execute` (`chaos_experiment`, run) → Bad Request (no data) | ⏭️ v1 N/A |

_v1 has no chaos engineering tools. v2 supports chaos_experiment and chaos_infrastructure resource types but the project has no chaos data (likely unlicensed). `chaos_hub` is not a valid v2 resource_type._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 5 |
| ✅ Passed | 2 |
| ❌ Failed | 1 |
| ⏭️ Skipped | 2 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| CHS-001 | List chaos experiments | N/A (no tool) | ✅ Pass (0 items) | `harness_list(resource_type=chaos_experiment)` returned `{items:[], total:0}`. Endpoint works; no experiments in project (likely unlicensed). |
| CHS-002 | List chaos hubs | N/A (no tool) | ❌ Fail | `chaos_hub` is not a recognized v2 resource_type. Available chaos types: `chaos_experiment`, `chaos_experiment_run`, `chaos_experiment_template`, `chaos_experiment_variable`, `chaos_infrastructure`, `chaos_loadtest`, `chaos_probe`. |
| CHS-003 | List chaos infrastructure | N/A (no tool) | ✅ Pass (0 items) | `harness_list(resource_type=chaos_infrastructure)` returned `{items:[], total:0}`. Endpoint works; no infra in project. |
| CHS-004 | Get experiment details | N/A (no tool) | ⏭️ Skipped | No experiments exist to retrieve. `harness_get(resource_type=chaos_experiment, resource_id=test-experiment)` returned "Bad Request". Tool routing is valid but no real data available. |
| CHS-005 | Run experiment | N/A (no tool) | ⏭️ Skipped | No experiments exist to run. `harness_execute(resource_type=chaos_experiment, action=run, resource_id=test-experiment)` returned "Bad Request". Tool routing is valid but no real data available. |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | CHS-002 | Medium | `chaos_hub` is not a valid v2 resource_type — no way to list Chaos Hubs | Open |

---

### Notes

- **v1** has zero chaos engineering tools across all 60 available tools.
- **v2** supports `chaos_experiment` and `chaos_infrastructure` as resource types for `harness_list`, `harness_get`, and `harness_execute`.
- **v2** does NOT support `chaos_hub` as a resource_type. The closest chaos-related types are: `chaos_experiment`, `chaos_experiment_run`, `chaos_experiment_template`, `chaos_experiment_variable`, `chaos_infrastructure`, `chaos_loadtest`, `chaos_probe`.
- The test account/project (AI_Devops/Sanity) has no chaos data — likely the Chaos Engineering module is not licensed.
- CHS-004 and CHS-005 could not be fully validated without existing chaos experiment data; the tool routing accepts `chaos_experiment` but returns "Bad Request" for non-existent IDs.
