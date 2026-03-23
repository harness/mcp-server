# Test Report: GitOps Repository Credential (`gitops_repo_credential`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_repo_credential` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-gitops_repo_credential-001 | List repo credentials for an agent | `harness_list(resource_type="gitops_repo_credential", agent_id="my_agent")` | Returns list of repository credentials | ✅ Passed | Returns empty list; API responds correctly |  |
| TC-gitops_repo_credential-002 | List with custom org/project | `harness_list(resource_type="gitops_repo_credential", agent_id="my_agent", org_id="my_org", project_id="my_project")` | Returns credentials for specified project | ⬜ Pending | | |
| TC-gitops_repo_credential-003 | Get credential by agent_id and credential_id | `harness_get(resource_type="gitops_repo_credential", agent_id="my_agent", credential_id="my_cred")` | Returns credential details (metadata only, no secrets) | ⬜ Pending | | |
| TC-gitops_repo_credential-004 | Verify no secret values exposed | `harness_get(resource_type="gitops_repo_credential", agent_id="my_agent", credential_id="my_cred")` | Response does not contain plaintext secrets | ⬜ Pending | | |
| TC-gitops_repo_credential-005 | List without agent_id | `harness_list(resource_type="gitops_repo_credential")` | Error: agent_id is required | ⬜ Pending | | |
| TC-gitops_repo_credential-006 | Get with missing agent_id | `harness_get(resource_type="gitops_repo_credential", credential_id="my_cred")` | Error: agent_id is required | ⬜ Pending | | |
| TC-gitops_repo_credential-007 | Get with missing credential_id | `harness_get(resource_type="gitops_repo_credential", agent_id="my_agent")` | Error: credential_id is required | ⬜ Pending | | |
| TC-gitops_repo_credential-008 | Get non-existent credential | `harness_get(resource_type="gitops_repo_credential", agent_id="my_agent", credential_id="nonexistent")` | Error: credential not found (404) | ⬜ Pending | | |
| TC-gitops_repo_credential-009 | List for agent with no credentials | `harness_list(resource_type="gitops_repo_credential", agent_id="empty_agent")` | Returns empty list | ⬜ Pending | | |
| TC-gitops_repo_credential-010 | Get credential with URL-style ID | `harness_get(resource_type="gitops_repo_credential", agent_id="my_agent", credential_id="https://github.com")` | Returns credential or handles URL encoding | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 10 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 9 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
