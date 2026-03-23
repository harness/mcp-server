# Test Plan: Delegate Token (`delegate_token`)

| Field | Value |
|-------|-------|
| **Resource Type** | `delegate_token` |
| **Display Name** | Delegate Token |
| **Toolset** | delegates |
| **Scope** | project |
| **Operations** | list, get, create, delete |
| **Execute Actions** | revoke, get_delegates |
| **Identifier Fields** | token_name |
| **Filter Fields** | name, status |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-dtok-001 | List | List all delegate tokens with defaults | `harness_list(resource_type="delegate_token")` | Returns list of delegate tokens |
| TC-dtok-002 | List | List delegate tokens filtered by name | `harness_list(resource_type="delegate_token", filters={name: "default_token"})` | Returns tokens matching the specified name |
| TC-dtok-003 | List | List delegate tokens filtered by ACTIVE status | `harness_list(resource_type="delegate_token", filters={status: "ACTIVE"})` | Returns only active delegate tokens |
| TC-dtok-004 | List | List delegate tokens filtered by REVOKED status | `harness_list(resource_type="delegate_token", filters={status: "REVOKED"})` | Returns only revoked delegate tokens |
| TC-dtok-005 | List | List delegate tokens with combined filters | `harness_list(resource_type="delegate_token", filters={name: "prod", status: "ACTIVE"})` | Returns active tokens matching name filter |
| TC-dtok-006 | List | List delegate tokens with scope override | `harness_list(resource_type="delegate_token", org_id="custom_org", project_id="custom_project")` | Returns tokens from specified org/project |
| TC-dtok-007 | Get | Get delegate token by name | `harness_get(resource_type="delegate_token", resource_id="my_token")` | Returns full delegate token details |
| TC-dtok-008 | Get | Get delegate token with scope override | `harness_get(resource_type="delegate_token", resource_id="my_token", org_id="other_org", project_id="other_project")` | Returns token from specified org/project |
| TC-dtok-009 | Create | Create a new delegate token | `harness_create(resource_type="delegate_token", body={name: "new_token"})` | Delegate token created successfully |
| TC-dtok-010 | Create | Create delegate token with scope override | `harness_create(resource_type="delegate_token", org_id="custom_org", project_id="custom_project", body={name: "scoped_token"})` | Token created in specified org/project |
| TC-dtok-011 | Create | Create delegate token with missing name | `harness_create(resource_type="delegate_token", body={})` | Error: name is required |
| TC-dtok-012 | Create | Create delegate token with duplicate name | `harness_create(resource_type="delegate_token", body={name: "existing_token"})` | Error: Token already exists (409) |
| TC-dtok-013 | Delete | Delete delegate token by name | `harness_delete(resource_type="delegate_token", resource_id="my_token")` | Delegate token deleted successfully |
| TC-dtok-014 | Delete | Delete delegate token with scope override | `harness_delete(resource_type="delegate_token", resource_id="my_token", org_id="other_org", project_id="other_project")` | Token deleted from specified org/project |
| TC-dtok-015 | Execute | Revoke a delegate token | `harness_execute(resource_type="delegate_token", action="revoke", token_name="my_token")` | Token status changed to REVOKED |
| TC-dtok-016 | Execute | Get delegates for a token | `harness_execute(resource_type="delegate_token", action="get_delegates", token_name="my_token")` | Returns list of delegates associated with the token |
| TC-dtok-017 | Execute | Revoke with scope override | `harness_execute(resource_type="delegate_token", action="revoke", token_name="my_token", org_id="custom_org", project_id="custom_project")` | Token revoked in specified org/project |
| TC-dtok-018 | Error | Get token with invalid name | `harness_get(resource_type="delegate_token", resource_id="nonexistent_token")` | Error: Token not found (404) |
| TC-dtok-019 | Error | Revoke nonexistent token | `harness_execute(resource_type="delegate_token", action="revoke", token_name="nonexistent")` | Error: Token not found (404) |
| TC-dtok-020 | Error | Delete token from unauthorized project | `harness_delete(resource_type="delegate_token", resource_id="my_token", org_id="no_access_org", project_id="no_access_project")` | Error: Unauthorized (401/403) |
| TC-dtok-021 | Edge | List delegate tokens with empty results | `harness_list(resource_type="delegate_token", filters={name: "zzz_nonexistent_zzz"})` | Returns empty results |
| TC-dtok-022 | Edge | Get delegates for token with no delegates | `harness_execute(resource_type="delegate_token", action="get_delegates", token_name="unused_token")` | Returns empty list of delegates |

## Notes
- Delegate tokens use `token_name` as the identifier field (not a standard ID)
- The `revoke` action uses PUT method to set token status to REVOKED
- The `get_delegates` action returns delegates associated with a specific token
- Token name is the primary key — used in path params for get/delete/revoke
- Create body requires only `name` field
- Status enum for filters: ACTIVE, REVOKED
