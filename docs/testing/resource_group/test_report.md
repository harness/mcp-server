# Test Report: Resource Group (`resource_group`)

| Field | Value |
|-------|-------|
| **Resource Type** | `resource_group` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-rg-001 | Basic list of resource groups | `harness_list(resource_type="resource_group")` | Returns paginated list of resource groups | ✅ Passed | Returns 2 resource groups with deep links |  |
| TC-rg-002 | Pagination - page 0, size 5 | `harness_list(resource_type="resource_group", page=0, size=5)` | Returns first 5 resource groups | ⬜ Pending | | |
| TC-rg-003 | Pagination - page 1 | `harness_list(resource_type="resource_group", page=1, size=5)` | Returns second page of resource groups | ⬜ Pending | | |
| TC-rg-004 | Filter by search_term | `harness_list(resource_type="resource_group", search_term="all")` | Returns resource groups matching "all" | ⬜ Pending | | |
| TC-rg-005 | Get resource group by ID | `harness_get(resource_type="resource_group", resource_group_id="<valid_id>")` | Returns full resource group details | ⬜ Pending | | |
| TC-rg-006 | Get built-in resource group | `harness_get(resource_type="resource_group", resource_group_id="_all_resources")` | Returns built-in All Resources group | ⬜ Pending | | |
| TC-rg-007 | Create resource group | `harness_create(resource_type="resource_group", body={identifier: "test_rg", name: "Test Resource Group"})` | Resource group created | ⬜ Pending | | |
| TC-rg-008 | Create with description and scopes | `harness_create(resource_type="resource_group", body={identifier: "test_rg_full", name: "Full Test RG", description: "Test resource group", includedScopes: [], resourceFilter: []})` | Resource group created with all fields | ⬜ Pending | | |
| TC-rg-009 | Delete resource group | `harness_delete(resource_type="resource_group", resource_group_id="test_rg")` | Resource group deleted | ⬜ Pending | | |
| TC-rg-010 | Custom org and project | `harness_list(resource_type="resource_group", org_id="custom_org", project_id="custom_project")` | Returns resource groups for specified scope | ⬜ Pending | | |
| TC-rg-011 | Get nonexistent resource group | `harness_get(resource_type="resource_group", resource_group_id="nonexistent")` | Returns not found error | ⬜ Pending | | |
| TC-rg-012 | Create without identifier | `harness_create(resource_type="resource_group", body={name: "No ID"})` | Returns validation error | ⬜ Pending | | |
| TC-rg-013 | Delete built-in group | `harness_delete(resource_type="resource_group", resource_group_id="_all_resources")` | Returns error — cannot delete managed groups | ⬜ Pending | | |
| TC-rg-014 | Search with no matches | `harness_list(resource_type="resource_group", search_term="zzz_nonexistent_zzz")` | Returns empty list | ⬜ Pending | | |
| TC-rg-015 | Resource metadata | `harness_describe(resource_type="resource_group")` | Returns full metadata including create body schema | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 15 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 14 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
