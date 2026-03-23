# Test Report: Input Set (`input_set`)

| Field | Value |
|-------|-------|
| **Resource Type** | `input_set` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-iset-001 | List all input sets with defaults | `harness_list(resource_type="input_set")` | Returns paginated list of input sets | ✅ Passed | Returns empty list (no input sets for this pipeline); API responds correctly |  |
| TC-iset-002 | List input sets with pagination | `harness_list(resource_type="input_set", page=1, size=5)` | Returns page 1 with up to 5 input sets | ⬜ Pending | | |
| TC-iset-003 | List input sets filtered by pipeline_id | `harness_list(resource_type="input_set", filters={pipeline_id: "my_pipeline"})` | Returns input sets only for the specified pipeline | ⬜ Pending | | |
| TC-iset-004 | List input sets with scope override | `harness_list(resource_type="input_set", org_id="custom_org", project_id="custom_project")` | Returns input sets from specified org/project | ⬜ Pending | | |
| TC-iset-005 | List input sets with pipeline_id and pagination | `harness_list(resource_type="input_set", filters={pipeline_id: "my_pipeline"}, page=0, size=10)` | Returns paginated input sets for specified pipeline | ⬜ Pending | | |
| TC-iset-006 | Get input set by identifier | `harness_get(resource_type="input_set", resource_id="my_input_set", params={pipeline_id: "my_pipeline"})` | Returns full input set details | ⬜ Pending | | |
| TC-iset-007 | Get input set with scope override | `harness_get(resource_type="input_set", resource_id="my_input_set", params={pipeline_id: "my_pipeline"}, org_id="other_org", project_id="other_project")` | Returns input set from specified org/project | ⬜ Pending | | |
| TC-iset-008 | Get input set with invalid identifier | `harness_get(resource_type="input_set", resource_id="nonexistent_input_set", params={pipeline_id: "my_pipeline"})` | Error: Input set not found (404) | ⬜ Pending | | |
| TC-iset-009 | List input sets with invalid pipeline_id | `harness_list(resource_type="input_set", filters={pipeline_id: "nonexistent_pipeline"})` | Error or empty results | ⬜ Pending | | |
| TC-iset-010 | Get input set from unauthorized project | `harness_get(resource_type="input_set", resource_id="my_input_set", params={pipeline_id: "my_pipeline"}, org_id="no_access_org", project_id="no_access_project")` | Error: Unauthorized (401/403) | ⬜ Pending | | |
| TC-iset-011 | List input sets with empty results | `harness_list(resource_type="input_set", filters={pipeline_id: "pipeline_with_no_input_sets"})` | Returns empty items array with total=0 | ⬜ Pending | | |
| TC-iset-012 | List input sets with max pagination | `harness_list(resource_type="input_set", page=0, size=100)` | Returns up to 100 input sets | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 12 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 11 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

_(To be filled during testing)_
