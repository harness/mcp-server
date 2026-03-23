# Test Report: Scorecard (`scorecard`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scorecard` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-scorecard-001 | List all scorecards with defaults | `harness_list(resource_type="scorecard")` | Returns paginated list of scorecards | ✅ Passed | Returns 180 scorecards with identifier, name, description, deep links |  |
| TC-scorecard-002 | List with pagination page 0 | `harness_list(resource_type="scorecard", page=0, size=5)` | Returns first page with up to 5 scorecards | ⬜ Pending | | |
| TC-scorecard-003 | List with pagination page 1 | `harness_list(resource_type="scorecard", page=1, size=5)` | Returns second page with up to 5 scorecards | ⬜ Pending | | |
| TC-scorecard-004 | List with large page size | `harness_list(resource_type="scorecard", size=100)` | Returns up to 100 scorecards | ⬜ Pending | | |
| TC-scorecard-005 | Get scorecard by ID | `harness_get(resource_type="scorecard", scorecard_id="my_scorecard")` | Returns full scorecard details | ⬜ Pending | | |
| TC-scorecard-006 | Get scorecard includes deep link | `harness_get(resource_type="scorecard", scorecard_id="my_scorecard")` | Response includes deep link URL | ⬜ Pending | | |
| TC-scorecard-007 | Get with missing scorecard_id | `harness_get(resource_type="scorecard")` | Error: scorecard_id is required | ⬜ Pending | | |
| TC-scorecard-008 | Get non-existent scorecard | `harness_get(resource_type="scorecard", scorecard_id="nonexistent")` | Error: scorecard not found (404) | ⬜ Pending | | |
| TC-scorecard-009 | List with page beyond available data | `harness_list(resource_type="scorecard", page=9999)` | Returns empty list | ⬜ Pending | | |
| TC-scorecard-010 | List with size=1 | `harness_list(resource_type="scorecard", size=1)` | Returns exactly 1 scorecard | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 10 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 9 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
