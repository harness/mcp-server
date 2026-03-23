# Test Plan: GitOps Pod Log (`gitops_pod_log`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_pod_log` |
| **Display Name** | GitOps Pod Log |
| **Toolset** | gitops |
| **Scope** | project |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | agent_id, app_name |
| **Filter Fields** | pod_name, namespace, container, tail_lines |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-gitops_pod_log-001 | Get | Get pod logs for an application | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app")` | Returns pod logs |
| TC-gitops_pod_log-002 | Get | Get logs with pod_name filter | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app", pod_name="my-pod-abc123")` | Returns logs for specified pod |
| TC-gitops_pod_log-003 | Get | Get logs with namespace filter | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app", namespace="production")` | Returns logs from specified namespace |
| TC-gitops_pod_log-004 | Get | Get logs with container filter | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app", container="main")` | Returns logs from specified container |
| TC-gitops_pod_log-005 | Get | Get logs with tail_lines limit | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app", tail_lines=100)` | Returns last 100 log lines |
| TC-gitops_pod_log-006 | Get | Get logs with all filters combined | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app", pod_name="my-pod", namespace="default", container="main", tail_lines=50)` | Returns filtered logs |
| TC-gitops_pod_log-007 | Get | Get logs with custom org/project | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app", org_id="my_org", project_id="my_project")` | Returns logs for specified project |
| TC-gitops_pod_log-008 | Error | Get without agent_id | `harness_get(resource_type="gitops_pod_log", app_name="my-app")` | Error: agent_id is required |
| TC-gitops_pod_log-009 | Error | Get without app_name | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent")` | Error: app_name is required |
| TC-gitops_pod_log-010 | Error | Get for non-existent application | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="nonexistent")` | Error: application not found (404) |
| TC-gitops_pod_log-011 | Error | Attempt list operation (unsupported) | `harness_list(resource_type="gitops_pod_log")` | Error: list operation not supported |
| TC-gitops_pod_log-012 | Edge | Get with tail_lines=1 | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app", tail_lines=1)` | Returns last 1 log line |
| TC-gitops_pod_log-013 | Edge | Get with non-existent pod_name | `harness_get(resource_type="gitops_pod_log", agent_id="my_agent", app_name="my-app", pod_name="nonexistent-pod")` | Returns empty logs or error |

## Notes
- Only supports get operation; no list operation
- Project-scoped resource; requires org_id and project_id (defaults from config)
- Requires both `agent_id` and `app_name` as parent identifiers
- Query params: pod_name → podName, namespace → namespace, container → container, tail_lines → tailLines
- Deep link format: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}`
- API path: GET `/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/logs`
