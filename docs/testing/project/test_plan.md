# Test Plan: Project (`project`)

| Field | Value |
|-------|-------|
| **Resource Type** | `project` |
| **Display Name** | Project |
| **Toolset** | platform |
| **Scope** | account |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | None |
| **Identifier Fields** | project_id |
| **Filter Fields** | search_term, sort, order, has_module, module_type |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-proj-001 | List | List all projects with defaults | `harness_list(resource_type="project")` | Returns paginated list of projects |
| TC-proj-002 | List | List projects with pagination | `harness_list(resource_type="project", page=1, size=5)` | Returns page 1 with up to 5 projects |
| TC-proj-003 | List | List projects filtered by search_term | `harness_list(resource_type="project", filters={search_term: "test"})` | Returns projects matching "test" keyword |
| TC-proj-004 | List | List projects sorted by name ascending | `harness_list(resource_type="project", filters={sort: "name", order: "asc"})` | Returns projects sorted A-Z by name |
| TC-proj-005 | List | List projects sorted descending | `harness_list(resource_type="project", filters={sort: "name", order: "desc"})` | Returns projects sorted Z-A by name |
| TC-proj-006 | List | List projects filtered by has_module | `harness_list(resource_type="project", filters={has_module: true})` | Returns only projects with at least one module enabled |
| TC-proj-007 | List | List projects filtered by module_type | `harness_list(resource_type="project", filters={module_type: "CD"})` | Returns projects with CD module enabled |
| TC-proj-008 | List | List projects with combined filters | `harness_list(resource_type="project", filters={search_term: "prod", sort: "name", order: "asc", module_type: "CI"}, page=0, size=10)` | Returns filtered, sorted CI projects |
| TC-proj-009 | List | List projects with org_id override | `harness_list(resource_type="project", org_id="custom_org")` | Returns projects from specified organization |
| TC-proj-010 | Get | Get project by identifier | `harness_get(resource_type="project", resource_id="my_project")` | Returns full project details |
| TC-proj-011 | Get | Get project with org_id override | `harness_get(resource_type="project", resource_id="my_project", org_id="other_org")` | Returns project from specified org |
| TC-proj-012 | Create | Create project with required fields | `harness_create(resource_type="project", org_id="default", body={identifier: "new_project", name: "New Project"})` | Project created successfully |
| TC-proj-013 | Create | Create project with all fields | `harness_create(resource_type="project", org_id="default", body={identifier: "full_project", name: "Full Project", description: "A test project", color: "#0063F7", modules: ["CD", "CI", "CF"], tags: {env: "test"}})` | Project created with all metadata |
| TC-proj-014 | Create | Create project with pre-wrapped body | `harness_create(resource_type="project", org_id="default", body={project: {identifier: "wrapped_proj", name: "Wrapped Project"}})` | Project created from pre-wrapped body |
| TC-proj-015 | Create | Create project with missing required fields | `harness_create(resource_type="project", org_id="default", body={identifier: "no_name"})` | Error: name is required |
| TC-proj-016 | Create | Create project with duplicate identifier | `harness_create(resource_type="project", org_id="default", body={identifier: "existing_project", name: "Duplicate"})` | Error: Project already exists (409) |
| TC-proj-017 | Update | Update project name | `harness_update(resource_type="project", resource_id="my_project", org_id="default", body={name: "Updated Project Name"})` | Project name updated (identifier auto-injected) |
| TC-proj-018 | Update | Update project with all fields | `harness_update(resource_type="project", resource_id="my_project", org_id="default", body={name: "Updated Project", description: "Updated desc", color: "#FF5630", modules: ["CD", "CI"], tags: {updated: "true"}})` | Project fully updated |
| TC-proj-019 | Update | Update project modules | `harness_update(resource_type="project", resource_id="my_project", org_id="default", body={name: "My Project", modules: ["CD", "CI", "STO", "IDP"]})` | Project modules updated |
| TC-proj-020 | Delete | Delete project by identifier | `harness_delete(resource_type="project", resource_id="test_project", org_id="default")` | Project deleted successfully |
| TC-proj-021 | Delete | Delete project with explicit scope | `harness_delete(resource_type="project", resource_id="test_project", org_id="custom_org")` | Project deleted from specified org |
| TC-proj-022 | Error | Get project with invalid identifier | `harness_get(resource_type="project", resource_id="nonexistent_project")` | Error: Project not found (404) |
| TC-proj-023 | Error | Create project in nonexistent org | `harness_create(resource_type="project", org_id="nonexistent_org", body={identifier: "test", name: "Test"})` | Error: Organization not found (404) |
| TC-proj-024 | Error | Delete project that has resources | `harness_delete(resource_type="project", resource_id="project_with_pipelines", org_id="default")` | Error: Cannot delete project with existing resources (400/409) |
| TC-proj-025 | Edge | List projects with empty results | `harness_list(resource_type="project", filters={search_term: "zzz_nonexistent_zzz"})` | Returns empty items array with total=0 |
| TC-proj-026 | Edge | List projects with max pagination | `harness_list(resource_type="project", page=0, size=100)` | Returns up to 100 projects |
| TC-proj-027 | Edge | Create project with special characters in identifier | `harness_create(resource_type="project", org_id="default", body={identifier: "proj-with-dashes_and_underscores", name: "Special Chars Project"})` | Project created with valid special chars |

## Notes
- Projects are scoped within an organization — `org_id` is a path parameter for most operations
- Uses v1 API: `/v1/orgs/{org}/projects` and `/v1/orgs/{org}/projects/{project}`
- Body is auto-wrapped in `{ project: { ... } }` if not already wrapped
- Update auto-injects `identifier` from `project_id` if missing in body
- Pagination uses `limit` param (v1 style) instead of `size`
- Supported modules: CD, CI, CF, CE, CV, STO, CHAOS, SRM, IACM, CET, CODE, IDP, SSCA, SEI
