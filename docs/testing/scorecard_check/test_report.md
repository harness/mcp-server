# Test Report: Scorecard Check (`scorecard_check`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scorecard_check` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-scorecard_check-001 | List all scorecard checks with defaults | `harness_list(resource_type="scorecard_check")` | Returns paginated list of scorecard checks | ✅ Passed | Returns 3 scorecard checks with identifier, name, tags |  |
| TC-scorecard_check-002 | List with pagination | `harness_list(resource_type="scorecard_check", page=0, size=5)` | Returns first page with up to 5 checks | ⬜ Pending | | |
| TC-scorecard_check-003 | List second page | `harness_list(resource_type="scorecard_check", page=1, size=5)` | Returns second page of checks | ⬜ Pending | | |
| TC-scorecard_check-004 | List with large page size | `harness_list(resource_type="scorecard_check", size=100)` | Returns up to 100 checks | ⬜ Pending | | |
| TC-scorecard_check-005 | Get check by check_id | `harness_get(resource_type="scorecard_check", check_id="my_check")` | Returns full check details | ⬜ Pending | | |
| TC-scorecard_check-006 | Get check with is_custom query param | `harness_get(resource_type="scorecard_check", check_id="custom_check", is_custom=true)` | Returns custom check details | ⬜ Pending | | |
| TC-scorecard_check-007 | Get with missing check_id | `harness_get(resource_type="scorecard_check")` | Error: check_id is required | ⬜ Pending | | |
| TC-scorecard_check-008 | Get non-existent check | `harness_get(resource_type="scorecard_check", check_id="nonexistent")` | Error: check not found (404) | ⬜ Pending | | |
| TC-scorecard_check-009 | List with page beyond data | `harness_list(resource_type="scorecard_check", page=9999)` | Returns empty list | ⬜ Pending | | |
| TC-scorecard_check-010 | List with size=1 | `harness_list(resource_type="scorecard_check", size=1)` | Returns exactly 1 check | ⬜ Pending | | |

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
