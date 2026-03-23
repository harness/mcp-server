# Test Plan: Service Override (`service_override`)

| Field | Value |
|-------|-------|
| **Resource Type** | `service_override` |
| **Display Name** | Service Override |
| **Toolset** | overrides |
| **Scope** | project |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | None |
| **Identifier Fields** | override_id |
| **Filter Fields** | environment_id, service_id, sort |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-ovr-001 | List | List overrides for an environment | `harness_list(resource_type="service_override", environment_id="my_env")` | Returns paginated list of service overrides for the environment |
| TC-ovr-002 | List | List overrides with pagination | `harness_list(resource_type="service_override", environment_id="my_env", page=0, size=5)` | Returns page 0 with up to 5 overrides |
| TC-ovr-003 | List | Filter overrides by service_id | `harness_list(resource_type="service_override", environment_id="my_env", service_id="my_service")` | Returns overrides for the specific service in the environment |
| TC-ovr-004 | List | Sort overrides | `harness_list(resource_type="service_override", environment_id="my_env", sort="lastModifiedAt,desc")` | Returns overrides sorted by last modified descending |
| TC-ovr-005 | List | Combined filters: environment + service + sort | `harness_list(resource_type="service_override", environment_id="my_env", service_id="my_service", sort="lastModifiedAt,desc", page=0, size=10)` | Returns filtered, sorted, paginated overrides |
| TC-ovr-006 | List | List without environment_id | `harness_list(resource_type="service_override")` | Error or empty: environment_id is required for listing overrides |
| TC-ovr-007 | Get | Get override by identifier | `harness_get(resource_type="service_override", override_id="my_override")` | Returns full override details including YAML, type, serviceRef, environmentRef |
| TC-ovr-008 | Get | Get override with scope overrides | `harness_get(resource_type="service_override", override_id="my_override", org_id="other_org", project_id="other_project")` | Returns override from specified org/project |
| TC-ovr-009 | Create | Create ENV_SERVICE_OVERRIDE with spec | `harness_create(resource_type="service_override", environmentRef="my_env", type="ENV_SERVICE_OVERRIDE", serviceRef="my_service", spec={"variables": [{"name": "replicas", "type": "String", "value": "3"}]})` | Override created with variable overrides |
| TC-ovr-010 | Create | Create ENV_GLOBAL_OVERRIDE with YAML | `harness_create(resource_type="service_override", environmentRef="my_env", type="ENV_GLOBAL_OVERRIDE", yaml="overrides:\n  variables:\n    - name: log_level\n      type: String\n      value: debug")` | Override created from YAML |
| TC-ovr-011 | Create | Create INFRA_SERVICE_OVERRIDE | `harness_create(resource_type="service_override", environmentRef="my_env", type="INFRA_SERVICE_OVERRIDE", serviceRef="my_service", infraIdentifier="my_infra", spec={"variables": [{"name": "namespace", "type": "String", "value": "prod"}]})` | Infrastructure-scoped override created |
| TC-ovr-012 | Create | Create override with missing required field (type) | `harness_create(resource_type="service_override", environmentRef="my_env")` | Error: type is required |
| TC-ovr-013 | Create | Create override with missing environmentRef | `harness_create(resource_type="service_override", type="ENV_GLOBAL_OVERRIDE")` | Error: environmentRef is required |
| TC-ovr-014 | Update | Update override spec variables | `harness_update(resource_type="service_override", override_id="my_override", environmentRef="my_env", type="ENV_SERVICE_OVERRIDE", serviceRef="my_service", spec={"variables": [{"name": "replicas", "type": "String", "value": "5"}]})` | Override updated with new variable values |
| TC-ovr-015 | Update | Update override with YAML | `harness_update(resource_type="service_override", override_id="my_override", environmentRef="my_env", type="ENV_SERVICE_OVERRIDE", yaml="overrides:\n  variables:\n    - name: replicas\n      type: String\n      value: 10")` | Override updated from YAML |
| TC-ovr-016 | Update | Update override with missing required fields | `harness_update(resource_type="service_override", override_id="my_override")` | Error: environmentRef and type are required |
| TC-ovr-017 | Delete | Delete override by identifier | `harness_delete(resource_type="service_override", override_id="my_override")` | Override deleted successfully |
| TC-ovr-018 | Scope | List overrides with different org_id | `harness_list(resource_type="service_override", environment_id="my_env", org_id="custom_org")` | Returns overrides from specified org |
| TC-ovr-019 | Scope | List overrides with different project_id | `harness_list(resource_type="service_override", environment_id="my_env", org_id="default", project_id="other_project")` | Returns overrides from specified project |
| TC-ovr-020 | Error | Get non-existent override | `harness_get(resource_type="service_override", override_id="nonexistent_ovr_xyz")` | Error: override not found (404) |
| TC-ovr-021 | Error | Delete non-existent override | `harness_delete(resource_type="service_override", override_id="nonexistent_ovr_xyz")` | Error: override not found (404) |
| TC-ovr-022 | Error | Create with invalid override type | `harness_create(resource_type="service_override", environmentRef="my_env", type="INVALID_TYPE")` | Error: invalid override type |
| TC-ovr-023 | Edge | List overrides with empty results | `harness_list(resource_type="service_override", environment_id="empty_env")` | Returns empty items array with total=0 |
| TC-ovr-024 | Edge | List overrides with max pagination | `harness_list(resource_type="service_override", environment_id="my_env", page=0, size=100)` | Returns up to 100 overrides |
| TC-ovr-025 | Deep Link | Verify deep link in get response | `harness_get(resource_type="service_override", override_id="my_override")` | Response includes valid Harness UI deep link with serviceOverrideType param |

## Notes
- Service overrides are always scoped to an environment; `environment_id` is required for listing.
- The list endpoint uses `totalItems` instead of the standard `totalElements`.
- The body builder auto-injects `orgIdentifier` and `projectIdentifier` into the request body.
- Valid override types: `ENV_GLOBAL_OVERRIDE`, `ENV_SERVICE_OVERRIDE`, `INFRA_GLOBAL_OVERRIDE`, `INFRA_SERVICE_OVERRIDE`, `CLUSTER_GLOBAL_OVERRIDE`, `CLUSTER_SERVICE_OVERRIDE`.
- Override configuration can be provided via `spec` (structured) or `yaml` (string).
- Deep link format: `/ng/account/{accountId}/all/cd/orgs/{orgIdentifier}/projects/{projectIdentifier}/serviceOverrides?serviceOverrideType={type}`
