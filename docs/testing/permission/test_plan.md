# Test Plan: Permission (`permission`)

| Field | Value |
|-------|-------|
| **Resource Type** | `permission` |
| **Display Name** | Permission |
| **Toolset** | access_control |
| **Scope** | account |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | _(none)_ |
| **Filter Fields** | _(none)_ |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-perm-001 | List | Basic list of all permissions | `harness_list(resource_type="permission")` | Returns list of all available platform permissions |
| TC-perm-002 | List | Verify permission structure | `harness_list(resource_type="permission")` | Each permission has identifier and name fields |
| TC-perm-003 | List | Pagination - page 0, size 5 | `harness_list(resource_type="permission", page=0, size=5)` | Returns first 5 permissions (if pagination supported) |
| TC-perm-004 | List | Large page size | `harness_list(resource_type="permission", size=100)` | Returns up to 100 permissions |
| TC-perm-005 | Scope | Default account scope | `harness_list(resource_type="permission")` | Correctly scoped to account level |
| TC-perm-006 | Error | Invalid account | `harness_list(resource_type="permission")` with invalid HARNESS_ACCOUNT_ID | Returns auth/not found error |
| TC-perm-007 | Edge | Permission count check | `harness_list(resource_type="permission")` | Returns non-empty list (Harness always has built-in permissions) |
| TC-perm-008 | Describe | Resource metadata | `harness_describe(resource_type="permission")` | Returns metadata showing list-only, account-scoped, no identifier fields |

## Notes
- Permission is a list-only, read-only resource
- Account-scoped — no org/project params needed
- Endpoint: GET `/authz/api/permissions`
- No identifier fields — permissions are a lookup/reference resource
- No filter fields — returns all available permissions
- No deep link template
- Useful for discovering valid permission identifiers when creating roles
