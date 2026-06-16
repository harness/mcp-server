# Test Report: Pipeline Execution Inputs (`execution_inputs`)

| Field | Value |
|-------|-------|
| **Resource Type** | `execution_inputs` |
| **Date** | 2026-06-15 |
| **Tester** | Documentation Automation |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-einp-001 | Get merged execution inputs by plan execution ID | `harness_get(resource_type="execution_inputs", resource_id="exec_abc123")` | Returns projected execution input fields | Pending | | Covered by `tests/tools/tool-handlers.test.ts` harness_get — execution_inputs |
| TC-einp-002 | Get with explicit org/project scope | `harness_get(resource_type="execution_inputs", resource_id="exec_abc123", org_id="AI_Devops", project_id="Sanity")` | Sends org/project scope and returns inputs for that project | Pending | | Covered by `tests/tools/tool-handlers.test.ts` harness_get — execution_inputs |
| TC-einp-003 | Resolve all expressions | `harness_get(resource_type="execution_inputs", resource_id="exec_abc123", params={resolve_expressions: true, resolve_expressions_type: "RESOLVE_ALL_EXPRESSIONS"})` | Sends expression resolution params; `resolvedYaml` is populated when Harness resolves expressions | Pending | | Covered by `tests/tools/tool-handlers.test.ts` harness_get — execution_inputs |
| TC-einp-004 | Resolve trigger expressions only | `harness_get(resource_type="execution_inputs", resource_id="exec_abc123", params={resolve_expressions: true, resolve_expressions_type: "RESOLVE_TRIGGER_EXPRESSIONS"})` | Sends trigger-expression resolution mode | Pending | | Covered by registry unit regression |
| TC-einp-005 | Omit expression params | `harness_get(resource_type="execution_inputs", resource_id="exec_abc123")` | Omits resolution params so Harness uses default `UNKNOWN` mode | Pending | | Covered by `tests/tools/tool-handlers.test.ts` harness_get — execution_inputs |
| TC-einp-006 | Verify response envelope stripping | Mock upstream response with `status` and `correlationId` | Public result omits backend envelope/debug fields | Pending | | Covered by `tests/registry/execution-inputs.test.ts` extractor regression |
| TC-einp-007 | Normalize contributing input set details | Mock upstream `inputSetDetails` with extra fields | Public details contain only `{identifier, name}` pairs | Pending | | Covered by `tests/registry/execution-inputs.test.ts` extractor regression |
| TC-einp-008 | Missing optional fields | Mock upstream `data:{}` | Returns `null` YAML/branch fields and empty `inputSetDetails` | Pending | | Covered by `tests/registry/execution-inputs.test.ts` extractor regression |
| TC-einp-009 | Verify read-risk behavior | Run TC-einp-001 with `HARNESS_READ_ONLY=true` | Request is allowed because the operation is read-only | Pending | | Covered by `tests/tools/tool-handlers.test.ts` harness_get — execution_inputs |
| TC-einp-010 | Missing execution ID | `harness_get(resource_type="execution_inputs")` | Registry dispatch fails with `Missing required field "execution_id" for execution_inputs.` | Pending | | Covered by `tests/tools/tool-handlers.test.ts` harness_get — execution_inputs |
| TC-einp-011 | Unknown execution ID | `harness_get(resource_type="execution_inputs", resource_id="nonexistent_exec")` | Harness not-found error is surfaced | Pending | | |
| TC-einp-012 | Chain from a pipeline run | Run a pipeline, then `harness_get(resource_type="execution_inputs", resource_id="<execution_id>")` | Returned YAML explains the inputs that produced the execution | Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 12 |
| Passed | 0 |
| Failed | 0 |
| Blocked | 0 |
| Not Run | 12 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

_(To be filled during testing)_
