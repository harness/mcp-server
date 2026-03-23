# Test Plan: GitOps Dashboard (`gitops_dashboard`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_dashboard` |
| **Display Name** | GitOps Dashboard |
| **Toolset** | gitops |
| **Scope** | project |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | (none) |
| **Filter Fields** | None |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-gitops_dashboard-001 | Get | Get dashboard overview with defaults | `harness_get(resource_type="gitops_dashboard")` | Returns dashboard overview with summary metrics |
| TC-gitops_dashboard-002 | Get | Get dashboard with custom org/project | `harness_get(resource_type="gitops_dashboard", org_id="my_org", project_id="my_project")` | Returns dashboard for specified project |
| TC-gitops_dashboard-003 | Get | Verify response includes summary metrics | `harness_get(resource_type="gitops_dashboard")` | Response contains application counts, health status, sync status |
| TC-gitops_dashboard-004 | Get | Verify deep link in response | `harness_get(resource_type="gitops_dashboard")` | Response includes deep link URL |
| TC-gitops_dashboard-005 | Error | Attempt list operation (unsupported) | `harness_list(resource_type="gitops_dashboard")` | Error: list operation not supported |
| TC-gitops_dashboard-006 | Scope | Get with non-existent org | `harness_get(resource_type="gitops_dashboard", org_id="nonexistent_org")` | Error or empty dashboard |
| TC-gitops_dashboard-007 | Scope | Get with non-existent project | `harness_get(resource_type="gitops_dashboard", org_id="my_org", project_id="nonexistent_project")` | Error or empty dashboard |
| TC-gitops_dashboard-008 | Edge | Verify dashboard for project with no GitOps apps | `harness_get(resource_type="gitops_dashboard")` | Returns dashboard with zero counts |

## Notes
- Only supports get operation; no list operation
- Project-scoped resource; requires org_id and project_id (defaults from config)
- No identifier fields required — returns project-wide dashboard overview
- Deep link format: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops`
- API path: GET `/gitops/api/v1/dashboard/overview`
