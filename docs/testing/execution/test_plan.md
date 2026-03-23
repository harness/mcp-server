# Test Plan: Pipeline Execution (`execution`)

| Field | Value |
|-------|-------|
| **Resource Type** | `execution` |
| **Display Name** | Pipeline Execution |
| **Toolset** | pipelines |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | interrupt |
| **Identifier Fields** | execution_id |
| **Filter Fields** | search_term, pipeline_id, status, branch, my_deployments, module |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-exec-001 | List | List all executions with defaults | `harness_list(resource_type="execution")` | Returns paginated list of pipeline executions |
| TC-exec-002 | List | List executions with pagination | `harness_list(resource_type="execution", page=2, size=5)` | Returns page 2 with up to 5 executions |
| TC-exec-003 | List | List executions filtered by pipeline_id | `harness_list(resource_type="execution", filters={pipeline_id: "my_pipeline"})` | Returns executions only for the specified pipeline |
| TC-exec-004 | List | List executions filtered by status Success | `harness_list(resource_type="execution", filters={status: "Success"})` | Returns only successful executions |
| TC-exec-005 | List | List executions filtered by status Failed | `harness_list(resource_type="execution", filters={status: "Failed"})` | Returns only failed executions |
| TC-exec-006 | List | List executions filtered by status Running | `harness_list(resource_type="execution", filters={status: "Running"})` | Returns only currently running executions |
| TC-exec-007 | List | List executions filtered by branch | `harness_list(resource_type="execution", filters={branch: "main"})` | Returns executions triggered from the main branch |
| TC-exec-008 | List | List executions with my_deployments filter | `harness_list(resource_type="execution", filters={my_deployments: true})` | Returns only executions triggered by the current user |
| TC-exec-009 | List | List executions filtered by module | `harness_list(resource_type="execution", filters={module: "CD"})` | Returns only CD module executions |
| TC-exec-010 | List | List executions with search_term | `harness_list(resource_type="execution", filters={search_term: "deploy-prod"})` | Returns executions matching the search keyword |
| TC-exec-011 | List | List executions with combined filters | `harness_list(resource_type="execution", filters={pipeline_id: "my_pipeline", status: "Failed", module: "CD"}, page=0, size=10)` | Returns failed CD executions for the specified pipeline |
| TC-exec-012 | List | List executions with scope override | `harness_list(resource_type="execution", org_id="custom_org", project_id="custom_project")` | Returns executions from the specified org/project |
| TC-exec-013 | Get | Get execution by identifier | `harness_get(resource_type="execution", resource_id="exec_abc123")` | Returns full execution details including stage/step status |
| TC-exec-014 | Get | Get execution with scope override | `harness_get(resource_type="execution", resource_id="exec_abc123", org_id="other_org", project_id="other_project")` | Returns execution from specified org/project |
| TC-exec-015 | Execute | Interrupt a running execution with AbortAll | `harness_execute(resource_type="execution", action="interrupt", execution_id="exec_running", body={interrupt_type: "AbortAll"})` | Execution interrupted with AbortAll type |
| TC-exec-016 | Execute | Interrupt a running execution with Pause | `harness_execute(resource_type="execution", action="interrupt", execution_id="exec_running", body={interrupt_type: "Pause"})` | Execution paused |
| TC-exec-017 | Execute | Resume a paused execution | `harness_execute(resource_type="execution", action="interrupt", execution_id="exec_paused", body={interrupt_type: "Resume"})` | Execution resumed |
| TC-exec-018 | Execute | Interrupt with StageRollback | `harness_execute(resource_type="execution", action="interrupt", execution_id="exec_running", body={interrupt_type: "StageRollback"})` | Stage rollback initiated |
| TC-exec-019 | Error | Get execution with invalid identifier | `harness_get(resource_type="execution", resource_id="nonexistent_exec")` | Error: Execution not found (404) |
| TC-exec-020 | Error | Interrupt with missing interrupt_type | `harness_execute(resource_type="execution", action="interrupt", execution_id="exec_running", body={})` | Error: interrupt_type is required |
| TC-exec-021 | Error | List executions with invalid status | `harness_list(resource_type="execution", filters={status: "INVALID_STATUS"})` | Error or empty results for invalid status |
| TC-exec-022 | Edge | List executions with empty results | `harness_list(resource_type="execution", filters={pipeline_id: "nonexistent_pipeline"})` | Returns empty items array with total=0 |
| TC-exec-023 | Edge | List executions with max pagination | `harness_list(resource_type="execution", page=0, size=100)` | Returns up to 100 executions in single page |
| TC-exec-024 | Edge | List executions filtered by Aborted status | `harness_list(resource_type="execution", filters={status: "Aborted"})` | Returns only aborted executions |

## Notes
- Execution list uses POST method with `filterType: "PipelineExecution"` body
- The `status` filter supports: Success, Failed, Running, Aborted, Expired, AbortedByFreeze, NotStarted, Paused, Queued, Waiting
- The `interrupt` execute action requires `interrupt_type` as a required body field
- Valid interrupt types: AbortAll, Pause, Resume, StageRollback, Abort, ExpireAll, Retry
- Execution summary API has a hard limit of 10,000 records
