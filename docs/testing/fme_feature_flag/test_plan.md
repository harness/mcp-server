# Test Plan: FME Feature Flag (`fme_feature_flag`)

| Field | Value |
|-------|-------|
| **Resource Type** | `fme_feature_flag` |
| **Display Name** | FME Feature Flag |
| **Toolset** | feature-flags |
| **Scope** | account (scope-optional; dual-mode) |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | kill, restore, archive, unarchive |
| **Identifier Fields** | workspace_id, feature_flag_name |
| **Filter Fields** | offset, size, rollout_status_id, name, tags |
| **Deep Link** | Yes |

## Test Cases — legacy mode (`workspace_id`)

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-fme_feature_flag-001 | List | List flags for a workspace | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace")` | Returns paginated list of feature flags |
| TC-fme_feature_flag-002 | List | List with custom size | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", size=10)` | Returns up to 10 flags |
| TC-fme_feature_flag-003 | List | List with offset pagination | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", offset=20)` | Returns flags starting at offset 20 |
| TC-fme_feature_flag-004 | List | List with offset and size combined | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", offset=10, size=5)` | Returns 5 flags starting at offset 10 |
| TC-fme_feature_flag-005 | List | List with max size (50) | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", size=50)` | Returns up to 50 flags |
| TC-fme_feature_flag-006 | Get | Get flag by workspace and name | `harness_get(resource_type="fme_feature_flag", workspace_id="my_workspace", feature_flag_name="my_flag")` | Returns flag metadata |
| TC-fme_feature_flag-007 | Get | Verify get response structure | `harness_get(resource_type="fme_feature_flag", workspace_id="my_workspace", feature_flag_name="my_flag")` | Response contains flag details without environment info |
| TC-fme_feature_flag-008 | Error | List without workspace_id or org/project | `harness_list(resource_type="fme_feature_flag")` | Error: "org_id and project_id are required (account is taken from config), or pass the deprecated workspace_id instead" |
| TC-fme_feature_flag-009 | Error | Get without workspace_id | `harness_get(resource_type="fme_feature_flag", feature_flag_name="my_flag")` | Error: "org_id and project_id are required (account is taken from config), or pass the deprecated workspace_id instead" |
| TC-fme_feature_flag-010 | Error | Get without feature_flag_name | `harness_get(resource_type="fme_feature_flag", workspace_id="my_workspace")` | Error: feature_flag_name is required |
| TC-fme_feature_flag-011 | Error | Get non-existent flag | `harness_get(resource_type="fme_feature_flag", workspace_id="my_workspace", feature_flag_name="nonexistent")` | Error: flag not found (404) |
| TC-fme_feature_flag-012 | Edge | List with offset beyond data | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", offset=999999)` | Returns empty list |
| TC-fme_feature_flag-013 | Edge | List with size=1 | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", size=1)` | Returns exactly 1 flag |
| TC-fme_feature_flag-014 | Create | Create a feature flag | `harness_create(resource_type="fme_feature_flag", workspace_id="my_workspace", traffic_type_id="tt_123", body={"name": "new_flag", "description": "test"})` | Creates flag and returns details |
| TC-fme_feature_flag-015 | Update | Update flag metadata | `harness_update(resource_type="fme_feature_flag", workspace_id="my_workspace", feature_flag_name="my_flag", body={"description": "updated"})` | Updates flag via JSON Patch |
| TC-fme_feature_flag-016 | Delete | Delete a feature flag | `harness_delete(resource_type="fme_feature_flag", workspace_id="my_workspace", feature_flag_name="my_flag")` | Deletes the flag |
| TC-fme_feature_flag-017 | Execute | Kill flag in environment | `harness_execute(resource_type="fme_feature_flag", action="kill", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="env_1")` | Kills the flag in the environment |
| TC-fme_feature_flag-018 | Execute | Restore flag in environment | `harness_execute(resource_type="fme_feature_flag", action="restore", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="env_1")` | Restores the flag in the environment |
| TC-fme_feature_flag-019 | Execute | Archive flag | `harness_execute(resource_type="fme_feature_flag", action="archive", workspace_id="my_workspace", feature_flag_name="my_flag")` | Archives the flag |
| TC-fme_feature_flag-020 | Execute | Unarchive flag | `harness_execute(resource_type="fme_feature_flag", action="unarchive", workspace_id="my_workspace", feature_flag_name="my_flag")` | Unarchives the flag |

## Test Cases — dual-mode selection

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-fme_feature_flag-021 | Error | Mixed-mode params (workspace_id + org_id + project_id together) | `harness_list(resource_type="fme_feature_flag", workspace_id="my_workspace", org_id="my_org", project_id="my_project")` | Error: "pass either workspace_id (deprecated) OR org_id+project_id, not both" |
| TC-fme_feature_flag-022 | Error | org_id without project_id | `harness_list(resource_type="fme_feature_flag", org_id="my_org")` | Error: "org_id and project_id are required (account is taken from config), or pass the deprecated workspace_id instead" |

