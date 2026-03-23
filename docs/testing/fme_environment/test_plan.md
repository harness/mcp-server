# Test Plan: FME Environment (`fme_environment`)

| Field | Value |
|-------|-------|
| **Resource Type** | `fme_environment` |
| **Display Name** | FME Environment |
| **Toolset** | feature-flags |
| **Scope** | account |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | workspace_id, environment_id |
| **Filter Fields** | None |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-fme_environment-001 | List | List environments for a workspace | `harness_list(resource_type="fme_environment", workspace_id="my_workspace")` | Returns list of environments for the workspace |
| TC-fme_environment-002 | List | List environments for different workspace | `harness_list(resource_type="fme_environment", workspace_id="other_workspace")` | Returns environments for the other workspace |
| TC-fme_environment-003 | Error | List without workspace_id | `harness_list(resource_type="fme_environment")` | Error: workspace_id is required |
| TC-fme_environment-004 | Error | List with non-existent workspace | `harness_list(resource_type="fme_environment", workspace_id="nonexistent")` | Error: workspace not found (404) |
| TC-fme_environment-005 | Error | Attempt get operation (unsupported) | `harness_get(resource_type="fme_environment", workspace_id="my_workspace", environment_id="prod")` | Error: get operation not supported |
| TC-fme_environment-006 | Edge | List with empty workspace_id | `harness_list(resource_type="fme_environment", workspace_id="")` | Error: invalid workspace_id |
| TC-fme_environment-007 | Edge | Verify response structure | `harness_list(resource_type="fme_environment", workspace_id="my_workspace")` | Response contains environment objects with id and name |
| TC-fme_environment-008 | Edge | List for workspace with no environments | `harness_list(resource_type="fme_environment", workspace_id="empty_workspace")` | Returns empty list |

## Notes
- Uses FME (Split.io) API via `baseUrlOverride: "fme"`
- Account-scoped; does not use org/project identifiers
- Requires `workspace_id` as a path parameter: `/internal/api/v2/environments/ws/{wsId}`
- Only supports list operation; no get, create, update, or delete
- No pagination params; returns all environments for the workspace
