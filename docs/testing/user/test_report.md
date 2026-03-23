# Test Report: User (`user`)

| Field | Value |
|-------|-------|
| **Resource Type** | `user` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-usr-001 | Basic list of users | `harness_list(resource_type="user")` | Returns paginated list of account users | ✅ Passed | Returns 6 users with deep links to access control |  |
| TC-usr-002 | Pagination - page 0, size 5 | `harness_list(resource_type="user", page=0, size=5)` | Returns first 5 users | ⬜ Pending | | |
| TC-usr-003 | Pagination - page 1 | `harness_list(resource_type="user", page=1, size=5)` | Returns second page of users | ⬜ Pending | | |
| TC-usr-004 | Filter by search_term (name) | `harness_list(resource_type="user", search_term="John")` | Returns users matching name "John" | ⬜ Pending | | |
| TC-usr-005 | Filter by search_term (email) | `harness_list(resource_type="user", search_term="john@example.com")` | Returns user matching email | ⬜ Pending | | |
| TC-usr-006 | Get user by ID | `harness_get(resource_type="user", user_id="<valid_user_id>")` | Returns full user details | ⬜ Pending | | |
| TC-usr-007 | Invite single user | `harness_execute(resource_type="user", action="invite", body={emails: ["newuser@example.com"], role_bindings: [...]})` | User invited successfully | ⬜ Pending | | |
| TC-usr-008 | Invite multiple users | `harness_execute(resource_type="user", action="invite", body={emails: ["user1@example.com", "user2@example.com"]})` | Multiple users invited | ⬜ Pending | | |
| TC-usr-009 | Invite with user groups | `harness_execute(resource_type="user", action="invite", body={emails: ["newuser@example.com"], user_groups: ["<group_id>"]})` | User invited and added to groups | ⬜ Pending | | |
| TC-usr-010 | Invite with comma-separated emails | `harness_execute(resource_type="user", action="invite", body={emails: "user1@example.com,user2@example.com"})` | Comma-separated string parsed and users invited | ⬜ Pending | | |
| TC-usr-011 | Get nonexistent user | `harness_get(resource_type="user", user_id="nonexistent")` | Returns not found error | ⬜ Pending | | |
| TC-usr-012 | Invite with empty emails | `harness_execute(resource_type="user", action="invite", body={emails: []})` | Returns validation error | ⬜ Pending | | |
| TC-usr-013 | Invite with invalid email format | `harness_execute(resource_type="user", action="invite", body={emails: ["not-an-email"]})` | Returns error from API | ⬜ Pending | | |
| TC-usr-014 | Search with no matches | `harness_list(resource_type="user", search_term="zzz_nonexistent_user_zzz")` | Returns empty list | ⬜ Pending | | |
| TC-usr-015 | Resource metadata | `harness_describe(resource_type="user")` | Returns metadata with operations (list, get), execute actions (invite), and body schema | ⬜ Pending | | |

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
