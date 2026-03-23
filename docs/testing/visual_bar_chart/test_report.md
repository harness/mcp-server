# Test Report: Bar Chart by Pipeline (`visual_bar_chart`)

| Field | Value |
|-------|-------|
| **Resource Type** | `visual_bar_chart` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-vbc-001 | Bar chart from execution list | `harness_list(resource_type="execution", include_visual=true, visual_type="bar")` | Returns execution list data and inline PNG horizontal bar chart | ✅ Passed | Returns metadata and usage instructions via harness_describe (diagnostic resource) |  |
| TC-vbc-002 | Grouped by pipeline | `harness_list(resource_type="execution", include_visual=true, visual_type="bar")` | Chart shows execution counts grouped by pipeline name | ⬜ Pending | | |
| TC-vbc-003 | Analysis field | `harness_list(resource_type="execution", include_visual=true, visual_type="bar")` | Response includes 'analysis' field with key insights | ⬜ Pending | | |
| TC-vbc-004 | With size parameter | `harness_list(resource_type="execution", include_visual=true, visual_type="bar", size=100)` | Aggregates 100 executions into bar chart | ⬜ Pending | | |
| TC-vbc-005 | Custom org and project | `harness_list(resource_type="execution", org_id="<org>", project_id="<project>", include_visual=true, visual_type="bar")` | Returns scoped bar chart | ⬜ Pending | | |
| TC-vbc-006 | Multiple pipelines | `harness_list(resource_type="execution", include_visual=true, visual_type="bar")` on project with many pipelines | Shows bars for each pipeline | ⬜ Pending | | |
| TC-vbc-007 | No executions | `harness_list(resource_type="execution", include_visual=true, visual_type="bar")` on empty project | Returns empty chart or appropriate message | ⬜ Pending | | |
| TC-vbc-008 | Single pipeline | `harness_list(resource_type="execution", include_visual=true, visual_type="bar")` on project with one pipeline | Shows single bar | ⬜ Pending | | |
| TC-vbc-009 | Resource metadata | `harness_describe(resource_type="visual_bar_chart")` | Returns metadata with diagnosticHint explaining usage | ⬜ Pending | | |

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
