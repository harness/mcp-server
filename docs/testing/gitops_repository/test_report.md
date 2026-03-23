# Test Report: GitOps Repository (`gitops_repository`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_repository` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-gitops_repository-001 | List repositories for an agent | `harness_list(resource_type="gitops_repository", agent_id="my_agent")` | Returns list of Git repositories | ✅ Passed | Returns empty list in AI_Devops/Sanity; 101 repos on default/gitops2 |  |
| TC-gitops_repository-002 | List with custom org/project | `harness_list(resource_type="gitops_repository", agent_id="my_agent", org_id="my_org", project_id="my_project")` | Returns repositories for specified project | ⬜ Pending | | |
| TC-gitops_repository-003 | Get repository by agent_id and repo_id | `harness_get(resource_type="gitops_repository", agent_id="my_agent", repo_id="my_repo")` | Returns full repository details | ⬜ Pending | | |
| TC-gitops_repository-004 | Verify response structure | `harness_get(resource_type="gitops_repository", agent_id="my_agent", repo_id="my_repo")` | Response contains repo URL and connection details | ⬜ Pending | | |
| TC-gitops_repository-005 | List without agent_id | `harness_list(resource_type="gitops_repository")` | Error: agent_id is required | ⬜ Pending | | |
| TC-gitops_repository-006 | Get with missing agent_id | `harness_get(resource_type="gitops_repository", repo_id="my_repo")` | Error: agent_id is required | ⬜ Pending | | |
| TC-gitops_repository-007 | Get with missing repo_id | `harness_get(resource_type="gitops_repository", agent_id="my_agent")` | Error: repo_id is required | ⬜ Pending | | |
| TC-gitops_repository-008 | Get non-existent repository | `harness_get(resource_type="gitops_repository", agent_id="my_agent", repo_id="nonexistent")` | Error: repository not found (404) | ⬜ Pending | | |
| TC-gitops_repository-009 | List for agent with no repos | `harness_list(resource_type="gitops_repository", agent_id="empty_agent")` | Returns empty list | ⬜ Pending | | |
| TC-gitops_repository-010 | Get repo with URL-style ID | `harness_get(resource_type="gitops_repository", agent_id="my_agent", repo_id="https://github.com/org/repo.git")` | Returns repository or handles URL encoding | ⬜ Pending | | |

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
