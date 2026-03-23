# Test Plan: Cost Category (`cost_category`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_category` |
| **Display Name** | Cost Category |
| **Toolset** | ccm |
| **Scope** | account |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | category_id |
| **Filter Fields** | search, sort_type, sort_order |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-cc-001 | List | List cost categories with defaults | `harness_list(resource_type="cost_category")` | Returns list of cost categories (business mappings) |
| TC-cc-002 | List | List with search filter | `harness_list(resource_type="cost_category", search="engineering")` | Returns categories matching "engineering" name |
| TC-cc-003 | List | List with sort_type=NAME | `harness_list(resource_type="cost_category", sort_type="NAME")` | Returns categories sorted by name |
| TC-cc-004 | List | List with sort_type=LAST_EDIT | `harness_list(resource_type="cost_category", sort_type="LAST_EDIT")` | Returns categories sorted by last edit time |
| TC-cc-005 | List | List with sort_order=ASC | `harness_list(resource_type="cost_category", sort_type="NAME", sort_order="ASC")` | Returns categories in ascending order |
| TC-cc-006 | List | List with sort_order=DESC | `harness_list(resource_type="cost_category", sort_type="NAME", sort_order="DESC")` | Returns categories in descending order |
| TC-cc-007 | List | List with pagination | `harness_list(resource_type="cost_category", page=0, size=5)` | Returns first 5 categories |
| TC-cc-008 | List | List with combined filters | `harness_list(resource_type="cost_category", search="prod", sort_type="LAST_EDIT", sort_order="DESC")` | Returns filtered and sorted categories |
| TC-cc-009 | Get | Get category by ID | `harness_get(resource_type="cost_category", category_id="<valid_id>")` | Returns cost category details |
| TC-cc-010 | Get | Get category with invalid ID | `harness_get(resource_type="cost_category", category_id="nonexistent")` | Returns appropriate error |
| TC-cc-011 | Get | Get category missing ID | `harness_get(resource_type="cost_category")` | Returns validation error for missing category_id |
| TC-cc-012 | Edge | List when no categories exist | `harness_list(resource_type="cost_category")` | Returns empty list |
| TC-cc-013 | Error | Attempt create (not supported) | `harness_create(resource_type="cost_category", body={...})` | Returns error indicating create is not supported |

## Notes
- REST endpoints: GET `/ccm/api/business-mapping` (list), GET `/ccm/api/business-mapping/{costCategoryId}` (get)
- Query params: search→searchKey, sort_type→sortType, sort_order→sortOrder, page→pageNo, size→pageSize
- Valid sort_type values: NAME, LAST_EDIT
- Valid sort_order values: ASC, DESC
- Cost categories (business mappings) organize cloud costs into business units
