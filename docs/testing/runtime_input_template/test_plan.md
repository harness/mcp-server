# Test Plan: Runtime Input Template (`runtime_input_template`)

| Field | Value |
|-------|-------|
| **Resource Type** | `runtime_input_template` |
| **Display Name** | Runtime Input Template |
| **Toolset** | pipelines |
| **Scope** | project |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | pipeline_id |
| **Filter Fields** | _(none)_ |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-rit-001 | Get | Get runtime input template for a pipeline | `harness_get(resource_type="runtime_input_template", resource_id="my_pipeline")` | Returns template showing all `<+input>` placeholders |
| TC-rit-002 | Get | Get runtime input template with branch param | `harness_get(resource_type="runtime_input_template", resource_id="my_pipeline", params={branch: "develop"})` | Returns template from the develop branch |
| TC-rit-003 | Get | Get runtime input template with scope override | `harness_get(resource_type="runtime_input_template", resource_id="my_pipeline", org_id="custom_org", project_id="custom_project")` | Returns template from specified org/project |
| TC-rit-004 | Get | Get template for pipeline with no runtime inputs | `harness_get(resource_type="runtime_input_template", resource_id="simple_pipeline")` | Returns empty or minimal template (no `<+input>` fields) |
| TC-rit-005 | Get | Get template for pipeline with many runtime inputs | `harness_get(resource_type="runtime_input_template", resource_id="complex_pipeline")` | Returns template with all runtime input placeholders |
| TC-rit-006 | Error | Get template with invalid pipeline identifier | `harness_get(resource_type="runtime_input_template", resource_id="nonexistent_pipeline")` | Error: Pipeline not found (404) |
| TC-rit-007 | Error | Get template from unauthorized project | `harness_get(resource_type="runtime_input_template", resource_id="my_pipeline", org_id="no_access_org", project_id="no_access_project")` | Error: Unauthorized (401/403) |
| TC-rit-008 | Edge | Get template with special characters in pipeline_id | `harness_get(resource_type="runtime_input_template", resource_id="pipeline-with-dashes")` | Returns template for pipeline with special chars in ID |

## Notes
- Uses POST method internally to `/pipeline/api/inputSets/template`
- The `pipeline_id` is mapped to `pipelineIdentifier` query parameter
- Returns YAML template showing all `<+input>` runtime expression fields
- Essential pre-step before executing a pipeline — check what inputs are required
- Optional `branch` parameter for remote/git-backed pipelines
