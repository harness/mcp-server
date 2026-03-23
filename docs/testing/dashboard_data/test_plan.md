# Test Plan: Dashboard Data (`dashboard_data`)

| Field | Value |
|-------|-------|
| **Resource Type** | `dashboard_data` |
| **Display Name** | Dashboard Data |
| **Toolset** | dashboards |
| **Scope** | account |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | dashboard_id |
| **Filter Fields** | reporting_timeframe |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-ddat-001 | Get | Get dashboard data with default timeframe | `harness_get(resource_type="dashboard_data", resource_id="dash_123")` | Returns dashboard data as structured tables (default 30 days) |
| TC-ddat-002 | Get | Get dashboard data with custom timeframe | `harness_get(resource_type="dashboard_data", resource_id="dash_123", params={reporting_timeframe: 7})` | Returns dashboard data for the last 7 days |
| TC-ddat-003 | Get | Get dashboard data with 90-day timeframe | `harness_get(resource_type="dashboard_data", resource_id="dash_123", params={reporting_timeframe: 90})` | Returns dashboard data for the last 90 days |
| TC-ddat-004 | Get | Get dashboard data with 1-day timeframe | `harness_get(resource_type="dashboard_data", resource_id="dash_123", params={reporting_timeframe: 1})` | Returns dashboard data for the last 1 day |
| TC-ddat-005 | Get | Get dashboard data with expanded_tables | `harness_get(resource_type="dashboard_data", resource_id="dash_123", params={expanded_tables: true})` | Returns expanded table data from dashboard |
| TC-ddat-006 | Error | Get data for nonexistent dashboard | `harness_get(resource_type="dashboard_data", resource_id="nonexistent_dash")` | Error: Dashboard not found (404) |
| TC-ddat-007 | Error | Get data with invalid dashboard_id | `harness_get(resource_type="dashboard_data", resource_id="")` | Error: Invalid dashboard identifier |
| TC-ddat-008 | Edge | Get data from dashboard with no data | `harness_get(resource_type="dashboard_data", resource_id="empty_dashboard")` | Returns empty or minimal data structure |
| TC-ddat-009 | Edge | Get data with very large timeframe | `harness_get(resource_type="dashboard_data", resource_id="dash_123", params={reporting_timeframe: 365})` | Returns data for full year (may be large) |
| TC-ddat-010 | Edge | Verify CSV-to-structured conversion | `harness_get(resource_type="dashboard_data", resource_id="dash_123")` | Response contains parsed tables, not raw CSV |

## Notes
- Dashboard data is downloaded as CSV and converted to structured tables by the extractor
- Uses GET `/dashboard/download/dashboards/{dashboardId}/csv` endpoint
- `reporting_timeframe` is passed as the `filters` query parameter (in days, default 30)
- Response type is `buffer` — processed by `dashboardDataExtract` function
- Account-scoped resource — no org/project parameters needed
- Optional `expanded_tables` parameter for more detailed data
