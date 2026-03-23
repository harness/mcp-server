# Test Report: User Group (`user_group`)

| Field | Value |
|-------|-------|
| **Resource Type** | `user_group` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-ug-001 | Basic list of user groups | `harness_list(resource_type="user_group")` | Returns paginated list of user groups | ✅ Passed | Returns 2 user groups (MCP Test User Group, All Project Users) with deep links |  |
| TC-ug-002 | Pagination - page 0, size 5 | `harness_list(resource_type="user_group", page=0, size=5)` | Returns first 5 user groups | ⬜ Pending | | |
| TC-ug-003 | Pagination - page 1 | `harness_list(resource_type="user_group", page=1, size=5)` | Returns second page of user groups | ⬜ Pending | | |
| TC-ug-004 | Filter by search_term | `harness_list(resource_type="user_group", search_term="admin")` | Returns user groups matching "admin" | ⬜ Pending | | |
| TC-ug-005 | Get user group by ID | `harness_get(resource_type="user_group", user_group_id="<valid_group_id>")` | Returns full user group details | ⬜ Pending | | |
| TC-ug-006 | Create user group | `harness_create(resource_type="user_group", body={identifier: "test_group", name: "Test Group", description: "A test group"})` | User group created successfully | ⬜ Pending | | |
| TC-ug-007 | Create with users | `harness_create(resource_type="user_group", body={identifier: "test_group_users", name: "Test Group With Users", users: ["<user_id>"]})` | User group created with members | ⬜ Pending | | |
| TC-ug-008 | Delete user group | `harness_delete(resource_type="user_group", user_group_id="test_group")` | User group deleted | ⬜ Pending | | |
| TC-ug-009 | Custom org and project | `harness_list(resource_type="user_group", org_id="custom_org", project_id="custom_project")` | Returns user groups for specified scope | ⬜ Pending | | |
| TC-ug-010 | Get nonexistent group | `harness_get(resource_type="user_group", user_group_id="nonexistent")` | Returns not found error | ⬜ Pending | | |
| TC-ug-011 | Create without identifier | `harness_create(resource_type="user_group", body={name: "No ID Group"})` | Returns validation error | ⬜ Pending | | |
| TC-ug-012 | Create duplicate identifier | `harness_create(resource_type="user_group", body={identifier: "<existing_id>", name: "Duplicate"})` | Returns conflict error | ⬜ Pending | | |
| TC-ug-013 | Delete nonexistent group | `harness_delete(resource_type="user_group", user_group_id="nonexistent")` | Returns not found error | ⬜ Pending | | |
| TC-ug-014 | Search with no matches | `harness_list(resource_type="user_group", search_term="zzz_nonexistent_zzz")` | Returns empty list | ⬜ Pending | | |
| TC-ug-015 | Resource metadata | `harness_describe(resource_type="user_group")` | Returns full metadata including create body schema | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 15 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 14 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
