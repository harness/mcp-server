# Test Report: GitOps Application (`gitops_application`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_application` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-gitops_application-001 | List applications for an agent | `harness_list(resource_type="gitops_application", agent_id="my_agent")` | Returns paginated list of GitOps applications | ✅ Passed | Returns empty list in AI_Devops/Sanity; 69 apps on default/gitops2 |  |
| TC-gitops_application-002 | List with pagination | `harness_list(resource_type="gitops_application", agent_id="my_agent", page=1, size=5)` | Returns second page with 5 applications | ⬜ Pending | | |
| TC-gitops_application-003 | Filter by search_term | `harness_list(resource_type="gitops_application", agent_id="my_agent", search_term="frontend")` | Returns applications matching "frontend" | ⬜ Pending | | |
| TC-gitops_application-004 | List with custom org/project | `harness_list(resource_type="gitops_application", agent_id="my_agent", org_id="my_org", project_id="my_project")` | Returns applications for specified project | ⬜ Pending | | |
| TC-gitops_application-005 | Get application by agent_id and app_name | `harness_get(resource_type="gitops_application", agent_id="my_agent", app_name="my-app")` | Returns full application details | ⬜ Pending | | |
| TC-gitops_application-006 | Verify deep link in response | `harness_get(resource_type="gitops_application", agent_id="my_agent", app_name="my-app")` | Response includes deep link URL | ⬜ Pending | | |
| TC-gitops_application-007 | Sync application | `harness_execute(resource_type="gitops_application", action="sync", agent_id="my_agent", app_name="my-app")` | Triggers sync and returns result | ⬜ Pending | | |
| TC-gitops_application-008 | Sync with prune option | `harness_execute(resource_type="gitops_application", action="sync", agent_id="my_agent", app_name="my-app", body={"prune": true})` | Triggers sync with pruning enabled | ⬜ Pending | | |
| TC-gitops_application-009 | Sync with dry run | `harness_execute(resource_type="gitops_application", action="sync", agent_id="my_agent", app_name="my-app", body={"dryRun": true})` | Simulates sync without executing | ⬜ Pending | | |
| TC-gitops_application-010 | Sync to specific revision | `harness_execute(resource_type="gitops_application", action="sync", agent_id="my_agent", app_name="my-app", body={"revision": "abc123"})` | Syncs to specified revision | ⬜ Pending | | |
| TC-gitops_application-011 | Sync with all options | `harness_execute(resource_type="gitops_application", action="sync", agent_id="my_agent", app_name="my-app", body={"prune": true, "dryRun": false, "revision": "main"})` | Syncs with all options specified | ⬜ Pending | | |
| TC-gitops_application-012 | List without agent_id | `harness_list(resource_type="gitops_application")` | Error: agent_id is required | ⬜ Pending | | |
| TC-gitops_application-013 | Get with missing agent_id | `harness_get(resource_type="gitops_application", app_name="my-app")` | Error: agent_id is required | ⬜ Pending | | |
| TC-gitops_application-014 | Get with missing app_name | `harness_get(resource_type="gitops_application", agent_id="my_agent")` | Error: app_name is required | ⬜ Pending | | |
| TC-gitops_application-015 | Get non-existent application | `harness_get(resource_type="gitops_application", agent_id="my_agent", app_name="nonexistent")` | Error: application not found (404) | ⬜ Pending | | |
| TC-gitops_application-016 | Sync non-existent application | `harness_execute(resource_type="gitops_application", action="sync", agent_id="my_agent", app_name="nonexistent")` | Error: application not found (404) | ⬜ Pending | | |
| TC-gitops_application-017 | List with page beyond data | `harness_list(resource_type="gitops_application", agent_id="my_agent", page=9999)` | Returns empty list | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 17 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 16 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
