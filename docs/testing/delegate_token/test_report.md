# Test Report: Delegate Token (`delegate_token`)

| Field | Value |
|-------|-------|
| **Resource Type** | `delegate_token` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-dtok-001 | List all delegate tokens with defaults | `harness_list(resource_type="delegate_token")` | Returns list of delegate tokens | ✅ Passed | Returns 22+ delegate tokens with name, status, ownerIdentifier, deep link |  |
| TC-dtok-002 | List delegate tokens filtered by name | `harness_list(resource_type="delegate_token", filters={name: "default_token"})` | Returns tokens matching the specified name | ⬜ Pending | | |
| TC-dtok-003 | List delegate tokens filtered by ACTIVE status | `harness_list(resource_type="delegate_token", filters={status: "ACTIVE"})` | Returns only active delegate tokens | ⬜ Pending | | |
| TC-dtok-004 | List delegate tokens filtered by REVOKED status | `harness_list(resource_type="delegate_token", filters={status: "REVOKED"})` | Returns only revoked delegate tokens | ⬜ Pending | | |
| TC-dtok-005 | List delegate tokens with combined filters | `harness_list(resource_type="delegate_token", filters={name: "prod", status: "ACTIVE"})` | Returns active tokens matching name filter | ⬜ Pending | | |
| TC-dtok-006 | List delegate tokens with scope override | `harness_list(resource_type="delegate_token", org_id="custom_org", project_id="custom_project")` | Returns tokens from specified org/project | ⬜ Pending | | |
| TC-dtok-007 | Get delegate token by name | `harness_get(resource_type="delegate_token", resource_id="my_token")` | Returns full delegate token details | ⬜ Pending | | |
| TC-dtok-008 | Get delegate token with scope override | `harness_get(resource_type="delegate_token", resource_id="my_token", org_id="other_org", project_id="other_project")` | Returns token from specified org/project | ⬜ Pending | | |
| TC-dtok-009 | Create a new delegate token | `harness_create(resource_type="delegate_token", body={name: "new_token"})` | Delegate token created successfully | ⬜ Pending | | |
| TC-dtok-010 | Create delegate token with scope override | `harness_create(resource_type="delegate_token", org_id="custom_org", project_id="custom_project", body={name: "scoped_token"})` | Token created in specified org/project | ⬜ Pending | | |
| TC-dtok-011 | Create delegate token with missing name | `harness_create(resource_type="delegate_token", body={})` | Error: name is required | ⬜ Pending | | |
| TC-dtok-012 | Create delegate token with duplicate name | `harness_create(resource_type="delegate_token", body={name: "existing_token"})` | Error: Token already exists (409) | ⬜ Pending | | |
| TC-dtok-013 | Delete delegate token by name | `harness_delete(resource_type="delegate_token", resource_id="my_token")` | Delegate token deleted successfully | ⬜ Pending | | |
| TC-dtok-014 | Delete delegate token with scope override | `harness_delete(resource_type="delegate_token", resource_id="my_token", org_id="other_org", project_id="other_project")` | Token deleted from specified org/project | ⬜ Pending | | |
| TC-dtok-015 | Revoke a delegate token | `harness_execute(resource_type="delegate_token", action="revoke", token_name="my_token")` | Token status changed to REVOKED | ⬜ Pending | | |
| TC-dtok-016 | Get delegates for a token | `harness_execute(resource_type="delegate_token", action="get_delegates", token_name="my_token")` | Returns list of delegates associated with the token | ⬜ Pending | | |
| TC-dtok-017 | Revoke with scope override | `harness_execute(resource_type="delegate_token", action="revoke", token_name="my_token", org_id="custom_org", project_id="custom_project")` | Token revoked in specified org/project | ⬜ Pending | | |
| TC-dtok-018 | Get token with invalid name | `harness_get(resource_type="delegate_token", resource_id="nonexistent_token")` | Error: Token not found (404) | ⬜ Pending | | |
| TC-dtok-019 | Revoke nonexistent token | `harness_execute(resource_type="delegate_token", action="revoke", token_name="nonexistent")` | Error: Token not found (404) | ⬜ Pending | | |
| TC-dtok-020 | Delete token from unauthorized project | `harness_delete(resource_type="delegate_token", resource_id="my_token", org_id="no_access_org", project_id="no_access_project")` | Error: Unauthorized (401/403) | ⬜ Pending | | |
| TC-dtok-021 | List delegate tokens with empty results | `harness_list(resource_type="delegate_token", filters={name: "zzz_nonexistent_zzz"})` | Returns empty results | ⬜ Pending | | |
| TC-dtok-022 | Get delegates for token with no delegates | `harness_execute(resource_type="delegate_token", action="get_delegates", token_name="unused_token")` | Returns empty list of delegates | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 22 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 21 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

_(To be filled during testing)_
