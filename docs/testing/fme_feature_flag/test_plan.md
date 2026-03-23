# Test Plan: FME Feature Flag (`fme_feature_flag`)

| Field | Value |
|-------|-------|
| **Resource Type** | `fme_feature_flag` |
| **Display Name** | FME Feature Flag |
| **Toolset** | feature-flags |
| **Scope** | account |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | workspace_id, feature_flag_name |
| **Filter Fields** | offset |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-fme_feature_flag-001 | List | List flags for a workspace | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace")` | Returns paginated list of feature flags |
| TC-fme_feature_flag-002 | List | List with custom size | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", size=10)` | Returns up to 10 flags |
| TC-fme_feature_flag-003 | List | List with offset pagination | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", offset=20)` | Returns flags starting at offset 20 |
| TC-fme_feature_flag-004 | List | List with offset and size combined | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", offset=10, size=5)` | Returns 5 flags starting at offset 10 |
| TC-fme_feature_flag-005 | List | List with max size (50) | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", size=50)` | Returns up to 50 flags |
| TC-fme_feature_flag-006 | Get | Get flag by workspace and name | `harness_get(resource_type="fme_feature_flag", workspace_id="my_workspace", feature_flag_name="my_flag")` | Returns flag metadata |
| TC-fme_feature_flag-007 | Get | Verify get response structure | `harness_get(resource_type="fme_feature_flag", workspace_id="my_workspace", feature_flag_name="my_flag")` | Response contains flag details without environment info |
| TC-fme_feature_flag-008 | Error | List without workspace_id | `harness_list(resource_type="fme_feature_flag")` | Error: workspace_id is required |
| TC-fme_feature_flag-009 | Error | Get without workspace_id | `harness_get(resource_type="fme_feature_flag", feature_flag_name="my_flag")` | Error: workspace_id is required |
| TC-fme_feature_flag-010 | Error | Get without feature_flag_name | `harness_get(resource_type="fme_feature_flag", workspace_id="my_workspace")` | Error: feature_flag_name is required |
| TC-fme_feature_flag-011 | Error | Get non-existent flag | `harness_get(resource_type="fme_feature_flag", workspace_id="my_workspace", feature_flag_name="nonexistent")` | Error: flag not found (404) |
| TC-fme_feature_flag-012 | Edge | List with offset beyond data | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", offset=999999)` | Returns empty list |
| TC-fme_feature_flag-013 | Edge | List with size=1 | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", size=1)` | Returns exactly 1 flag |

## Notes
- Uses FME (Split.io) API via `baseUrlOverride: "fme"`
- Account-scoped; does not use org/project identifiers
- Uses offset-based pagination: `offset` and `size` params (default 20, max 50)
- List path: `/internal/api/v2/splits/ws/{wsId}`
- Get path: `/internal/api/v2/splits/ws/{wsId}/{featureFlagName}`
- Does not require an environment; returns metadata only
