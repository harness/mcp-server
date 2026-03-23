# Test Report: Pipeline Execution (`execution`)

| Field | Value |
|-------|-------|
| **Resource Type** | `execution` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-exec-001 | List all executions with defaults | `harness_list(resource_type="execution")` | Returns paginated list of pipeline executions | ✅ Passed | Returns 11 executions with planExecutionId, status, pipeline name, timestamps, deep links |  |
| TC-exec-002 | List executions with pagination | `harness_list(resource_type="execution", page=2, size=5)` | Returns page 2 with up to 5 executions | ⬜ Pending | | |
| TC-exec-003 | List executions filtered by pipeline_id | `harness_list(resource_type="execution", filters={pipeline_id: "my_pipeline"})` | Returns executions only for the specified pipeline | ⬜ Pending | | |
| TC-exec-004 | List executions filtered by status Success | `harness_list(resource_type="execution", filters={status: "Success"})` | Returns only successful executions | ⬜ Pending | | |
| TC-exec-005 | List executions filtered by status Failed | `harness_list(resource_type="execution", filters={status: "Failed"})` | Returns only failed executions | ⬜ Pending | | |
| TC-exec-006 | List executions filtered by status Running | `harness_list(resource_type="execution", filters={status: "Running"})` | Returns only currently running executions | ⬜ Pending | | |
| TC-exec-007 | List executions filtered by branch | `harness_list(resource_type="execution", filters={branch: "main"})` | Returns executions triggered from the main branch | ⬜ Pending | | |
| TC-exec-008 | List executions with my_deployments filter | `harness_list(resource_type="execution", filters={my_deployments: true})` | Returns only executions triggered by the current user | ⬜ Pending | | |
| TC-exec-009 | List executions filtered by module | `harness_list(resource_type="execution", filters={module: "CD"})` | Returns only CD module executions | ⬜ Pending | | |
| TC-exec-010 | List executions with search_term | `harness_list(resource_type="execution", filters={search_term: "deploy-prod"})` | Returns executions matching the search keyword | ⬜ Pending | | |
| TC-exec-011 | List executions with combined filters | `harness_list(resource_type="execution", filters={pipeline_id: "my_pipeline", status: "Failed", module: "CD"}, page=0, size=10)` | Returns failed CD executions for the specified pipeline | ⬜ Pending | | |
| TC-exec-012 | List executions with scope override | `harness_list(resource_type="execution", org_id="custom_org", project_id="custom_project")` | Returns executions from the specified org/project | ⬜ Pending | | |
| TC-exec-013 | Get execution by identifier | `harness_get(resource_type="execution", resource_id="exec_abc123")` | Returns full execution details including stage/step status | ⬜ Pending | | |
| TC-exec-014 | Get execution with scope override | `harness_get(resource_type="execution", resource_id="exec_abc123", org_id="other_org", project_id="other_project")` | Returns execution from specified org/project | ⬜ Pending | | |
| TC-exec-015 | Interrupt a running execution with AbortAll | `harness_execute(resource_type="execution", action="interrupt", execution_id="exec_running", body={interrupt_type: "AbortAll"})` | Execution interrupted with AbortAll type | ⬜ Pending | | |
| TC-exec-016 | Interrupt a running execution with Pause | `harness_execute(resource_type="execution", action="interrupt", execution_id="exec_running", body={interrupt_type: "Pause"})` | Execution paused | ⬜ Pending | | |
| TC-exec-017 | Resume a paused execution | `harness_execute(resource_type="execution", action="interrupt", execution_id="exec_paused", body={interrupt_type: "Resume"})` | Execution resumed | ⬜ Pending | | |
| TC-exec-018 | Interrupt with StageRollback | `harness_execute(resource_type="execution", action="interrupt", execution_id="exec_running", body={interrupt_type: "StageRollback"})` | Stage rollback initiated | ⬜ Pending | | |
| TC-exec-019 | Get execution with invalid identifier | `harness_get(resource_type="execution", resource_id="nonexistent_exec")` | Error: Execution not found (404) | ⬜ Pending | | |
| TC-exec-020 | Interrupt with missing interrupt_type | `harness_execute(resource_type="execution", action="interrupt", execution_id="exec_running", body={})` | Error: interrupt_type is required | ⬜ Pending | | |
| TC-exec-021 | List executions with invalid status | `harness_list(resource_type="execution", filters={status: "INVALID_STATUS"})` | Error or empty results for invalid status | ⬜ Pending | | |
| TC-exec-022 | List executions with empty results | `harness_list(resource_type="execution", filters={pipeline_id: "nonexistent_pipeline"})` | Returns empty items array with total=0 | ⬜ Pending | | |
| TC-exec-023 | List executions with max pagination | `harness_list(resource_type="execution", page=0, size=100)` | Returns up to 100 executions in single page | ⬜ Pending | | |
| TC-exec-024 | List executions filtered by Aborted status | `harness_list(resource_type="execution", filters={status: "Aborted"})` | Returns only aborted executions | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 24 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 23 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

_(To be filled during testing)_