## Test Cases — Harness-native mode (`org_id`+`project_id`)

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-fme_feature_flag-023 | List | List flags via Harness-native scope | `harness_list(resource_type="fme_feature_flag", org_id="my_org", project_id="my_project")` | Routes to `/fme/api/v4/feature-flags` with `account_id`/`organization_identifier`/`project_identifier` query params; returns 200 with paginated flags |
| TC-fme_feature_flag-024 | Get | Get flag via Harness-native scope | `harness_get(resource_type="fme_feature_flag", org_id="my_org", project_id="my_project", params={feature_flag_name="my_flag"})` | Routes to `/fme/api/v4/feature-flags/{name}`; returns 200 with flag details |
| TC-fme_feature_flag-025 | Delete | Delete flag via Harness-native scope | `harness_delete(resource_type="fme_feature_flag", org_id="my_org", project_id="my_project", params={feature_flag_name="my_flag"})` | Routes to `/fme/api/v4/feature-flags/{name}` |
| TC-fme_feature_flag-026 | Create | Create via Harness-native scope | `harness_create(resource_type="fme_feature_flag", org_id="my_org", project_id="my_project", body={"name": "new_flag", "trafficType": "user"})` | Routes to `/fme/api/v4/feature-flags` (POST) with the confirmed `CreateFeatureFlagRequest` body (`name`, `trafficType`, optional `description`/`tags`/`owners`); returns 201 with flag details |
| TC-fme_feature_flag-026b | Error | Create via Harness-native scope without trafficType | `harness_create(resource_type="fme_feature_flag", org_id="my_org", project_id="my_project", body={"name": "new_flag"})` | Error: "\"trafficType\" is required in body for Harness-native (org_id/project_id) mode." |
| TC-fme_feature_flag-027 | Error | Update via Harness-native scope | `harness_update(resource_type="fme_feature_flag", org_id="my_org", project_id="my_project", feature_flag_name="my_flag", body={"description": "x"})` | Error: "not yet implemented for this operation — pass workspace_id (deprecated) instead" |
| TC-fme_feature_flag-028 | Error | Kill via Harness-native scope | `harness_execute(resource_type="fme_feature_flag", action="kill", org_id="my_org", project_id="my_project", feature_flag_name="my_flag", environment_id="env_1")` | Error: "not yet implemented for this operation — pass workspace_id (deprecated) instead" |
| TC-fme_feature_flag-029 | Error | Restore via Harness-native scope | `harness_execute(resource_type="fme_feature_flag", action="restore", org_id="my_org", project_id="my_project", feature_flag_name="my_flag", environment_id="env_1")` | Error: "not yet implemented for this operation — pass workspace_id (deprecated) instead" |
| TC-fme_feature_flag-030 | Error | Archive via Harness-native scope | `harness_execute(resource_type="fme_feature_flag", action="archive", org_id="my_org", project_id="my_project", feature_flag_name="my_flag")` | Error: "not yet implemented for this operation — pass workspace_id (deprecated) instead" |
| TC-fme_feature_flag-031 | Error | Unarchive via Harness-native scope | `harness_execute(resource_type="fme_feature_flag", action="unarchive", org_id="my_org", project_id="my_project", feature_flag_name="my_flag")` | Error: "not yet implemented for this operation — pass workspace_id (deprecated) instead" |

## Notes
- Dual-mode resource: pass `workspace_id` (legacy, deprecated) to call the Split.io API directly, or `org_id`+`project_id` together (Harness-native) to call the new endpoints under `product: "harness"` (standard `HARNESS_API_KEY`/`HARNESS_BASE_URL` auth). Do not combine both modes on the same call.
- Account-scoped in legacy mode; does not use org/project identifiers there.
- Uses offset-based pagination: `offset` and `size` params (default 20, max 50).
- Legacy list path: `/internal/api/v2/splits/ws/{wsId}`; legacy get/delete path: `/internal/api/v2/splits/ws/{wsId}/{featureFlagName}`.
- Harness-native list/get/create/delete path: `/fme/api/v4/feature-flags[/{featureFlagName}]`, scoped via `account_id`/`organization_identifier`/`project_identifier` query params (not the standard NG `orgIdentifier`/`projectIdentifier`). Create body shape (`name`, `trafficType`, optional `description`/`tags`/`owners`) is confirmed against the backend's `CreateFeatureFlagRequest` DTO (`Harness_Split/Main`), not guessed.
- Does not require an environment for list/get/delete; environment is only needed for the `kill`/`restore` execute actions (legacy mode only today).
