# Test Plan: Environment (`environment`)

| Field | Value |
|-------|-------|
| **Resource Type** | `environment` |
| **Display Name** | Environment |
| **Toolset** | environments |
| **Scope** | project |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | move_configs |
| **Identifier Fields** | environment_id |
| **Filter Fields** | search_term, env_type, sort, order |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-env-001 | List | List all environments with defaults | `harness_list(resource_type="environment")` | Returns paginated list of environments with items array and total count |
| TC-env-002 | List | List environments with pagination | `harness_list(resource_type="environment", page=0, size=5)` | Returns page 0 with up to 5 environments |
| TC-env-003 | List | Filter environments by search_term | `harness_list(resource_type="environment", search_term="prod")` | Returns environments matching "prod" in name or keyword |
| TC-env-004 | List | Filter environments by env_type Production | `harness_list(resource_type="environment", env_type="Production")` | Returns only Production-type environments |
| TC-env-005 | List | Filter environments by env_type PreProduction | `harness_list(resource_type="environment", env_type="PreProduction")` | Returns only PreProduction-type environments |
| TC-env-006 | List | Sort environments by name ascending | `harness_list(resource_type="environment", sort="name", order="asc")` | Returns environments sorted by name A-Z |
| TC-env-007 | List | Combined filters: env_type + search + pagination | `harness_list(resource_type="environment", env_type="Production", search_term="us-east", page=0, size=10)` | Returns filtered Production environments matching "us-east" |
| TC-env-008 | Get | Get environment by identifier | `harness_get(resource_type="environment", environment_id="my_env")` | Returns full environment details including type, description, tags |
| TC-env-009 | Get | Get environment with scope overrides | `harness_get(resource_type="environment", environment_id="my_env", org_id="other_org", project_id="other_project")` | Returns environment from specified org/project scope |
| TC-env-010 | Create | Create environment with required fields only | `harness_create(resource_type="environment", identifier="test_env", name="Test Env", type="PreProduction")` | Environment created with identifier, name, and type |
| TC-env-011 | Create | Create Production environment with all fields | `harness_create(resource_type="environment", identifier="prod_env", name="Production US", type="Production", description="Production environment", tags={"region": "us-east"})` | Environment created with all fields populated |
| TC-env-012 | Create | Create environment with YAML | `harness_create(resource_type="environment", identifier="yaml_env", name="YAML Env", type="PreProduction", yaml="environment:\n  name: YAML Env\n  identifier: yaml_env\n  type: PreProduction")` | Environment created from YAML definition |
| TC-env-013 | Create | Create environment with missing required field (type) | `harness_create(resource_type="environment", identifier="bad_env", name="Bad Env")` | Error: type is required |
| TC-env-014 | Update | Update environment name and description | `harness_update(resource_type="environment", environment_id="my_env", name="Updated Env", type="Production", description="Updated description")` | Environment updated with new name and description |
| TC-env-015 | Update | Update environment type | `harness_update(resource_type="environment", environment_id="my_env", name="My Env", type="PreProduction")` | Environment type changed to PreProduction |
| TC-env-016 | Update | Update environment with invalid data (missing type) | `harness_update(resource_type="environment", environment_id="my_env", name="My Env")` | Error: type is required for update |
| TC-env-017 | Delete | Delete environment by identifier | `harness_delete(resource_type="environment", environment_id="my_env")` | Environment deleted successfully |
| TC-env-018 | Execute | Move config inline to remote | `harness_execute(resource_type="environment", action="move_configs", environment_id="my_env", move_config_type="INLINE_TO_REMOTE", connector_ref="git_connector", repo_name="my-repo", branch="main", file_path=".harness/env.yaml", commit_msg="Move env to remote")` | Environment config moved to remote repository |
| TC-env-019 | Execute | Move config with new branch | `harness_execute(resource_type="environment", action="move_configs", environment_id="my_env", move_config_type="INLINE_TO_REMOTE", connector_ref="git_connector", repo_name="my-repo", branch="feature/env-config", file_path=".harness/env.yaml", commit_msg="Move env", is_new_branch=true, base_branch="main")` | Config moved to a new branch |
| TC-env-020 | Scope | List environments with different org_id | `harness_list(resource_type="environment", org_id="custom_org")` | Returns environments from the specified organization |
| TC-env-021 | Error | Get non-existent environment | `harness_get(resource_type="environment", environment_id="nonexistent_env_xyz")` | Error: environment not found (404) |
| TC-env-022 | Error | Delete non-existent environment | `harness_delete(resource_type="environment", environment_id="nonexistent_env_xyz")` | Error: environment not found (404) |
| TC-env-023 | Edge | List environments with empty results | `harness_list(resource_type="environment", search_term="zzz_no_match_xyz")` | Returns empty items array with total=0 |
| TC-env-024 | Edge | Create environment with special characters in name | `harness_create(resource_type="environment", identifier="env_special", name="Env (Staging) #2", type="PreProduction")` | Environment created successfully |
| TC-env-025 | Edge | List environments with max pagination | `harness_list(resource_type="environment", page=0, size=100)` | Returns up to 100 environments |
| TC-env-026 | Deep Link | Verify deep link in get response | `harness_get(resource_type="environment", environment_id="my_env")` | Response includes valid Harness UI deep link with `/details` suffix |

## Notes
- Environment scope is project-level; both org_id and project_id are required (defaults from config if omitted).
- The `type` field is required for both create and update; valid values are `Production` and `PreProduction`.
- The create body is wrapped under an `environment` key by the bodyBuilder.
- Update auto-injects `identifier` from `environment_id` if not provided in body.
- The `move_configs` execute action uses query params (not body) for all parameters.
- Deep link format: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/environments/{environmentIdentifier}/details`
