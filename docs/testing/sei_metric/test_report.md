# Test Report: SEI Metric (`sei_metric`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_metric` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-SM-001 | List SEI metrics with defaults | `harness_list(resource_type="sei_metric")` | Returns list of SEI metrics with default pagination | ❌ Failed | HTTP 401 — /sei/api/v1/metrics endpoint; likely deprecated; all other SEI v2 endpoints work |  |
| TC-SM-002 | List with explicit page | `harness_list(resource_type="sei_metric", page=1)` | Returns second page of metrics | ⬜ Pending | | |
| TC-SM-003 | List with custom page size | `harness_list(resource_type="sei_metric", size=5)` | Returns at most 5 metrics | ⬜ Pending | | |
| TC-SM-004 | List page beyond available data | `harness_list(resource_type="sei_metric", page=9999)` | Returns empty list or appropriate message | ⬜ Pending | | |
| TC-SM-005 | Verify account-level scope | `harness_list(resource_type="sei_metric")` | Metrics returned at account level; no org/project required | ⬜ Pending | | |
| TC-SM-006 | Invalid resource type | `harness_list(resource_type="sei_metrics")` | Error: unknown resource type | ⬜ Pending | | |
| TC-SM-007 | Unsupported operation (get) | `harness_get(resource_type="sei_metric", id="some_id")` | Error: get operation not supported for sei_metric | ⬜ Pending | | |
| TC-SM-008 | Missing API key / auth failure | `harness_list(resource_type="sei_metric")` (no auth) | Returns 401 Unauthorized error | ⬜ Pending | | |
| TC-SM-009 | Empty account with no metrics | `harness_list(resource_type="sei_metric")` | Returns empty items list | ⬜ Pending | | |
| TC-SM-010 | Page 0, size 1 | `harness_list(resource_type="sei_metric", page=0, size=1)` | Returns exactly 1 metric | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 10 |
| ✅ Passed | 0 |
| ❌ Failed | 1 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 9 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
