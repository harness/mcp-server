# Test Plan: User Group (`user_group`)

| Field | Value |
|-------|-------|
| **Resource Type** | `user_group` |
| **Display Name** | User Group |
| **Toolset** | access_control |
| **Scope** | project |
| **Operations** | list, get, create, delete |
| **Execute Actions** | None |
| **Identifier Fields** | user_group_id |
| **Filter Fields** | search_term |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-ug-001 | List | Basic list of user groups | `harness_list(resource_type="user_group")` | Returns paginated list of user groups |
| TC-ug-002 | List | Pagination - page 0, size 5 | `harness_list(resource_type="user_group", page=0, size=5)` | Returns first 5 user groups |
| TC-ug-003 | List | Pagination - page 1 | `harness_list(resource_type="user_group", page=1, size=5)` | Returns second page of user groups |
| TC-ug-004 | List | Filter by search_term | `harness_list(resource_type="user_group", search_term="admin")` | Returns user groups matching "admin" |
| TC-ug-005 | Get | Get user group by ID | `harness_get(resource_type="user_group", user_group_id="<valid_group_id>")` | Returns full user group details |
| TC-ug-006 | Create | Create user group | `harness_create(resource_type="user_group", body={identifier: "test_group", name: "Test Group", description: "A test group"})` | User group created successfully |
| TC-ug-007 | Create | Create with users | `harness_create(resource_type="user_group", body={identifier: "test_group_users", name: "Test Group With Users", users: ["<user_id>"]})` | User group created with members |
| TC-ug-008 | Delete | Delete user group | `harness_delete(resource_type="user_group", user_group_id="test_group")` | User group deleted |
| TC-ug-009 | Scope | Custom org and project | `harness_list(resource_type="user_group", org_id="custom_org", project_id="custom_project")` | Returns user groups for specified scope |
| TC-ug-010 | Error | Get nonexistent group | `harness_get(resource_type="user_group", user_group_id="nonexistent")` | Returns not found error |
| TC-ug-011 | Error | Create without identifier | `harness_create(resource_type="user_group", body={name: "No ID Group"})` | Returns validation error |
| TC-ug-012 | Error | Create duplicate identifier | `harness_create(resource_type="user_group", body={identifier: "<existing_id>", name: "Duplicate"})` | Returns conflict error |
| TC-ug-013 | Error | Delete nonexistent group | `harness_delete(resource_type="user_group", user_group_id="nonexistent")` | Returns not found error |
| TC-ug-014 | Edge | Search with no matches | `harness_list(resource_type="user_group", search_term="zzz_nonexistent_zzz")` | Returns empty list |
| TC-ug-015 | Describe | Resource metadata | `harness_describe(resource_type="user_group")` | Returns full metadata including create body schema |

## Notes
- List endpoint: GET `/ng/api/user-groups` with searchTerm query param
- Get endpoint: GET `/ng/api/user-groups/{groupIdentifier}`
- Create body: identifier (required), name (required), description (optional), users (optional array of user IDs)
- Delete endpoint: DELETE `/ng/api/user-groups/{groupIdentifier}`
- Deep link: `/ng/account/{accountId}/settings/access-control/user-groups/{groupIdentifier}`
