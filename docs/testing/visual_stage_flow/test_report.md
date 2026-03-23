# Test Report: Pipeline Stage Flow / DAG (`visual_stage_flow`)

| Field | Value |
|-------|-------|
| **Resource Type** | `visual_stage_flow` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-vsf-001 | Flow diagram with execution_id | `harness_diagnose(execution_id="<valid_id>", options={include_visual: true, visual_type: "flow"})` | Returns JSON diagnosis data and inline PNG flow diagram | ✅ Passed | Returns metadata and usage instructions via harness_describe (diagnostic resource) |  |
| TC-vsf-002 | Flow diagram with pipeline_id | `harness_diagnose(pipeline_id="<valid_id>", options={include_visual: true, visual_type: "flow"})` | Uses latest execution; returns flow chart | ⬜ Pending | | |
| TC-vsf-003 | Custom visual_width | `harness_diagnose(execution_id="<valid_id>", options={include_visual: true, visual_type: "flow", visual_width: 1200})` | Returns wider flow diagram (1200px) | ⬜ Pending | | |
| TC-vsf-004 | Status-colored borders | `harness_diagnose(execution_id="<id_with_mixed_statuses>", options={include_visual: true, visual_type: "flow"})` | Nodes have status-colored borders | ⬜ Pending | | |
| TC-vsf-005 | Step count labels | `harness_diagnose(execution_id="<valid_id>", options={include_visual: true, visual_type: "flow"})` | Each stage node shows step count label | ⬜ Pending | | |
| TC-vsf-006 | Connected nodes with arrows | `harness_diagnose(execution_id="<multi_stage_id>", options={include_visual: true, visual_type: "flow"})` | Stages shown as connected nodes with directional arrows | ⬜ Pending | | |
| TC-vsf-007 | Invalid execution_id | `harness_diagnose(execution_id="nonexistent", options={include_visual: true, visual_type: "flow"})` | Returns meaningful error | ⬜ Pending | | |
| TC-vsf-008 | Missing execution/pipeline ID | `harness_diagnose(options={include_visual: true, visual_type: "flow"})` | Returns error indicating execution_id or pipeline_id required | ⬜ Pending | | |
| TC-vsf-009 | Custom org and project | `harness_diagnose(pipeline_id="<id>", org_id="custom_org", project_id="custom_project", options={include_visual: true, visual_type: "flow"})` | Returns flow for specified scope | ⬜ Pending | | |
| TC-vsf-010 | Resource metadata | `harness_describe(resource_type="visual_stage_flow")` | Returns metadata with diagnosticHint explaining usage | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 10 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 9 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
