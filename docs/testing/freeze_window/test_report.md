# Test Report: Freeze Window (`freeze_window`)

| Field | Value |
|-------|-------|
| **Resource Type** | `freeze_window` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-frz-001 | List all freeze windows with defaults | `harness_list(resource_type="freeze_window")` | Returns paginated list with items and total | ✅ Passed | Returns empty list (no freeze windows configured); API responds correctly |  |
| TC-frz-002 | List with pagination | `harness_list(resource_type="freeze_window", page=0, size=5)` | Returns page 0 with up to 5 items | ⬜ Pending | | |
| TC-frz-003 | Filter by freeze_status Enabled | `harness_list(resource_type="freeze_window", freeze_status="Enabled")` | Returns only enabled freeze windows | ⬜ Pending | | |
| TC-frz-004 | Filter by freeze_status Disabled | `harness_list(resource_type="freeze_window", freeze_status="Disabled")` | Returns only disabled freeze windows | ⬜ Pending | | |
| TC-frz-005 | Filter by search_term | `harness_list(resource_type="freeze_window", search_term="maintenance")` | Returns matching freeze windows | ⬜ Pending | | |
| TC-frz-006 | Filter by start_time and end_time | `harness_list(resource_type="freeze_window", start_time="1700000000000", end_time="1700100000000")` | Returns windows in time range | ⬜ Pending | | |
| TC-frz-007 | Combined filters | `harness_list(resource_type="freeze_window", freeze_status="Enabled", search_term="release", page=0, size=10)` | Returns filtered results | ⬜ Pending | | |
| TC-frz-008 | Get freeze window by identifier | `harness_get(resource_type="freeze_window", freeze_id="my_freeze")` | Returns full details | ⬜ Pending | | |
| TC-frz-009 | Get with scope overrides | `harness_get(resource_type="freeze_window", freeze_id="my_freeze", org_id="other_org", project_id="other_project")` | Returns from specified scope | ⬜ Pending | | |
| TC-frz-010 | Create freeze window with YAML | `harness_create(resource_type="freeze_window", yaml="freeze:\n  name: Weekend Freeze\n  ...")` | Freeze window created | ⬜ Pending | | |
| TC-frz-011 | Create with missing yaml | `harness_create(resource_type="freeze_window")` | Error: yaml required | ⬜ Pending | | |
| TC-frz-012 | Create with invalid YAML | `harness_create(resource_type="freeze_window", yaml="invalid: not_a_freeze")` | Error: invalid structure | ⬜ Pending | | |
| TC-frz-013 | Update freeze window YAML | `harness_update(resource_type="freeze_window", freeze_id="my_freeze", yaml="freeze:\n  name: Updated Freeze\n  ...")` | Freeze window updated | ⬜ Pending | | |
| TC-frz-014 | Update with missing yaml | `harness_update(resource_type="freeze_window", freeze_id="my_freeze")` | Error: yaml required | ⬜ Pending | | |
| TC-frz-015 | Delete freeze window | `harness_delete(resource_type="freeze_window", freeze_id="my_freeze")` | Freeze window deleted | ⬜ Pending | | |
| TC-frz-016 | Toggle status to Enabled | `harness_execute(resource_type="freeze_window", action="toggle_status", status="Enabled", freeze_ids=["freeze_1", "freeze_2"])` | Freeze windows enabled | ⬜ Pending | | |
| TC-frz-017 | Toggle status to Disabled | `harness_execute(resource_type="freeze_window", action="toggle_status", status="Disabled", freeze_ids=["freeze_1"])` | Freeze window disabled | ⬜ Pending | | |
| TC-frz-018 | Toggle with empty freeze_ids | `harness_execute(resource_type="freeze_window", action="toggle_status", status="Enabled", freeze_ids=[])` | Error: non-empty array required | ⬜ Pending | | |
| TC-frz-019 | Toggle with missing freeze_ids | `harness_execute(resource_type="freeze_window", action="toggle_status", status="Enabled")` | Error: freeze_ids required | ⬜ Pending | | |
| TC-frz-020 | List with different org_id | `harness_list(resource_type="freeze_window", org_id="custom_org")` | Returns from specified org | ⬜ Pending | | |
| TC-frz-021 | List with different project_id | `harness_list(resource_type="freeze_window", org_id="default", project_id="other_project")` | Returns from specified project | ⬜ Pending | | |
| TC-frz-022 | Get non-existent freeze window | `harness_get(resource_type="freeze_window", freeze_id="nonexistent_frz_xyz")` | Error: not found (404) | ⬜ Pending | | |
| TC-frz-023 | Delete non-existent freeze window | `harness_delete(resource_type="freeze_window", freeze_id="nonexistent_frz_xyz")` | Error: not found (404) | ⬜ Pending | | |
| TC-frz-024 | List with empty results | `harness_list(resource_type="freeze_window", search_term="zzz_no_match_xyz")` | Empty items, total=0 | ⬜ Pending | | |
| TC-frz-025 | List with max pagination | `harness_list(resource_type="freeze_window", page=0, size=100)` | Returns up to 100 items | ⬜ Pending | | |
| TC-frz-026 | Verify deep link in response | `harness_get(resource_type="freeze_window", freeze_id="my_freeze")` | Response includes valid deep link | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 26 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 25 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
