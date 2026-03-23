# Test Report: Environment (`environment`)

| Field | Value |
|-------|-------|
| **Resource Type** | `environment` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-env-001 | List all environments with defaults | `harness_list(resource_type="environment")` | Returns paginated list with items and total | ✅ Passed | Returns 12 environments with name, identifier, timestamps, deep links |  |
| TC-env-002 | List environments with pagination | `harness_list(resource_type="environment", page=0, size=5)` | Returns page 0 with up to 5 environments | ⬜ Pending | | |
| TC-env-003 | Filter environments by search_term | `harness_list(resource_type="environment", search_term="prod")` | Returns matching environments | ⬜ Pending | | |
| TC-env-004 | Filter by env_type Production | `harness_list(resource_type="environment", env_type="Production")` | Returns only Production environments | ⬜ Pending | | |
| TC-env-005 | Filter by env_type PreProduction | `harness_list(resource_type="environment", env_type="PreProduction")` | Returns only PreProduction environments | ⬜ Pending | | |
| TC-env-006 | Sort environments by name ascending | `harness_list(resource_type="environment", sort="name", order="asc")` | Returns sorted environments | ⬜ Pending | | |
| TC-env-007 | Combined filters: env_type + search + pagination | `harness_list(resource_type="environment", env_type="Production", search_term="us-east", page=0, size=10)` | Returns filtered results | ⬜ Pending | | |
| TC-env-008 | Get environment by identifier | `harness_get(resource_type="environment", environment_id="my_env")` | Returns full environment details | ⬜ Pending | | |
| TC-env-009 | Get environment with scope overrides | `harness_get(resource_type="environment", environment_id="my_env", org_id="other_org", project_id="other_project")` | Returns environment from specified scope | ⬜ Pending | | |
| TC-env-010 | Create environment with required fields only | `harness_create(resource_type="environment", identifier="test_env", name="Test Env", type="PreProduction")` | Environment created | ⬜ Pending | | |
| TC-env-011 | Create Production environment with all fields | `harness_create(resource_type="environment", identifier="prod_env", name="Production US", type="Production", description="...", tags={...})` | Environment created with all fields | ⬜ Pending | | |
| TC-env-012 | Create environment with YAML | `harness_create(resource_type="environment", identifier="yaml_env", name="YAML Env", type="PreProduction", yaml="...")` | Environment created from YAML | ⬜ Pending | | |
| TC-env-013 | Create environment with missing type | `harness_create(resource_type="environment", identifier="bad_env", name="Bad Env")` | Error: type is required | ⬜ Pending | | |
| TC-env-014 | Update environment name and description | `harness_update(resource_type="environment", environment_id="my_env", name="Updated Env", type="Production", description="Updated")` | Environment updated | ⬜ Pending | | |
| TC-env-015 | Update environment type | `harness_update(resource_type="environment", environment_id="my_env", name="My Env", type="PreProduction")` | Type changed | ⬜ Pending | | |
| TC-env-016 | Update environment with missing type | `harness_update(resource_type="environment", environment_id="my_env", name="My Env")` | Error: type is required | ⬜ Pending | | |
| TC-env-017 | Delete environment by identifier | `harness_delete(resource_type="environment", environment_id="my_env")` | Environment deleted | ⬜ Pending | | |
| TC-env-018 | Move config inline to remote | `harness_execute(resource_type="environment", action="move_configs", environment_id="my_env", move_config_type="INLINE_TO_REMOTE", ...)` | Config moved to remote | ⬜ Pending | | |
| TC-env-019 | Move config with new branch | `harness_execute(resource_type="environment", action="move_configs", environment_id="my_env", ..., is_new_branch=true, base_branch="main")` | Config moved to new branch | ⬜ Pending | | |
| TC-env-020 | List environments with different org_id | `harness_list(resource_type="environment", org_id="custom_org")` | Returns environments from specified org | ⬜ Pending | | |
| TC-env-021 | Get non-existent environment | `harness_get(resource_type="environment", environment_id="nonexistent_env_xyz")` | Error: not found (404) | ⬜ Pending | | |
| TC-env-022 | Delete non-existent environment | `harness_delete(resource_type="environment", environment_id="nonexistent_env_xyz")` | Error: not found (404) | ⬜ Pending | | |
| TC-env-023 | List environments with empty results | `harness_list(resource_type="environment", search_term="zzz_no_match_xyz")` | Empty items, total=0 | ⬜ Pending | | |
| TC-env-024 | Create environment with special characters | `harness_create(resource_type="environment", identifier="env_special", name="Env (Staging) #2", type="PreProduction")` | Environment created | ⬜ Pending | | |
| TC-env-025 | List environments with max pagination | `harness_list(resource_type="environment", page=0, size=100)` | Returns up to 100 environments | ⬜ Pending | | |
| TC-env-026 | Verify deep link in get response | `harness_get(resource_type="environment", environment_id="my_env")` | Response includes valid deep link | ⬜ Pending | | |

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
