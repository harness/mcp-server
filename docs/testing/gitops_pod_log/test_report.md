# Test Report: GitOps Pod Log (`gitops_pod_log`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_pod_log` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-gitops_pod_log-001 | Get pod logs for an application | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app")` | Returns pod logs | ✅ Passed | API responds correctly; get only, requires connected agent | Needs connected agent |
| TC-gitops_pod_log-002 | Get logs with pod_name filter | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app", pod_name="my-pod-abc123")` | Returns logs for specified pod | ⬜ Pending | | |
| TC-gitops_pod_log-003 | Get logs with namespace filter | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app", namespace="production")` | Returns logs from specified namespace | ⬜ Pending | | |
| TC-gitops_pod_log-004 | Get logs with container filter | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app", container="main")` | Returns logs from specified container | ⬜ Pending | | |
| TC-gitops_pod_log-005 | Get logs with tail_lines limit | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app", tail_lines=100)` | Returns last 100 log lines | ⬜ Pending | | |
| TC-gitops_pod_log-006 | Get logs with all filters combined | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app", pod_name="my-pod", namespace="default", container="main", tail_lines=50)` | Returns filtered logs | ⬜ Pending | | |
| TC-gitops_pod_log-007 | Get logs with custom org/project | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app", org_id="my_org", project_id="my_project")` | Returns logs for specified project | ⬜ Pending | | |
| TC-gitops_pod_log-008 | Get without agent_id | `harness_get(resource_type="gitops_pod_log", app_name="my-app")` | Error: agent_id is required | ⬜ Pending | | |
| TC-gitops_pod_log-009 | Get without app_name | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent")` | Error: app_name is required | ⬜ Pending | | |
| TC-gitops_pod_log-010 | Get for non-existent application | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="nonexistent")` | Error: application not found (404) | ⬜ Pending | | |
| TC-gitops_pod_log-011 | Attempt list operation (unsupported) | `harness_list(resource_type="gitops_pod_log")` | Error: list operation not supported | ⬜ Pending | | |
| TC-gitops_pod_log-012 | Get with tail_lines=1 | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app", tail_lines=1)` | Returns last 1 log line | ⬜ Pending | | |
| TC-gitops_pod_log-013 | Get with non-existent pod_name | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app", pod_name="nonexistent-pod")` | Returns empty logs or error | ⬜ Pending | | |

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
