# Test Plan: GitOps Agent (`gitops_agent`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_agent` |
| **Display Name** | GitOps Agent |
| **Toolset** | gitops |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | agent_id |
| **Filter Fields** | search_term, type |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-gitops_agent-001 | List | List all GitOps agents with defaults | `harness_list(resource_type="gitops_agent")` | Returns paginated list of GitOps agents |
| TC-gitops_agent-002 | List | List with pagination | `harness_list(resource_type="gitops_agent", page=1, size=5)` | Returns second page with 5 agents |
| TC-gitops_agent-003 | List | Filter by search_term | `harness_list(resource_type="gitops_agent", search_term="my-agent")` | Returns agents matching search term |
| TC-gitops_agent-004 | List | Filter by type=MANAGED_ARGO_PROVIDER | `harness_list(resource_type="gitops_agent", type="MANAGED_ARGO_PROVIDER")` | Returns only managed Argo agents |
| TC-gitops_agent-005 | List | Filter by type=HOSTED_ARGO_PROVIDER | `harness_list(resource_type="gitops_agent", type="HOSTED_ARGO_PROVIDER")` | Returns only hosted Argo agents |
| TC-gitops_agent-006 | List | Filter by search_term and type | `harness_list(resource_type="gitops_agent", search_term="prod", type="MANAGED_ARGO_PROVIDER")` | Returns managed agents matching "prod" |
| TC-gitops_agent-007 | List | List with custom org/project | `harness_list(resource_type="gitops_agent", org_id="my_org", project_id="my_project")` | Returns agents for specified project |
| TC-gitops_agent-008 | Get | Get agent by ID | `harness_get(resource_type="gitops_agent", agent_id="my_agent")` | Returns full agent details |
| TC-gitops_agent-009 | Get | Verify deep link in response | `harness_get(resource_type="gitops_agent", agent_id="my_agent")` | Response includes deep link URL |
| TC-gitops_agent-010 | Error | Get with missing agent_id | `harness_get(resource_type="gitops_agent")` | Error: agent_id is required |
| TC-gitops_agent-011 | Error | Get non-existent agent | `harness_get(resource_type="gitops_agent", agent_id="nonexistent")` | Error: agent not found (404) |
| TC-gitops_agent-012 | Error | List with invalid type enum | `harness_list(resource_type="gitops_agent", type="INVALID_TYPE")` | Error: invalid type value |
| TC-gitops_agent-013 | Edge | List with page beyond data | `harness_list(resource_type="gitops_agent", page=9999)` | Returns empty list |
| TC-gitops_agent-014 | Edge | List with size=1 | `harness_list(resource_type="gitops_agent", size=1)` | Returns exactly 1 agent |

## Notes
- Project-scoped resource; requires org_id and project_id (defaults from config)
- The `type` filter supports enum: MANAGED_ARGO_PROVIDER, HOSTED_ARGO_PROVIDER
- Deep link format: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/agents/{agentIdentifier}`
- API paths: GET `/gitops/api/v1/agents` (list), GET `/gitops/api/v1/agents/{agentIdentifier}` (get)
