# Test Plan: GitOps Resource Action (`gitops_resource_action`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_resource_action` |
| **Display Name** | GitOps Resource Action |
| **Toolset** | gitops |
| **Scope** | project |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | agent_id, app_name |
| **Filter Fields** | namespace, resource_name, kind |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-gitops_resource_action-001 | List | List resource actions for an application | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app")` | Returns list of available resource actions |
| TC-gitops_resource_action-002 | List | Filter by namespace | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app", namespace="production")` | Returns actions for resources in specified namespace |
| TC-gitops_resource_action-003 | List | Filter by resource_name | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app", resource_name="my-deployment")` | Returns actions for specified resource |
| TC-gitops_resource_action-004 | List | Filter by kind | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app", kind="Deployment")` | Returns actions for Deployment resources |
| TC-gitops_resource_action-005 | List | Filter by all fields combined | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app", namespace="default", resource_name="my-deploy", kind="Deployment")` | Returns actions matching all filters |
| TC-gitops_resource_action-006 | List | List with custom org/project | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app", org_id="my_org", project_id="my_project")` | Returns actions for specified project |
| TC-gitops_resource_action-007 | Error | List without agent_id | `harness_list(resource_type="gitops_resource_action", app_name="my-app")` | Error: agent_id is required |
| TC-gitops_resource_action-008 | Error | List without app_name | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent")` | Error: app_name is required |
| TC-gitops_resource_action-009 | Error | List for non-existent application | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="nonexistent")` | Error: application not found (404) |
| TC-gitops_resource_action-010 | Error | Attempt get operation (unsupported) | `harness_get(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app")` | Error: get operation not supported |
| TC-gitops_resource_action-011 | Edge | List with no matching resources | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app", kind="NonexistentKind")` | Returns empty list |
| TC-gitops_resource_action-012 | Edge | Verify deep link in response | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app")` | Response may include deep link URL |

## Notes
- Only supports list operation; no get operation
- Project-scoped resource; requires org_id and project_id (defaults from config)
- Requires both `agent_id` and `app_name` as parent identifiers
- Filter fields: namespace → namespace, resource_name → resourceName, kind → kind
- Deep link format: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}`
- API path: GET `/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/resource/actions`
