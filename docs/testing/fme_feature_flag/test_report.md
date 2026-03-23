# Test Report: FME Feature Flag (`fme_feature_flag`)

| Field | Value |
|-------|-------|
| **Resource Type** | `fme_feature_flag` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-fme_feature_flag-001 | List flags for a workspace | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace")` | Returns paginated list of feature flags | ❌ Failed | Depends on fme_workspace which returns 401; FME module not configured |  |
| TC-fme_feature_flag-002 | List with custom size | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", size=10)` | Returns up to 10 flags | ⬜ Pending | | |
| TC-fme_feature_flag-003 | List with offset pagination | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", offset=20)` | Returns flags starting at offset 20 | ⬜ Pending | | |
| TC-fme_feature_flag-004 | List with offset and size combined | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", offset=10, size=5)` | Returns 5 flags starting at offset 10 | ⬜ Pending | | |
| TC-fme_feature_flag-005 | List with max size (50) | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", size=50)` | Returns up to 50 flags | ⬜ Pending | | |
| TC-fme_feature_flag-006 | Get flag by workspace and name | `harness_get(resource_type="fme_feature_flag", workspace_id="my_workspace", feature_flag_name="my_flag")` | Returns flag metadata | ⬜ Pending | | |
| TC-fme_feature_flag-007 | Verify get response structure | `harness_get(resource_type="fme_feature_flag", workspace_id="my_workspace", feature_flag_name="my_flag")` | Response contains flag details without environment info | ⬜ Pending | | |
| TC-fme_feature_flag-008 | List without workspace_id | `harness_list(resource_type="fme_feature_flag")` | Error: workspace_id is required | ⬜ Pending | | |
| TC-fme_feature_flag-009 | Get without workspace_id | `harness_get(resource_type="fme_feature_flag", feature_flag_name="my_flag")` | Error: workspace_id is required | ⬜ Pending | | |
| TC-fme_feature_flag-010 | Get without feature_flag_name | `harness_get(resource_type="fme_feature_flag", workspace_id="my_workspace")` | Error: feature_flag_name is required | ⬜ Pending | | |
| TC-fme_feature_flag-011 | Get non-existent flag | `harness_get(resource_type="fme_feature_flag", workspace_id="my_workspace", feature_flag_name="nonexistent")` | Error: flag not found (404) | ⬜ Pending | | |
| TC-fme_feature_flag-012 | List with offset beyond data | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", offset=999999)` | Returns empty list | ⬜ Pending | | |
| TC-fme_feature_flag-013 | List with size=1 | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", size=1)` | Returns exactly 1 flag | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 13 |
| ✅ Passed | 0 |
| ❌ Failed | 1 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 12 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
