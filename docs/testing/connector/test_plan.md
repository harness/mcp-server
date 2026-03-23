# Test Plan: Connector (`connector`)

| Field | Value |
|-------|-------|
| **Resource Type** | `connector` |
| **Display Name** | Connector |
| **Toolset** | connectors |
| **Scope** | project |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | test_connection |
| **Identifier Fields** | connector_id |
| **Filter Fields** | search_term, type, category, connector_names, connector_identifiers, connectivity_statuses, connector_connectivity_modes, description, inheriting_credentials_from_delegate, tags |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-conn-001 | List | List all connectors with defaults | `harness_list(resource_type="connector")` | Returns paginated list of connectors |
| TC-conn-002 | List | List connectors with pagination | `harness_list(resource_type="connector", page=1, size=5)` | Returns page 1 with up to 5 connectors |
| TC-conn-003 | List | List connectors filtered by search_term | `harness_list(resource_type="connector", filters={search_term: "github"})` | Returns connectors matching "github" keyword |
| TC-conn-004 | List | List connectors filtered by type Github | `harness_list(resource_type="connector", filters={type: "Github"})` | Returns only Github connectors |
| TC-conn-005 | List | List connectors filtered by type K8sCluster | `harness_list(resource_type="connector", filters={type: "K8sCluster"})` | Returns only Kubernetes cluster connectors |
| TC-conn-006 | List | List connectors filtered by type DockerRegistry | `harness_list(resource_type="connector", filters={type: "DockerRegistry"})` | Returns only Docker registry connectors |
| TC-conn-007 | List | List connectors filtered by category CLOUD_PROVIDER | `harness_list(resource_type="connector", filters={category: "CLOUD_PROVIDER"})` | Returns only cloud provider connectors |
| TC-conn-008 | List | List connectors filtered by category CODE_REPO | `harness_list(resource_type="connector", filters={category: "CODE_REPO"})` | Returns only code repo connectors |
| TC-conn-009 | List | List connectors filtered by category SECRET_MANAGER | `harness_list(resource_type="connector", filters={category: "SECRET_MANAGER"})` | Returns only secret manager connectors |
| TC-conn-010 | List | List connectors filtered by connectivity_statuses SUCCESS | `harness_list(resource_type="connector", filters={connectivity_statuses: "SUCCESS"})` | Returns only connectors with successful connectivity |
| TC-conn-011 | List | List connectors filtered by connectivity_statuses FAILURE | `harness_list(resource_type="connector", filters={connectivity_statuses: "FAILURE"})` | Returns only connectors with failed connectivity |
| TC-conn-012 | List | List connectors filtered by connector_connectivity_modes DELEGATE | `harness_list(resource_type="connector", filters={connector_connectivity_modes: "DELEGATE"})` | Returns only delegate-mode connectors |
| TC-conn-013 | List | List connectors filtered by connector_names | `harness_list(resource_type="connector", filters={connector_names: "my-github,my-docker"})` | Returns connectors matching the specified names |
| TC-conn-014 | List | List connectors filtered by connector_identifiers | `harness_list(resource_type="connector", filters={connector_identifiers: "github_conn,docker_conn"})` | Returns connectors matching the specified identifiers |
| TC-conn-015 | List | List connectors filtered by inheriting_credentials_from_delegate | `harness_list(resource_type="connector", filters={inheriting_credentials_from_delegate: true})` | Returns connectors inheriting delegate credentials |
| TC-conn-016 | List | List connectors filtered by description | `harness_list(resource_type="connector", filters={description: "production"})` | Returns connectors with "production" in description |
| TC-conn-017 | List | List connectors with combined filters | `harness_list(resource_type="connector", filters={type: "Github", category: "CODE_REPO", connectivity_statuses: "SUCCESS"}, page=0, size=10)` | Returns successful Github code repo connectors |
| TC-conn-018 | List | List connectors with scope override | `harness_list(resource_type="connector", org_id="custom_org", project_id="custom_project")` | Returns connectors from specified org/project |
| TC-conn-019 | Get | Get connector by identifier | `harness_get(resource_type="connector", resource_id="my_github_connector")` | Returns full connector details |
| TC-conn-020 | Get | Get connector with scope override | `harness_get(resource_type="connector", resource_id="my_connector", org_id="other_org", project_id="other_project")` | Returns connector from specified org/project |
| TC-conn-021 | Create | Create a Github connector | `harness_create(resource_type="connector", body={identifier: "github_test", name: "GitHub Test", type: "Github", spec: {url: "https://github.com", type: "Account", authentication: {type: "Http", spec: {type: "UsernameToken", spec: {tokenRef: "github_token"}}}}})` | Github connector created successfully |
| TC-conn-022 | Create | Create a DockerRegistry connector | `harness_create(resource_type="connector", body={identifier: "docker_test", name: "Docker Hub", type: "DockerRegistry", spec: {dockerRegistryUrl: "https://index.docker.io/v2/", providerType: "DockerHub", auth: {type: "UsernamePassword", spec: {usernameRef: "docker_user", passwordRef: "docker_pass"}}}})` | DockerRegistry connector created successfully |
| TC-conn-023 | Create | Create connector with description and tags | `harness_create(resource_type="connector", body={identifier: "aws_prod", name: "AWS Production", type: "Aws", spec: {credential: {type: "InheritFromDelegate"}}, description: "Production AWS account", tags: {env: "prod", team: "platform"}})` | Connector created with metadata |
| TC-conn-024 | Create | Create connector with missing required fields | `harness_create(resource_type="connector", body={identifier: "incomplete"})` | Error: Missing required fields (name, type, spec) |
| TC-conn-025 | Update | Update connector details | `harness_update(resource_type="connector", resource_id="my_connector", body={identifier: "my_connector", name: "Updated Connector", type: "Github", spec: {url: "https://github.com/org", type: "Account"}})` | Connector updated successfully |
| TC-conn-026 | Update | Update connector with tags | `harness_update(resource_type="connector", resource_id="my_connector", body={identifier: "my_connector", name: "My Connector", type: "Github", spec: {url: "https://github.com"}, tags: {updated: "true"}})` | Connector updated with new tags |
| TC-conn-027 | Delete | Delete connector by identifier | `harness_delete(resource_type="connector", resource_id="my_connector")` | Connector deleted successfully |
| TC-conn-028 | Delete | Delete connector with scope override | `harness_delete(resource_type="connector", resource_id="my_connector", org_id="other_org", project_id="other_project")` | Connector deleted from specified org/project |
| TC-conn-029 | Execute | Test connection for a connector | `harness_execute(resource_type="connector", action="test_connection", connector_id="my_github_connector")` | Connection test result returned (success/failure) |
| TC-conn-030 | Execute | Test connection with scope override | `harness_execute(resource_type="connector", action="test_connection", connector_id="my_connector", org_id="other_org", project_id="other_project")` | Connection test from specified org/project |
| TC-conn-031 | Error | Get connector with invalid identifier | `harness_get(resource_type="connector", resource_id="nonexistent_connector")` | Error: Connector not found (404) |
| TC-conn-032 | Error | Test connection for nonexistent connector | `harness_execute(resource_type="connector", action="test_connection", connector_id="nonexistent")` | Error: Connector not found (404) |
| TC-conn-033 | Error | Create connector in unauthorized project | `harness_create(resource_type="connector", org_id="no_access_org", project_id="no_access_project", body={identifier: "x", name: "X", type: "Github", spec: {}})` | Error: Unauthorized (401/403) |
| TC-conn-034 | Edge | List connectors with empty results | `harness_list(resource_type="connector", filters={type: "Rancher"})` | Returns empty items array with total=0 |
| TC-conn-035 | Edge | List connectors with max pagination | `harness_list(resource_type="connector", page=0, size=100)` | Returns up to 100 connectors |
| TC-conn-036 | Edge | List connectors filtered by tags | `harness_list(resource_type="connector", filters={tags: {env: "prod"}})` | Returns connectors with matching tags |

## Notes
- Connector list uses POST method with body filters for type, category, etc.
- CSV-formatted filters (connector_names, connector_identifiers) are split by comma
- The `type` field supports 50+ connector types (Github, DockerRegistry, K8sCluster, Aws, Gcp, Azure, etc.)
- The `category` field supports: CLOUD_PROVIDER, SECRET_MANAGER, CLOUD_COST, ARTIFACTORY, CODE_REPO, MONITORING, TICKETING, DATABASE, COMMUNICATION, DOCUMENTATION, ML_OPS
- `connectivity_statuses`: SUCCESS, FAILURE, PARTIAL, UNKNOWN
- `connector_connectivity_modes`: DELEGATE, MANAGER
- Create/update body is auto-wrapped in `{ connector: { ... } }` envelope
- `test_connection` execute action requires no body — connector identified by path param
