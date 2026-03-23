# Test Plan: Resource Group (`resource_group`)

| Field | Value |
|-------|-------|
| **Resource Type** | `resource_group` |
| **Display Name** | Resource Group |
| **Toolset** | access_control |
| **Scope** | project |
| **Operations** | list, get, create, delete |
| **Execute Actions** | None |
| **Identifier Fields** | resource_group_id |
| **Filter Fields** | search_term |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-rg-001 | List | Basic list of resource groups | `harness_list(resource_type="resource_group")` | Returns paginated list of resource groups |
| TC-rg-002 | List | Pagination - page 0, size 5 | `harness_list(resource_type="resource_group", page=0, size=5)` | Returns first 5 resource groups |
| TC-rg-003 | List | Pagination - page 1 | `harness_list(resource_type="resource_group", page=1, size=5)` | Returns second page of resource groups |
| TC-rg-004 | List | Filter by search_term | `harness_list(resource_type="resource_group", search_term="all")` | Returns resource groups matching "all" |
| TC-rg-005 | Get | Get resource group by ID | `harness_get(resource_type="resource_group", resource_group_id="<valid_id>")` | Returns full resource group details |
| TC-rg-006 | Get | Get built-in resource group | `harness_get(resource_type="resource_group", resource_group_id="_all_resources")` | Returns built-in All Resources group |
| TC-rg-007 | Create | Create resource group | `harness_create(resource_type="resource_group", body={identifier: "test_rg", name: "Test Resource Group"})` | Resource group created |
| TC-rg-008 | Create | Create with description and scopes | `harness_create(resource_type="resource_group", body={identifier: "test_rg_full", name: "Full Test RG", description: "Test resource group", includedScopes: [], resourceFilter: []})` | Resource group created with all fields |
| TC-rg-009 | Delete | Delete resource group | `harness_delete(resource_type="resource_group", resource_group_id="test_rg")` | Resource group deleted |
| TC-rg-010 | Scope | Custom org and project | `harness_list(resource_type="resource_group", org_id="custom_org", project_id="custom_project")` | Returns resource groups for specified scope |
| TC-rg-011 | Error | Get nonexistent resource group | `harness_get(resource_type="resource_group", resource_group_id="nonexistent")` | Returns not found error |
| TC-rg-012 | Error | Create without identifier | `harness_create(resource_type="resource_group", body={name: "No ID"})` | Returns validation error |
| TC-rg-013 | Error | Delete built-in group | `harness_delete(resource_type="resource_group", resource_group_id="_all_resources")` | Returns error — cannot delete managed groups |
| TC-rg-014 | Edge | Search with no matches | `harness_list(resource_type="resource_group", search_term="zzz_nonexistent_zzz")` | Returns empty list |
| TC-rg-015 | Describe | Resource metadata | `harness_describe(resource_type="resource_group")` | Returns full metadata including create body schema |

## Notes
- List endpoint: GET `/resourcegroup/api/v2/resourcegroup` with searchTerm query param
- Get endpoint: GET `/resourcegroup/api/v2/resourcegroup/{resourceGroupIdentifier}`
- Create body: identifier (required), name (required), description (optional), includedScopes (optional array of scope objects), resourceFilter (optional array of filter objects)
- Delete endpoint: DELETE `/resourcegroup/api/v2/resourcegroup/{resourceGroupIdentifier}`
- Built-in resource groups like `_all_resources` cannot be deleted
- Deep link: `/ng/account/{accountId}/settings/access-control/resource-groups/{resourceGroupIdentifier}`
