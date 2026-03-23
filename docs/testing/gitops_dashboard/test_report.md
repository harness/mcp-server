# Test Report: GitOps Dashboard (`gitops_dashboard`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_dashboard` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-gitops_dashboard-001 | Get dashboard overview with defaults | `harness_get(resource_type="gitops_dashboard")` | Returns dashboard overview with summary metrics | ✅ Passed | Returns dashboard with app/cluster/repo counts (get only) |  |
| TC-gitops_dashboard-002 | Get dashboard with custom org/project | `harness_get(resource_type="gitops_dashboard", org_id="my_org", project_id="my_project")` | Returns dashboard for specified project | ⬜ Pending | | |
| TC-gitops_dashboard-003 | Verify response includes summary metrics | `harness_get(resource_type="gitops_dashboard")` | Response contains application counts, health status, sync status | ⬜ Pending | | |
| TC-gitops_dashboard-004 | Verify deep link in response | `harness_get(resource_type="gitops_dashboard")` | Response includes deep link URL | ⬜ Pending | | |
| TC-gitops_dashboard-005 | Attempt list operation (unsupported) | `harness_list(resource_type="gitops_dashboard")` | Error: list operation not supported | ⬜ Pending | | |
| TC-gitops_dashboard-006 | Get with non-existent org | `harness_get(resource_type="gitops_dashboard", org_id="nonexistent_org")` | Error or empty dashboard | ⬜ Pending | | |
| TC-gitops_dashboard-007 | Get with non-existent project | `harness_get(resource_type="gitops_dashboard", org_id="my_org", project_id="nonexistent_project")` | Error or empty dashboard | ⬜ Pending | | |
| TC-gitops_dashboard-008 | Verify dashboard for project with no GitOps apps | `harness_get(resource_type="gitops_dashboard")` | Returns dashboard with zero counts | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 8 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 7 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
