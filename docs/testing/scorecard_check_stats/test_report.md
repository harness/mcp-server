# Test Report: Scorecard Check Stats (`scorecard_check_stats`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scorecard_check_stats` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-scorecard_check_stats-001 | Get stats for a scorecard check | `harness_get(resource_type="scorecard_check_stats", check_id="my_check")` | Returns statistics for the specified check | ✅ Passed | Returns check statistics (get only, requires check_id) | Returns error if check_id not found |
| TC-scorecard_check_stats-002 | Get stats with is_custom param | `harness_get(resource_type="scorecard_check_stats", check_id="custom_check", is_custom=true)` | Returns stats for a custom check | ⬜ Pending | | |
| TC-scorecard_check_stats-003 | Get stats includes deep link | `harness_get(resource_type="scorecard_check_stats", check_id="my_check")` | Response includes deep link URL | ⬜ Pending | | |
| TC-scorecard_check_stats-004 | Get with missing check_id | `harness_get(resource_type="scorecard_check_stats")` | Error: check_id is required | ⬜ Pending | | |
| TC-scorecard_check_stats-005 | Get stats for non-existent check | `harness_get(resource_type="scorecard_check_stats", check_id="nonexistent")` | Error: check not found (404) | ⬜ Pending | | |
| TC-scorecard_check_stats-006 | Attempt to list (unsupported) | `harness_list(resource_type="scorecard_check_stats")` | Error: list operation not supported | ⬜ Pending | | |
| TC-scorecard_check_stats-007 | Get stats with empty check_id | `harness_get(resource_type="scorecard_check_stats", check_id="")` | Error: invalid check_id | ⬜ Pending | | |
| TC-scorecard_check_stats-008 | Get stats with special characters in ID | `harness_get(resource_type="scorecard_check_stats", check_id="check-v2_custom")` | Returns stats or appropriate error | ⬜ Pending | | |

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
