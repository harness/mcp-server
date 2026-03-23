# Test Report: Execution Log (`execution_log`)

| Field | Value |
|-------|-------|
| **Resource Type** | `execution_log` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-log-001 | Get execution log by raw prefix | `harness_get(resource_type="execution_log", prefix="accountId/orgId/projectId/pipelineId/runSequence/nodeId")` | Returns readable log text | ✅ Passed | Returns execution step logs with timestamps (get only, requires execution_id) |  |
| TC-log-002 | Get execution log by execution_id | `harness_get(resource_type="execution_log", execution_id="abc123xyz")` | Auto-resolves and returns log | ⬜ Pending | | |
| TC-log-003 | Get with scope overrides | `harness_get(resource_type="execution_log", prefix="my/log/prefix", org_id="other_org", project_id="other_project")` | Returns from specified scope | ⬜ Pending | | |
| TC-log-004 | Get log for a specific step | `harness_get(resource_type="execution_log", execution_id="exec123", step_id="step_deploy")` | Returns step log content | ⬜ Pending | | |
| TC-log-005 | Get log for a specific stage | `harness_get(resource_type="execution_log", execution_id="exec123", stage_id="stage_build")` | Returns stage log content | ⬜ Pending | | |
| TC-log-006 | Get with different org_id | `harness_get(resource_type="execution_log", execution_id="exec123", org_id="custom_org")` | Returns from specified org | ⬜ Pending | | |
| TC-log-007 | Get with different project_id | `harness_get(resource_type="execution_log", execution_id="exec123", org_id="default", project_id="other_project")` | Returns from specified project | ⬜ Pending | | |
| TC-log-008 | Get with non-existent prefix | `harness_get(resource_type="execution_log", prefix="nonexistent/log/prefix/xyz")` | Error or empty: not found | ⬜ Pending | | |
| TC-log-009 | Get with non-existent execution_id | `harness_get(resource_type="execution_log", execution_id="nonexistent_exec_xyz")` | Error: execution not found | ⬜ Pending | | |
| TC-log-010 | Get without prefix or execution_id | `harness_get(resource_type="execution_log")` | Error: prefix or execution_id required | ⬜ Pending | | |
| TC-log-011 | Get log for successful execution | `harness_get(resource_type="execution_log", execution_id="successful_exec_id")` | Clean log without errors | ⬜ Pending | | |
| TC-log-012 | Get log for failed execution | `harness_get(resource_type="execution_log", execution_id="failed_exec_id")` | Log with error messages | ⬜ Pending | | |
| TC-log-013 | Get log with large output | `harness_get(resource_type="execution_log", execution_id="large_output_exec")` | Returns log (may be truncated) | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 13 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 12 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
