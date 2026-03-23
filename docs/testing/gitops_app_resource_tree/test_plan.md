# Test Plan: GitOps App Resource Tree (`gitops_app_resource_tree`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_app_resource_tree` |
| **Display Name** | GitOps App Resource Tree |
| **Toolset** | gitops |
| **Scope** | project |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | agent_id, app_name |
| **Filter Fields** | None |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-gitops_app_resource_tree-001 | Get | Get resource tree for an application | `harness_get(resource_type="gitops_app_resource_tree", agent_id="my_agent", app_name="my-app")` | Returns Kubernetes resource tree |
| TC-gitops_app_resource_tree-002 | Get | Verify tree structure | `harness_get(resource_type="gitops_app_resource_tree", agent_id="my_agent", app_name="my-app")` | Response contains nodes with kind, name, namespace, health, status |
| TC-gitops_app_resource_tree-003 | Get | Get resource tree with custom org/project | `harness_get(resource_type="gitops_app_resource_tree", agent_id="my_agent", app_name="my-app", org_id="my_org", project_id="my_project")` | Returns resource tree for specified project |
| TC-gitops_app_resource_tree-004 | Get | Verify parent-child relationships | `harness_get(resource_type="gitops_app_resource_tree", agent_id="my_agent", app_name="my-app")` | Response shows resource hierarchy (Deployment → ReplicaSet → Pod) |
| TC-gitops_app_resource_tree-005 | Error | Get without agent_id | `harness_get(resource_type="gitops_app_resource_tree", app_name="my-app")` | Error: agent_id is required |
| TC-gitops_app_resource_tree-006 | Error | Get without app_name | `harness_get(resource_type="gitops_app_resource_tree", agent_id="my_agent")` | Error: app_name is required |
| TC-gitops_app_resource_tree-007 | Error | Get for non-existent application | `harness_get(resource_type="gitops_app_resource_tree", agent_id="my_agent", app_name="nonexistent")` | Error: application not found (404) |
| TC-gitops_app_resource_tree-008 | Error | Attempt list operation (unsupported) | `harness_list(resource_type="gitops_app_resource_tree")` | Error: list operation not supported |
| TC-gitops_app_resource_tree-009 | Edge | Get tree for app with single resource | `harness_get(resource_type="gitops_app_resource_tree", agent_id="my_agent", app_name="simple-app")` | Returns tree with minimal nodes |
| TC-gitops_app_resource_tree-010 | Edge | Get tree for app with unhealthy resources | `harness_get(resource_type="gitops_app_resource_tree", agent_id="my_agent", app_name="unhealthy-app")` | Returns tree with degraded/unhealthy health statuses |

## Notes
- Only supports get operation; no list operation
- Project-scoped resource; requires org_id and project_id (defaults from config)
- Requires both `agent_id` and `app_name` as parent identifiers
- No deep link template defined
- API path: GET `/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/resource-tree`
- Returns hierarchical Kubernetes resource tree showing relationships between resources
