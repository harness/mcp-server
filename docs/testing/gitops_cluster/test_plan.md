# Test Plan: GitOps Cluster (`gitops_cluster`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_cluster` |
| **Display Name** | GitOps Cluster |
| **Toolset** | gitops |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | agent_id, cluster_id |
| **Filter Fields** | None |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-gitops_cluster-001 | List | List clusters for an agent | `harness_list(resource_type="gitops_cluster", agent_id="my_agent")` | Returns list of Kubernetes clusters |
| TC-gitops_cluster-002 | List | List with custom org/project | `harness_list(resource_type="gitops_cluster", agent_id="my_agent", org_id="my_org", project_id="my_project")` | Returns clusters for specified project |
| TC-gitops_cluster-003 | Get | Get cluster by agent_id and cluster_id | `harness_get(resource_type="gitops_cluster", agent_id="my_agent", cluster_id="my_cluster")` | Returns full cluster details |
| TC-gitops_cluster-004 | Get | Verify deep link in response | `harness_get(resource_type="gitops_cluster", agent_id="my_agent", cluster_id="my_cluster")` | Response includes deep link URL |
| TC-gitops_cluster-005 | Error | List without agent_id | `harness_list(resource_type="gitops_cluster")` | Error: agent_id is required |
| TC-gitops_cluster-006 | Error | Get with missing agent_id | `harness_get(resource_type="gitops_cluster", cluster_id="my_cluster")` | Error: agent_id is required |
| TC-gitops_cluster-007 | Error | Get with missing cluster_id | `harness_get(resource_type="gitops_cluster", agent_id="my_agent")` | Error: cluster_id is required |
| TC-gitops_cluster-008 | Error | Get non-existent cluster | `harness_get(resource_type="gitops_cluster", agent_id="my_agent", cluster_id="nonexistent")` | Error: cluster not found (404) |
| TC-gitops_cluster-009 | Edge | List for agent with no clusters | `harness_list(resource_type="gitops_cluster", agent_id="empty_agent")` | Returns empty list |
| TC-gitops_cluster-010 | Edge | Get cluster with URL-encoded ID | `harness_get(resource_type="gitops_cluster", agent_id="my_agent", cluster_id="https://kubernetes.default.svc")` | Returns in-cluster details |

## Notes
- Project-scoped resource; requires org_id and project_id (defaults from config)
- Requires `agent_id` as parent identifier for all operations
- No list filter fields; no pagination params for list
- API paths: GET `/gitops/api/v1/agents/{agentIdentifier}/clusters` (list), GET `/gitops/api/v1/agents/{agentIdentifier}/clusters/{clusterIdentifier}` (get)
- Deep link format: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/clusters`
