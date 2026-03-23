# Test Report: Dashboard Data (`dashboard_data`)

| Field | Value |
|-------|-------|
| **Resource Type** | `dashboard_data` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-ddat-001 | Get dashboard data with default timeframe | `harness_get(resource_type="dashboard_data", resource_id="dash_123")` | Returns dashboard data as structured tables (default 30 days) | ✅ Passed | Returns dashboard data by ID (get only); requires valid dashboard resourceIdentifier | 404 if dashboard ID not found |
| TC-ddat-002 | Get dashboard data with custom timeframe | `harness_get(resource_type="dashboard_data", resource_id="dash_123", params={reporting_timeframe: 7})` | Returns dashboard data for the last 7 days | ⬜ Pending | | |
| TC-ddat-003 | Get dashboard data with 90-day timeframe | `harness_get(resource_type="dashboard_data", resource_id="dash_123", params={reporting_timeframe: 90})` | Returns dashboard data for the last 90 days | ⬜ Pending | | |
| TC-ddat-004 | Get dashboard data with 1-day timeframe | `harness_get(resource_type="dashboard_data", resource_id="dash_123", params={reporting_timeframe: 1})` | Returns dashboard data for the last 1 day | ⬜ Pending | | |
| TC-ddat-005 | Get dashboard data with expanded_tables | `harness_get(resource_type="dashboard_data", resource_id="dash_123", params={expanded_tables: true})` | Returns expanded table data from dashboard | ⬜ Pending | | |
| TC-ddat-006 | Get data for nonexistent dashboard | `harness_get(resource_type="dashboard_data", resource_id="nonexistent_dash")` | Error: Dashboard not found (404) | ⬜ Pending | | |
| TC-ddat-007 | Get data with invalid dashboard_id | `harness_get(resource_type="dashboard_data", resource_id="")` | Error: Invalid dashboard identifier | ⬜ Pending | | |
| TC-ddat-008 | Get data from dashboard with no data | `harness_get(resource_type="dashboard_data", resource_id="empty_dashboard")` | Returns empty or minimal data structure | ⬜ Pending | | |
| TC-ddat-009 | Get data with very large timeframe | `harness_get(resource_type="dashboard_data", resource_id="dash_123", params={reporting_timeframe: 365})` | Returns data for full year (may be large) | ⬜ Pending | | |
| TC-ddat-010 | Verify CSV-to-structured conversion | `harness_get(resource_type="dashboard_data", resource_id="dash_123")` | Response contains parsed tables, not raw CSV | ⬜ Pending | | |

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
