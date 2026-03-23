# Test Report: Pipeline Timeline / Gantt (`visual_timeline`)

| Field | Value |
|-------|-------|
| **Resource Type** | `visual_timeline` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-vt-001 | Timeline with execution_id | `harness_diagnose(execution_id="<valid_id>", options={include_visual: true, visual_type: "timeline"})` | Returns JSON diagnosis data and inline PNG Gantt chart | ✅ Passed | Returns metadata and usage instructions via harness_describe (diagnostic resource) |  |
| TC-vt-002 | Timeline with pipeline_id (latest) | `harness_diagnose(pipeline_id="<valid_id>", options={include_visual: true, visual_type: "timeline"})` | Uses latest execution; returns timeline chart | ⬜ Pending | | |
| TC-vt-003 | Custom visual_width | `harness_diagnose(execution_id="<valid_id>", options={include_visual: true, visual_type: "timeline", visual_width: 1200})` | Returns wider timeline chart (1200px) | ⬜ Pending | | |
| TC-vt-004 | Default visual_width | `harness_diagnose(execution_id="<valid_id>", options={include_visual: true, visual_type: "timeline"})` | Default width is 800px | ⬜ Pending | | |
| TC-vt-005 | Status color coding | `harness_diagnose(execution_id="<id_with_mixed_statuses>", options={include_visual: true, visual_type: "timeline"})` | Green=success, red=failed, blue=running stages | ⬜ Pending | | |
| TC-vt-006 | Bottleneck identification | `harness_diagnose(execution_id="<id_with_slow_stage>", options={include_visual: true, visual_type: "timeline"})` | Chart shows duration per stage, longest stage visible | ⬜ Pending | | |
| TC-vt-007 | Invalid execution_id | `harness_diagnose(execution_id="nonexistent", options={include_visual: true, visual_type: "timeline"})` | Returns meaningful error | ⬜ Pending | | |
| TC-vt-008 | Missing execution/pipeline ID | `harness_diagnose(options={include_visual: true, visual_type: "timeline"})` | Returns error indicating execution_id or pipeline_id required | ⬜ Pending | | |
| TC-vt-009 | Custom org and project | `harness_diagnose(pipeline_id="<id>", org_id="custom_org", project_id="custom_project", options={include_visual: true, visual_type: "timeline"})` | Returns timeline for specified scope | ⬜ Pending | | |
| TC-vt-010 | Resource metadata | `harness_describe(resource_type="visual_timeline")` | Returns metadata with diagnosticHint explaining usage | ⬜ Pending | | |

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
