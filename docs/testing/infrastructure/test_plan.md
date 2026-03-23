# Test Plan: Infrastructure Definition (`infrastructure`)

| Field | Value |
|-------|-------|
| **Resource Type** | `infrastructure` |
| **Display Name** | Infrastructure Definition |
| **Toolset** | infrastructure |
| **Scope** | project |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | move_configs |
| **Identifier Fields** | infrastructure_id |
| **Filter Fields** | environment_id, search_term, deployment_type, sort, order |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-infra-001 | List | List infrastructure definitions for an environment | `harness_list(resource_type="infrastructure", environment_id="my_env")` | Returns paginated list of infrastructure definitions scoped to environment |
| TC-infra-002 | List | List with pagination | `harness_list(resource_type="infrastructure", environment_id="my_env", page=1, size=5)` | Returns page 1 with up to 5 infrastructure definitions |
| TC-infra-003 | List | Filter by search_term | `harness_list(resource_type="infrastructure", environment_id="my_env", search_term="k8s")` | Returns infrastructure definitions matching "k8s" |
| TC-infra-004 | List | Filter by deployment_type | `harness_list(resource_type="infrastructure", environment_id="my_env", deployment_type="Kubernetes")` | Returns only Kubernetes deployment type infrastructure |
| TC-infra-005 | List | Sort by name descending | `harness_list(resource_type="infrastructure", environment_id="my_env", sort="name", order="desc")` | Returns infrastructure sorted by name Z-A |
| TC-infra-006 | List | Combined filters: search + deployment_type + pagination | `harness_list(resource_type="infrastructure", environment_id="my_env", search_term="prod", deployment_type="Kubernetes", page=0, size=10)` | Returns filtered, paginated results |
| TC-infra-007 | List | List without environment_id (required field) | `harness_list(resource_type="infrastructure")` | Error or empty result: environment_id is required for listing infrastructure |
| TC-infra-008 | Get | Get infrastructure by identifier | `harness_get(resource_type="infrastructure", infrastructure_id="my_infra", environment_id="my_env")` | Returns full infrastructure definition details |
| TC-infra-009 | Get | Get infrastructure with scope overrides | `harness_get(resource_type="infrastructure", infrastructure_id="my_infra", environment_id="my_env", org_id="other_org", project_id="other_project")` | Returns infrastructure from specified org/project |
| TC-infra-010 | Create | Create infrastructure with required fields | `harness_create(resource_type="infrastructure", identifier="test_infra", name="Test Infra", type="KubernetesDirect", environmentRef="my_env")` | Infrastructure definition created |
| TC-infra-011 | Create | Create infrastructure with all fields | `harness_create(resource_type="infrastructure", identifier="full_infra", name="Full Infra", type="KubernetesDirect", environmentRef="my_env", deploymentType="Kubernetes", yaml="infrastructureDefinition:\n  name: Full Infra\n  identifier: full_infra")` | Infrastructure created with all fields |
| TC-infra-012 | Create | Create infrastructure with missing required field (type) | `harness_create(resource_type="infrastructure", identifier="bad_infra", name="Bad Infra", environmentRef="my_env")` | Error: type is required |
| TC-infra-013 | Create | Create infrastructure with missing environmentRef | `harness_create(resource_type="infrastructure", identifier="bad_infra", name="Bad Infra", type="KubernetesDirect")` | Error: environmentRef is required |
| TC-infra-014 | Update | Update infrastructure name and type | `harness_update(resource_type="infrastructure", infrastructure_id="my_infra", identifier="my_infra", name="Updated Infra", type="KubernetesGcp", environmentRef="my_env")` | Infrastructure updated |
| TC-infra-015 | Update | Update infrastructure with YAML | `harness_update(resource_type="infrastructure", infrastructure_id="my_infra", identifier="my_infra", name="My Infra", type="KubernetesDirect", environmentRef="my_env", yaml="infrastructureDefinition:\n  ...")` | Infrastructure updated with YAML |
| TC-infra-016 | Update | Update infrastructure with missing required fields | `harness_update(resource_type="infrastructure", infrastructure_id="my_infra", name="My Infra")` | Error: type and environmentRef are required |
| TC-infra-017 | Delete | Delete infrastructure by identifier | `harness_delete(resource_type="infrastructure", infrastructure_id="my_infra", environment_id="my_env")` | Infrastructure deleted successfully |
| TC-infra-018 | Execute | Move config inline to remote | `harness_execute(resource_type="infrastructure", action="move_configs", infrastructure_id="my_infra", environment_id="my_env", move_config_type="INLINE_TO_REMOTE", connector_ref="git_connector", repo_name="my-repo", branch="main", file_path=".harness/infra.yaml", commit_msg="Move infra to remote")` | Infrastructure config moved to remote |
| TC-infra-019 | Execute | Move config remote to inline | `harness_execute(resource_type="infrastructure", action="move_configs", infrastructure_id="my_infra", environment_id="my_env", move_config_type="REMOTE_TO_INLINE")` | Infrastructure config moved to inline |
| TC-infra-020 | Scope | List infrastructure with different org_id | `harness_list(resource_type="infrastructure", environment_id="my_env", org_id="custom_org")` | Returns infrastructure from specified org |
| TC-infra-021 | Error | Get non-existent infrastructure | `harness_get(resource_type="infrastructure", infrastructure_id="nonexistent_xyz", environment_id="my_env")` | Error: not found (404) |
| TC-infra-022 | Error | Delete non-existent infrastructure | `harness_delete(resource_type="infrastructure", infrastructure_id="nonexistent_xyz", environment_id="my_env")` | Error: not found (404) |
| TC-infra-023 | Edge | List infrastructure with empty results | `harness_list(resource_type="infrastructure", environment_id="my_env", search_term="zzz_no_match")` | Returns empty items array with total=0 |
| TC-infra-024 | Edge | List infrastructure with max pagination | `harness_list(resource_type="infrastructure", environment_id="my_env", page=0, size=100)` | Returns up to 100 infrastructure definitions |
| TC-infra-025 | Deep Link | Verify deep link in get response | `harness_get(resource_type="infrastructure", infrastructure_id="my_infra", environment_id="my_env")` | Response includes valid Harness UI deep link |

## Notes
- Infrastructure is always scoped to an environment; `environment_id` is required for list, get, and delete operations.
- The create/update body is passed directly (not wrapped under a key).
- Both create and update require `identifier`, `name`, `type`, and `environmentRef`.
- The `move_configs` execute action supports both `INLINE_TO_REMOTE` and `REMOTE_TO_INLINE`.
- Deep link format: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/environments`
