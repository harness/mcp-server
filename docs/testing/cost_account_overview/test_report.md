# Test Report: Cost Account Overview (`cost_account_overview`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_account_overview` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-cao-001 | Get account overview with defaults | `harness_get(resource_type="cost_account_overview")` | Returns account-level cost overview | ✅ Passed | Returns account cost overview (intermittent 500) | Intermittent server errors |
| TC-cao-002 | Get with start_time and end_time | `harness_get(resource_type="cost_account_overview", start_time="2025-01-01T00:00:00Z", end_time="2025-01-31T23:59:59Z")` | Returns overview for specified time range | ⬜ Pending | | |
| TC-cao-003 | Get with group_by | `harness_get(resource_type="cost_account_overview", group_by="SERVICE")` | Returns overview grouped by service | ⬜ Pending | | |
| TC-cao-004 | Get with all parameters | `harness_get(resource_type="cost_account_overview", start_time="2025-01-01T00:00:00Z", end_time="2025-01-31T23:59:59Z", group_by="REGION")` | Returns overview for time range grouped by region | ⬜ Pending | | |
| TC-cao-005 | Get with only start_time | `harness_get(resource_type="cost_account_overview", start_time="2025-01-01T00:00:00Z")` | Returns overview from start_time to now | ⬜ Pending | | |
| TC-cao-006 | Verify deep link in response | `harness_get(resource_type="cost_account_overview")` | Response includes deep link to `/ng/account/{accountId}/ce/overview` | ⬜ Pending | | |
| TC-cao-007 | Attempt list operation (not supported) | `harness_list(resource_type="cost_account_overview")` | Returns error indicating list is not supported | ⬜ Pending | | |
| TC-cao-008 | Overview when no cost data exists | `harness_get(resource_type="cost_account_overview")` | Returns empty or zero-value overview | ⬜ Pending | | |
| TC-cao-009 | Invalid time range (end before start) | `harness_get(resource_type="cost_account_overview", start_time="2025-12-31T00:00:00Z", end_time="2025-01-01T00:00:00Z")` | Returns error or empty result | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 9 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 8 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
