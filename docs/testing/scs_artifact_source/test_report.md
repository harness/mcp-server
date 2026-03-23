# Test Report: SCS Artifact Source (`scs_artifact_source`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scs_artifact_source` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-SAS-001 | List artifact sources with defaults | `harness_list(resource_type="scs_artifact_source")` | Returns list of artifact sources in the project | ✅ Passed | Returns empty list; API responds correctly |  |
| TC-SAS-002 | List with explicit page | `harness_list(resource_type="scs_artifact_source", page=1)` | Returns second page of artifact sources | ⬜ Pending | | |
| TC-SAS-003 | List with custom page size | `harness_list(resource_type="scs_artifact_source", size=5)` | Returns at most 5 artifact sources | ⬜ Pending | | |
| TC-SAS-004 | List with search_term | `harness_list(resource_type="scs_artifact_source", search_term="docker")` | Returns artifact sources matching "docker" | ⬜ Pending | | |
| TC-SAS-005 | List with explicit org_id and project_id | `harness_list(resource_type="scs_artifact_source", org_id="my-org", project_id="my-project")` | Returns artifact sources for specified org/project | ⬜ Pending | | |
| TC-SAS-006 | List with default org/project from config | `harness_list(resource_type="scs_artifact_source")` | Uses default org/project from environment config | ⬜ Pending | | |
| TC-SAS-007 | List without project scope | `harness_list(resource_type="scs_artifact_source")` (no project configured) | Error: project identifier required | ⬜ Pending | | |
| TC-SAS-008 | Unsupported operation (get) | `harness_get(resource_type="scs_artifact_source", source_id="src-1")` | Error: get operation not supported | ⬜ Pending | | |
| TC-SAS-009 | Authentication failure | `harness_list(resource_type="scs_artifact_source")` (invalid key) | Returns 401 Unauthorized error | ⬜ Pending | | |
| TC-SAS-010 | Empty project with no artifact sources | `harness_list(resource_type="scs_artifact_source")` | Returns empty items list | ⬜ Pending | | |
| TC-SAS-011 | Search term with no matches | `harness_list(resource_type="scs_artifact_source", search_term="nonexistent_xyz")` | Returns empty items list | ⬜ Pending | | |

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
