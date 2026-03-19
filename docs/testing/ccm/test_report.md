# Module: CCM - Cloud Cost Management (Requires License)

## CCM — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List Perspectives | *(no CCM tools in v1)* | `harness_list` (`cost_perspective`) | ⏭️ License |
| List Budgets | *(no CCM tools in v1)* | N/A — no `cost_budget` resource type | ⏭️ License |
| List Anomalies | *(no CCM tools in v1)* | `harness_list` (`cost_anomaly`) | ⏭️ License |
| List Recommendations | *(no CCM tools in v1)* | `harness_list` (`cost_recommendation`) | ⏭️ License |
| Get Perspective | *(no CCM tools in v1)* | `harness_get` (`cost_perspective`) | ⏭️ License |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 5 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 4 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| CCM-001 | List Perspectives | N/A | ✅ Pass | `cost_perspective` returns `{"items":[],"total":0}` — tool functional, 0 items (no CCM data on account) |
| CCM-002 | List Budgets | N/A | ⏭️ Skipped | No `cost_budget` resource type in v2; budget not available as a list resource |
| CCM-003 | List Anomalies | N/A | ⏭️ Skipped | `cost_anomaly` returns server error (correlationId: 69e5fffb-f6d1-4aa2-bb78-924ff16c0fce); likely requires CCM license |
| CCM-004 | List Recommendations | N/A | ⏭️ Skipped | `cost_recommendation` returns "Unable to process JSON"; likely requires CCM license |
| CCM-005 | Get Perspective | N/A | ⏭️ Skipped | No perspectives exist to retrieve (CCM-001 returned 0 items); `harness_get` returns server error |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | CCM-002 | Low | No `cost_budget` resource type exists in v2; test plan expects budget listing but v2 has no budget resource | Open |
| 2 | CCM-003 | Low | `cost_anomaly` list returns 500 server error on unlicensed account instead of empty list | Open |
| 3 | CCM-004 | Low | `cost_recommendation` list returns JSON parse error on unlicensed account instead of empty list | Open |

---

### Notes

- **v1 has no CCM tools** — confirmed by inspecting all 60 v1 tool descriptors; none are CCM-related.
- **v2 resource types use `cost_` prefix**, not `ccm_`: `cost_perspective`, `cost_anomaly`, `cost_recommendation`, etc.
- **CCM-001 (cost_perspective)** is the only test that returned a clean response (empty list). The tool is functional; the account simply has no perspective data.
- **CCM-003 and CCM-004** returned server-side errors, likely because the Harness CCM API endpoints require an active CCM license to respond. Ideally these should return empty lists rather than 500 errors.
- **CCM-002 (budgets)** has no corresponding resource type in v2. Available cost-related types: `cost_account_overview`, `cost_anomaly`, `cost_anomaly_summary`, `cost_breakdown`, `cost_category`, `cost_commitment`, `cost_filter_value`, `cost_perspective`, `cost_recommendation`, `cost_recommendation_detail`, `cost_recommendation_stats`, `cost_summary`, `cost_timeseries`.
- A CCM-licensed account is required to fully validate these tools.
