# Test Report: Infrastructure Definition (`infrastructure`)

| Field | Value |
|-------|-------|
| **Resource Type** | `infrastructure` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-infra-001 | List infrastructure for an environment | `harness_list(resource_type="infrastructure", environment_id="my_env")` | Returns paginated list scoped to environment | ✅ Passed | Returns 1 infrastructure definition (requires environment_id filter) | Requires environment_id filter |
| TC-infra-002 | List with pagination | `harness_list(resource_type="infrastructure", environment_id="my_env", page=1, size=5)` | Returns page 1 with up to 5 items | ⬜ Pending | | |
| TC-infra-003 | Filter by search_term | `harness_list(resource_type="infrastructure", environment_id="my_env", search_term="k8s")` | Returns matching infrastructure | ⬜ Pending | | |
| TC-infra-004 | Filter by deployment_type | `harness_list(resource_type="infrastructure", environment_id="my_env", deployment_type="Kubernetes")` | Returns Kubernetes infrastructure only | ⬜ Pending | | |
| TC-infra-005 | Sort by name descending | `harness_list(resource_type="infrastructure", environment_id="my_env", sort="name", order="desc")` | Returns sorted results | ⬜ Pending | | |
| TC-infra-006 | Combined filters | `harness_list(resource_type="infrastructure", environment_id="my_env", search_term="prod", deployment_type="Kubernetes", page=0, size=10)` | Returns filtered results | ⬜ Pending | | |
| TC-infra-007 | List without environment_id | `harness_list(resource_type="infrastructure")` | Error or empty: environment_id required | ⬜ Pending | | |
| TC-infra-008 | Get infrastructure by identifier | `harness_get(resource_type="infrastructure", infrastructure_id="my_infra", environment_id="my_env")` | Returns full details | ⬜ Pending | | |
| TC-infra-009 | Get with scope overrides | `harness_get(resource_type="infrastructure", infrastructure_id="my_infra", environment_id="my_env", org_id="other_org", project_id="other_project")` | Returns from specified scope | ⬜ Pending | | |
| TC-infra-010 | Create with required fields | `harness_create(resource_type="infrastructure", identifier="test_infra", name="Test Infra", type="KubernetesDirect", environmentRef="my_env")` | Infrastructure created | ⬜ Pending | | |
| TC-infra-011 | Create with all fields | `harness_create(resource_type="infrastructure", identifier="full_infra", name="Full Infra", type="KubernetesDirect", environmentRef="my_env", deploymentType="Kubernetes", yaml="...")` | Infrastructure created with all fields | ⬜ Pending | | |
| TC-infra-012 | Create with missing type | `harness_create(resource_type="infrastructure", identifier="bad_infra", name="Bad Infra", environmentRef="my_env")` | Error: type is required | ⬜ Pending | | |
| TC-infra-013 | Create with missing environmentRef | `harness_create(resource_type="infrastructure", identifier="bad_infra", name="Bad Infra", type="KubernetesDirect")` | Error: environmentRef required | ⬜ Pending | | |
| TC-infra-014 | Update name and type | `harness_update(resource_type="infrastructure", infrastructure_id="my_infra", identifier="my_infra", name="Updated Infra", type="KubernetesGcp", environmentRef="my_env")` | Infrastructure updated | ⬜ Pending | | |
| TC-infra-015 | Update with YAML | `harness_update(resource_type="infrastructure", infrastructure_id="my_infra", identifier="my_infra", name="My Infra", type="KubernetesDirect", environmentRef="my_env", yaml="...")` | Updated with YAML | ⬜ Pending | | |
| TC-infra-016 | Update with missing required fields | `harness_update(resource_type="infrastructure", infrastructure_id="my_infra", name="My Infra")` | Error: type, environmentRef required | ⬜ Pending | | |
| TC-infra-017 | Delete by identifier | `harness_delete(resource_type="infrastructure", infrastructure_id="my_infra", environment_id="my_env")` | Infrastructure deleted | ⬜ Pending | | |
| TC-infra-018 | Move config inline to remote | `harness_execute(resource_type="infrastructure", action="move_configs", infrastructure_id="my_infra", environment_id="my_env", move_config_type="INLINE_TO_REMOTE", ...)` | Config moved to remote | ⬜ Pending | | |
| TC-infra-019 | Move config remote to inline | `harness_execute(resource_type="infrastructure", action="move_configs", infrastructure_id="my_infra", environment_id="my_env", move_config_type="REMOTE_TO_INLINE")` | Config moved to inline | ⬜ Pending | | |
| TC-infra-020 | List with different org_id | `harness_list(resource_type="infrastructure", environment_id="my_env", org_id="custom_org")` | Returns from specified org | ⬜ Pending | | |
| TC-infra-021 | Get non-existent infrastructure | `harness_get(resource_type="infrastructure", infrastructure_id="nonexistent_xyz", environment_id="my_env")` | Error: not found (404) | ⬜ Pending | | |
| TC-infra-022 | Delete non-existent infrastructure | `harness_delete(resource_type="infrastructure", infrastructure_id="nonexistent_xyz", environment_id="my_env")` | Error: not found (404) | ⬜ Pending | | |
| TC-infra-023 | List with empty results | `harness_list(resource_type="infrastructure", environment_id="my_env", search_term="zzz_no_match")` | Empty items, total=0 | ⬜ Pending | | |
| TC-infra-024 | List with max pagination | `harness_list(resource_type="infrastructure", environment_id="my_env", page=0, size=100)` | Returns up to 100 items | ⬜ Pending | | |
| TC-infra-025 | Verify deep link in response | `harness_get(resource_type="infrastructure", infrastructure_id="my_infra", environment_id="my_env")` | Response includes valid deep link | ⬜ Pending | | |

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
