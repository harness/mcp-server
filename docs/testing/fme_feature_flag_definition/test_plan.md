# Test Plan: FME Feature Flag Definition (`fme_feature_flag_definition`)

| Field | Value |
|-------|-------|
| **Resource Type** | `fme_feature_flag_definition` |
| **Display Name** | FME Feature Flag Definition |
| **Toolset** | feature-flags |
| **Scope** | account |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | workspace_id, feature_flag_name, environment_id |
| **Filter Fields** | None |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-fme_feature_flag_definition-001 | Get | Get flag definition in environment | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="production")` | Returns detailed flag definition with treatments, rules, targeting, traffic allocation |
| TC-fme_feature_flag_definition-002 | Get | Get flag definition in staging env | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="staging")` | Returns flag definition for staging environment |
| TC-fme_feature_flag_definition-003 | Get | Verify response includes treatments | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="production")` | Response contains treatments array |
| TC-fme_feature_flag_definition-004 | Get | Verify response includes rules | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="production")` | Response contains rules and default rule |
| TC-fme_feature_flag_definition-005 | Error | Get without workspace_id | `harness_get(resource_type="fme_feature_flag_definition", feature_flag_name="my_flag", environment_id="production")` | Error: workspace_id is required |
| TC-fme_feature_flag_definition-006 | Error | Get without feature_flag_name | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", environment_id="production")` | Error: feature_flag_name is required |
| TC-fme_feature_flag_definition-007 | Error | Get without environment_id | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag")` | Error: environment_id is required |
| TC-fme_feature_flag_definition-008 | Error | Get non-existent flag | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="nonexistent", environment_id="production")` | Error: flag not found (404) |
| TC-fme_feature_flag_definition-009 | Error | Get with non-existent environment | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="nonexistent")` | Error: environment not found (404) |
| TC-fme_feature_flag_definition-010 | Error | Attempt list operation (unsupported) | `harness_list(resource_type="fme_feature_flag_definition")` | Error: list operation not supported |
| TC-fme_feature_flag_definition-011 | Edge | Get with all three required identifiers | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="ws1", feature_flag_name="flag1", environment_id="env1")` | Returns definition or appropriate error |

## Notes
- Only supports get operation; no list available
- Uses FME (Split.io) API via `baseUrlOverride: "fme"`
- Account-scoped; does not use org/project identifiers
- Requires all three identifier fields: workspace_id, feature_flag_name, environment_id
- API path: `/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/environments/{environmentId}`
- Returns detailed definition including treatments, rules, default rule, and traffic allocation
