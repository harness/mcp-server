# Test Plan: GitOps ApplicationSet (`gitops_applicationset`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_applicationset` |
| **Display Name** | GitOps ApplicationSet |
| **Toolset** | gitops |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | agent_id, appset_name |
| **Filter Fields** | None |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-gitops_applicationset-001 | List | List ApplicationSets for an agent | `harness_list(resource_type="gitops_applicationset", agent_id="my_agent")` | Returns list of ApplicationSets |
| TC-gitops_applicationset-002 | List | List with custom org/project | `harness_list(resource_type="gitops_applicationset", agent_id="my_agent", org_id="my_org", project_id="my_project")` | Returns ApplicationSets for specified project |
| TC-gitops_applicationset-003 | Get | Get ApplicationSet by agent_id and appset_name | `harness_get(resource_type="gitops_applicationset", agent_id="my_agent", appset_name="my-appset")` | Returns full ApplicationSet details |
| TC-gitops_applicationset-004 | Get | Verify response includes template spec | `harness_get(resource_type="gitops_applicationset", agent_id="my_agent", appset_name="my-appset")` | Response contains generators and template fields |
| TC-gitops_applicationset-005 | Error | List without agent_id | `harness_list(resource_type="gitops_applicationset")` | Error: agent_id is required |
| TC-gitops_applicationset-006 | Error | Get with missing agent_id | `harness_get(resource_type="gitops_applicationset", appset_name="my-appset")` | Error: agent_id is required |
| TC-gitops_applicationset-007 | Error | Get with missing appset_name | `harness_get(resource_type="gitops_applicationset", agent_id="my_agent")` | Error: appset_name is required |
| TC-gitops_applicationset-008 | Error | Get non-existent ApplicationSet | `harness_get(resource_type="gitops_applicationset", agent_id="my_agent", appset_name="nonexistent")` | Error: ApplicationSet not found (404) |
| TC-gitops_applicationset-009 | Edge | List for agent with no ApplicationSets | `harness_list(resource_type="gitops_applicationset", agent_id="empty_agent")` | Returns empty list |
| TC-gitops_applicationset-010 | Edge | Get with special characters in name | `harness_get(resource_type="gitops_applicationset", agent_id="my_agent", appset_name="my-appset-v2")` | Returns ApplicationSet details |

## Notes
- Project-scoped resource; requires org_id and project_id (defaults from config)
- Requires `agent_id` as parent identifier for all operations
- Used for templated application generation across multiple clusters or environments
- No list filter fields; no pagination params
- No deep link template defined
- API paths: GET `/gitops/api/v1/agents/{agentIdentifier}/applicationsets` (list), GET `/gitops/api/v1/agents/{agentIdentifier}/applicationsets/{appsetName}` (get)
