# Test Report: Cost Category (`cost_category`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_category` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-cc-001 | List cost categories with defaults | `harness_list(resource_type="cost_category")` | Returns list of cost categories (business mappings) | ✅ Passed | Returns 9 cost categories with cost targets, shared costs, data sources |  |
| TC-cc-002 | List with search filter | `harness_list(resource_type="cost_category", search="engineering")` | Returns categories matching "engineering" name | ⬜ Pending | | |
| TC-cc-003 | List with sort_type=NAME | `harness_list(resource_type="cost_category", sort_type="NAME")` | Returns categories sorted by name | ⬜ Pending | | |
| TC-cc-004 | List with sort_type=LAST_EDIT | `harness_list(resource_type="cost_category", sort_type="LAST_EDIT")` | Returns categories sorted by last edit time | ⬜ Pending | | |
| TC-cc-005 | List with sort_order=ASC | `harness_list(resource_type="cost_category", sort_type="NAME", sort_order="ASC")` | Returns categories in ascending order | ⬜ Pending | | |
| TC-cc-006 | List with sort_order=DESC | `harness_list(resource_type="cost_category", sort_type="NAME", sort_order="DESC")` | Returns categories in descending order | ⬜ Pending | | |
| TC-cc-007 | List with pagination | `harness_list(resource_type="cost_category", page=0, size=5)` | Returns first 5 categories | ⬜ Pending | | |
| TC-cc-008 | List with combined filters | `harness_list(resource_type="cost_category", search="prod", sort_type="LAST_EDIT", sort_order="DESC")` | Returns filtered and sorted categories | ⬜ Pending | | |
| TC-cc-009 | Get category by ID | `harness_get(resource_type="cost_category", category_id="<valid_id>")` | Returns cost category details | ⬜ Pending | | |
| TC-cc-010 | Get category with invalid ID | `harness_get(resource_type="cost_category", category_id="nonexistent")` | Returns appropriate error | ⬜ Pending | | |
| TC-cc-011 | Get category missing ID | `harness_get(resource_type="cost_category")` | Returns validation error for missing category_id | ⬜ Pending | | |
| TC-cc-012 | List when no categories exist | `harness_list(resource_type="cost_category")` | Returns empty list | ⬜ Pending | | |
| TC-cc-013 | Attempt create (not supported) | `harness_create(resource_type="cost_category", body={...})` | Returns error indicating create is not supported | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 13 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 12 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
