# Test Plan: Role (`role`)

| Field | Value |
|-------|-------|
| **Resource Type** | `role` |
| **Display Name** | Role |
| **Toolset** | access_control |
| **Scope** | project |
| **Operations** | list, get, create, delete |
| **Execute Actions** | None |
| **Identifier Fields** | role_id |
| **Filter Fields** | search_term |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-role-001 | List | Basic list of roles | `harness_list(resource_type="role")` | Returns paginated list of RBAC roles |
| TC-role-002 | List | Pagination - page 0, size 5 | `harness_list(resource_type="role", page=0, size=5)` | Returns first 5 roles |
| TC-role-003 | List | Pagination - page 1 | `harness_list(resource_type="role", page=1, size=5)` | Returns second page of roles |
| TC-role-004 | List | Filter by search_term | `harness_list(resource_type="role", search_term="admin")` | Returns roles matching "admin" |
| TC-role-005 | Get | Get role by ID | `harness_get(resource_type="role", role_id="<valid_role_id>")` | Returns full role details with permissions list |
| TC-role-006 | Get | Get built-in role | `harness_get(resource_type="role", role_id="_account_admin")` | Returns built-in Account Admin role details |
| TC-role-007 | Create | Create custom role | `harness_create(resource_type="role", body={identifier: "test_role", name: "Test Role", permissions: ["core_project_view", "core_pipeline_view"]})` | Role created with specified permissions |
| TC-role-008 | Create | Create with description and scope | `harness_create(resource_type="role", body={identifier: "test_role_full", name: "Full Test Role", permissions: ["core_project_view"], description: "Test role", allowed_scope_levels: ["project"]})` | Role created with all fields |
| TC-role-009 | Delete | Delete custom role | `harness_delete(resource_type="role", role_id="test_role")` | Role deleted |
| TC-role-010 | Scope | Custom org and project | `harness_list(resource_type="role", org_id="custom_org", project_id="custom_project")` | Returns roles for specified scope |
| TC-role-011 | Error | Get nonexistent role | `harness_get(resource_type="role", role_id="nonexistent")` | Returns not found error |
| TC-role-012 | Error | Create without permissions | `harness_create(resource_type="role", body={identifier: "bad_role", name: "Bad Role"})` | Returns validation error (permissions required) |
| TC-role-013 | Error | Create duplicate identifier | `harness_create(resource_type="role", body={identifier: "<existing_id>", name: "Dup", permissions: ["core_project_view"]})` | Returns conflict error |
| TC-role-014 | Error | Delete built-in role | `harness_delete(resource_type="role", role_id="_account_admin")` | Returns error — cannot delete managed roles |
| TC-role-015 | Edge | Search with no matches | `harness_list(resource_type="role", search_term="zzz_nonexistent_zzz")` | Returns empty list |
| TC-role-016 | Describe | Resource metadata | `harness_describe(resource_type="role")` | Returns full metadata including create body schema |

## Notes
- List endpoint: GET `/authz/api/roles` with searchTerm query param
- Get endpoint: GET `/authz/api/roles/{roleIdentifier}`
- Create body: identifier (required), name (required), permissions (required array), description (optional), allowed_scope_levels (optional array)
- Delete endpoint: DELETE `/authz/api/roles/{roleIdentifier}`
- Built-in/managed roles cannot be deleted (e.g., `_account_admin`, `_account_viewer`)
- Deep link: `/ng/account/{accountId}/settings/access-control/roles/{roleIdentifier}`
