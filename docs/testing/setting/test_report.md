# Test Report: Setting (`setting`)

| Field | Value |
|-------|-------|
| **Resource Type** | `setting` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-set-001 | List settings by category CD | `harness_list(resource_type="setting", category="CD")` | Returns CD settings | ✅ Passed | Returns 9 CD settings with identifier, value, source, allowedScopes (requires category filter) | Requires category filter |
| TC-set-002 | List settings by category CI | `harness_list(resource_type="setting", category="CI")` | Returns CI settings | ⬜ Pending | | |
| TC-set-003 | List settings by category CE | `harness_list(resource_type="setting", category="CE")` | Returns CE settings | ⬜ Pending | | |
| TC-set-004 | List settings by category CORE | `harness_list(resource_type="setting", category="CORE")` | Returns CORE settings | ⬜ Pending | | |
| TC-set-005 | List settings by category PMS | `harness_list(resource_type="setting", category="PMS")` | Returns PMS settings | ⬜ Pending | | |
| TC-set-006 | List settings by category NOTIFICATION | `harness_list(resource_type="setting", category="NOTIFICATION")` | Returns notification settings | ⬜ Pending | | |
| TC-set-007 | Filter by category and group | `harness_list(resource_type="setting", category="CD", group="pipeline")` | Returns filtered settings | ⬜ Pending | | |
| TC-set-008 | Include parent scopes | `harness_list(resource_type="setting", category="CD", include_parent_scopes=true)` | Returns with parent scopes | ⬜ Pending | | |
| TC-set-009 | Exclude parent scopes | `harness_list(resource_type="setting", category="CD", include_parent_scopes=false)` | Returns project-level only | ⬜ Pending | | |
| TC-set-010 | Combined filters | `harness_list(resource_type="setting", category="CORE", group="security", include_parent_scopes=true)` | Returns filtered results | ⬜ Pending | | |
| TC-set-011 | List without category | `harness_list(resource_type="setting")` | Error: category required | ⬜ Pending | | |
| TC-set-012 | List with different org_id | `harness_list(resource_type="setting", category="CD", org_id="custom_org")` | Returns from specified org | ⬜ Pending | | |
| TC-set-013 | List with different project_id | `harness_list(resource_type="setting", category="CD", org_id="default", project_id="other_project")` | Returns from specified project | ⬜ Pending | | |
| TC-set-014 | List with invalid category | `harness_list(resource_type="setting", category="INVALID_CAT")` | Error or empty results | ⬜ Pending | | |
| TC-set-015 | List with non-existent group | `harness_list(resource_type="setting", category="CD", group="nonexistent_group")` | Empty or ignored | ⬜ Pending | | |
| TC-set-016 | Verify deep link concept | `harness_list(resource_type="setting", category="CD")` | References general settings link | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 16 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 15 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
