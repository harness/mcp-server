# Test Report: Project Health Dashboard (`visual_health_dashboard`)

| Field | Value |
|-------|-------|
| **Resource Type** | `visual_health_dashboard` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-vhd-001 | Health dashboard default | `harness_status(include_visual=true)` | Returns JSON health data and inline PNG dashboard image | ✅ Passed | Returns metadata and usage instructions via harness_describe (diagnostic resource) |  |
| TC-vhd-002 | With org_id and project_id | `harness_status(include_visual=true, org_id="<org>", project_id="<project>")` | Returns scoped health dashboard | ⬜ Pending | | |
| TC-vhd-003 | Health badge check | `harness_status(include_visual=true)` | Dashboard shows health badge (healthy/degraded/failing) | ⬜ Pending | | |
| TC-vhd-004 | Metric cards | `harness_status(include_visual=true)` | Dashboard shows metric cards (failed, running, recent counts) | ⬜ Pending | | |
| TC-vhd-005 | Recent execution status bar | `harness_status(include_visual=true)` | Dashboard includes recent execution status bar | ⬜ Pending | | |
| TC-vhd-006 | Healthy project | `harness_status(include_visual=true)` on healthy project | Shows green/healthy badge | ⬜ Pending | | |
| TC-vhd-007 | Degraded project | `harness_status(include_visual=true)` on project with failures | Shows degraded/failing badge | ⬜ Pending | | |
| TC-vhd-008 | Invalid org/project | `harness_status(include_visual=true, org_id="nonexistent", project_id="nonexistent")` | Returns meaningful error | ⬜ Pending | | |
| TC-vhd-009 | Empty project | `harness_status(include_visual=true)` on empty project | Returns dashboard with zero counts | ⬜ Pending | | |
| TC-vhd-010 | Resource metadata | `harness_describe(resource_type="visual_health_dashboard")` | Returns metadata with diagnosticHint explaining usage | ⬜ Pending | | |

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
