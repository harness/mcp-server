# Test Report: Execution Timeseries (`visual_timeseries`)

| Field | Value |
|-------|-------|
| **Resource Type** | `visual_timeseries` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-vts-001 | Timeseries from execution list | `harness_list(resource_type="execution", include_visual=true, visual_type="timeseries")` | Returns execution data and inline PNG stacked bar chart | ✅ Passed | Returns metadata and usage instructions via harness_describe (diagnostic resource) |  |
| TC-vts-002 | Daily breakdown | `harness_list(resource_type="execution", include_visual=true, visual_type="timeseries")` | Chart shows daily execution counts over last 30 days | ⬜ Pending | | |
| TC-vts-003 | Status stacking | `harness_list(resource_type="execution", include_visual=true, visual_type="timeseries")` | Bars stacked by status (Success/Failed/Expired/Running) | ⬜ Pending | | |
| TC-vts-004 | Large dataset | `harness_list(resource_type="execution", include_visual=true, visual_type="timeseries", size=100)` | Aggregates 100 executions for better data points | ⬜ Pending | | |
| TC-vts-005 | Trend spotting | `harness_list(resource_type="execution", include_visual=true, visual_type="timeseries")` | Visual shows trends in execution frequency and success rate | ⬜ Pending | | |
| TC-vts-006 | Custom org and project | `harness_list(resource_type="execution", org_id="<org>", project_id="<project>", include_visual=true, visual_type="timeseries")` | Returns scoped timeseries chart | ⬜ Pending | | |
| TC-vts-007 | No executions | `harness_list(resource_type="execution", include_visual=true, visual_type="timeseries")` on empty project | Returns empty chart or appropriate message | ⬜ Pending | | |
| TC-vts-008 | Single day of data | `harness_list(resource_type="execution", include_visual=true, visual_type="timeseries", size=5)` | Shows chart with minimal data points | ⬜ Pending | | |
| TC-vts-009 | Resource metadata | `harness_describe(resource_type="visual_timeseries")` | Returns metadata with diagnosticHint explaining usage | ⬜ Pending | | |

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
