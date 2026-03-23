# Test Plan: Execution Timeseries (`visual_timeseries`)

| Field | Value |
|-------|-------|
| **Resource Type** | `visual_timeseries` |
| **Display Name** | Execution Timeseries |
| **Toolset** | visualizations |
| **Scope** | project |
| **Operations** | _(none — virtual resource type)_ |
| **Execute Actions** | None |
| **Identifier Fields** | _(none)_ |
| **Filter Fields** | _(none)_ |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-vts-001 | Render | Timeseries from execution list | `harness_list(resource_type="execution", include_visual=true, visual_type="timeseries")` | Returns execution data and inline PNG stacked bar chart |
| TC-vts-002 | Render | Daily breakdown | `harness_list(resource_type="execution", include_visual=true, visual_type="timeseries")` | Chart shows daily execution counts over last 30 days |
| TC-vts-003 | Render | Status stacking | `harness_list(resource_type="execution", include_visual=true, visual_type="timeseries")` | Bars stacked by status (Success/Failed/Expired/Running) |
| TC-vts-004 | Render | Large dataset | `harness_list(resource_type="execution", include_visual=true, visual_type="timeseries", size=100)` | Aggregates 100 executions for better data points |
| TC-vts-005 | Render | Trend spotting | `harness_list(resource_type="execution", include_visual=true, visual_type="timeseries")` | Visual shows trends in execution frequency and success rate |
| TC-vts-006 | Render | Custom org and project | `harness_list(resource_type="execution", org_id="<org>", project_id="<project>", include_visual=true, visual_type="timeseries")` | Returns scoped timeseries chart |
| TC-vts-007 | Error | No executions | `harness_list(resource_type="execution", include_visual=true, visual_type="timeseries")` on empty project | Returns empty chart or appropriate message |
| TC-vts-008 | Edge | Single day of data | `harness_list(resource_type="execution", include_visual=true, visual_type="timeseries", size=5)` | Shows chart with minimal data points |
| TC-vts-009 | Describe | Resource metadata | `harness_describe(resource_type="visual_timeseries")` | Returns metadata with diagnosticHint explaining usage |

## Notes
- Virtual resource type — no direct API operations; rendered locally from execution list data
- Invoked via `harness_list` with `resource_type="execution"`, `include_visual: true`, `visual_type: "timeseries"`
- Stacked bar chart showing daily execution counts over the last 30 days
- Broken down by status: Success, Failed, Expired, Running
- For best results, set `size=100` to get more data points
- Aggregates executions by day from `startTs` timestamps
- Response includes JSON data and an inline PNG stacked bar chart
