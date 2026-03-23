# Test Report: Template (`template`)

| Field | Value |
|-------|-------|
| **Resource Type** | `template` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-tpl-001 | List all templates with defaults | `harness_list(resource_type="template")` | Returns paginated list with items and total | ✅ Passed | Returns 13 templates with type, version, deep links |  |
| TC-tpl-002 | List templates with pagination | `harness_list(resource_type="template", page=0, size=5)` | Returns page 0 with up to 5 templates | ⬜ Pending | | |
| TC-tpl-003 | Filter by search_term | `harness_list(resource_type="template", search_term="deploy")` | Returns matching templates | ⬜ Pending | | |
| TC-tpl-004 | Filter by template_type Pipeline | `harness_list(resource_type="template", template_type="Pipeline")` | Returns only Pipeline templates | ⬜ Pending | | |
| TC-tpl-005 | Filter by template_type Stage | `harness_list(resource_type="template", template_type="Stage")` | Returns only Stage templates | ⬜ Pending | | |
| TC-tpl-006 | Filter by template_type Step | `harness_list(resource_type="template", template_type="Step")` | Returns only Step templates | ⬜ Pending | | |
| TC-tpl-007 | Filter by template_list_type Stable | `harness_list(resource_type="template", template_list_type="Stable")` | Returns only stable templates | ⬜ Pending | | |
| TC-tpl-008 | Filter by template_list_type LastUpdated | `harness_list(resource_type="template", template_list_type="LastUpdated")` | Returns last updated templates | ⬜ Pending | | |
| TC-tpl-009 | Combined filters | `harness_list(resource_type="template", template_type="Step", search_term="shell", template_list_type="Stable", page=0, size=10)` | Returns filtered results | ⬜ Pending | | |
| TC-tpl-010 | Get template by identifier | `harness_get(resource_type="template", template_id="my_template")` | Returns full template details | ⬜ Pending | | |
| TC-tpl-011 | Get with specific version_label | `harness_get(resource_type="template", template_id="my_template", version_label="v2")` | Returns template at version v2 | ⬜ Pending | | |
| TC-tpl-012 | Get with scope overrides | `harness_get(resource_type="template", template_id="my_template", org_id="other_org", project_id="other_project")` | Returns from specified scope | ⬜ Pending | | |
| TC-tpl-013 | Create with required fields | `harness_create(resource_type="template", identifier="test_tpl", name="Test Template", template_yaml="template:\n  ...")` | Template created | ⬜ Pending | | |
| TC-tpl-014 | Create with all fields | `harness_create(resource_type="template", identifier="full_tpl", name="Full Template", template_yaml="...", label="v1", is_stable=true, description="...", tags={...}, comments="...")` | Template created with all fields | ⬜ Pending | | |
| TC-tpl-015 | Create with missing template_yaml | `harness_create(resource_type="template", identifier="bad_tpl", name="Bad Template")` | Error: template_yaml required | ⬜ Pending | | |
| TC-tpl-016 | Create with missing identifier | `harness_create(resource_type="template", name="No ID", template_yaml="...")` | Error: identifier required | ⬜ Pending | | |
| TC-tpl-017 | Create with missing name | `harness_create(resource_type="template", identifier="no_name", template_yaml="...")` | Error: name required | ⬜ Pending | | |
| TC-tpl-018 | Update template version YAML | `harness_update(resource_type="template", template_id="my_template", version_label="v1", template_yaml="template:\n  ...")` | Template updated | ⬜ Pending | | |
| TC-tpl-019 | Update and mark as stable | `harness_update(resource_type="template", template_id="my_template", version_label="v2", template_yaml="...", is_stable=true, comments="...")` | Updated and marked stable | ⬜ Pending | | |
| TC-tpl-020 | Update with missing template_yaml | `harness_update(resource_type="template", template_id="my_template", version_label="v1")` | Error: template_yaml required | ⬜ Pending | | |
| TC-tpl-021 | Delete all versions | `harness_delete(resource_type="template", template_id="my_template")` | All versions deleted | ⬜ Pending | | |
| TC-tpl-022 | Delete specific version | `harness_delete(resource_type="template", template_id="my_template", version_label="v1")` | Only v1 deleted | ⬜ Pending | | |
| TC-tpl-023 | List with different org_id | `harness_list(resource_type="template", org_id="custom_org")` | Returns from specified org | ⬜ Pending | | |
| TC-tpl-024 | Get non-existent template | `harness_get(resource_type="template", template_id="nonexistent_tpl_xyz")` | Error: not found (404) | ⬜ Pending | | |
| TC-tpl-025 | Delete non-existent template | `harness_delete(resource_type="template", template_id="nonexistent_tpl_xyz")` | Error: not found (404) | ⬜ Pending | | |
| TC-tpl-026 | List with empty results | `harness_list(resource_type="template", search_term="zzz_no_match_xyz")` | Empty items, total=0 | ⬜ Pending | | |
| TC-tpl-027 | List with max pagination | `harness_list(resource_type="template", page=0, size=100)` | Returns up to 100 templates | ⬜ Pending | | |
| TC-tpl-028 | Verify deep link in response | `harness_get(resource_type="template", template_id="my_template")` | Response includes valid deep link | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 28 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 27 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
