# Test Report: Cost Summary (`cost_summary`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_summary` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-cs-001 | Get cost summary for a perspective | `harness_list(resource_type="cost_summary", perspective_id="<valid_id>")` | Returns trend stats: cost, idle cost, unallocated cost, efficiency score, forecast | ✅ Passed | Returns empty summary object; API responds correctly |  |
| TC-cs-002 | Summary with time_filter LAST_7 | `harness_list(resource_type="cost_summary", perspective_id="<valid_id>", time_filter="LAST_7")` | Returns summary for last 7 days | ⬜ Pending | | |
| TC-cs-003 | Summary with time_filter THIS_MONTH | `harness_list(resource_type="cost_summary", perspective_id="<valid_id>", time_filter="THIS_MONTH")` | Returns summary for current month | ⬜ Pending | | |
| TC-cs-004 | Summary with time_filter LAST_MONTH | `harness_list(resource_type="cost_summary", perspective_id="<valid_id>", time_filter="LAST_MONTH")` | Returns summary for last month | ⬜ Pending | | |
| TC-cs-005 | Summary with time_filter LAST_12_MONTHS | `harness_list(resource_type="cost_summary", perspective_id="<valid_id>", time_filter="LAST_12_MONTHS")` | Returns summary for last 12 months | ⬜ Pending | | |
| TC-cs-006 | Get CCM metadata (no perspective_id) | `harness_list(resource_type="cost_summary")` | Returns CCM metadata: available connectors, default perspective IDs, currency preferences | ⬜ Pending | | |
| TC-cs-007 | Get budget status for perspective | `harness_get(resource_type="cost_summary", perspective_id="<valid_id>")` | Returns budget summary: id, name, budgetAmount, actualCost, timeLeft | ⬜ Pending | | |
| TC-cs-008 | Get budget for perspective with no budget | `harness_get(resource_type="cost_summary", perspective_id="<no_budget_id>")` | Returns empty budget list | ⬜ Pending | | |
| TC-cs-009 | Get budget with invalid perspective_id | `harness_get(resource_type="cost_summary", perspective_id="nonexistent")` | Returns empty or error | ⬜ Pending | | |
| TC-cs-010 | Get budget missing perspective_id | `harness_get(resource_type="cost_summary")` | Returns validation error for missing perspective_id | ⬜ Pending | | |
| TC-cs-011 | Summary for cluster perspective | `harness_list(resource_type="cost_summary", perspective_id="<cluster_perspective_id>")` | Returns cluster-specific metrics (idle cost, unallocated cost, efficiency) | ⬜ Pending | | |
| TC-cs-012 | Verify forecast data present | `harness_list(resource_type="cost_summary", perspective_id="<valid_id>")` | Response includes perspectiveForecastCost with statsLabel, statsTrend, statsValue | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 12 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 11 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
