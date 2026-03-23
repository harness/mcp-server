# Test Report: FME Feature Flag Definition (`fme_feature_flag_definition`)

| Field | Value |
|-------|-------|
| **Resource Type** | `fme_feature_flag_definition` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-fme_feature_flag_definition-001 | Get flag definition in environment | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="production")` | Returns detailed flag definition with treatments, rules, targeting, traffic allocation | ❌ Failed | Depends on fme_workspace which returns 401; FME module not configured |  |
| TC-fme_feature_flag_definition-002 | Get flag definition in staging env | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="staging")` | Returns flag definition for staging environment | ⬜ Pending | | |
| TC-fme_feature_flag_definition-003 | Verify response includes treatments | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="production")` | Response contains treatments array | ⬜ Pending | | |
| TC-fme_feature_flag_definition-004 | Verify response includes rules | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="production")` | Response contains rules and default rule | ⬜ Pending | | |
| TC-fme_feature_flag_definition-005 | Get without workspace_id | `harness_get(resource_type="fme_feature_flag_definition", feature_flag_name="my_flag", environment_id="production")` | Error: workspace_id is required | ⬜ Pending | | |
| TC-fme_feature_flag_definition-006 | Get without feature_flag_name | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", environment_id="production")` | Error: feature_flag_name is required | ⬜ Pending | | |
| TC-fme_feature_flag_definition-007 | Get without environment_id | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag")` | Error: environment_id is required | ⬜ Pending | | |
| TC-fme_feature_flag_definition-008 | Get non-existent flag | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="nonexistent", environment_id="production")` | Error: flag not found (404) | ⬜ Pending | | |
| TC-fme_feature_flag_definition-009 | Get with non-existent environment | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="nonexistent")` | Error: environment not found (404) | ⬜ Pending | | |
| TC-fme_feature_flag_definition-010 | Attempt list operation (unsupported) | `harness_list(resource_type="fme_feature_flag_definition")` | Error: list operation not supported | ⬜ Pending | | |
| TC-fme_feature_flag_definition-011 | Get with all three required identifiers | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="ws1", feature_flag_name="flag1", environment_id="env1")` | Returns definition or appropriate error | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 11 |
| ✅ Passed | 0 |
| ❌ Failed | 1 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 10 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
