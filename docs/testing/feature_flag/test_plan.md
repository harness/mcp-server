# Test Plan: Feature Flag (`feature_flag`)

| Field | Value |
|-------|-------|
| **Resource Type** | `feature_flag` |
| **Display Name** | Feature Flag |
| **Toolset** | feature-flags |
| **Scope** | project |
| **Operations** | list, get, create, delete |
| **Execute Actions** | toggle |
| **Identifier Fields** | flag_id |
| **Filter Fields** | name, environment |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-feature_flag-001 | List | List all feature flags with defaults | `harness_list(resource_type="feature_flag")` | Returns paginated list of feature flags |
| TC-feature_flag-002 | List | List with pagination | `harness_list(resource_type="feature_flag", page=1, size=5)` | Returns second page with 5 flags |
| TC-feature_flag-003 | List | Filter by name | `harness_list(resource_type="feature_flag", name="dark_mode")` | Returns flags matching "dark_mode" |
| TC-feature_flag-004 | List | Filter by environment | `harness_list(resource_type="feature_flag", environment="production")` | Returns flags for production environment |
| TC-feature_flag-005 | List | Filter by name and environment | `harness_list(resource_type="feature_flag", name="dark_mode", environment="production")` | Returns flags matching both filters |
| TC-feature_flag-006 | List | List with custom org/project | `harness_list(resource_type="feature_flag", org_id="my_org", project_id="my_project")` | Returns flags for specified project |
| TC-feature_flag-007 | Get | Get flag by ID | `harness_get(resource_type="feature_flag", flag_id="dark_mode_toggle")` | Returns full flag details |
| TC-feature_flag-008 | Get | Get flag with environment context | `harness_get(resource_type="feature_flag", flag_id="dark_mode_toggle", environment="production")` | Returns flag details with environment state |
| TC-feature_flag-009 | Get | Verify deep link in response | `harness_get(resource_type="feature_flag", flag_id="dark_mode_toggle")` | Response includes deep link URL |
| TC-feature_flag-010 | Create | Create boolean feature flag | `harness_create(resource_type="feature_flag", body={"identifier": "new_flag", "name": "New Flag", "kind": "boolean"})` | Creates flag and returns details |
| TC-feature_flag-011 | Create | Create multivariate flag | `harness_create(resource_type="feature_flag", body={"identifier": "multi_flag", "name": "Multi Flag", "kind": "multivariate", "description": "A multivariate flag"})` | Creates multivariate flag |
| TC-feature_flag-012 | Create | Create permanent flag | `harness_create(resource_type="feature_flag", body={"identifier": "perm_flag", "name": "Permanent Flag", "kind": "boolean", "permanent": true})` | Creates permanent flag |
| TC-feature_flag-013 | Delete | Delete a feature flag | `harness_delete(resource_type="feature_flag", flag_id="flag_to_delete")` | Deletes the flag successfully |
| TC-feature_flag-014 | Execute | Toggle flag on | `harness_execute(resource_type="feature_flag", action="toggle", flag_id="dark_mode_toggle", enable=true, environment="production")` | Toggles flag on in production |
| TC-feature_flag-015 | Execute | Toggle flag off | `harness_execute(resource_type="feature_flag", action="toggle", flag_id="dark_mode_toggle", enable=false, environment="production")` | Toggles flag off in production |
| TC-feature_flag-016 | Error | Get with missing flag_id | `harness_get(resource_type="feature_flag")` | Error: flag_id is required |
| TC-feature_flag-017 | Error | Get non-existent flag | `harness_get(resource_type="feature_flag", flag_id="nonexistent")` | Error: flag not found (404) |
| TC-feature_flag-018 | Error | Create with missing required fields | `harness_create(resource_type="feature_flag", body={"identifier": "new_flag"})` | Error: name and kind are required |
| TC-feature_flag-019 | Error | Toggle without enable field | `harness_execute(resource_type="feature_flag", action="toggle", flag_id="my_flag", environment="prod")` | Error: 'enable' field is required |
| TC-feature_flag-020 | Error | Toggle without environment | `harness_execute(resource_type="feature_flag", action="toggle", flag_id="my_flag", enable=true)` | Error: 'environment' field is required |
| TC-feature_flag-021 | Error | Delete non-existent flag | `harness_delete(resource_type="feature_flag", flag_id="nonexistent")` | Error: flag not found (404) |
| TC-feature_flag-022 | Edge | List with size=1 | `harness_list(resource_type="feature_flag", size=1)` | Returns exactly 1 flag |
| TC-feature_flag-023 | Edge | Create with duplicate identifier | `harness_create(resource_type="feature_flag", body={"identifier": "existing_flag", "name": "Duplicate", "kind": "boolean"})` | Error: flag already exists (409) |

## Notes
- Project-scoped resource; requires org_id and project_id (defaults from config)
- Uses standard Harness Feature Flags API (not FME/Split.io)
- Toggle action uses PATCH with `instructions` array containing `turnFlagOn` or `turnFlagOff`
- Create body schema: identifier (required), name (required), kind (required: "boolean" or "multivariate"), permanent (optional), description (optional)
- Toggle body schema: enable (required: true/false), environment (required)
- Deep link format: `/ng/account/{accountId}/cf/orgs/{orgIdentifier}/projects/{projectIdentifier}/feature-flags/{flagIdentifier}`
