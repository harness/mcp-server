# Test Report: Project (`project`)

| Field | Value |
|-------|-------|
| **Resource Type** | `project` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-proj-001 | List all projects with defaults | `harness_list(resource_type="project")` | Returns paginated list of projects | ✅ Passed | Returns 6 projects in AI_Devops org with identifier, name, deep links |  |
| TC-proj-002 | List projects with pagination | `harness_list(resource_type="project", page=1, size=5)` | Returns page 1 with up to 5 projects | ⬜ Pending | | |
| TC-proj-003 | List projects filtered by search_term | `harness_list(resource_type="project", filters={search_term: "test"})` | Returns projects matching "test" keyword | ⬜ Pending | | |
| TC-proj-004 | List projects sorted by name ascending | `harness_list(resource_type="project", filters={sort: "name", order: "asc"})` | Returns projects sorted A-Z by name | ⬜ Pending | | |
| TC-proj-005 | List projects sorted descending | `harness_list(resource_type="project", filters={sort: "name", order: "desc"})` | Returns projects sorted Z-A by name | ⬜ Pending | | |
| TC-proj-006 | List projects filtered by has_module | `harness_list(resource_type="project", filters={has_module: true})` | Returns only projects with at least one module enabled | ⬜ Pending | | |
| TC-proj-007 | List projects filtered by module_type | `harness_list(resource_type="project", filters={module_type: "CD"})` | Returns projects with CD module enabled | ⬜ Pending | | |
| TC-proj-008 | List projects with combined filters | `harness_list(resource_type="project", filters={search_term: "prod", sort: "name", order: "asc", module_type: "CI"}, page=0, size=10)` | Returns filtered, sorted CI projects | ⬜ Pending | | |
| TC-proj-009 | List projects with org_id override | `harness_list(resource_type="project", org_id="custom_org")` | Returns projects from specified organization | ⬜ Pending | | |
| TC-proj-010 | Get project by identifier | `harness_get(resource_type="project", resource_id="my_project")` | Returns full project details | ⬜ Pending | | |
| TC-proj-011 | Get project with org_id override | `harness_get(resource_type="project", resource_id="my_project", org_id="other_org")` | Returns project from specified org | ⬜ Pending | | |
| TC-proj-012 | Create project with required fields | `harness_create(resource_type="project", org_id="default", body={identifier: "new_project", name: "New Project"})` | Project created successfully | ⬜ Pending | | |
| TC-proj-013 | Create project with all fields | `harness_create(resource_type="project", org_id="default", body={identifier: "full_project", name: "Full Project", description: "A test project", color: "#0063F7", modules: ["CD", "CI", "CF"], tags: {env: "test"}})` | Project created with all metadata | ⬜ Pending | | |
| TC-proj-014 | Create project with pre-wrapped body | `harness_create(resource_type="project", org_id="default", body={project: {identifier: "wrapped_proj", name: "Wrapped Project"}})` | Project created from pre-wrapped body | ⬜ Pending | | |
| TC-proj-015 | Create project with missing required fields | `harness_create(resource_type="project", org_id="default", body={identifier: "no_name"})` | Error: name is required | ⬜ Pending | | |
| TC-proj-016 | Create project with duplicate identifier | `harness_create(resource_type="project", org_id="default", body={identifier: "existing_project", name: "Duplicate"})` | Error: Project already exists (409) | ⬜ Pending | | |
| TC-proj-017 | Update project name | `harness_update(resource_type="project", resource_id="my_project", org_id="default", body={name: "Updated Project Name"})` | Project name updated (identifier auto-injected) | ⬜ Pending | | |
| TC-proj-018 | Update project with all fields | `harness_update(resource_type="project", resource_id="my_project", org_id="default", body={name: "Updated Project", description: "Updated desc", color: "#FF5630", modules: ["CD", "CI"], tags: {updated: "true"}})` | Project fully updated | ⬜ Pending | | |
| TC-proj-019 | Update project modules | `harness_update(resource_type="project", resource_id="my_project", org_id="default", body={name: "My Project", modules: ["CD", "CI", "STO", "IDP"]})` | Project modules updated | ⬜ Pending | | |
| TC-proj-020 | Delete project by identifier | `harness_delete(resource_type="project", resource_id="test_project", org_id="default")` | Project deleted successfully | ⬜ Pending | | |
| TC-proj-021 | Delete project with explicit scope | `harness_delete(resource_type="project", resource_id="test_project", org_id="custom_org")` | Project deleted from specified org | ⬜ Pending | | |
| TC-proj-022 | Get project with invalid identifier | `harness_get(resource_type="project", resource_id="nonexistent_project")` | Error: Project not found (404) | ⬜ Pending | | |
| TC-proj-023 | Create project in nonexistent org | `harness_create(resource_type="project", org_id="nonexistent_org", body={identifier: "test", name: "Test"})` | Error: Organization not found (404) | ⬜ Pending | | |
| TC-proj-024 | Delete project that has resources | `harness_delete(resource_type="project", resource_id="project_with_pipelines", org_id="default")` | Error: Cannot delete project with existing resources (400/409) | ⬜ Pending | | |
| TC-proj-025 | List projects with empty results | `harness_list(resource_type="project", filters={search_term: "zzz_nonexistent_zzz"})` | Returns empty items array with total=0 | ⬜ Pending | | |
| TC-proj-026 | List projects with max pagination | `harness_list(resource_type="project", page=0, size=100)` | Returns up to 100 projects | ⬜ Pending | | |
| TC-proj-027 | Create project with special characters in identifier | `harness_create(resource_type="project", org_id="default", body={identifier: "proj-with-dashes_and_underscores", name: "Special Chars Project"})` | Project created with valid special chars | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 27 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 26 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

_(To be filled during testing)_
