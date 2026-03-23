# Test Report: Global Freeze (`global_freeze`)

| Field | Value |
|-------|-------|
| **Resource Type** | `global_freeze` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-gfrz-001 | Get current global freeze status | `harness_get(resource_type="global_freeze")` | Returns global freeze config and status | ✅ Passed | Returns global freeze config (Disabled) with YAML definition (get only) |  |
| TC-gfrz-002 | Get global freeze with scope overrides | `harness_get(resource_type="global_freeze", org_id="other_org", project_id="other_project")` | Returns from specified scope | ⬜ Pending | | |
| TC-gfrz-003 | Enable global freeze | `harness_execute(resource_type="global_freeze", action="manage", yaml="freeze:\n  name: Global Freeze\n  identifier: _GLOBAL_\n  status: Enabled\n  ...")` | Global freeze enabled | ⬜ Pending | | |
| TC-gfrz-004 | Disable global freeze | `harness_execute(resource_type="global_freeze", action="manage", yaml="freeze:\n  name: Global Freeze\n  identifier: _GLOBAL_\n  status: Disabled\n  ...")` | Global freeze disabled | ⬜ Pending | | |
| TC-gfrz-005 | Manage with missing yaml | `harness_execute(resource_type="global_freeze", action="manage")` | Error: yaml required | ⬜ Pending | | |
| TC-gfrz-006 | Manage with invalid yaml | `harness_execute(resource_type="global_freeze", action="manage", yaml="invalid: not_a_freeze")` | Error: invalid YAML | ⬜ Pending | | |
| TC-gfrz-007 | Get with different org_id | `harness_get(resource_type="global_freeze", org_id="custom_org")` | Returns from specified org | ⬜ Pending | | |
| TC-gfrz-008 | Get with different project_id | `harness_get(resource_type="global_freeze", org_id="default", project_id="other_project")` | Returns from specified project | ⬜ Pending | | |
| TC-gfrz-009 | Execute invalid action | `harness_execute(resource_type="global_freeze", action="invalid_action")` | Error: unknown action | ⬜ Pending | | |
| TC-gfrz-010 | Get when none is configured | `harness_get(resource_type="global_freeze")` | Returns default state (disabled) | ⬜ Pending | | |

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
