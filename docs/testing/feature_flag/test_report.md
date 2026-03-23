# Test Report: Feature Flag (`feature_flag`)

| Field | Value |
|-------|-------|
| **Resource Type** | `feature_flag` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-feature_flag-001 | List all feature flags with defaults | `harness_list(resource_type="feature_flag")` | Returns paginated list of feature flags | ✅ Passed | Returns 4 feature flags with variations, envProperties, deep links |  |
| TC-feature_flag-002 | List with pagination | `harness_list(resource_type="feature_flag", page=1, size=5)` | Returns second page with 5 flags | ⬜ Pending | | |
| TC-feature_flag-003 | Filter by name | `harness_list(resource_type="feature_flag", name="dark_mode")` | Returns flags matching "dark_mode" | ⬜ Pending | | |
| TC-feature_flag-004 | Filter by environment | `harness_list(resource_type="feature_flag", environment="production")` | Returns flags for production environment | ⬜ Pending | | |
| TC-feature_flag-005 | Filter by name and environment | `harness_list(resource_type="feature_flag", name="dark_mode", environment="production")` | Returns flags matching both filters | ⬜ Pending | | |
| TC-feature_flag-006 | List with custom org/project | `harness_list(resource_type="feature_flag", org_id="my_org", project_id="my_project")` | Returns flags for specified project | ⬜ Pending | | |
| TC-feature_flag-007 | Get flag by ID | `harness_get(resource_type="feature_flag", flag_id="dark_mode_toggle")` | Returns full flag details | ⬜ Pending | | |
| TC-feature_flag-008 | Get flag with environment context | `harness_get(resource_type="feature_flag", flag_id="dark_mode_toggle", environment="production")` | Returns flag details with environment state | ⬜ Pending | | |
| TC-feature_flag-009 | Verify deep link in response | `harness_get(resource_type="feature_flag", flag_id="dark_mode_toggle")` | Response includes deep link URL | ⬜ Pending | | |
| TC-feature_flag-010 | Create boolean feature flag | `harness_create(resource_type="feature_flag", body={"identifier": "new_flag", "name": "New Flag", "kind": "boolean"})` | Creates flag and returns details | ⬜ Pending | | |
| TC-feature_flag-011 | Create multivariate flag | `harness_create(resource_type="feature_flag", body={"identifier": "multi_flag", "name": "Multi Flag", "kind": "multivariate", "description": "A multivariate flag"})` | Creates multivariate flag | ⬜ Pending | | |
| TC-feature_flag-012 | Create permanent flag | `harness_create(resource_type="feature_flag", body={"identifier": "perm_flag", "name": "Permanent Flag", "kind": "boolean", "permanent": true})` | Creates permanent flag | ⬜ Pending | | |
| TC-feature_flag-013 | Delete a feature flag | `harness_delete(resource_type="feature_flag", flag_id="flag_to_delete")` | Deletes the flag successfully | ⬜ Pending | | |
| TC-feature_flag-014 | Toggle flag on | `harness_execute(resource_type="feature_flag", action="toggle", flag_id="dark_mode_toggle", enable=true, environment="production")` | Toggles flag on in production | ⬜ Pending | | |
| TC-feature_flag-015 | Toggle flag off | `harness_execute(resource_type="feature_flag", action="toggle", flag_id="dark_mode_toggle", enable=false, environment="production")` | Toggles flag off in production | ⬜ Pending | | |
| TC-feature_flag-016 | Get with missing flag_id | `harness_get(resource_type="feature_flag")` | Error: flag_id is required | ⬜ Pending | | |
| TC-feature_flag-017 | Get non-existent flag | `harness_get(resource_type="feature_flag", flag_id="nonexistent")` | Error: flag not found (404) | ⬜ Pending | | |
| TC-feature_flag-018 | Create with missing required fields | `harness_create(resource_type="feature_flag", body={"identifier": "new_flag"})` | Error: name and kind are required | ⬜ Pending | | |
| TC-feature_flag-019 | Toggle without enable field | `harness_execute(resource_type="feature_flag", action="toggle", flag_id="my_flag", environment="prod")` | Error: 'enable' field is required | ⬜ Pending | | |
| TC-feature_flag-020 | Toggle without environment | `harness_execute(resource_type="feature_flag", action="toggle", flag_id="my_flag", enable=true)` | Error: 'environment' field is required | ⬜ Pending | | |
| TC-feature_flag-021 | Delete non-existent flag | `harness_delete(resource_type="feature_flag", flag_id="nonexistent")` | Error: flag not found (404) | ⬜ Pending | | |
| TC-feature_flag-022 | List with size=1 | `harness_list(resource_type="feature_flag", size=1)` | Returns exactly 1 flag | ⬜ Pending | | |
| TC-feature_flag-023 | Create with duplicate identifier | `harness_create(resource_type="feature_flag", body={"identifier": "existing_flag", "name": "Duplicate", "kind": "boolean"})` | Error: flag already exists (409) | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 23 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 22 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
