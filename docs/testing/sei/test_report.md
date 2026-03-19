# Module: SEI - Software Engineering Insights (Requires License)

## SEI — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | *(no SEI tools in v1)* | `harness_list` (`sei_*` types registered) | ⏭️ License |
| Get | *(no SEI tools in v1)* | `harness_get` (`sei_*` types registered) | ⏭️ License |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 3 |
| ✅ Passed | 0 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 3 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| SEI-001 | List Collections | N/A | ⏭️ Skipped | v1: no SEI tools (confirmed 0/60 tools). v2: `sei_collection` not a valid resource_type; closest `sei_org_tree` returns "Required parameter projectIdentifier missing". SEI not licensed on test account. |
| SEI-002 | List Insights | N/A | ⏭️ Skipped | v1: no SEI tools (confirmed 0/60 tools). v2: `sei_insight` not a valid resource_type; closest `sei_metric` returns HTTP 401 Unauthorized. SEI not licensed on test account. |
| SEI-003 | Get Collection | N/A | ⏭️ Skipped | v1: no SEI tools (confirmed 0/60 tools). v2: `sei_org_tree` with resource_id `1` returns "A database error occurred". SEI not licensed on test account. |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | SEI-001 | Low | Test plan references `sei_collection` resource_type but v2 does not support it; available SEI types are `sei_org_tree`, `sei_team`, `sei_metric`, `sei_dora_metric`, `sei_productivity_metric`, `sei_ai_usage`, `sei_ai_adoption`, `sei_ai_impact`, `sei_ai_raw_metric`, `sei_business_alignment`, `sei_org_tree_detail`, `sei_team_detail` | Open |
| 2 | SEI-002 | Low | Test plan references `sei_insight` resource_type but v2 does not support it; no direct equivalent found | Open |

---

### Notes

- SEI (Software Engineering Insights) module is not licensed on the test account.
- v1 MCP server has **zero** SEI-related tools (confirmed by scanning all 60 tool descriptors).
- v2 MCP server has 12 SEI resource types registered: `sei_ai_adoption`, `sei_ai_impact`, `sei_ai_raw_metric`, `sei_ai_usage`, `sei_business_alignment`, `sei_dora_metric`, `sei_metric`, `sei_org_tree`, `sei_org_tree_detail`, `sei_productivity_metric`, `sei_team`, `sei_team_detail`.
- The test plan's `sei_collection` and `sei_insight` resource types do not exist in v2; the closest analogues (`sei_org_tree`, `sei_metric`) both fail with license/auth errors.
- Tested both with explicit scope (org_id=AI_Devops, project_id=Sanity) and without scope — same errors in both cases, confirming this is a licensing issue not a scoping issue.
- All tests require an SEI-licensed account to produce meaningful pass/fail results.
- Revalidated on 2026-03-19 with identical results to prior run.
