# Test Plan: Pipeline Execution Inputs (`execution_inputs`)

| Field | Value |
|-------|-------|
| **Resource Type** | `execution_inputs` |
| **Display Name** | Pipeline Execution Inputs |
| **Toolset** | pipelines |
| **Scope** | project |
| **Operations** | get |
| **Execute Actions** | none |
| **Identifier Fields** | execution_id |
| **Filter Fields** | none |
| **Deep Link** | No |

## Purpose

Validate retrieval of the merged input set YAML that produced a pipeline execution. The endpoint is `GET /pipeline/api/pipelines/execution/{planExecutionId}/inputsetV2`, exposed through `harness_get(resource_type="execution_inputs", resource_id="<planExecutionId>")`.

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-einp-001 | Get | Get merged execution inputs by plan execution ID | `harness_get(resource_type="execution_inputs", resource_id="exec_abc123")` | Returns `executionId`, `inputSetYaml`, `inputSetTemplateYaml`, `resolvedYaml`, `inputSetDetails`, and `inputSetBranchName` |
| TC-einp-002 | Get | Get with explicit org/project scope | `harness_get(resource_type="execution_inputs", resource_id="exec_abc123", org_id="AI_Devops", project_id="Sanity")` | Sends org/project scope to the Harness API and returns inputs for that project |
| TC-einp-003 | Get | Resolve all expressions | `harness_get(resource_type="execution_inputs", resource_id="exec_abc123", params={resolve_expressions: true, resolve_expressions_type: "RESOLVE_ALL_EXPRESSIONS"})` | Sends `resolveExpressions=true` and `resolveExpressionsType=RESOLVE_ALL_EXPRESSIONS`; `resolvedYaml` is populated when Harness can resolve expressions |
| TC-einp-004 | Get | Resolve trigger expressions only | `harness_get(resource_type="execution_inputs", resource_id="exec_abc123", params={resolve_expressions: true, resolve_expressions_type: "RESOLVE_TRIGGER_EXPRESSIONS"})` | Sends trigger-expression resolution mode and returns the projected response shape |
| TC-einp-005 | Get | Omit expression params | `harness_get(resource_type="execution_inputs", resource_id="exec_abc123")` | Omits `resolveExpressions` and `resolveExpressionsType`; Harness uses its upstream default `UNKNOWN` mode |
| TC-einp-006 | Response | Verify response envelope stripping | Mock upstream response `{status:"SUCCESS",data:{inputSetYaml:"yaml"},correlationId:"cid"}` | Public result does not include `status`, `correlationId`, `metaData`, or unknown debug fields |
| TC-einp-007 | Response | Normalize contributing input set details | Mock upstream `inputSetDetails` with extra fields | Public `inputSetDetails` contains only `{identifier, name}` pairs; missing fields become `null` |
| TC-einp-008 | Response | Missing optional fields | Mock upstream `data:{}` | Returns `null` for YAML/branch fields and `[]` for `inputSetDetails` |
| TC-einp-009 | Read-only | Verify read-risk behavior | Run TC-einp-001 with `HARNESS_READ_ONLY=true` | Request is allowed because `operationPolicy.risk="read"` |
| TC-einp-010 | Error | Missing execution ID | `harness_get(resource_type="execution_inputs")` | Tool input validation fails before dispatch because `resource_id`/execution ID is required |
| TC-einp-011 | Error | Unknown execution ID | `harness_get(resource_type="execution_inputs", resource_id="nonexistent_exec")` | Harness not-found error is surfaced |
| TC-einp-012 | Workflow | Chain from a pipeline run | Run `pipeline.run` or `pipeline_dynamic_execution.run`, then call `harness_get(resource_type="execution_inputs", resource_id="<execution_id>")` | Returned input YAML explains what values produced that execution |

## Notes

- `resource_id` maps to the endpoint's `planExecutionId` path parameter and is reported back as `executionId`.
- The resource is get-only; use `input_set` for saved input set CRUD.
- `inputSetYaml` is the merged runtime input YAML used for the execution.
- `inputSetTemplateYaml` is the execution-time template.
- `resolvedYaml` is only expected when expression resolution is requested and Harness can resolve the expressions.
- `inputSetBranchName` identifies the source branch for Git-backed input sets when Harness returns it.
