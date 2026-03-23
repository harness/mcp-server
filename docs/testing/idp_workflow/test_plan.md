# Test Plan: IDP Workflow (`idp_workflow`)

| Field | Value |
|-------|-------|
| **Resource Type** | `idp_workflow` |
| **Display Name** | IDP Workflow |
| **Toolset** | idp |
| **Scope** | account |
| **Operations** | list |
| **Execute Actions** | execute |
| **Identifier Fields** | workflow_id |
| **Filter Fields** | scope_level |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-idp_workflow-001 | List | List all workflows with defaults | `harness_list(resource_type="idp_workflow")` | Returns list of IDP workflows (default scope_level=ACCOUNT) |
| TC-idp_workflow-002 | List | List with scope_level=ACCOUNT | `harness_list(resource_type="idp_workflow", scope_level="ACCOUNT")` | Returns account-scoped workflows |
| TC-idp_workflow-003 | List | List with scope_level=ORG | `harness_list(resource_type="idp_workflow", scope_level="ORG")` | Returns org-scoped workflows |
| TC-idp_workflow-004 | List | List with scope_level=PROJECT | `harness_list(resource_type="idp_workflow", scope_level="PROJECT")` | Returns project-scoped workflows |
| TC-idp_workflow-005 | List | List with scope_level=ALL | `harness_list(resource_type="idp_workflow", scope_level="ALL")` | Returns workflows at all scope levels |
| TC-idp_workflow-006 | Execute | Execute a workflow | `harness_execute(resource_type="idp_workflow", action="execute", workflow_id="my_workflow", body={"inputs": {"key": "value"}})` | Returns workflow execution result |
| TC-idp_workflow-007 | Execute | Execute workflow without inputs | `harness_execute(resource_type="idp_workflow", action="execute", workflow_id="my_workflow")` | Returns workflow execution result with empty inputs |
| TC-idp_workflow-008 | Execute | Execute workflow with complex inputs | `harness_execute(resource_type="idp_workflow", action="execute", workflow_id="my_workflow", body={"inputs": {"name": "my-app", "language": "typescript", "owner": "team-a"}})` | Returns successful execution |
| TC-idp_workflow-009 | Error | Execute with missing workflow_id | `harness_execute(resource_type="idp_workflow", action="execute")` | Error: workflow_id is required |
| TC-idp_workflow-010 | Error | Execute non-existent workflow | `harness_execute(resource_type="idp_workflow", action="execute", workflow_id="nonexistent")` | Error: workflow not found (404) |
| TC-idp_workflow-011 | Error | List with invalid scope_level | `harness_list(resource_type="idp_workflow", scope_level="INVALID")` | Error: invalid scope_level value |
| TC-idp_workflow-012 | Error | Attempt get operation (unsupported) | `harness_get(resource_type="idp_workflow", workflow_id="my_workflow")` | Error: get operation not supported |
| TC-idp_workflow-013 | Edge | Execute with empty body | `harness_execute(resource_type="idp_workflow", action="execute", workflow_id="my_workflow", body={})` | Executes with empty inputs |

## Notes
- Only supports list and execute (via executeActions); no get operation
- List uses default query params: `kind=workflow`, `scope_level=ACCOUNT`
- Execute action POSTs to `/v1/scaffolder/tasks` with optional `inputs` object in body
- The `scope_level` filter supports enum: ACCOUNT, ORG, PROJECT, ALL
