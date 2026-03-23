# Test Report: GitOps App Event (`gitops_app_event`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_app_event` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-gitops_app_event-001 | List events for an application | `harness_list(resource_type="gitops_app_event", agent_id="my_agent", app_name="my-app")` | Returns list of application events | ✅ Passed | API responds correctly; requires connected agent for data | Needs connected agent |
| TC-gitops_app_event-002 | List with custom org/project | `harness_list(resource_type="gitops_app_event", agent_id="my_agent", app_name="my-app", org_id="my_org", project_id="my_project")` | Returns events for specified project | ⬜ Pending | | |
| TC-gitops_app_event-003 | Verify event response structure | `harness_list(resource_type="gitops_app_event", agent_id="my_agent", app_name="my-app")` | Response contains event type, reason, message, timestamp | ⬜ Pending | | |
| TC-gitops_app_event-004 | List without agent_id | `harness_list(resource_type="gitops_app_event", app_name="my-app")` | Error: agent_id is required | ⬜ Pending | | |
| TC-gitops_app_event-005 | List without app_name | `harness_list(resource_type="gitops_app_event", agent_id="my_agent")` | Error: app_name is required | ⬜ Pending | | |
| TC-gitops_app_event-006 | List for non-existent application | `harness_list(resource_type="gitops_app_event", agent_id="my_agent", app_name="nonexistent")` | Error: application not found (404) | ⬜ Pending | | |
| TC-gitops_app_event-007 | Attempt get operation (unsupported) | `harness_get(resource_type="gitops_app_event", agent_id="my_agent", app_name="my-app")` | Error: get operation not supported | ⬜ Pending | | |
| TC-gitops_app_event-008 | List events for app with no events | `harness_list(resource_type="gitops_app_event", agent_id="my_agent", app_name="quiet-app")` | Returns empty list | ⬜ Pending | | |
| TC-gitops_app_event-009 | Verify deep link in response | `harness_list(resource_type="gitops_app_event", agent_id="my_agent", app_name="my-app")` | Response may include deep link URL | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 9 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 8 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
