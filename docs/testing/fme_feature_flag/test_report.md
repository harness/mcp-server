# Test Report: FME Feature Flag (`fme_feature_flag`)

| Field | Value |
|-------|-------|
| **Resource Type** | `fme_feature_flag` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-fme_feature_flag-001 | List flags for a workspace | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace")` | Returns paginated list of feature flags | ❌ Failed | Depends on fme_workspace which returns 401; FME module not configured |  |
| TC-fme_feature_flag-002 | List with custom size | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", size=10)` | Returns up to 10 flags | ⬜ Pending | | |
| TC-fme_feature_flag-003 | List with offset pagination | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", offset=20)` | Returns flags starting at offset 20 | ⬜ Pending | | |
| TC-fme_feature_flag-004 | List with offset and size combined | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", offset=10, size=5)` | Returns 5 flags starting at offset 10 | ⬜ Pending | | |
| TC-fme_feature_flag-005 | List with max size (50) | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", size=50)` | Returns up to 50 flags | ⬜ Pending | | |
| TC-fme_feature_flag-006 | Get flag by workspace and name | `harness_get(resource_type="fme_feature_flag", workspace_id="my_workspace", feature_flag_name="my_flag")` | Returns flag metadata | ⬜ Pending | | |
| TC-fme_feature_flag-007 | Verify get response structure | `harness_get(resource_type="fme_feature_flag", workspace_id="my_workspace", feature_flag_name="my_flag")` | Response contains flag details without environment info | ⬜ Pending | | |
| TC-fme_feature_flag-008 | List without workspace_id or org/project | `harness_list(resource_type="fme_feature_flag")` | Error: "org_id and project_id are required..., or pass the deprecated workspace_id instead" | ⬜ Pending | | |
| TC-fme_feature_flag-009 | Get without workspace_id | `harness_get(resource_type="fme_feature_flag", feature_flag_name="my_flag")` | Error: "org_id and project_id are required..., or pass the deprecated workspace_id instead" | ⬜ Pending | | |
| TC-fme_feature_flag-010 | Get without feature_flag_name | `harness_get(resource_type="fme_feature_flag", workspace_id="my_workspace")` | Error: feature_flag_name is required | ⬜ Pending | | |
| TC-fme_feature_flag-011 | Get non-existent flag | `harness_get(resource_type="fme_feature_flag", workspace_id="my_workspace", feature_flag_name="nonexistent")` | Error: flag not found (404) | ⬜ Pending | | |
| TC-fme_feature_flag-012 | List with offset beyond data | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", offset=999999)` | Returns empty list | ⬜ Pending | | |
| TC-fme_feature_flag-013 | List with size=1 | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", size=1)` | Returns exactly 1 flag | ⬜ Pending | | |
| TC-fme_feature_flag-014 | Create a feature flag (legacy) | `harness_create(resource_type="fme_feature_flag", workspace_id="my_workspace", traffic_type_id="tt_123", body={"name": "new_flag"})` | Creates flag and returns details | ⬜ Pending | | |
| TC-fme_feature_flag-015 | Update flag metadata (legacy) | `harness_update(resource_type="fme_feature_flag", workspace_id="my_workspace", feature_flag_name="my_flag", body={"description": "updated"})` | Updates flag via JSON Patch | ⬜ Pending | | |
| TC-fme_feature_flag-016 | Delete a feature flag (legacy) | `harness_delete(resource_type="fme_feature_flag", workspace_id="my_workspace", feature_flag_name="my_flag")` | Deletes the flag | ⬜ Pending | | |
| TC-fme_feature_flag-017 | Kill flag in environment (legacy) | `harness_execute(resource_type="fme_feature_flag", action="kill", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="env_1")` | Kills the flag in the environment | ⬜ Pending | | |
| TC-fme_feature_flag-018 | Restore flag in environment (legacy) | `harness_execute(resource_type="fme_feature_flag", action="restore", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="env_1")` | Restores the flag in the environment | ⬜ Pending | | |
| TC-fme_feature_flag-019 | Archive flag (legacy) | `harness_execute(resource_type="fme_feature_flag", action="archive", workspace_id="my_workspace", feature_flag_name="my_flag")` | Archives the flag | ⬜ Pending | | |
| TC-fme_feature_flag-020 | Unarchive flag (legacy) | `harness_execute(resource_type="fme_feature_flag", action="unarchive", workspace_id="my_workspace", feature_flag_name="my_flag")` | Unarchives the flag | ⬜ Pending | | |
| TC-fme_feature_flag-021 | Mixed-mode params rejected | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", org_id="my_org", project_id="my_project")` | Error: "pass either workspace_id (deprecated) OR org_id+project_id, not both" | ✅ Passed | Error thrown as expected (covered by `tests/registry/feature-flags.test.ts`) | |
| TC-fme_feature_flag-022 | org_id without project_id rejected | `harness_list(resource_type="fme_feature_flag", org_id="my_org")` | Error: "org_id and project_id are required..." | ✅ Passed | Error thrown as expected | |
| TC-fme_feature_flag-023 | List via Harness-native scope | `harness_list(resource_type="fme_feature_flag", org_id="my_org", project_id="my_project")` | Routes to `/fme/internal/api/v4/feature-flags` with `product: "harness"` auth; 200 | ✅ Passed | Confirmed 200 against real Harness-native endpoint | Routing and auth verified correct |
| TC-fme_feature_flag-024 | Get via Harness-native scope | `harness_get(resource_type="fme_feature_flag", org_id="my_org", project_id="my_project", feature_flag_name="my_flag")` | Routes to `/fme/internal/api/v4/feature-flags/{name}` | ⚠️ Blocked | Routing wired through and correct; backend currently returns 500 | Blocked on backend fix, not an MCP defect — same underlying issue as TC-fme_environment/list, TC-fme_standard_segment, TC-fme_rule_based_segment |
| TC-fme_feature_flag-025 | Delete via Harness-native scope | `harness_delete(resource_type="fme_feature_flag", org_id="my_org", project_id="my_project", feature_flag_name="my_flag")` | Routes to `/fme/internal/api/v4/feature-flags/{name}` | ⚠️ Blocked | Routing wired through and correct; backend currently returns 500 | Blocked on backend fix, not an MCP defect |
| TC-fme_feature_flag-026 | Create via Harness-native scope rejected | `harness_create(resource_type="fme_feature_flag", org_id="my_org", project_id="my_project", body={"name": "new_flag"})` | Error: "not yet implemented for this operation" | ✅ Passed | Error thrown as expected | |
| TC-fme_feature_flag-027 | Update via Harness-native scope rejected | `harness_update(resource_type="fme_feature_flag", org_id="my_org", project_id="my_project", feature_flag_name="my_flag", body={"description": "x"})` | Error: "not yet implemented for this operation" | ✅ Passed | Error thrown as expected | |
| TC-fme_feature_flag-028 | Kill via Harness-native scope rejected | `harness_execute(resource_type="fme_feature_flag", action="kill", org_id="my_org", project_id="my_project", feature_flag_name="my_flag", environment_id="env_1")` | Error: "not yet implemented for this operation" | ✅ Passed | Error thrown as expected | |
| TC-fme_feature_flag-029 | Restore via Harness-native scope rejected | `harness_execute(resource_type="fme_feature_flag", action="restore", org_id="my_org", project_id="my_project", feature_flag_name="my_flag", environment_id="env_1")` | Error: "not yet implemented for this operation" | ✅ Passed | Error thrown as expected | |
| TC-fme_feature_flag-030 | Archive via Harness-native scope rejected | `harness_execute(resource_type="fme_feature_flag", action="archive", org_id="my_org", project_id="my_project", feature_flag_name="my_flag")` | Error: "not yet implemented for this operation" | ✅ Passed | Error thrown as expected | |
| TC-fme_feature_flag-031 | Unarchive via Harness-native scope rejected | `harness_execute(resource_type="fme_feature_flag", action="unarchive", org_id="my_org", project_id="my_project", feature_flag_name="my_flag")` | Error: "not yet implemented for this operation" | ✅ Passed | Error thrown as expected | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 31 |
| ✅ Passed | 9 |
| ❌ Failed | 1 |
| ⚠️ Blocked | 2 |
| ⬜ Not Run | 19 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|
| FME-DUALMODE-500 | High | Harness-native `get`/`delete` for `fme_feature_flag` (and the corresponding wired-through operations on `fme_environment`, `fme_standard_segment`, `fme_rule_based_segment`) return HTTP 500 from the backend. MCP-side routing, path construction, and `product: "harness"` auth are confirmed correct — this is a backend-side gap, not an MCP defect. | TC-fme_feature_flag-024, TC-fme_feature_flag-025 | Open — tracked as a backend follow-up |

## Sample Responses
_(To be filled during testing)_
