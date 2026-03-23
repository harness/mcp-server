# Test Report: Service Override (`service_override`)

| Field | Value |
|-------|-------|
| **Resource Type** | `service_override` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-ovr-001 | List overrides for an environment | `harness_list(resource_type="service_override", environment_id="my_env")` | Returns paginated list of overrides | ✅ Passed | Returns empty list (requires environment_id filter); API responds correctly | Requires environment_id filter |
| TC-ovr-002 | List overrides with pagination | `harness_list(resource_type="service_override", environment_id="my_env", page=0, size=5)` | Returns page 0 with up to 5 overrides | ⬜ Pending | | |
| TC-ovr-003 | Filter overrides by service_id | `harness_list(resource_type="service_override", environment_id="my_env", service_id="my_service")` | Returns overrides for specific service | ⬜ Pending | | |
| TC-ovr-004 | Sort overrides | `harness_list(resource_type="service_override", environment_id="my_env", sort="lastModifiedAt,desc")` | Returns sorted overrides | ⬜ Pending | | |
| TC-ovr-005 | Combined filters | `harness_list(resource_type="service_override", environment_id="my_env", service_id="my_service", sort="lastModifiedAt,desc", page=0, size=10)` | Returns filtered results | ⬜ Pending | | |
| TC-ovr-006 | List without environment_id | `harness_list(resource_type="service_override")` | Error: environment_id required | ⬜ Pending | | |
| TC-ovr-007 | Get override by identifier | `harness_get(resource_type="service_override", override_id="my_override")` | Returns full override details | ⬜ Pending | | |
| TC-ovr-008 | Get override with scope overrides | `harness_get(resource_type="service_override", override_id="my_override", org_id="other_org", project_id="other_project")` | Returns from specified scope | ⬜ Pending | | |
| TC-ovr-009 | Create ENV_SERVICE_OVERRIDE with spec | `harness_create(resource_type="service_override", environmentRef="my_env", type="ENV_SERVICE_OVERRIDE", serviceRef="my_service", spec={...})` | Override created with variables | ⬜ Pending | | |
| TC-ovr-010 | Create ENV_GLOBAL_OVERRIDE with YAML | `harness_create(resource_type="service_override", environmentRef="my_env", type="ENV_GLOBAL_OVERRIDE", yaml="...")` | Override created from YAML | ⬜ Pending | | |
| TC-ovr-011 | Create INFRA_SERVICE_OVERRIDE | `harness_create(resource_type="service_override", environmentRef="my_env", type="INFRA_SERVICE_OVERRIDE", serviceRef="my_service", infraIdentifier="my_infra", spec={...})` | Infra-scoped override created | ⬜ Pending | | |
| TC-ovr-012 | Create with missing type | `harness_create(resource_type="service_override", environmentRef="my_env")` | Error: type required | ⬜ Pending | | |
| TC-ovr-013 | Create with missing environmentRef | `harness_create(resource_type="service_override", type="ENV_GLOBAL_OVERRIDE")` | Error: environmentRef required | ⬜ Pending | | |
| TC-ovr-014 | Update override spec variables | `harness_update(resource_type="service_override", override_id="my_override", environmentRef="my_env", type="ENV_SERVICE_OVERRIDE", serviceRef="my_service", spec={...})` | Override updated | ⬜ Pending | | |
| TC-ovr-015 | Update override with YAML | `harness_update(resource_type="service_override", override_id="my_override", environmentRef="my_env", type="ENV_SERVICE_OVERRIDE", yaml="...")` | Override updated from YAML | ⬜ Pending | | |
| TC-ovr-016 | Update with missing required fields | `harness_update(resource_type="service_override", override_id="my_override")` | Error: environmentRef and type required | ⬜ Pending | | |
| TC-ovr-017 | Delete override by identifier | `harness_delete(resource_type="service_override", override_id="my_override")` | Override deleted | ⬜ Pending | | |
| TC-ovr-018 | List with different org_id | `harness_list(resource_type="service_override", environment_id="my_env", org_id="custom_org")` | Returns from specified org | ⬜ Pending | | |
| TC-ovr-019 | List with different project_id | `harness_list(resource_type="service_override", environment_id="my_env", org_id="default", project_id="other_project")` | Returns from specified project | ⬜ Pending | | |
| TC-ovr-020 | Get non-existent override | `harness_get(resource_type="service_override", override_id="nonexistent_ovr_xyz")` | Error: not found (404) | ⬜ Pending | | |
| TC-ovr-021 | Delete non-existent override | `harness_delete(resource_type="service_override", override_id="nonexistent_ovr_xyz")` | Error: not found (404) | ⬜ Pending | | |
| TC-ovr-022 | Create with invalid override type | `harness_create(resource_type="service_override", environmentRef="my_env", type="INVALID_TYPE")` | Error: invalid type | ⬜ Pending | | |
| TC-ovr-023 | List with empty results | `harness_list(resource_type="service_override", environment_id="empty_env")` | Empty items, total=0 | ⬜ Pending | | |
| TC-ovr-024 | List with max pagination | `harness_list(resource_type="service_override", environment_id="my_env", page=0, size=100)` | Returns up to 100 overrides | ⬜ Pending | | |
| TC-ovr-025 | Verify deep link in response | `harness_get(resource_type="service_override", override_id="my_override")` | Response includes valid deep link | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 25 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 24 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
