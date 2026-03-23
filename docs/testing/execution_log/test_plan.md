# Test Plan: Execution Log (`execution_log`)

| Field | Value |
|-------|-------|
| **Resource Type** | `execution_log` |
| **Display Name** | Execution Log |
| **Toolset** | logs |
| **Scope** | project |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | prefix |
| **Filter Fields** | execution_id |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-log-001 | Get | Get execution log by raw prefix | `harness_get(resource_type="execution_log", prefix="accountId/orgId/projectId/pipelineId/runSequence/nodeId")` | Returns readable log text content for the specified step |
| TC-log-002 | Get | Get execution log by execution_id | `harness_get(resource_type="execution_log", execution_id="abc123xyz")` | Auto-resolves log key from execution metadata and returns log content |
| TC-log-003 | Get | Get execution log with scope overrides | `harness_get(resource_type="execution_log", prefix="my/log/prefix", org_id="other_org", project_id="other_project")` | Returns log from specified org/project scope |
| TC-log-004 | Get | Get execution log for a specific step | `harness_get(resource_type="execution_log", execution_id="exec123", step_id="step_deploy")` | Returns log content for the specific step in the execution |
| TC-log-005 | Get | Get execution log for a specific stage | `harness_get(resource_type="execution_log", execution_id="exec123", stage_id="stage_build")` | Returns log content for the specific stage |
| TC-log-006 | Scope | Get execution log with different org_id | `harness_get(resource_type="execution_log", execution_id="exec123", org_id="custom_org")` | Returns log from specified org |
| TC-log-007 | Scope | Get execution log with different project_id | `harness_get(resource_type="execution_log", execution_id="exec123", org_id="default", project_id="other_project")` | Returns log from specified project |
| TC-log-008 | Error | Get log with non-existent prefix | `harness_get(resource_type="execution_log", prefix="nonexistent/log/prefix/xyz")` | Error or empty: log not found |
| TC-log-009 | Error | Get log with non-existent execution_id | `harness_get(resource_type="execution_log", execution_id="nonexistent_exec_xyz")` | Error: execution not found or no logs available |
| TC-log-010 | Error | Get log without prefix or execution_id | `harness_get(resource_type="execution_log")` | Error: prefix or execution_id is required |
| TC-log-011 | Edge | Get log for a successful execution | `harness_get(resource_type="execution_log", execution_id="successful_exec_id")` | Returns complete log text without error indicators |
| TC-log-012 | Edge | Get log for a failed execution | `harness_get(resource_type="execution_log", execution_id="failed_exec_id")` | Returns log text containing error/failure messages |
| TC-log-013 | Edge | Get log with large output | `harness_get(resource_type="execution_log", execution_id="large_output_exec")` | Returns log text (may be truncated for very large outputs) |

## Notes
- Execution log only supports the `get` operation — no list, create, update, or delete.
- The get operation uses a POST method to `/gateway/log-service/blob/download`.
- The `prefix` identifier is a raw Harness logBaseKey string (e.g. `accountId/orgId/projectId/pipelineId/runSequence/nodeId`).
- The `execution_id` filter auto-resolves the log prefix from execution metadata.
- The response extractor uses `passthrough` — returns raw log text as-is.
- No deep link template is defined for execution logs.
- For best failure analysis, use `harness_diagnose` with `include_logs=true` instead of direct log retrieval.
- When a Harness execution URL includes step/stage query params, the MCP uses them to resolve the matching step log key.
