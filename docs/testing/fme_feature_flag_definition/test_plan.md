# Test Plan: FME Feature Flag Definition (`fme_feature_flag_definition`)

| Field | Value |
|-------|-------|
| **Resource Type** | `fme_feature_flag_definition` |
| **Display Name** | FME Feature Flag Definition |
| **Toolset** | feature-flags |
| **Scope** | account (scope-optional; dual-mode) |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | kill, restore, reallocate |
| **Identifier Fields** | workspace_id, feature_flag_name, environment_id |
| **Filter Fields** | feature_flag_name (required on list), offset, limit |
| **Deep Link** | No |

## Test Cases — legacy mode (`workspace_id`)

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-fme_feature_flag_definition-001 | Get | Get flag definition in environment | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="production")` | Returns detailed flag definition with treatments, rules, targeting, traffic allocation |
| TC-fme_feature_flag_definition-002 | Get | Get flag definition in staging env | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="staging")` | Returns flag definition for staging environment |
| TC-fme_feature_flag_definition-003 | Get | Verify response includes treatments | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="production")` | Response contains treatments array |
| TC-fme_feature_flag_definition-004 | Get | Verify response includes rules | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="production")` | Response contains rules and default rule |
| TC-fme_feature_flag_definition-005 | Error | Get without workspace_id or org/project | `harness_get(resource_type="fme_feature_flag_definition", feature_flag_name="my_flag", environment_id="production")` | Error: "org_id and project_id are required..., or pass the deprecated workspace_id instead" |
| TC-fme_feature_flag_definition-006 | Error | Get without feature_flag_name | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", environment_id="production")` | Error: feature_flag_name is required |
| TC-fme_feature_flag_definition-007 | Error | Get without environment_id | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag")` | Error: environment_id is required |
| TC-fme_feature_flag_definition-008 | Error | Get non-existent flag | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="nonexistent", environment_id="production")` | Error: flag not found (404) |
| TC-fme_feature_flag_definition-009 | Error | Get with non-existent environment | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="nonexistent")` | Error: environment not found (404) |
| TC-fme_feature_flag_definition-010 | Error | List with workspace_id (unsupported) | `harness_list(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag")` | Error: list is Harness-native only — pass org_id+project_id instead of workspace_id |
| TC-fme_feature_flag_definition-011 | Create | Create flag definition in environment | `harness_create(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="production", body={"treatments": [{"name": "on"}, {"name": "off"}], "defaultTreatment": "off", "defaultRule": [{"treatment": "off", "size": 100}]})` | Creates the definition and returns details |
| TC-fme_feature_flag_definition-012 | Update | Update flag definition in environment | `harness_update(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", feature_flag_name="my_flag", environment_id="production", body={"trafficAllocation": 50})` | Updates the definition |

## Test Cases — Harness-native mode (`org_id`+`project_id`)

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-fme_feature_flag_definition-013 | Get | Get definition via Harness-native scope | `harness_get(resource_type="fme_feature_flag_definition", org_id="my_org", project_id="my_project", feature_flag_name="my_flag", environment_id="production")` | Returns the definition for that environment |
| TC-fme_feature_flag_definition-014 | Create | Create definition via Harness-native scope | `harness_create(resource_type="fme_feature_flag_definition", org_id="my_org", project_id="my_project", feature_flag_name="my_flag", environment_id="production", body={"treatments": [{"name": "on"}], "defaultTreatment": "on", "defaultRule": [{"treatment": "on", "size": 100}], "title": "My Definition"})` | Creates the definition; body matches legacy plus optional `title` |
| TC-fme_feature_flag_definition-015 | Update | Update definition via Harness-native scope | `harness_update(resource_type="fme_feature_flag_definition", org_id="my_org", project_id="my_project", feature_flag_name="my_flag", environment_id="production", body={"trafficAllocation": 50})` | Updates the definition (JSON Merge Patch) |
| TC-fme_feature_flag_definition-016 | Error | Mixed-mode params rejected | `harness_get(resource_type="fme_feature_flag_definition", workspace_id="my_workspace", org_id="my_org", feature_flag_name="my_flag", environment_id="production")` | Error: "pass either workspace_id (deprecated) OR org_id+project_id, not both" |
| TC-fme_feature_flag_definition-017 | List | List definitions for a flag across environments | `harness_list(resource_type="fme_feature_flag_definition", org_id="my_org", project_id="my_project", feature_flag_name="my_flag", limit=25, offset=0)` | Lists definitions for that flag with `limit`/`offset`; no `environment_id` |
| TC-fme_feature_flag_definition-018 | Error | List without feature_flag_name | `harness_list(resource_type="fme_feature_flag_definition", org_id="my_org", project_id="my_project")` | Error: missing required list filter `feature_flag_name` |
| TC-fme_feature_flag_definition-019 | Delete | Delete a native definition | `harness_delete(resource_type="fme_feature_flag_definition", org_id="my_org", project_id="my_project", feature_flag_name="my_flag", environment_id="production")` | Deletes the definition for that environment |
| TC-fme_feature_flag_definition-020 | Execute | Kill/restore/reallocate a native definition | `harness_execute(resource_type="fme_feature_flag_definition", action="kill", org_id="my_org", project_id="my_project", feature_flag_name="my_flag", environment_id="production")` | Same kill/restore/reallocate actions as `fme_feature_flag` |

## Notes
- Dual-mode resource: pass `workspace_id` (legacy, deprecated) or `org_id`+`project_id` together (preferred). Do not combine both modes on the same call.
- Native list requires `feature_flag_name` and uses `offset`/`limit`. It does not take `environment_id`.
- Delete and execute require `feature_flag_name` and `environment_id`.
- Body shape (`treatments`, `defaultTreatment`, `defaultRule`, optional `rules`/`baselineTreatment`/`trafficAllocation`/`comment`) is identical between modes for get/create/update; Harness-native mode additionally accepts an optional `title` field.
- `list`/`delete`/`kill`/`restore`/`reallocate` are Harness-native only. `get`/`create`/`update` remain dual-mode.
