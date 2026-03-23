# Test Plan: GitOps Repository Credential (`gitops_repo_credential`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_repo_credential` |
| **Display Name** | GitOps Repository Credential |
| **Toolset** | gitops |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | agent_id, credential_id |
| **Filter Fields** | None |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-gitops_repo_credential-001 | List | List repo credentials for an agent | `harness_list(resource_type="gitops_repo_credential", agent_id="my_agent")` | Returns list of repository credentials |
| TC-gitops_repo_credential-002 | List | List with custom org/project | `harness_list(resource_type="gitops_repo_credential", agent_id="my_agent", org_id="my_org", project_id="my_project")` | Returns credentials for specified project |
| TC-gitops_repo_credential-003 | Get | Get credential by agent_id and credential_id | `harness_get(resource_type="gitops_repo_credential", agent_id="my_agent", credential_id="my_cred")` | Returns credential details (metadata only, no secrets) |
| TC-gitops_repo_credential-004 | Get | Verify no secret values exposed | `harness_get(resource_type="gitops_repo_credential", agent_id="my_agent", credential_id="my_cred")` | Response does not contain plaintext secrets |
| TC-gitops_repo_credential-005 | Error | List without agent_id | `harness_list(resource_type="gitops_repo_credential")` | Error: agent_id is required |
| TC-gitops_repo_credential-006 | Error | Get with missing agent_id | `harness_get(resource_type="gitops_repo_credential", credential_id="my_cred")` | Error: agent_id is required |
| TC-gitops_repo_credential-007 | Error | Get with missing credential_id | `harness_get(resource_type="gitops_repo_credential", agent_id="my_agent")` | Error: credential_id is required |
| TC-gitops_repo_credential-008 | Error | Get non-existent credential | `harness_get(resource_type="gitops_repo_credential", agent_id="my_agent", credential_id="nonexistent")` | Error: credential not found (404) |
| TC-gitops_repo_credential-009 | Edge | List for agent with no credentials | `harness_list(resource_type="gitops_repo_credential", agent_id="empty_agent")` | Returns empty list |
| TC-gitops_repo_credential-010 | Edge | Get credential with URL-style ID | `harness_get(resource_type="gitops_repo_credential", agent_id="my_agent", credential_id="https://github.com")` | Returns credential or handles URL encoding |

## Notes
- Project-scoped resource; requires org_id and project_id (defaults from config)
- Requires `agent_id` as parent identifier for all operations
- No list filter fields; no pagination params
- No deep link template defined
- API paths: GET `/gitops/api/v1/agents/{agentIdentifier}/repocreds` (list), GET `/gitops/api/v1/agents/{agentIdentifier}/repocreds/{credentialId}` (get)
- Credentials should never expose secret values in responses
