# Test Plan: GitOps Repository (`gitops_repository`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_repository` |
| **Display Name** | GitOps Repository |
| **Toolset** | gitops |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | agent_id, repo_id |
| **Filter Fields** | None |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-gitops_repository-001 | List | List repositories for an agent | `harness_list(resource_type="gitops_repository", agent_id="my_agent")` | Returns list of Git repositories |
| TC-gitops_repository-002 | List | List with custom org/project | `harness_list(resource_type="gitops_repository", agent_id="my_agent", org_id="my_org", project_id="my_project")` | Returns repositories for specified project |
| TC-gitops_repository-003 | Get | Get repository by agent_id and repo_id | `harness_get(resource_type="gitops_repository", agent_id="my_agent", repo_id="my_repo")` | Returns full repository details |
| TC-gitops_repository-004 | Get | Verify response structure | `harness_get(resource_type="gitops_repository", agent_id="my_agent", repo_id="my_repo")` | Response contains repo URL and connection details |
| TC-gitops_repository-005 | Error | List without agent_id | `harness_list(resource_type="gitops_repository")` | Error: agent_id is required |
| TC-gitops_repository-006 | Error | Get with missing agent_id | `harness_get(resource_type="gitops_repository", repo_id="my_repo")` | Error: agent_id is required |
| TC-gitops_repository-007 | Error | Get with missing repo_id | `harness_get(resource_type="gitops_repository", agent_id="my_agent")` | Error: repo_id is required |
| TC-gitops_repository-008 | Error | Get non-existent repository | `harness_get(resource_type="gitops_repository", agent_id="my_agent", repo_id="nonexistent")` | Error: repository not found (404) |
| TC-gitops_repository-009 | Edge | List for agent with no repos | `harness_list(resource_type="gitops_repository", agent_id="empty_agent")` | Returns empty list |
| TC-gitops_repository-010 | Edge | Get repo with URL-style ID | `harness_get(resource_type="gitops_repository", agent_id="my_agent", repo_id="https://github.com/org/repo.git")` | Returns repository or handles URL encoding |

## Notes
- Project-scoped resource; requires org_id and project_id (defaults from config)
- Requires `agent_id` as parent identifier for all operations
- No list filter fields; no pagination params
- No deep link template defined
- API paths: GET `/gitops/api/v1/agents/{agentIdentifier}/repositories` (list), GET `/gitops/api/v1/agents/{agentIdentifier}/repositories/{repoIdentifier}` (get)
