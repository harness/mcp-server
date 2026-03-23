# Test Report: Organization (`organization`)

| Field | Value |
|-------|-------|
| **Resource Type** | `organization` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-org-001 | List all organizations with defaults | `harness_list(resource_type="organization")` | Returns paginated list of organizations | ✅ Passed | Returns 20 organizations with identifier, name, deep links |  |
| TC-org-002 | List organizations with pagination | `harness_list(resource_type="organization", page=1, size=5)` | Returns page 1 with up to 5 organizations | ⬜ Pending | | |
| TC-org-003 | List organizations filtered by search_term | `harness_list(resource_type="organization", filters={search_term: "default"})` | Returns organizations matching "default" keyword | ⬜ Pending | | |
| TC-org-004 | List organizations sorted by name ascending | `harness_list(resource_type="organization", filters={sort: "name", order: "asc"})` | Returns organizations sorted A-Z by name | ⬜ Pending | | |
| TC-org-005 | List organizations sorted descending | `harness_list(resource_type="organization", filters={sort: "name", order: "desc"})` | Returns organizations sorted Z-A by name | ⬜ Pending | | |
| TC-org-006 | List organizations with combined filters | `harness_list(resource_type="organization", filters={search_term: "dev", sort: "name", order: "asc"}, page=0, size=10)` | Returns filtered and sorted organizations | ⬜ Pending | | |
| TC-org-007 | Get organization by identifier | `harness_get(resource_type="organization", resource_id="default")` | Returns full organization details | ⬜ Pending | | |
| TC-org-008 | Get organization with explicit org_id | `harness_get(resource_type="organization", resource_id="my_org")` | Returns organization details for my_org | ⬜ Pending | | |
| TC-org-009 | Create organization with required fields | `harness_create(resource_type="organization", body={identifier: "new_org", name: "New Organization"})` | Organization created successfully | ⬜ Pending | | |
| TC-org-010 | Create organization with all fields | `harness_create(resource_type="organization", body={identifier: "full_org", name: "Full Organization", description: "A test org", tags: {env: "test", team: "platform"}})` | Organization created with all metadata | ⬜ Pending | | |
| TC-org-011 | Create organization with pre-wrapped body | `harness_create(resource_type="organization", body={org: {identifier: "wrapped_org", name: "Wrapped Org"}})` | Organization created from pre-wrapped body | ⬜ Pending | | |
| TC-org-012 | Create organization with missing required fields | `harness_create(resource_type="organization", body={identifier: "no_name"})` | Error: name is required | ⬜ Pending | | |
| TC-org-013 | Create organization with duplicate identifier | `harness_create(resource_type="organization", body={identifier: "default", name: "Duplicate"})` | Error: Organization already exists (409) | ⬜ Pending | | |
| TC-org-014 | Update organization name | `harness_update(resource_type="organization", resource_id="my_org", body={name: "Updated Org Name"})` | Organization name updated (identifier auto-injected) | ⬜ Pending | | |
| TC-org-015 | Update organization with all fields | `harness_update(resource_type="organization", resource_id="my_org", body={name: "Updated Org", description: "Updated desc", tags: {updated: "true"}})` | Organization fully updated | ⬜ Pending | | |
| TC-org-016 | Update organization with pre-wrapped body | `harness_update(resource_type="organization", resource_id="my_org", body={org: {name: "Wrapped Update"}})` | Organization updated from pre-wrapped body | ⬜ Pending | | |
| TC-org-017 | Delete organization by identifier | `harness_delete(resource_type="organization", resource_id="test_org")` | Organization deleted successfully | ⬜ Pending | | |
| TC-org-018 | Get organization with invalid identifier | `harness_get(resource_type="organization", resource_id="nonexistent_org")` | Error: Organization not found (404) | ⬜ Pending | | |
| TC-org-019 | Delete organization that has projects | `harness_delete(resource_type="organization", resource_id="org_with_projects")` | Error: Cannot delete org with existing projects (400/409) | ⬜ Pending | | |
| TC-org-020 | List organizations with empty results | `harness_list(resource_type="organization", filters={search_term: "zzz_nonexistent_zzz"})` | Returns empty items array with total=0 | ⬜ Pending | | |
| TC-org-021 | List organizations with max pagination | `harness_list(resource_type="organization", page=0, size=100)` | Returns up to 100 organizations | ⬜ Pending | | |
| TC-org-022 | Create organization with special characters in identifier | `harness_create(resource_type="organization", body={identifier: "org-with-dashes_underscores", name: "Special Chars Org"})` | Organization created with valid special chars | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 22 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 21 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

_(To be filled during testing)_
