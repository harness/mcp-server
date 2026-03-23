# Test Plan: Organization (`organization`)

| Field | Value |
|-------|-------|
| **Resource Type** | `organization` |
| **Display Name** | Organization |
| **Toolset** | platform |
| **Scope** | account |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | None |
| **Identifier Fields** | org_id |
| **Filter Fields** | search_term, sort, order |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-org-001 | List | List all organizations with defaults | `harness_list(resource_type="organization")` | Returns paginated list of organizations |
| TC-org-002 | List | List organizations with pagination | `harness_list(resource_type="organization", page=1, size=5)` | Returns page 1 with up to 5 organizations |
| TC-org-003 | List | List organizations filtered by search_term | `harness_list(resource_type="organization", filters={search_term: "default"})` | Returns organizations matching "default" keyword |
| TC-org-004 | List | List organizations sorted by name ascending | `harness_list(resource_type="organization", filters={sort: "name", order: "asc"})` | Returns organizations sorted A-Z by name |
| TC-org-005 | List | List organizations sorted descending | `harness_list(resource_type="organization", filters={sort: "name", order: "desc"})` | Returns organizations sorted Z-A by name |
| TC-org-006 | List | List organizations with combined filters | `harness_list(resource_type="organization", filters={search_term: "dev", sort: "name", order: "asc"}, page=0, size=10)` | Returns filtered and sorted organizations |
| TC-org-007 | Get | Get organization by identifier | `harness_get(resource_type="organization", resource_id="default")` | Returns full organization details |
| TC-org-008 | Get | Get organization with explicit org_id | `harness_get(resource_type="organization", resource_id="my_org")` | Returns organization details for my_org |
| TC-org-009 | Create | Create organization with required fields | `harness_create(resource_type="organization", body={identifier: "new_org", name: "New Organization"})` | Organization created successfully |
| TC-org-010 | Create | Create organization with all fields | `harness_create(resource_type="organization", body={identifier: "full_org", name: "Full Organization", description: "A test org", tags: {env: "test", team: "platform"}})` | Organization created with all metadata |
| TC-org-011 | Create | Create organization with pre-wrapped body | `harness_create(resource_type="organization", body={org: {identifier: "wrapped_org", name: "Wrapped Org"}})` | Organization created from pre-wrapped body |
| TC-org-012 | Create | Create organization with missing required fields | `harness_create(resource_type="organization", body={identifier: "no_name"})` | Error: name is required |
| TC-org-013 | Create | Create organization with duplicate identifier | `harness_create(resource_type="organization", body={identifier: "default", name: "Duplicate"})` | Error: Organization already exists (409) |
| TC-org-014 | Update | Update organization name | `harness_update(resource_type="organization", resource_id="my_org", body={name: "Updated Org Name"})` | Organization name updated (identifier auto-injected) |
| TC-org-015 | Update | Update organization with all fields | `harness_update(resource_type="organization", resource_id="my_org", body={name: "Updated Org", description: "Updated desc", tags: {updated: "true"}})` | Organization fully updated |
| TC-org-016 | Update | Update organization with pre-wrapped body | `harness_update(resource_type="organization", resource_id="my_org", body={org: {name: "Wrapped Update"}})` | Organization updated from pre-wrapped body |
| TC-org-017 | Delete | Delete organization by identifier | `harness_delete(resource_type="organization", resource_id="test_org")` | Organization deleted successfully |
| TC-org-018 | Error | Get organization with invalid identifier | `harness_get(resource_type="organization", resource_id="nonexistent_org")` | Error: Organization not found (404) |
| TC-org-019 | Error | Delete organization that has projects | `harness_delete(resource_type="organization", resource_id="org_with_projects")` | Error: Cannot delete org with existing projects (400/409) |
| TC-org-020 | Edge | List organizations with empty results | `harness_list(resource_type="organization", filters={search_term: "zzz_nonexistent_zzz"})` | Returns empty items array with total=0 |
| TC-org-021 | Edge | List organizations with max pagination | `harness_list(resource_type="organization", page=0, size=100)` | Returns up to 100 organizations |
| TC-org-022 | Edge | Create organization with special characters in identifier | `harness_create(resource_type="organization", body={identifier: "org-with-dashes_underscores", name: "Special Chars Org"})` | Organization created with valid special chars |

## Notes
- Organizations are account-scoped — no org_id or project_id in query params
- Uses v1 API: `/v1/orgs` and `/v1/orgs/{org}`
- Body is auto-wrapped in `{ org: { ... } }` if not already wrapped
- Update auto-injects `identifier` from `org_id` if missing in body
- Pagination uses `limit` param (v1 style) instead of `size`
