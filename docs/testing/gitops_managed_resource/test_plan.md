# Test Plan: GitOps Managed Resource (`gitops_managed_resource`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_managed_resource` |
| **Display Name** | GitOps Managed Resource |
| **Toolset** | gitops |
| **Scope** | project |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | agent_id, app_name |
| **Filter Fields** | None |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-gitops_managed_resource-001 | List | List managed resources for an application | `harness_list(resource_type="gitops_managed_resource", agent_id="my_agent", app_name="my-app")` | Returns list of managed Kubernetes resources |
| TC-gitops_managed_resource-002 | List | List with custom org/project | `harness_list(resource_type="gitops_managed_resource", agent_id="my_agent", app_name="my-app", org_id="my_org", project_id="my_project")` | Returns managed resources for specified project |
| TC-gitops_managed_resource-003 | List | Verify response structure | `harness_list(resource_type="gitops_managed_resource", agent_id="my_agent", app_name="my-app")` | Response contains K8s resource objects with kind, name, namespace |
| TC-gitops_managed_resource-004 | Error | List without agent_id | `harness_list(resource_type="gitops_managed_resource", app_name="my-app")` | Error: agent_id is required |
| TC-gitops_managed_resource-005 | Error | List without app_name | `harness_list(resource_type="gitops_managed_resource", agent_id="my_agent")` | Error: app_name is required |
| TC-gitops_managed_resource-006 | Error | List for non-existent application | `harness_list(resource_type="gitops_managed_resource", agent_id="my_agent", app_name="nonexistent")` | Error: application not found (404) |
| TC-gitops_managed_resource-007 | Error | Attempt get operation (unsupported) | `harness_get(resource_type="gitops_managed_resource", agent_id="my_agent", app_name="my-app")` | Error: get operation not supported |
| TC-gitops_managed_resource-008 | Edge | List for app with no managed resources | `harness_list(resource_type="gitops_managed_resource", agent_id="my_agent", app_name="empty-app")` | Returns empty list |
| TC-gitops_managed_resource-009 | Edge | Verify deep link in response | `harness_list(resource_type="gitops_managed_resource", agent_id="my_agent", app_name="my-app")` | Response may include deep link URL |

## Notes
- Only supports list operation; no get operation
- Project-scoped resource; requires org_id and project_id (defaults from config)
- Requires both `agent_id` and `app_name` as parent identifiers
- No list filter fields; no pagination params
- Deep link format: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}`
- API path: GET `/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/managed-resources`
