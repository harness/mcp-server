# Test Report: Pipeline Dynamic Execution (`pipeline_dynamic_execution`)

| Field | Value |
|-------|-------|
| **Resource Type** | `pipeline_dynamic_execution` |
| **Date** | 2026-06-15 |
| **Tester** | Documentation Automation |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-pdyn-001 | Run with YAML string in `body.yaml` | `harness_execute(resource_type="pipeline_dynamic_execution", action="run", resource_id="deploy_app", body={yaml: "pipeline:\n  identifier: deploy_app\n  name: Deploy App\n  stages: []"})` | Sends `{yaml: "<string>"}` and returns `execution_id`, `status`, and `openInHarness` | Pending | | Requires a pipeline with dynamic execution enabled |
| TC-pdyn-002 | Run with explicit org/project scope | `harness_execute(resource_type="pipeline_dynamic_execution", action="run", resource_id="deploy_app", org_id="AI_Devops", project_id="Sanity", body={yaml: "pipeline:\n  identifier: deploy_app\n  stages: []"})` | Uses `/v1/orgs/AI_Devops/projects/Sanity/pipelines/deploy_app/execute/dynamic` | Pending | | |
| TC-pdyn-003 | Run with JSON pipeline object | `harness_execute(resource_type="pipeline_dynamic_execution", action="run", resource_id="deploy_app", body={yaml: {pipeline: {identifier: "deploy_app", name: "Deploy App", stages: []}}})` | Serializes JSON to YAML before dispatch | Pending | | |
| TC-pdyn-004 | Pass optional module and notification params | `harness_execute(resource_type="pipeline_dynamic_execution", action="run", resource_id="deploy_app", body={yaml: "pipeline: {}\n"}, params={module_type: "CD", notes: "agent-generated run", notify_only_user: true})` | Sends `moduleType`, `notes`, and `notify_only_user` query params | Pending | | |
| TC-pdyn-005 | Confirm high-write risk gating | Run TC-pdyn-001 without auto-approval or elicitation | Blocks or prompts according to `operationPolicy.risk="high_write"` | Pending | | |
| TC-pdyn-006 | Verify stable response projection | Mock response with `execution_details` and `correlationId` | Public result omits backend envelope/debug fields | Pending | | Covered by `tests/registry/pipeline-dynamic-execution.test.ts` unit regression |
| TC-pdyn-007 | Missing body | `harness_execute(resource_type="pipeline_dynamic_execution", action="run", resource_id="deploy_app")` | Local validation error; no Harness request | Pending | | Covered by unit regression |
| TC-pdyn-008 | Missing `yaml` field | `harness_execute(resource_type="pipeline_dynamic_execution", action="run", resource_id="deploy_app", body={pipeline: {identifier: "deploy_app"}})` | Local validation error; no Harness request | Pending | | Covered by unit regression |
| TC-pdyn-009 | Raw string body rejected by tool schema | `harness_execute(resource_type="pipeline_dynamic_execution", action="run", resource_id="deploy_app", body="pipeline: {}\n")` | Strict MCP clients reject non-object body | Pending | | Covered by public tool contract regression |
| TC-pdyn-010 | Dynamic execution not enabled | Run TC-pdyn-001 against a disabled pipeline | Harness error is surfaced | Pending | | |
| TC-pdyn-011 | Unresolved runtime inputs in submitted YAML | Run with unresolved `<+input>` placeholders | Harness rejects or execution fails; caller must resolve YAML first | Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 11 |
| Passed | 0 |
| Failed | 0 |
| Blocked | 0 |
| Not Run | 11 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

_(To be filled during testing)_
