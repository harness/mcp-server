# Test Plan: User (`user`)

| Field | Value |
|-------|-------|
| **Resource Type** | `user` |
| **Display Name** | User |
| **Toolset** | access_control |
| **Scope** | account (supported: account, org, project; org/project only when passed explicitly) |
| **Operations** | list, get |
| **Execute Actions** | invite |
| **Identifier Fields** | user_id |
| **Filter Fields** | search_term, role_identifiers, resource_group_identifiers |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-usr-001 | List | Basic list of users | `harness_list(resource_type="user")` | Returns paginated list of users at account scope (config org/project are not applied) |
| TC-usr-002 | List | Pagination - page 0, size 5 | `harness_list(resource_type="user", page=0, size=5)` | Returns first 5 users |
| TC-usr-003 | List | Pagination - page 1 | `harness_list(resource_type="user", page=1, size=5)` | Returns second page of users |
| TC-usr-004 | List | Filter by search_term (name) | `harness_list(resource_type="user", search_term="John")` | Returns users matching name "John" |
| TC-usr-005 | List | Filter by search_term (email) | `harness_list(resource_type="user", search_term="john@example.com")` | Returns user matching email |
| TC-usr-006 | Get | Get user by UUID | `harness_get(resource_type="user", user_id="<uuid from list>")` | Returns full user details (not email as user_id) |
| TC-usr-007 | Execute | Invite single user | `harness_execute(resource_type="user", action="invite", body={emails: ["newuser@example.com"], role_bindings: [{roleIdentifier: "_account_viewer", resourceGroupIdentifier: "_all_resources", roleScopeLevel: "account", roleName: "Account Viewer", resourceGroupName: "All Resources", managedRole: "true"}]})` | User invited successfully |
| TC-usr-008 | Execute | Invite multiple users | `harness_execute(resource_type="user", action="invite", body={emails: ["user1@example.com", "user2@example.com"], user_groups: ["<group_id>"]})` | Multiple users invited |
| TC-usr-009 | Execute | Invite with user groups | `harness_execute(resource_type="user", action="invite", body={emails: ["newuser@example.com"], user_groups: ["<group_id>"]})` | User invited and added to groups |
| TC-usr-010 | Execute | Invite with comma-separated emails | `harness_execute(resource_type="user", action="invite", body={emails: "user1@example.com,user2@example.com", user_groups: ["<group_id>"]})` | Comma-separated string parsed and users invited |
| TC-usr-011 | Error | Get nonexistent user | `harness_get(resource_type="user", user_id="nonexistent")` | Returns not found error |
| TC-usr-012 | Error | Invite with empty emails | `harness_execute(resource_type="user", action="invite", body={emails: []})` | Returns validation error |
| TC-usr-013 | Error | Invite with invalid email format | `harness_execute(resource_type="user", action="invite", body={emails: ["not-an-email"]})` | Returns error from API |
| TC-usr-014 | Edge | Search with no matches | `harness_list(resource_type="user", search_term="zzz_nonexistent_user_zzz")` | Returns empty list |
| TC-usr-015 | Describe | Resource metadata | `harness_describe(resource_type="user")` | Returns metadata with operations (list, get), execute actions (invite), and body schema |

## Notes
- Default scope is account. Pass `org_id` / `project_id` for org or project membership. Config `HARNESS_ORG` / `HARNESS_PROJECT` are not applied unless those fields are passed.
- List with `search_term` to filter by email or name. Optional `role_identifiers` / `resource_group_identifiers` cannot be combined with `search_term`.
- Invite via `harness_execute` action=invite. Body: `emails` plus `user_groups` and/or `role_bindings`.
