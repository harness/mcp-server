# Test Report: Pipeline Architecture Diagram (`visual_architecture`)

| Field | Value |
|-------|-------|
| **Resource Type** | `visual_architecture` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-va-001 | Architecture diagram for pipeline | `harness_diagnose(pipeline_id="<valid_id>", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Returns JSON diagnosis data and inline PNG architecture diagram | ✅ Passed | Returns metadata and usage instructions via harness_describe (diagnostic resource) |  |
| TC-va-002 | Multi-level hierarchy | `harness_diagnose(pipeline_id="<complex_pipeline>", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Shows Pipeline → Stages → Step Groups → Steps hierarchy | ⬜ Pending | | |
| TC-va-003 | Stage type badges | `harness_diagnose(pipeline_id="<mixed_pipeline>", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Stages show type badges: CI, Deployment, Approval | ⬜ Pending | | |
| TC-va-004 | Deployment stage details | `harness_diagnose(pipeline_id="<deploy_pipeline>", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Shows strategy, service ref, environment ref, infrastructure type | ⬜ Pending | | |
| TC-va-005 | Step details | `harness_diagnose(pipeline_id="<valid_id>", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Steps show type and timeout | ⬜ Pending | | |
| TC-va-006 | Rollback steps | `harness_diagnose(pipeline_id="<pipeline_with_rollback>", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Rollback steps shown in separate red-highlighted section | ⬜ Pending | | |
| TC-va-007 | With execution context | `harness_diagnose(execution_id="<valid_id>", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Architecture diagram from execution's pipeline | ⬜ Pending | | |
| TC-va-008 | Custom visual_width | `harness_diagnose(pipeline_id="<valid_id>", options={include_visual: true, visual_type: "architecture", include_yaml: true, visual_width: 1200})` | Returns wider architecture diagram | ⬜ Pending | | |
| TC-va-009 | Without include_yaml | `harness_diagnose(pipeline_id="<valid_id>", options={include_visual: true, visual_type: "architecture"})` | May return limited or no diagram (YAML needed for parsing) | ⬜ Pending | | |
| TC-va-010 | Invalid pipeline_id | `harness_diagnose(pipeline_id="nonexistent", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Returns meaningful error | ⬜ Pending | | |
| TC-va-011 | Missing pipeline/execution ID | `harness_diagnose(options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Returns error indicating pipeline_id required | ⬜ Pending | | |
| TC-va-012 | Custom org and project | `harness_diagnose(pipeline_id="<id>", org_id="custom_org", project_id="custom_project", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Returns architecture for specified scope | ⬜ Pending | | |
| TC-va-013 | Resource metadata | `harness_describe(resource_type="visual_architecture")` | Returns metadata with diagnosticHint explaining usage | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 13 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 12 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
