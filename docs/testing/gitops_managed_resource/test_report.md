# Test Report: GitOps Managed Resource (`gitops_managed_resource`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_managed_resource` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-gitops_managed_resource-001 | List managed resources for an application | `harness_list(resource_type="gitops_managed_resource", agent_id="my_agent", app_name="my-app")` | Returns list of managed Kubernetes resources | ✅ Passed | API responds correctly; requires connected agent for data | Needs connected agent |
| TC-gitops_managed_resource-002 | List with custom org/project | `harness_list(resource_type="gitops_managed_resource", agent_id="my_agent", app_name="my-app", org_id="my_org", project_id="my_project")` | Returns managed resources for specified project | ⬜ Pending | | |
| TC-gitops_managed_resource-003 | Verify response structure | `harness_list(resource_type="gitops_managed_resource", agent_id="my_agent", app_name="my-app")` | Response contains K8s resource objects with kind, name, namespace | ⬜ Pending | | |
| TC-gitops_managed_resource-004 | List without agent_id | `harness_list(resource_type="gitops_managed_resource", app_name="my-app")` | Error: agent_id is required | ⬜ Pending | | |
| TC-gitops_managed_resource-005 | List without app_name | `harness_list(resource_type="gitops_managed_resource", agent_id="my_agent")` | Error: app_name is required | ⬜ Pending | | |
| TC-gitops_managed_resource-006 | List for non-existent application | `harness_list(resource_type="gitops_managed_resource", agent_id="my_agent", app_name="nonexistent")` | Error: application not found (404) | ⬜ Pending | | |
| TC-gitops_managed_resource-007 | Attempt get operation (unsupported) | `harness_get(resource_type="gitops_managed_resource", agent_id="my_agent", app_name="my-app")` | Error: get operation not supported | ⬜ Pending | | |
| TC-gitops_managed_resource-008 | List for app with no managed resources | `harness_list(resource_type="gitops_managed_resource", agent_id="my_agent", app_name="empty-app")` | Returns empty list | ⬜ Pending | | |
| TC-gitops_managed_resource-009 | Verify deep link in response | `harness_list(resource_type="gitops_managed_resource", agent_id="my_agent", app_name="my-app")` | Response may include deep link URL | ⬜ Pending | | |

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
