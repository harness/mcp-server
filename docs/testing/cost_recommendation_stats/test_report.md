# Test Report: Cost Recommendation Stats (`cost_recommendation_stats`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_recommendation_stats` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-crs-001 | Get aggregate recommendation stats | `harness_get(resource_type="cost_recommendation_stats")` | Returns aggregate stats: total savings, total cost, recommendation count | ✅ Passed | Returns stats: totalMonthlyCost=0, totalMonthlySaving=0, deep link |  |
| TC-crs-002 | Get stats grouped by resource type | `harness_get(resource_type="cost_recommendation_stats", group_by="type")` | Returns stats broken down by resource type (resize, terminate, etc.) | ⬜ Pending | | |
| TC-crs-003 | Verify deep link in response | `harness_get(resource_type="cost_recommendation_stats")` | Response includes deep link to `/ng/account/{accountId}/ce/recommendations` | ⬜ Pending | | |
| TC-crs-004 | Stats when no recommendations exist | `harness_get(resource_type="cost_recommendation_stats")` | Returns zero counts and savings | ⬜ Pending | | |
| TC-crs-005 | Attempt list operation (not supported) | `harness_list(resource_type="cost_recommendation_stats")` | Returns error indicating list is not supported | ⬜ Pending | | |
| TC-crs-006 | Invalid group_by value | `harness_get(resource_type="cost_recommendation_stats", group_by="invalid")` | Uses default aggregate endpoint or returns error | ⬜ Pending | | |
| TC-crs-007 | Stats by type when only one type exists | `harness_get(resource_type="cost_recommendation_stats", group_by="type")` | Returns single resource type breakdown | ⬜ Pending | | |
| TC-crs-008 | Verify response structure | `harness_get(resource_type="cost_recommendation_stats")` | Response contains expected fields (totalSavings, totalCost, count) | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 8 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 7 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
