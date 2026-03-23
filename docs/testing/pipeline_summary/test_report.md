# Test Report: Pipeline Summary (`pipeline_summary`)

| Field | Value |
|-------|-------|
| **Resource Type** | `pipeline_summary` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-psum-001 | Get pipeline summary by identifier | `harness_get(resource_type="pipeline_summary", resource_id="my_pipeline")` | Returns lightweight pipeline summary without full YAML | ✅ Passed | Returns pipeline summary with execution history, stage names, module info, deep link (get only) |  |
| TC-psum-002 | Get pipeline summary with scope override | `harness_get(resource_type="pipeline_summary", resource_id="my_pipeline", org_id="custom_org", project_id="custom_project")` | Returns summary from specified org/project | ⬜ Pending | | |
| TC-psum-003 | Get summary for a CD pipeline | `harness_get(resource_type="pipeline_summary", resource_id="cd_deploy_pipeline")` | Returns summary with CD module metadata | ⬜ Pending | | |
| TC-psum-004 | Get summary for a CI pipeline | `harness_get(resource_type="pipeline_summary", resource_id="ci_build_pipeline")` | Returns summary with CI module metadata | ⬜ Pending | | |
| TC-psum-005 | Get summary with invalid identifier | `harness_get(resource_type="pipeline_summary", resource_id="nonexistent_pipeline")` | Error: Pipeline not found (404) | ⬜ Pending | | |
| TC-psum-006 | Get summary from unauthorized project | `harness_get(resource_type="pipeline_summary", resource_id="my_pipeline", org_id="no_access_org", project_id="no_access_project")` | Error: Unauthorized (401/403) | ⬜ Pending | | |
| TC-psum-007 | Get summary with special characters in identifier | `harness_get(resource_type="pipeline_summary", resource_id="pipeline-with-dashes_underscores")` | Returns summary for pipeline with special chars | ⬜ Pending | | |
| TC-psum-008 | Compare summary vs full get | `harness_get(resource_type="pipeline_summary", resource_id="my_pipeline")` then `harness_get(resource_type="pipeline", resource_id="my_pipeline")` | Summary has less data than full get (no YAML) | ⬜ Pending | | |

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
