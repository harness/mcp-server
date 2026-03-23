# Test Report: GitOps App Resource Tree (`gitops_app_resource_tree`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_app_resource_tree` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-gitops_app_resource_tree-001 | Get resource tree for an application | `harness_get(resource_type="gitops_app_resource_tree", agent_id="my_agent", app_name="my-app")` | Returns Kubernetes resource tree | ✅ Passed | API responds correctly; get only, requires connected agent | Needs connected agent |
| TC-gitops_app_resource_tree-002 | Verify tree structure | `harness_get(resource_type="gitops_app_resource_tree", agent_id="my_agent", app_name="my-app")` | Response contains nodes with kind, name, namespace, health, status | ⬜ Pending | | |
| TC-gitops_app_resource_tree-003 | Get resource tree with custom org/project | `harness_get(resource_type="gitops_app_resource_tree", agent_id="my_agent", app_name="my-app", org_id="my_org", project_id="my_project")` | Returns resource tree for specified project | ⬜ Pending | | |
| TC-gitops_app_resource_tree-004 | Verify parent-child relationships | `harness_get(resource_type="gitops_app_resource_tree", agent_id="my_agent", app_name="my-app")` | Response shows resource hierarchy (Deployment → ReplicaSet → Pod) | ⬜ Pending | | |
| TC-gitops_app_resource_tree-005 | Get without agent_id | `harness_get(resource_type="gitops_app_resource_tree", app_name="my-app")` | Error: agent_id is required | ⬜ Pending | | |
| TC-gitops_app_resource_tree-006 | Get without app_name | `harness_get(resource_type="gitops_app_resource_tree", agent_id="my_agent")` | Error: app_name is required | ⬜ Pending | | |
| TC-gitops_app_resource_tree-007 | Get for non-existent application | `harness_get(resource_type="gitops_app_resource_tree", agent_id="my_agent", app_name="nonexistent")` | Error: application not found (404) | ⬜ Pending | | |
| TC-gitops_app_resource_tree-008 | Attempt list operation (unsupported) | `harness_list(resource_type="gitops_app_resource_tree")` | Error: list operation not supported | ⬜ Pending | | |
| TC-gitops_app_resource_tree-009 | Get tree for app with single resource | `harness_get(resource_type="gitops_app_resource_tree", agent_id="my_agent", app_name="simple-app")` | Returns tree with minimal nodes | ⬜ Pending | | |
| TC-gitops_app_resource_tree-010 | Get tree for app with unhealthy resources | `harness_get(resource_type="gitops_app_resource_tree", agent_id="my_agent", app_name="unhealthy-app")` | Returns tree with degraded/unhealthy health statuses | ⬜ Pending | | |

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
