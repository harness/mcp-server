# Test Plan: GitOps Application (`gitops_application`)

| Field | Value |
|-------|-------|
| **Resource Type** | `gitops_application` |
| **Display Name** | GitOps Application |
| **Toolset** | gitops |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | sync |
| **Identifier Fields** | agent_id, app_name |
| **Filter Fields** | search_term |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-gitops_application-001 | List | List applications for an agent | `harness_list(resource_type="gitops_application", agent_id="my_agent")` | Returns paginated list of GitOps applications |
| TC-gitops_application-002 | List | List with pagination | `harness_list(resource_type="gitops_application", agent_id="my_agent", page=1, size=5)` | Returns second page with 5 applications |
| TC-gitops_application-003 | List | Filter by search_term | `harness_list(resource_type="gitops_application", agent_id="my_agent", search_term="frontend")` | Returns applications matching "frontend" |
| TC-gitops_application-004 | List | List with custom org/project | `harness_list(resource_type="gitops_application", agent_id="my_agent", org_id="my_org", project_id="my_project")` | Returns applications for specified project |
| TC-gitops_application-005 | Get | Get application by agent_id and app_name | `harness_get(resource_type="gitops_application", agent_id="my_agent", app_name="my-app")` | Returns full application details |
| TC-gitops_application-006 | Get | Verify deep link in response | `harness_get(resource_type="gitops_application", agent_id="my_agent", app_name="my-app")` | Response includes deep link URL |
| TC-gitops_application-007 | Execute | Sync application | `harness_execute(resource_type="gitops_application", action="sync", agent_id="my_agent", app_name="my-app")` | Triggers sync and returns result |
| TC-gitops_application-008 | Execute | Sync with prune option | `harness_execute(resource_type="gitops_application", action="sync", agent_id="my_agent", app_name="my-app", body={"prune": true})` | Triggers sync with pruning enabled |
| TC-gitops_application-009 | Execute | Sync with dry run | `harness_execute(resource_type="gitops_application", action="sync", agent_id="my_agent", app_name="my-app", body={"dryRun": true})` | Simulates sync without executing |
| TC-gitops_application-010 | Execute | Sync to specific revision | `harness_execute(resource_type="gitops_application", action="sync", agent_id="my_agent", app_name="my-app", body={"revision": "abc123"})` | Syncs to specified revision |
| TC-gitops_application-011 | Execute | Sync with all options | `harness_execute(resource_type="gitops_application", action="sync", agent_id="my_agent", app_name="my-app", body={"prune": true, "dryRun": false, "revision": "main"})` | Syncs with all options specified |
| TC-gitops_application-012 | Error | List without agent_id | `harness_list(resource_type="gitops_application")` | Error: agent_id is required |
| TC-gitops_application-013 | Error | Get with missing agent_id | `harness_get(resource_type="gitops_application", app_name="my-app")` | Error: agent_id is required |
| TC-gitops_application-014 | Error | Get with missing app_name | `harness_get(resource_type="gitops_application", agent_id="my_agent")` | Error: app_name is required |
| TC-gitops_application-015 | Error | Get non-existent application | `harness_get(resource_type="gitops_application", agent_id="my_agent", app_name="nonexistent")` | Error: application not found (404) |
| TC-gitops_application-016 | Error | Sync non-existent application | `harness_execute(resource_type="gitops_application", action="sync", agent_id="my_agent", app_name="nonexistent")` | Error: application not found (404) |
| TC-gitops_application-017 | Edge | List with page beyond data | `harness_list(resource_type="gitops_application", agent_id="my_agent", page=9999)` | Returns empty list |

## Notes
- Project-scoped resource; requires org_id and project_id (defaults from config)
- Requires `agent_id` as parent identifier for all operations
- Sync action body schema: prune (optional bool), dryRun (optional bool), revision (optional string)
- Supports `harness_diagnose` for analyzing sync failures, health issues, and unhealthy K8s resources
- Deep link format: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}`
