# Test Report: GitOps Agent (`gitops_agent`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_agent` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-gitops_agent-001 | List all GitOps agents with defaults | `harness_list(resource_type="gitops_agent")` | Returns paginated list of GitOps agents | ✅ Passed | Returns empty list in AI_Devops/Sanity; 212 agents on default/gitops2 |  |
| TC-gitops_agent-002 | List with pagination | `harness_list(resource_type="gitops_agent", page=1, size=5)` | Returns second page with 5 agents | ⬜ Pending | | |
| TC-gitops_agent-003 | Filter by search_term | `harness_list(resource_type="gitops_agent", search_term="my-agent")` | Returns agents matching search term | ⬜ Pending | | |
| TC-gitops_agent-004 | Filter by type=MANAGED_ARGO_PROVIDER | `harness_list(resource_type="gitops_agent", type="MANAGED_ARGO_PROVIDER")` | Returns only managed Argo agents | ⬜ Pending | | |
| TC-gitops_agent-005 | Filter by type=HOSTED_ARGO_PROVIDER | `harness_list(resource_type="gitops_agent", type="HOSTED_ARGO_PROVIDER")` | Returns only hosted Argo agents | ⬜ Pending | | |
| TC-gitops_agent-006 | Filter by search_term and type | `harness_list(resource_type="gitops_agent", search_term="prod", type="MANAGED_ARGO_PROVIDER")` | Returns managed agents matching "prod" | ⬜ Pending | | |
| TC-gitops_agent-007 | List with custom org/project | `harness_list(resource_type="gitops_agent", org_id="my_org", project_id="my_project")` | Returns agents for specified project | ⬜ Pending | | |
| TC-gitops_agent-008 | Get agent by ID | `harness_get(resource_type="gitops_agent", agent_id="my_agent")` | Returns full agent details | ⬜ Pending | | |
| TC-gitops_agent-009 | Verify deep link in response | `harness_get(resource_type="gitops_agent", agent_id="my_agent")` | Response includes deep link URL | ⬜ Pending | | |
| TC-gitops_agent-010 | Get with missing agent_id | `harness_get(resource_type="gitops_agent")` | Error: agent_id is required | ⬜ Pending | | |
| TC-gitops_agent-011 | Get non-existent agent | `harness_get(resource_type="gitops_agent", agent_id="nonexistent")` | Error: agent not found (404) | ⬜ Pending | | |
| TC-gitops_agent-012 | List with invalid type enum | `harness_list(resource_type="gitops_agent", type="INVALID_TYPE")` | Error: invalid type value | ⬜ Pending | | |
| TC-gitops_agent-013 | List with page beyond data | `harness_list(resource_type="gitops_agent", page=9999)` | Returns empty list | ⬜ Pending | | |
| TC-gitops_agent-014 | List with size=1 | `harness_list(resource_type="gitops_agent", size=1)` | Returns exactly 1 agent | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 14 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 13 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
