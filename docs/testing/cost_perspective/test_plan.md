# Test Plan: Cost Perspective (`cost_perspective`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_perspective` |
| **Display Name** | Cost Perspective |
| **Toolset** | ccm |
| **Scope** | account |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | None |
| **Identifier Fields** | perspective_id |
| **Filter Fields** | search, sort_type, sort_order, cloud_filter |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-cpv-001 | List | List perspectives with defaults | `harness_list(resource_type="cost_perspective")` | Returns paginated list of cost perspectives |
| TC-cpv-002 | List | List with pagination | `harness_list(resource_type="cost_perspective", page=0, size=5)` | Returns first 5 perspectives |
| TC-cpv-003 | List | List with search filter | `harness_list(resource_type="cost_perspective", search="production")` | Returns perspectives matching "production" name filter |
| TC-cpv-004 | List | List with sort_type=NAME | `harness_list(resource_type="cost_perspective", sort_type="NAME")` | Returns perspectives sorted by name |
| TC-cpv-005 | List | List with sort_type=COST | `harness_list(resource_type="cost_perspective", sort_type="COST", sort_order="DESCENDING")` | Returns perspectives sorted by cost descending |
| TC-cpv-006 | List | List with sort_type=LAST_EDIT | `harness_list(resource_type="cost_perspective", sort_type="LAST_EDIT")` | Returns perspectives sorted by last edit time |
| TC-cpv-007 | List | List with cloud_filter=AWS | `harness_list(resource_type="cost_perspective", cloud_filter="AWS")` | Returns only AWS perspectives |
| TC-cpv-008 | List | List with cloud_filter=GCP | `harness_list(resource_type="cost_perspective", cloud_filter="GCP")` | Returns only GCP perspectives |
| TC-cpv-009 | List | List with cloud_filter=AZURE | `harness_list(resource_type="cost_perspective", cloud_filter="AZURE")` | Returns only Azure perspectives |
| TC-cpv-010 | List | List with cloud_filter=CLUSTER | `harness_list(resource_type="cost_perspective", cloud_filter="CLUSTER")` | Returns only cluster perspectives |
| TC-cpv-011 | List | List with combined filters | `harness_list(resource_type="cost_perspective", search="prod", cloud_filter="AWS", sort_type="COST", sort_order="DESCENDING")` | Returns AWS perspectives matching "prod", sorted by cost desc |
| TC-cpv-012 | Get | Get perspective by ID | `harness_get(resource_type="cost_perspective", perspective_id="<valid_id>")` | Returns full perspective details |
| TC-cpv-013 | Get | Get perspective with invalid ID | `harness_get(resource_type="cost_perspective", perspective_id="nonexistent")` | Returns appropriate error |
| TC-cpv-014 | Create | Create perspective with name | `harness_create(resource_type="cost_perspective", body={name: "Test Perspective"})` | Creates perspective, returns details with uuid |
| TC-cpv-015 | Create | Create perspective with full config | `harness_create(resource_type="cost_perspective", body={name: "Full Perspective", viewVisualization: {...}, viewRules: [...], viewTimeRange: {...}})` | Creates perspective with all configuration |
| TC-cpv-016 | Update | Update perspective name | `harness_update(resource_type="cost_perspective", body={uuid: "<id>", name: "Updated Name"})` | Updates perspective name |
| TC-cpv-017 | Delete | Delete perspective by ID | `harness_delete(resource_type="cost_perspective", perspective_id="<valid_id>")` | Deletes perspective, returns success |
| TC-cpv-018 | Delete | Delete perspective with invalid ID | `harness_delete(resource_type="cost_perspective", perspective_id="nonexistent")` | Returns appropriate error |
| TC-cpv-019 | Error | Get missing perspective_id | `harness_get(resource_type="cost_perspective")` | Returns validation error for missing perspective_id |

## Notes
- Account-scoped resource — no org/project required
- List query params map: search→searchKey, sort_type→sortType, sort_order→sortOrder, cloud_filter→cloudFilters, page→pageNo, size→pageSize
- Valid sort_type values: NAME, LAST_EDIT, COST, CLUSTER_COST
- Valid sort_order values: ASCENDING, DESCENDING
- Valid cloud_filter values: AWS, GCP, AZURE, CLUSTER, DEFAULT
- Update requires `uuid` in body (from get response)
- This is the starting point for CCM — get a perspective_id first, then use cost_breakdown or cost_timeseries to drill into costs
