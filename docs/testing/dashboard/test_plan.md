# Test Plan: Dashboard (`dashboard`)

| Field | Value |
|-------|-------|
| **Resource Type** | `dashboard` |
| **Display Name** | Dashboard |
| **Toolset** | dashboards |
| **Scope** | account |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | dashboard_id |
| **Filter Fields** | search_term, folder_id, tags |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-dash-001 | List | List all dashboards with defaults | `harness_list(resource_type="dashboard")` | Returns paginated list of dashboards |
| TC-dash-002 | List | List dashboards with pagination | `harness_list(resource_type="dashboard", page=1, size=5)` | Returns page 1 with up to 5 dashboards |
| TC-dash-003 | List | List dashboards filtered by search_term | `harness_list(resource_type="dashboard", filters={search_term: "deployment"})` | Returns dashboards matching "deployment" keyword |
| TC-dash-004 | List | List dashboards filtered by folder_id | `harness_list(resource_type="dashboard", filters={folder_id: "folder_123"})` | Returns dashboards in the specified folder |
| TC-dash-005 | List | List dashboards filtered by tags | `harness_list(resource_type="dashboard", filters={tags: "CD=true"})` | Returns dashboards with CD tag |
| TC-dash-006 | List | List dashboards with combined filters | `harness_list(resource_type="dashboard", filters={search_term: "build", folder_id: "ci_folder"}, page=0, size=10)` | Returns filtered dashboards with pagination |
| TC-dash-007 | List | List dashboards with multiple tag filters | `harness_list(resource_type="dashboard", filters={tags: "CD=true&CI=true"})` | Returns dashboards with both CD and CI tags |
| TC-dash-008 | Error | List dashboards with invalid folder_id | `harness_list(resource_type="dashboard", filters={folder_id: "nonexistent_folder"})` | Returns empty results or error |
| TC-dash-009 | Edge | List dashboards with empty results | `harness_list(resource_type="dashboard", filters={search_term: "zzz_nonexistent_zzz"})` | Returns empty items array |
| TC-dash-010 | Edge | List dashboards with max pagination | `harness_list(resource_type="dashboard", page=0, size=100)` | Returns up to 100 dashboards |
| TC-dash-011 | Edge | Verify default tags parameter | `harness_list(resource_type="dashboard")` | Request includes default tag filters for all modules |

## Notes
- Dashboard is an account-scoped resource — no org/project parameters
- Only supports `list` operation (use `dashboard_data` for fetching content)
- Default query params include tags for all Harness modules (HARNESS, CD, CE, CET, CF, CHAOS, CI, DBOPS, IACM, IDP, SSCA, STO, SRM)
- Default page is 1 (not 0) for the dashboard API
- Tags filter uses URL-encoded format: `key=value&key2=value2`
- Uses GET `/dashboard/v1/search` endpoint
