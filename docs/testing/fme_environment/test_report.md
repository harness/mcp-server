# Test Report: FME Environment (`fme_environment`)

| Field | Value |
|-------|-------|
| **Resource Type** | `fme_environment` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-fme_environment-001 | List environments for a workspace | `harness_list(resource_type="fme_environment", workspace_id="my_workspace")` | Returns list of environments for the workspace | ❌ Failed | Depends on fme_workspace which returns 401; FME module not configured |  |
| TC-fme_environment-002 | List environments for different workspace | `harness_list(resource_type="fme_environment", workspace_id="other_workspace")` | Returns environments for the other workspace | ⬜ Pending | | |
| TC-fme_environment-003 | List without workspace_id | `harness_list(resource_type="fme_environment")` | Error: workspace_id is required | ⬜ Pending | | |
| TC-fme_environment-004 | List with non-existent workspace | `harness_list(resource_type="fme_environment", workspace_id="nonexistent")` | Error: workspace not found (404) | ⬜ Pending | | |
| TC-fme_environment-005 | Attempt get operation (unsupported) | `harness_get(resource_type="fme_environment", workspace_id="my_workspace", environment_id="prod")` | Error: get operation not supported | ⬜ Pending | | |
| TC-fme_environment-006 | List with empty workspace_id | `harness_list(resource_type="fme_environment", workspace_id="")` | Error: invalid workspace_id | ⬜ Pending | | |
| TC-fme_environment-007 | Verify response structure | `harness_list(resource_type="fme_environment", workspace_id="my_workspace")` | Response contains environment objects with id and name | ⬜ Pending | | |
| TC-fme_environment-008 | List for workspace with no environments | `harness_list(resource_type="fme_environment", workspace_id="empty_workspace")` | Returns empty list | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 8 |
| ✅ Passed | 0 |
| ❌ Failed | 1 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 7 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
