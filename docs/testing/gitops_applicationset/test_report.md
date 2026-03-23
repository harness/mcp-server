# Test Report: GitOps ApplicationSet (`gitops_applicationset`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_applicationset` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-gitops_applicationset-001 | List ApplicationSets for an agent | `harness_list(resource_type="gitops_applicationset", agent_id="my_agent")` | Returns list of ApplicationSets | ✅ Passed | API responds correctly; requires agent_id filter | Requires agent_id filter |
| TC-gitops_applicationset-002 | List with custom org/project | `harness_list(resource_type="gitops_applicationset", agent_id="my_agent", org_id="my_org", project_id="my_project")` | Returns ApplicationSets for specified project | ⬜ Pending | | |
| TC-gitops_applicationset-003 | Get ApplicationSet by agent_id and appset_name | `harness_get(resource_type="gitops_applicationset", agent_id="my_agent", appset_name="my-appset")` | Returns full ApplicationSet details | ⬜ Pending | | |
| TC-gitops_applicationset-004 | Verify response includes template spec | `harness_get(resource_type="gitops_applicationset", agent_id="my_agent", appset_name="my-appset")` | Response contains generators and template fields | ⬜ Pending | | |
| TC-gitops_applicationset-005 | List without agent_id | `harness_list(resource_type="gitops_applicationset")` | Error: agent_id is required | ⬜ Pending | | |
| TC-gitops_applicationset-006 | Get with missing agent_id | `harness_get(resource_type="gitops_applicationset", appset_name="my-appset")` | Error: agent_id is required | ⬜ Pending | | |
| TC-gitops_applicationset-007 | Get with missing appset_name | `harness_get(resource_type="gitops_applicationset", agent_id="my_agent")` | Error: appset_name is required | ⬜ Pending | | |
| TC-gitops_applicationset-008 | Get non-existent ApplicationSet | `harness_get(resource_type="gitops_applicationset", agent_id="my_agent", appset_name="nonexistent")` | Error: ApplicationSet not found (404) | ⬜ Pending | | |
| TC-gitops_applicationset-009 | List for agent with no ApplicationSets | `harness_list(resource_type="gitops_applicationset", agent_id="empty_agent")` | Returns empty list | ⬜ Pending | | |
| TC-gitops_applicationset-010 | Get with special characters in name | `harness_get(resource_type="gitops_applicationset", agent_id="my_agent", appset_name="my-appset-v2")` | Returns ApplicationSet details | ⬜ Pending | | |

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
