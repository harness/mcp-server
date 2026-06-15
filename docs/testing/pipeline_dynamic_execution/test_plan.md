# Test Plan: Pipeline Dynamic Execution (`pipeline_dynamic_execution`)

| Field | Value |
|-------|-------|
| **Resource Type** | `pipeline_dynamic_execution` |
| **Display Name** | Pipeline Dynamic Execution |
| **Toolset** | pipelines |
| **Scope** | project |
| **Operations** | none |
| **Execute Actions** | run |
| **Identifier Fields** | pipeline_id |
| **Filter Fields** | none |
| **Deep Link** | Yes, execution link when `execution_id` is returned |

## Purpose

Validate dynamic execution of an existing v0 pipeline shell using YAML supplied at runtime. The endpoint is `POST /v1/orgs/{org}/projects/{project}/pipelines/{pipeline}/execute/dynamic`, exposed through `harness_execute(resource_type="pipeline_dynamic_execution", action="run", ...)`.

## Preconditions

- The target v0 pipeline already exists in Harness.
- Account-level and pipeline-level Allow Dynamic Execution are enabled.
- The caller has Edit and Execute permissions on the pipeline.
- Submitted YAML is a full v0 pipeline definition with all `<+input>` values resolved.

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-pdyn-001 | Execute | Run with YAML string in `body.yaml` | `harness_execute(resource_type="pipeline_dynamic_execution", action="run", resource_id="deploy_app", body={yaml: "pipeline:\n  identifier: deploy_app\n  name: Deploy App\n  stages: []"})` | Sends `{yaml: "<string>"}` to the dynamic execution endpoint and returns `execution_id`, `status`, and `openInHarness` |
| TC-pdyn-002 | Execute | Run with explicit org/project scope | `harness_execute(resource_type="pipeline_dynamic_execution", action="run", resource_id="deploy_app", org_id="AI_Devops", project_id="Sanity", body={yaml: "pipeline:\n  identifier: deploy_app\n  stages: []"})` | Uses `/v1/orgs/AI_Devops/projects/Sanity/pipelines/deploy_app/execute/dynamic` |
| TC-pdyn-003 | Execute | Run with JSON pipeline object | `harness_execute(resource_type="pipeline_dynamic_execution", action="run", resource_id="deploy_app", body={yaml: {pipeline: {identifier: "deploy_app", name: "Deploy App", stages: []}}})` | Serializes the JSON object to YAML before dispatch |
| TC-pdyn-004 | Execute | Pass optional module and notification params | `harness_execute(resource_type="pipeline_dynamic_execution", action="run", resource_id="deploy_app", body={yaml: "pipeline: {}\n"}, params={module_type: "CD", notes: "agent-generated run", notify_only_user: true})` | Sends `moduleType`, `notes`, and `notify_only_user` query params |
| TC-pdyn-005 | Confirmation | Confirm high-write risk gating | `harness_execute(resource_type="pipeline_dynamic_execution", action="run", resource_id="deploy_app", body={yaml: "pipeline: {}\n"})` in a client without auto-approval or elicitation | Blocks or prompts according to `operationPolicy.risk="high_write"` |
| TC-pdyn-006 | Response | Verify stable response projection | Run TC-pdyn-001 against a mock response `{execution_details:{execution_id:"exec-1",status:"RUNNING"},correlationId:"cid"}` | Public result includes `execution_id` and `status`; it does not leak `execution_details` or `correlationId` |
| TC-pdyn-007 | Error | Missing body | `harness_execute(resource_type="pipeline_dynamic_execution", action="run", resource_id="deploy_app")` | Local validation error mentioning required `body.yaml`; no Harness request is sent |
| TC-pdyn-008 | Error | Missing `yaml` field | `harness_execute(resource_type="pipeline_dynamic_execution", action="run", resource_id="deploy_app", body={pipeline: {identifier: "deploy_app"}})` | Local validation error mentioning required `body.yaml`; no Harness request is sent |
| TC-pdyn-009 | Error | Raw string body rejected by tool schema | `harness_execute(resource_type="pipeline_dynamic_execution", action="run", resource_id="deploy_app", body="pipeline: {}\n")` | Strict MCP clients reject the call because `harness_execute.body` must be an object |
| TC-pdyn-010 | Error | Dynamic execution not enabled | Run TC-pdyn-001 against a pipeline without dynamic execution enabled | Harness error is surfaced; troubleshoot account-level and pipeline-level Allow Dynamic Execution settings |
| TC-pdyn-011 | Error | Unresolved runtime inputs in submitted YAML | Run with YAML containing unresolved `<+input>` placeholders | Harness rejects or execution fails; callers must resolve values before submission because this API does not prompt for runtime inputs |

## Notes

- `pipeline_dynamic_execution` has no list/get/create/update/delete operation; only `run` is exposed.
- It targets v0 `pipeline` shells even though the endpoint path starts with `/v1/...`.
- Input sets, selective stage execution, retry, and triggers are not supported by the dynamic execution API.
- `body.yaml` can be a string or a JSON object that the server serializes with `yaml`.
- The action uses `retryPolicy: "do_not_retry"` because POSTing a dynamic run is non-idempotent.
