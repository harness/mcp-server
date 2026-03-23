# Test Plan: Pie / Donut Chart (`visual_pie_chart`)

| Field | Value |
|-------|-------|
| **Resource Type** | `visual_pie_chart` |
| **Display Name** | Pie / Donut Chart |
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
| TC-vpc-001 | Render | Pie chart from execution list | `harness_list(resource_type="execution", include_visual=true, visual_type="pie")` | Returns execution list data and inline PNG donut chart |
| TC-vpc-002 | Render | Status breakdown | `harness_list(resource_type="execution", include_visual=true, visual_type="pie")` | Chart shows breakdown by status (Success, Failed, Expired, etc.) |
| TC-vpc-003 | Render | Percentages displayed | `harness_list(resource_type="execution", include_visual=true, visual_type="pie")` | Each status segment shows percentage |
| TC-vpc-004 | Render | Analysis field | `harness_list(resource_type="execution", include_visual=true, visual_type="pie")` | Response includes 'analysis' field with key insights |
| TC-vpc-005 | Render | With size parameter | `harness_list(resource_type="execution", include_visual=true, visual_type="pie", size=50)` | Aggregates 50 executions into pie chart |
| TC-vpc-006 | Render | Custom org and project | `harness_list(resource_type="execution", org_id="<org>", project_id="<project>", include_visual=true, visual_type="pie")` | Returns scoped pie chart |
| TC-vpc-007 | Error | No executions | `harness_list(resource_type="execution", include_visual=true, visual_type="pie")` on empty project | Returns empty chart or appropriate message |
| TC-vpc-008 | Edge | All same status | `harness_list(resource_type="execution", include_visual=true, visual_type="pie")` where all succeeded | Shows 100% Success donut |
| TC-vpc-009 | Describe | Resource metadata | `harness_describe(resource_type="visual_pie_chart")` | Returns metadata with diagnosticHint explaining usage |

## Notes
- Virtual resource type — no direct API operations; rendered locally from execution list data
- Invoked via `harness_list` with `resource_type="execution"`, `include_visual: true`, `visual_type: "pie"`
- Donut chart showing execution breakdown by status (Success, Failed, Expired, etc.)
- Includes auto-generated analysis with key insights
- Response includes JSON data with 'analysis' field and an inline PNG donut chart
