# Test Plan: Role Assignment (`role_assignment`)

| Field | Value |
|-------|-------|
| **Resource Type** | `role_assignment` |
| **Display Name** | Role Assignment |
| **Toolset** | access_control |
| **Scope** | project |
| **Operations** | list, create, delete |
| **Execute Actions** | None |
| **Identifier Fields** | role_assignment_id |
| **Filter Fields** | principal_type, role_identifier, resource_group_identifier |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-ra-001 | List | Basic list of role assignments | `harness_list(resource_type="role_assignment")` | Returns paginated list of role assignments |
| TC-ra-002 | List | Pagination - page 0, size 5 | `harness_list(resource_type="role_assignment", page=0, size=5)` | Returns first 5 role assignments |
| TC-ra-003 | List | Pagination - page 1 | `harness_list(resource_type="role_assignment", page=1, size=5)` | Returns second page of role assignments |
| TC-ra-004 | List | Filter by principal_type (USER) | `harness_list(resource_type="role_assignment", principal_type="USER")` | Returns only user-based role assignments |
| TC-ra-005 | List | Filter by principal_type (USER_GROUP) | `harness_list(resource_type="role_assignment", principal_type="USER_GROUP")` | Returns only group-based role assignments |
| TC-ra-006 | List | Filter by principal_type (SERVICE_ACCOUNT) | `harness_list(resource_type="role_assignment", principal_type="SERVICE_ACCOUNT")` | Returns only service-account role assignments |
| TC-ra-007 | List | Filter by role_identifier | `harness_list(resource_type="role_assignment", role_identifier="_account_admin")` | Returns assignments for specified role |
| TC-ra-008 | List | Filter by resource_group_identifier | `harness_list(resource_type="role_assignment", resource_group_identifier="_all_resources")` | Returns assignments for specified resource group |
| TC-ra-009 | List | Combined filters | `harness_list(resource_type="role_assignment", principal_type="USER", role_identifier="_account_admin")` | Returns user assignments for admin role |
| TC-ra-010 | Create | Create role assignment for user | `harness_create(resource_type="role_assignment", body={resourceGroupIdentifier: "_all_resources", roleIdentifier: "_account_viewer", principal: {identifier: "<user_id>", type: "USER"}})` | Role assignment created |
| TC-ra-011 | Create | Create role assignment for group | `harness_create(resource_type="role_assignment", body={resourceGroupIdentifier: "_all_resources", roleIdentifier: "_account_viewer", principal: {identifier: "<group_id>", type: "USER_GROUP"}})` | Role assignment created for group |
| TC-ra-012 | Create | Create disabled assignment | `harness_create(resource_type="role_assignment", body={resourceGroupIdentifier: "_all_resources", roleIdentifier: "_account_viewer", principal: {identifier: "<user_id>", type: "USER"}, disabled: true})` | Disabled role assignment created |
| TC-ra-013 | Delete | Delete role assignment | `harness_delete(resource_type="role_assignment", role_assignment_id="<valid_id>")` | Role assignment deleted |
| TC-ra-014 | Scope | Custom org and project | `harness_list(resource_type="role_assignment", org_id="custom_org", project_id="custom_project")` | Returns role assignments for specified scope |
| TC-ra-015 | Error | Create without principal | `harness_create(resource_type="role_assignment", body={resourceGroupIdentifier: "_all_resources", roleIdentifier: "_account_viewer"})` | Returns validation error (principal required) |
| TC-ra-016 | Error | Create with invalid principal type | `harness_create(resource_type="role_assignment", body={..., principal: {identifier: "x", type: "INVALID"}})` | Returns error |
| TC-ra-017 | Error | Delete nonexistent assignment | `harness_delete(resource_type="role_assignment", role_assignment_id="nonexistent")` | Returns not found error |
| TC-ra-018 | Describe | Resource metadata | `harness_describe(resource_type="role_assignment")` | Returns full metadata including create body schema with principal structure |

## Notes
- List endpoint is POST-based at `/authz/api/roleassignments/filter` with filter body
- principal_type enum: USER, USER_GROUP, SERVICE_ACCOUNT
- Create body: resourceGroupIdentifier (required), roleIdentifier (required), principal (required object with identifier + type), disabled (optional boolean)
- Delete endpoint: DELETE `/authz/api/roleassignments/{roleAssignmentIdentifier}`
- No get operation — use list with filters to find specific assignments
- No deep link template defined
