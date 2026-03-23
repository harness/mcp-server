# Test Report: Role Assignment (`role_assignment`)

| Field | Value |
|-------|-------|
| **Resource Type** | `role_assignment` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-ra-001 | Basic list of role assignments | `harness_list(resource_type="role_assignment")` | Returns paginated list of role assignments | ✅ Passed | Returns 8 role assignments with timestamps |  |
| TC-ra-002 | Pagination - page 0, size 5 | `harness_list(resource_type="role_assignment", page=0, size=5)` | Returns first 5 role assignments | ⬜ Pending | | |
| TC-ra-003 | Pagination - page 1 | `harness_list(resource_type="role_assignment", page=1, size=5)` | Returns second page of role assignments | ⬜ Pending | | |
| TC-ra-004 | Filter by principal_type (USER) | `harness_list(resource_type="role_assignment", principal_type="USER")` | Returns only user-based role assignments | ⬜ Pending | | |
| TC-ra-005 | Filter by principal_type (USER_GROUP) | `harness_list(resource_type="role_assignment", principal_type="USER_GROUP")` | Returns only group-based role assignments | ⬜ Pending | | |
| TC-ra-006 | Filter by principal_type (SERVICE_ACCOUNT) | `harness_list(resource_type="role_assignment", principal_type="SERVICE_ACCOUNT")` | Returns only service-account role assignments | ⬜ Pending | | |
| TC-ra-007 | Filter by role_identifier | `harness_list(resource_type="role_assignment", role_identifier="_account_admin")` | Returns assignments for specified role | ⬜ Pending | | |
| TC-ra-008 | Filter by resource_group_identifier | `harness_list(resource_type="role_assignment", resource_group_identifier="_all_resources")` | Returns assignments for specified resource group | ⬜ Pending | | |
| TC-ra-009 | Combined filters | `harness_list(resource_type="role_assignment", principal_type="USER", role_identifier="_account_admin")` | Returns user assignments for admin role | ⬜ Pending | | |
| TC-ra-010 | Create role assignment for user | `harness_create(resource_type="role_assignment", body={resourceGroupIdentifier: "_all_resources", roleIdentifier: "_account_viewer", principal: {identifier: "<user_id>", type: "USER"}})` | Role assignment created | ⬜ Pending | | |
| TC-ra-011 | Create role assignment for group | `harness_create(resource_type="role_assignment", body={resourceGroupIdentifier: "_all_resources", roleIdentifier: "_account_viewer", principal: {identifier: "<group_id>", type: "USER_GROUP"}})` | Role assignment created for group | ⬜ Pending | | |
| TC-ra-012 | Create disabled assignment | `harness_create(resource_type="role_assignment", body={..., disabled: true})` | Disabled role assignment created | ⬜ Pending | | |
| TC-ra-013 | Delete role assignment | `harness_delete(resource_type="role_assignment", role_assignment_id="<valid_id>")` | Role assignment deleted | ⬜ Pending | | |
| TC-ra-014 | Custom org and project | `harness_list(resource_type="role_assignment", org_id="custom_org", project_id="custom_project")` | Returns role assignments for specified scope | ⬜ Pending | | |
| TC-ra-015 | Create without principal | `harness_create(resource_type="role_assignment", body={resourceGroupIdentifier: "_all_resources", roleIdentifier: "_account_viewer"})` | Returns validation error (principal required) | ⬜ Pending | | |
| TC-ra-016 | Create with invalid principal type | `harness_create(resource_type="role_assignment", body={..., principal: {identifier: "x", type: "INVALID"}})` | Returns error | ⬜ Pending | | |
| TC-ra-017 | Delete nonexistent assignment | `harness_delete(resource_type="role_assignment", role_assignment_id="nonexistent")` | Returns not found error | ⬜ Pending | | |
| TC-ra-018 | Resource metadata | `harness_describe(resource_type="role_assignment")` | Returns full metadata including create body schema with principal structure | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 18 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 17 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
