# Test Plan: Pipeline Stage Flow / DAG (`visual_stage_flow`)

| Field | Value |
|-------|-------|
| **Resource Type** | `visual_stage_flow` |
| **Display Name** | Pipeline Stage Flow (DAG) |
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
| TC-vsf-001 | Render | Flow diagram with execution_id | `harness_diagnose(execution_id="<valid_id>", options={include_visual: true, visual_type: "flow"})` | Returns JSON diagnosis data and inline PNG flow diagram |
| TC-vsf-002 | Render | Flow diagram with pipeline_id | `harness_diagnose(pipeline_id="<valid_id>", options={include_visual: true, visual_type: "flow"})` | Uses latest execution; returns flow chart |
| TC-vsf-003 | Render | Custom visual_width | `harness_diagnose(execution_id="<valid_id>", options={include_visual: true, visual_type: "flow", visual_width: 1200})` | Returns wider flow diagram (1200px) |
| TC-vsf-004 | Render | Status-colored borders | `harness_diagnose(execution_id="<id_with_mixed_statuses>", options={include_visual: true, visual_type: "flow"})` | Nodes have status-colored borders |
| TC-vsf-005 | Render | Step count labels | `harness_diagnose(execution_id="<valid_id>", options={include_visual: true, visual_type: "flow"})` | Each stage node shows step count label |
| TC-vsf-006 | Render | Connected nodes with arrows | `harness_diagnose(execution_id="<multi_stage_id>", options={include_visual: true, visual_type: "flow"})` | Stages shown as connected nodes with directional arrows |
| TC-vsf-007 | Error | Invalid execution_id | `harness_diagnose(execution_id="nonexistent", options={include_visual: true, visual_type: "flow"})` | Returns meaningful error |
| TC-vsf-008 | Error | Missing execution/pipeline ID | `harness_diagnose(options={include_visual: true, visual_type: "flow"})` | Returns error indicating execution_id or pipeline_id required |
| TC-vsf-009 | Scope | Custom org and project | `harness_diagnose(pipeline_id="<id>", org_id="custom_org", project_id="custom_project", options={include_visual: true, visual_type: "flow"})` | Returns flow for specified scope |
| TC-vsf-010 | Describe | Resource metadata | `harness_describe(resource_type="visual_stage_flow")` | Returns metadata with diagnosticHint explaining usage |

## Notes
- Virtual resource type — no direct API operations; rendered locally from execution data
- Invoked via `harness_diagnose` with `include_visual: true` and `visual_type: "flow"`
- Left-to-right flowchart showing pipeline stages as connected nodes with arrows
- Status-colored borders, step count labels on each node
- Good for understanding pipeline structure and stage dependencies
- Supports `visual_width` option (default 800px)
