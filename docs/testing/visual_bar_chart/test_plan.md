# Test Plan: Bar Chart by Pipeline (`visual_bar_chart`)

| Field | Value |
|-------|-------|
| **Resource Type** | `visual_bar_chart` |
| **Display Name** | Bar Chart (by Pipeline) |
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
| TC-vbc-001 | Render | Bar chart from execution list | `harness_list(resource_type="execution", include_visual=true, visual_type="bar")` | Returns execution list data and inline PNG horizontal bar chart |
| TC-vbc-002 | Render | Grouped by pipeline | `harness_list(resource_type="execution", include_visual=true, visual_type="bar")` | Chart shows execution counts grouped by pipeline name |
| TC-vbc-003 | Render | Analysis field | `harness_list(resource_type="execution", include_visual=true, visual_type="bar")` | Response includes 'analysis' field with key insights |
| TC-vbc-004 | Render | With size parameter | `harness_list(resource_type="execution", include_visual=true, visual_type="bar", size=100)` | Aggregates 100 executions into bar chart |
| TC-vbc-005 | Render | Custom org and project | `harness_list(resource_type="execution", org_id="<org>", project_id="<project>", include_visual=true, visual_type="bar")` | Returns scoped bar chart |
| TC-vbc-006 | Render | Multiple pipelines | `harness_list(resource_type="execution", include_visual=true, visual_type="bar")` on project with many pipelines | Shows bars for each pipeline |
| TC-vbc-007 | Error | No executions | `harness_list(resource_type="execution", include_visual=true, visual_type="bar")` on empty project | Returns empty chart or appropriate message |
| TC-vbc-008 | Edge | Single pipeline | `harness_list(resource_type="execution", include_visual=true, visual_type="bar")` on project with one pipeline | Shows single bar |
| TC-vbc-009 | Describe | Resource metadata | `harness_describe(resource_type="visual_bar_chart")` | Returns metadata with diagnosticHint explaining usage |

## Notes
- Virtual resource type — no direct API operations; rendered locally from execution list data
- Invoked via `harness_list` with `resource_type="execution"`, `include_visual: true`, `visual_type: "bar"`
- Horizontal bar chart showing execution counts grouped by pipeline name
- Useful for comparing activity across pipelines
- Response includes JSON data with 'analysis' field and an inline PNG bar chart
