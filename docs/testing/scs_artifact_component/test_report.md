# Test Report: SCS Artifact Component (`scs_artifact_component`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scs_artifact_component` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-SAC-001 | List components of an artifact | `harness_list(resource_type="scs_artifact_component", artifact_id="art-1")` | Returns list of components (dependencies) in the artifact | ✅ Passed | API responds correctly; requires artifact_id filter | Requires artifact_id filter |
| TC-SAC-002 | List with explicit page | `harness_list(resource_type="scs_artifact_component", artifact_id="art-1", page=1)` | Returns second page of components | ⬜ Pending | | |
| TC-SAC-003 | List with custom page size | `harness_list(resource_type="scs_artifact_component", artifact_id="art-1", size=10)` | Returns at most 10 components | ⬜ Pending | | |
| TC-SAC-004 | List with search_term | `harness_list(resource_type="scs_artifact_component", artifact_id="art-1", search_term="lodash")` | Returns components matching "lodash" | ⬜ Pending | | |
| TC-SAC-005 | List with sort and order | `harness_list(resource_type="scs_artifact_component", artifact_id="art-1", sort="name", order="asc")` | Returns sorted components | ⬜ Pending | | |
| TC-SAC-006 | List with explicit org_id and project_id | `harness_list(resource_type="scs_artifact_component", artifact_id="art-1", org_id="my-org", project_id="my-project")` | Returns components for specified org/project | ⬜ Pending | | |
| TC-SAC-007 | List without artifact_id | `harness_list(resource_type="scs_artifact_component")` | Error: artifact_id is required | ⬜ Pending | | |
| TC-SAC-008 | Non-existent artifact_id | `harness_list(resource_type="scs_artifact_component", artifact_id="nonexistent")` | Returns 404 or empty list | ⬜ Pending | | |
| TC-SAC-009 | Unsupported operation (get) | `harness_get(resource_type="scs_artifact_component", artifact_id="art-1")` | Error: get operation not supported | ⬜ Pending | | |
| TC-SAC-010 | Artifact with no components | `harness_list(resource_type="scs_artifact_component", artifact_id="empty-art")` | Returns empty items list | ⬜ Pending | | |
| TC-SAC-011 | Search term with no matches | `harness_list(resource_type="scs_artifact_component", artifact_id="art-1", search_term="nonexistent_xyz")` | Returns empty items list | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 11 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 10 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
