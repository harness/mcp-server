# Test Report: Scorecard Stats (`scorecard_stats`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scorecard_stats` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-scorecard_stats-001 | Get stats for a scorecard | `harness_get(resource_type="scorecard_stats", scorecard_id="my_scorecard")` | Returns aggregate statistics for the scorecard | ✅ Passed | Returns scorecard statistics with entity scores (get only, requires scorecard_id) |  |
| TC-scorecard_stats-002 | Get stats includes deep link | `harness_get(resource_type="scorecard_stats", scorecard_id="my_scorecard")` | Response includes deep link to scorecard | ⬜ Pending | | |
| TC-scorecard_stats-003 | Get with missing scorecard_id | `harness_get(resource_type="scorecard_stats")` | Error: scorecard_id is required | ⬜ Pending | | |
| TC-scorecard_stats-004 | Get stats for non-existent scorecard | `harness_get(resource_type="scorecard_stats", scorecard_id="nonexistent")` | Error: scorecard not found (404) | ⬜ Pending | | |
| TC-scorecard_stats-005 | Attempt to list (unsupported) | `harness_list(resource_type="scorecard_stats")` | Error: list operation not supported | ⬜ Pending | | |
| TC-scorecard_stats-006 | Verify stats response structure | `harness_get(resource_type="scorecard_stats", scorecard_id="my_scorecard")` | Response contains aggregate stats fields | ⬜ Pending | | |
| TC-scorecard_stats-007 | Get stats with empty scorecard_id | `harness_get(resource_type="scorecard_stats", scorecard_id="")` | Error: invalid scorecard_id | ⬜ Pending | | |
| TC-scorecard_stats-008 | Get stats with special characters in ID | `harness_get(resource_type="scorecard_stats", scorecard_id="test-scorecard_v2")` | Returns stats or appropriate error | ⬜ Pending | | |

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
