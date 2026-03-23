# Test Plan: Pipeline Summary (`pipeline_summary`)

| Field | Value |
|-------|-------|
| **Resource Type** | `pipeline_summary` |
| **Display Name** | Pipeline Summary |
| **Toolset** | pipelines |
| **Scope** | project |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | pipeline_id |
| **Filter Fields** | _(none)_ |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-psum-001 | Get | Get pipeline summary by identifier | `harness_get(resource_type="pipeline_summary", resource_id="my_pipeline")` | Returns lightweight pipeline summary without full YAML |
| TC-psum-002 | Get | Get pipeline summary with scope override | `harness_get(resource_type="pipeline_summary", resource_id="my_pipeline", org_id="custom_org", project_id="custom_project")` | Returns summary from specified org/project |
| TC-psum-003 | Get | Get summary for a CD pipeline | `harness_get(resource_type="pipeline_summary", resource_id="cd_deploy_pipeline")` | Returns summary with CD module metadata |
| TC-psum-004 | Get | Get summary for a CI pipeline | `harness_get(resource_type="pipeline_summary", resource_id="ci_build_pipeline")` | Returns summary with CI module metadata |
| TC-psum-005 | Error | Get summary with invalid identifier | `harness_get(resource_type="pipeline_summary", resource_id="nonexistent_pipeline")` | Error: Pipeline not found (404) |
| TC-psum-006 | Error | Get summary from unauthorized project | `harness_get(resource_type="pipeline_summary", resource_id="my_pipeline", org_id="no_access_org", project_id="no_access_project")` | Error: Unauthorized (401/403) |
| TC-psum-007 | Edge | Get summary with special characters in identifier | `harness_get(resource_type="pipeline_summary", resource_id="pipeline-with-dashes_underscores")` | Returns summary for pipeline with special chars |
| TC-psum-008 | Edge | Compare summary vs full get | `harness_get(resource_type="pipeline_summary", resource_id="my_pipeline")` then `harness_get(resource_type="pipeline", resource_id="my_pipeline")` | Summary has less data than full get (no YAML) |

## Notes
- Pipeline summary is a lightweight alternative to full pipeline get — excludes YAML definition
- Only supports `get` operation (no list, create, update, delete)
- Useful for quick lookups when full YAML is not needed
- Uses path `/pipeline/api/pipelines/summary/{pipelineIdentifier}`
