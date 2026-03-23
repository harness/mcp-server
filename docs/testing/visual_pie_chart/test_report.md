# Test Report: Pie / Donut Chart (`visual_pie_chart`)

| Field | Value |
|-------|-------|
| **Resource Type** | `visual_pie_chart` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-vpc-001 | Pie chart from execution list | `harness_list(resource_type="execution", include_visual=true, visual_type="pie")` | Returns execution list data and inline PNG donut chart | ✅ Passed | Returns metadata and usage instructions via harness_describe (diagnostic resource) |  |
| TC-vpc-002 | Status breakdown | `harness_list(resource_type="execution", include_visual=true, visual_type="pie")` | Chart shows breakdown by status (Success, Failed, Expired, etc.) | ⬜ Pending | | |
| TC-vpc-003 | Percentages displayed | `harness_list(resource_type="execution", include_visual=true, visual_type="pie")` | Each status segment shows percentage | ⬜ Pending | | |
| TC-vpc-004 | Analysis field | `harness_list(resource_type="execution", include_visual=true, visual_type="pie")` | Response includes 'analysis' field with key insights | ⬜ Pending | | |
| TC-vpc-005 | With size parameter | `harness_list(resource_type="execution", include_visual=true, visual_type="pie", size=50)` | Aggregates 50 executions into pie chart | ⬜ Pending | | |
| TC-vpc-006 | Custom org and project | `harness_list(resource_type="execution", org_id="<org>", project_id="<project>", include_visual=true, visual_type="pie")` | Returns scoped pie chart | ⬜ Pending | | |
| TC-vpc-007 | No executions | `harness_list(resource_type="execution", include_visual=true, visual_type="pie")` on empty project | Returns empty chart or appropriate message | ⬜ Pending | | |
| TC-vpc-008 | All same status | `harness_list(resource_type="execution", include_visual=true, visual_type="pie")` where all succeeded | Shows 100% Success donut | ⬜ Pending | | |
| TC-vpc-009 | Resource metadata | `harness_describe(resource_type="visual_pie_chart")` | Returns metadata with diagnosticHint explaining usage | ⬜ Pending | | |

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
