# Test Plan: Pipeline Timeline / Gantt (`visual_timeline`)

| Field | Value |
|-------|-------|
| **Resource Type** | `visual_timeline` |
| **Display Name** | Pipeline Timeline (Gantt) |
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
| TC-vt-001 | Render | Timeline with execution_id | `harness_diagnose(execution_id="<valid_id>", options={include_visual: true, visual_type: "timeline"})` | Returns JSON diagnosis data and inline PNG Gantt chart |
| TC-vt-002 | Render | Timeline with pipeline_id (latest) | `harness_diagnose(pipeline_id="<valid_id>", options={include_visual: true, visual_type: "timeline"})` | Uses latest execution; returns timeline chart |
| TC-vt-003 | Render | Custom visual_width | `harness_diagnose(execution_id="<valid_id>", options={include_visual: true, visual_type: "timeline", visual_width: 1200})` | Returns wider timeline chart (1200px) |
| TC-vt-004 | Render | Default visual_width | `harness_diagnose(execution_id="<valid_id>", options={include_visual: true, visual_type: "timeline"})` | Default width is 800px |
| TC-vt-005 | Render | Status color coding | `harness_diagnose(execution_id="<id_with_mixed_statuses>", options={include_visual: true, visual_type: "timeline"})` | Green=success, red=failed, blue=running stages |
| TC-vt-006 | Render | Bottleneck identification | `harness_diagnose(execution_id="<id_with_slow_stage>", options={include_visual: true, visual_type: "timeline"})` | Chart shows duration per stage, longest stage visible |
| TC-vt-007 | Error | Invalid execution_id | `harness_diagnose(execution_id="nonexistent", options={include_visual: true, visual_type: "timeline"})` | Returns meaningful error |
| TC-vt-008 | Error | Missing execution/pipeline ID | `harness_diagnose(options={include_visual: true, visual_type: "timeline"})` | Returns error indicating execution_id or pipeline_id required |
| TC-vt-009 | Scope | Custom org and project | `harness_diagnose(pipeline_id="<id>", org_id="custom_org", project_id="custom_project", options={include_visual: true, visual_type: "timeline"})` | Returns timeline for specified scope |
| TC-vt-010 | Describe | Resource metadata | `harness_describe(resource_type="visual_timeline")` | Returns metadata with diagnosticHint explaining usage |

## Notes
- Virtual resource type — no direct API operations; rendered locally from execution data
- Invoked via `harness_diagnose` with `include_visual: true` and `visual_type: "timeline"`
- Horizontal Gantt chart showing pipeline stage execution over time
- Color-coded by status: green=success, red=failed, blue=running
- Shows duration per stage and enables bottleneck identification
- Supports `visual_width` option (default 800px)
- Response includes both JSON diagnosis data and an inline PNG image
