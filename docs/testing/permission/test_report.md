# Test Report: Permission (`permission`)

| Field | Value |
|-------|-------|
| **Resource Type** | `permission` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-perm-001 | Basic list of all permissions | `harness_list(resource_type="permission")` | Returns list of all available platform permissions | ✅ Passed | Returns comprehensive list of all available permissions (large dataset) |  |
| TC-perm-002 | Verify permission structure | `harness_list(resource_type="permission")` | Each permission has identifier and name fields | ⬜ Pending | | |
| TC-perm-003 | Pagination - page 0, size 5 | `harness_list(resource_type="permission", page=0, size=5)` | Returns first 5 permissions (if pagination supported) | ⬜ Pending | | |
| TC-perm-004 | Large page size | `harness_list(resource_type="permission", size=100)` | Returns up to 100 permissions | ⬜ Pending | | |
| TC-perm-005 | Default account scope | `harness_list(resource_type="permission")` | Correctly scoped to account level | ⬜ Pending | | |
| TC-perm-006 | Invalid account | `harness_list(resource_type="permission")` with invalid HARNESS_ACCOUNT_ID | Returns auth/not found error | ⬜ Pending | | |
| TC-perm-007 | Permission count check | `harness_list(resource_type="permission")` | Returns non-empty list (Harness always has built-in permissions) | ⬜ Pending | | |
| TC-perm-008 | Resource metadata | `harness_describe(resource_type="permission")` | Returns metadata showing list-only, account-scoped, no identifier fields | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 8 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 7 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
