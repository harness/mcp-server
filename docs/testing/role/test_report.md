# Test Report: Role (`role`)

| Field | Value |
|-------|-------|
| **Resource Type** | `role` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-role-001 | Basic list of roles | `harness_list(resource_type="role")` | Returns paginated list of RBAC roles | ✅ Passed | Returns 32 roles with identifier, timestamps, deep links |  |
| TC-role-002 | Pagination - page 0, size 5 | `harness_list(resource_type="role", page=0, size=5)` | Returns first 5 roles | ⬜ Pending | | |
| TC-role-003 | Pagination - page 1 | `harness_list(resource_type="role", page=1, size=5)` | Returns second page of roles | ⬜ Pending | | |
| TC-role-004 | Filter by search_term | `harness_list(resource_type="role", search_term="admin")` | Returns roles matching "admin" | ⬜ Pending | | |
| TC-role-005 | Get role by ID | `harness_get(resource_type="role", role_id="<valid_role_id>")` | Returns full role details with permissions list | ⬜ Pending | | |
| TC-role-006 | Get built-in role | `harness_get(resource_type="role", role_id="_account_admin")` | Returns built-in Account Admin role details | ⬜ Pending | | |
| TC-role-007 | Create custom role | `harness_create(resource_type="role", body={identifier: "test_role", name: "Test Role", permissions: ["core_project_view", "core_pipeline_view"]})` | Role created with specified permissions | ⬜ Pending | | |
| TC-role-008 | Create with description and scope | `harness_create(resource_type="role", body={identifier: "test_role_full", name: "Full Test Role", permissions: ["core_project_view"], description: "Test role", allowed_scope_levels: ["project"]})` | Role created with all fields | ⬜ Pending | | |
| TC-role-009 | Delete custom role | `harness_delete(resource_type="role", role_id="test_role")` | Role deleted | ⬜ Pending | | |
| TC-role-010 | Custom org and project | `harness_list(resource_type="role", org_id="custom_org", project_id="custom_project")` | Returns roles for specified scope | ⬜ Pending | | |
| TC-role-011 | Get nonexistent role | `harness_get(resource_type="role", role_id="nonexistent")` | Returns not found error | ⬜ Pending | | |
| TC-role-012 | Create without permissions | `harness_create(resource_type="role", body={identifier: "bad_role", name: "Bad Role"})` | Returns validation error (permissions required) | ⬜ Pending | | |
| TC-role-013 | Create duplicate identifier | `harness_create(resource_type="role", body={identifier: "<existing_id>", name: "Dup", permissions: ["core_project_view"]})` | Returns conflict error | ⬜ Pending | | |
| TC-role-014 | Delete built-in role | `harness_delete(resource_type="role", role_id="_account_admin")` | Returns error — cannot delete managed roles | ⬜ Pending | | |
| TC-role-015 | Search with no matches | `harness_list(resource_type="role", search_term="zzz_nonexistent_zzz")` | Returns empty list | ⬜ Pending | | |
| TC-role-016 | Resource metadata | `harness_describe(resource_type="role")` | Returns full metadata including create body schema | ⬜ Pending | | |

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
