# Test Plan: Template (`template`)

| Field | Value |
|-------|-------|
| **Resource Type** | `template` |
| **Display Name** | Template |
| **Toolset** | templates |
| **Scope** | project |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | None |
| **Identifier Fields** | template_id |
| **Filter Fields** | search_term, template_type, template_list_type |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-tpl-001 | List | List all templates with defaults | `harness_list(resource_type="template")` | Returns paginated list of templates with items array and total count |
| TC-tpl-002 | List | List templates with pagination | `harness_list(resource_type="template", page=0, size=5)` | Returns page 0 with up to 5 templates |
| TC-tpl-003 | List | Filter templates by search_term | `harness_list(resource_type="template", search_term="deploy")` | Returns templates matching "deploy" in name or keyword |
| TC-tpl-004 | List | Filter by template_type Pipeline | `harness_list(resource_type="template", template_type="Pipeline")` | Returns only Pipeline-type templates |
| TC-tpl-005 | List | Filter by template_type Stage | `harness_list(resource_type="template", template_type="Stage")` | Returns only Stage-type templates |
| TC-tpl-006 | List | Filter by template_type Step | `harness_list(resource_type="template", template_type="Step")` | Returns only Step-type templates |
| TC-tpl-007 | List | Filter by template_list_type Stable | `harness_list(resource_type="template", template_list_type="Stable")` | Returns only stable templates |
| TC-tpl-008 | List | Filter by template_list_type LastUpdated | `harness_list(resource_type="template", template_list_type="LastUpdated")` | Returns templates sorted by last updated |
| TC-tpl-009 | List | Combined filters: type + search + list_type + pagination | `harness_list(resource_type="template", template_type="Step", search_term="shell", template_list_type="Stable", page=0, size=10)` | Returns filtered, paginated templates |
| TC-tpl-010 | Get | Get template by identifier | `harness_get(resource_type="template", template_id="my_template")` | Returns full template details including YAML |
| TC-tpl-011 | Get | Get template with specific version_label | `harness_get(resource_type="template", template_id="my_template", version_label="v2")` | Returns template at specified version |
| TC-tpl-012 | Get | Get template with scope overrides | `harness_get(resource_type="template", template_id="my_template", org_id="other_org", project_id="other_project")` | Returns template from specified org/project |
| TC-tpl-013 | Create | Create template with required fields | `harness_create(resource_type="template", identifier="test_tpl", name="Test Template", template_yaml="template:\n  name: Test Template\n  identifier: test_tpl\n  versionLabel: v1\n  type: Step\n  spec:\n    type: ShellScript\n    spec:\n      shell: Bash\n      source:\n        type: Inline\n        spec:\n          script: echo hello")` | Template created with identifier, name, and YAML |
| TC-tpl-014 | Create | Create template with all fields | `harness_create(resource_type="template", identifier="full_tpl", name="Full Template", template_yaml="template:\n  ...", label="v1", is_stable=true, description="Full template", tags={"team": "platform"}, comments="Initial version")` | Template created with all fields |
| TC-tpl-015 | Create | Create template with missing template_yaml | `harness_create(resource_type="template", identifier="bad_tpl", name="Bad Template")` | Error: body.template_yaml is required |
| TC-tpl-016 | Create | Create template with missing identifier | `harness_create(resource_type="template", name="No ID", template_yaml="template:\n  ...")` | Error: body.identifier is required |
| TC-tpl-017 | Create | Create template with missing name | `harness_create(resource_type="template", identifier="no_name", template_yaml="template:\n  ...")` | Error: body.name is required |
| TC-tpl-018 | Update | Update template version YAML | `harness_update(resource_type="template", template_id="my_template", version_label="v1", template_yaml="template:\n  name: My Template\n  identifier: my_template\n  versionLabel: v1\n  type: Step\n  spec:\n    type: ShellScript\n    spec:\n      shell: Bash\n      source:\n        type: Inline\n        spec:\n          script: echo updated")` | Template version updated with new YAML |
| TC-tpl-019 | Update | Update template and mark as stable | `harness_update(resource_type="template", template_id="my_template", version_label="v2", template_yaml="template:\n  ...", is_stable=true, comments="Marking v2 stable")` | Template updated and marked as stable |
| TC-tpl-020 | Update | Update template with missing template_yaml | `harness_update(resource_type="template", template_id="my_template", version_label="v1")` | Error: body.template_yaml is required |
| TC-tpl-021 | Delete | Delete all versions of a template | `harness_delete(resource_type="template", template_id="my_template")` | All versions of template deleted |
| TC-tpl-022 | Delete | Delete specific version of a template | `harness_delete(resource_type="template", template_id="my_template", version_label="v1")` | Only version v1 deleted |
| TC-tpl-023 | Scope | List templates with different org_id | `harness_list(resource_type="template", org_id="custom_org")` | Returns templates from specified org |
| TC-tpl-024 | Error | Get non-existent template | `harness_get(resource_type="template", template_id="nonexistent_tpl_xyz")` | Error: template not found (404) |
| TC-tpl-025 | Error | Delete non-existent template | `harness_delete(resource_type="template", template_id="nonexistent_tpl_xyz")` | Error: template not found (404) |
| TC-tpl-026 | Edge | List templates with empty results | `harness_list(resource_type="template", search_term="zzz_no_match_xyz")` | Returns empty items array with total=0 |
| TC-tpl-027 | Edge | List templates with max pagination | `harness_list(resource_type="template", page=0, size=100)` | Returns up to 100 templates |
| TC-tpl-028 | Deep Link | Verify deep link in get response | `harness_get(resource_type="template", template_id="my_template")` | Response includes valid Harness UI deep link |

## Notes
- Template list is a POST endpoint with a filter body; `template_type` maps to `templateEntityTypes` array.
- Valid template types: `Pipeline`, `Stage`, `Step`, `CustomDeployment`, `MonitoredService`, `SecretManager`, `ArtifactSource`.
- Valid template list types: `Stable`, `LastUpdated`, `All`.
- Get supports an optional `version_label` query param to fetch a specific version.
- Create uses the v1 API path: `/v1/orgs/{org}/projects/{project}/templates`.
- Update uses the v1 API path: `/v1/orgs/{org}/projects/{project}/templates/{template}/versions/{version}` — requires `version_label`.
- Delete without `version_label` deletes all versions; with `version_label` deletes only that version.
- The `template_yaml` field can alternatively be provided as `yaml` in the body.
- Deep link format: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/setup/resources/templates/{templateIdentifier}`
