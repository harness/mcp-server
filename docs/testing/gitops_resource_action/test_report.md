# Test Report: GitOps Resource Action (`gitops_resource_action`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_resource_action` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-gitops_resource_action-001 | List resource actions for an application | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app")` | Returns list of available resource actions | ✅ Passed | API responds correctly; requires connected agent for data | Needs connected agent |
| TC-gitops_resource_action-002 | Filter by namespace | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app", namespace="production")` | Returns actions for resources in specified namespace | ⬜ Pending | | |
| TC-gitops_resource_action-003 | Filter by resource_name | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app", resource_name="my-deployment")` | Returns actions for specified resource | ⬜ Pending | | |
| TC-gitops_resource_action-004 | Filter by kind | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app", kind="Deployment")` | Returns actions for Deployment resources | ⬜ Pending | | |
| TC-gitops_resource_action-005 | Filter by all fields combined | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app", namespace="default", resource_name="my-deploy", kind="Deployment")` | Returns actions matching all filters | ⬜ Pending | | |
| TC-gitops_resource_action-006 | List with custom org/project | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app", org_id="my_org", project_id="my_project")` | Returns actions for specified project | ⬜ Pending | | |
| TC-gitops_resource_action-007 | List without agent_id | `harness_list(resource_type="gitops_resource_action", app_name="my-app")` | Error: agent_id is required | ⬜ Pending | | |
| TC-gitops_resource_action-008 | List without app_name | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent")` | Error: app_name is required | ⬜ Pending | | |
| TC-gitops_resource_action-009 | List for non-existent application | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="nonexistent")` | Error: application not found (404) | ⬜ Pending | | |
| TC-gitops_resource_action-010 | Attempt get operation (unsupported) | `harness_get(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app")` | Error: get operation not supported | ⬜ Pending | | |
| TC-gitops_resource_action-011 | List with no matching resources | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app", kind="NonexistentKind")` | Returns empty list | ⬜ Pending | | |
| TC-gitops_resource_action-012 | Verify deep link in response | `harness_list(resource_type="gitops_resource_action", agent_id="my_agent", app_name="my-app")` | Response may include deep link URL | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 12 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 11 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
