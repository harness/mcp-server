# Test Report: Runtime Input Template (`runtime_input_template`)

| Field | Value |
|-------|-------|
| **Resource Type** | `runtime_input_template` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-rit-001 | Get runtime input template for a pipeline | `harness_get(resource_type="runtime_input_template", resource_id="my_pipeline")` | Returns template showing all `<+input>` placeholders | ✅ Passed | Returns runtime input template YAML and hasInputSets flag (get only) |  |
| TC-rit-002 | Get runtime input template with branch param | `harness_get(resource_type="runtime_input_template", resource_id="my_pipeline", params={branch: "develop"})` | Returns template from the develop branch | ⬜ Pending | | |
| TC-rit-003 | Get runtime input template with scope override | `harness_get(resource_type="runtime_input_template", resource_id="my_pipeline", org_id="custom_org", project_id="custom_project")` | Returns template from specified org/project | ⬜ Pending | | |
| TC-rit-004 | Get template for pipeline with no runtime inputs | `harness_get(resource_type="runtime_input_template", resource_id="simple_pipeline")` | Returns empty or minimal template (no `<+input>` fields) | ⬜ Pending | | |
| TC-rit-005 | Get template for pipeline with many runtime inputs | `harness_get(resource_type="runtime_input_template", resource_id="complex_pipeline")` | Returns template with all runtime input placeholders | ⬜ Pending | | |
| TC-rit-006 | Get template with invalid pipeline identifier | `harness_get(resource_type="runtime_input_template", resource_id="nonexistent_pipeline")` | Error: Pipeline not found (404) | ⬜ Pending | | |
| TC-rit-007 | Get template from unauthorized project | `harness_get(resource_type="runtime_input_template", resource_id="my_pipeline", org_id="no_access_org", project_id="no_access_project")` | Error: Unauthorized (401/403) | ⬜ Pending | | |
| TC-rit-008 | Get template with special characters in pipeline_id | `harness_get(resource_type="runtime_input_template", resource_id="pipeline-with-dashes")` | Returns template for pipeline with special chars in ID | ⬜ Pending | | |

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
