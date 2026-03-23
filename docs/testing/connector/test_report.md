# Test Report: Connector (`connector`)

| Field | Value |
|-------|-------|
| **Resource Type** | `connector` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-conn-001 | List all connectors with defaults | `harness_list(resource_type="connector")` | Returns paginated list of connectors | ✅ Passed | Returns 16 connectors with status, connectivity info, deep links |  |
| TC-conn-002 | List connectors with pagination | `harness_list(resource_type="connector", page=1, size=5)` | Returns page 1 with up to 5 connectors | ⬜ Pending | | |
| TC-conn-003 | List connectors filtered by search_term | `harness_list(resource_type="connector", filters={search_term: "github"})` | Returns connectors matching "github" keyword | ⬜ Pending | | |
| TC-conn-004 | List connectors filtered by type Github | `harness_list(resource_type="connector", filters={type: "Github"})` | Returns only Github connectors | ⬜ Pending | | |
| TC-conn-005 | List connectors filtered by type K8sCluster | `harness_list(resource_type="connector", filters={type: "K8sCluster"})` | Returns only Kubernetes cluster connectors | ⬜ Pending | | |
| TC-conn-006 | List connectors filtered by type DockerRegistry | `harness_list(resource_type="connector", filters={type: "DockerRegistry"})` | Returns only Docker registry connectors | ⬜ Pending | | |
| TC-conn-007 | List connectors filtered by category CLOUD_PROVIDER | `harness_list(resource_type="connector", filters={category: "CLOUD_PROVIDER"})` | Returns only cloud provider connectors | ⬜ Pending | | |
| TC-conn-008 | List connectors filtered by category CODE_REPO | `harness_list(resource_type="connector", filters={category: "CODE_REPO"})` | Returns only code repo connectors | ⬜ Pending | | |
| TC-conn-009 | List connectors filtered by category SECRET_MANAGER | `harness_list(resource_type="connector", filters={category: "SECRET_MANAGER"})` | Returns only secret manager connectors | ⬜ Pending | | |
| TC-conn-010 | List connectors filtered by connectivity_statuses SUCCESS | `harness_list(resource_type="connector", filters={connectivity_statuses: "SUCCESS"})` | Returns only connectors with successful connectivity | ⬜ Pending | | |
| TC-conn-011 | List connectors filtered by connectivity_statuses FAILURE | `harness_list(resource_type="connector", filters={connectivity_statuses: "FAILURE"})` | Returns only connectors with failed connectivity | ⬜ Pending | | |
| TC-conn-012 | List connectors filtered by connector_connectivity_modes DELEGATE | `harness_list(resource_type="connector", filters={connector_connectivity_modes: "DELEGATE"})` | Returns only delegate-mode connectors | ⬜ Pending | | |
| TC-conn-013 | List connectors filtered by connector_names | `harness_list(resource_type="connector", filters={connector_names: "my-github,my-docker"})` | Returns connectors matching the specified names | ⬜ Pending | | |
| TC-conn-014 | List connectors filtered by connector_identifiers | `harness_list(resource_type="connector", filters={connector_identifiers: "github_conn,docker_conn"})` | Returns connectors matching the specified identifiers | ⬜ Pending | | |
| TC-conn-015 | List connectors filtered by inheriting_credentials_from_delegate | `harness_list(resource_type="connector", filters={inheriting_credentials_from_delegate: true})` | Returns connectors inheriting delegate credentials | ⬜ Pending | | |
| TC-conn-016 | List connectors filtered by description | `harness_list(resource_type="connector", filters={description: "production"})` | Returns connectors with "production" in description | ⬜ Pending | | |
| TC-conn-017 | List connectors with combined filters | `harness_list(resource_type="connector", filters={type: "Github", category: "CODE_REPO", connectivity_statuses: "SUCCESS"}, page=0, size=10)` | Returns successful Github code repo connectors | ⬜ Pending | | |
| TC-conn-018 | List connectors with scope override | `harness_list(resource_type="connector", org_id="custom_org", project_id="custom_project")` | Returns connectors from specified org/project | ⬜ Pending | | |
| TC-conn-019 | Get connector by identifier | `harness_get(resource_type="connector", resource_id="my_github_connector")` | Returns full connector details | ⬜ Pending | | |
| TC-conn-020 | Get connector with scope override | `harness_get(resource_type="connector", resource_id="my_connector", org_id="other_org", project_id="other_project")` | Returns connector from specified org/project | ⬜ Pending | | |
| TC-conn-021 | Create a Github connector | `harness_create(resource_type="connector", body={identifier: "github_test", name: "GitHub Test", type: "Github", spec: {url: "https://github.com", type: "Account", authentication: {type: "Http", spec: {type: "UsernameToken", spec: {tokenRef: "github_token"}}}}})` | Github connector created successfully | ⬜ Pending | | |
| TC-conn-022 | Create a DockerRegistry connector | `harness_create(resource_type="connector", body={identifier: "docker_test", name: "Docker Hub", type: "DockerRegistry", spec: {dockerRegistryUrl: "https://index.docker.io/v2/", providerType: "DockerHub", auth: {type: "UsernamePassword", spec: {usernameRef: "docker_user", passwordRef: "docker_pass"}}}})` | DockerRegistry connector created successfully | ⬜ Pending | | |
| TC-conn-023 | Create connector with description and tags | `harness_create(resource_type="connector", body={identifier: "aws_prod", name: "AWS Production", type: "Aws", spec: {credential: {type: "InheritFromDelegate"}}, description: "Production AWS account", tags: {env: "prod", team: "platform"}})` | Connector created with metadata | ⬜ Pending | | |
| TC-conn-024 | Create connector with missing required fields | `harness_create(resource_type="connector", body={identifier: "incomplete"})` | Error: Missing required fields (name, type, spec) | ⬜ Pending | | |
| TC-conn-025 | Update connector details | `harness_update(resource_type="connector", resource_id="my_connector", body={identifier: "my_connector", name: "Updated Connector", type: "Github", spec: {url: "https://github.com/org", type: "Account"}})` | Connector updated successfully | ⬜ Pending | | |
| TC-conn-026 | Update connector with tags | `harness_update(resource_type="connector", resource_id="my_connector", body={identifier: "my_connector", name: "My Connector", type: "Github", spec: {url: "https://github.com"}, tags: {updated: "true"}})` | Connector updated with new tags | ⬜ Pending | | |
| TC-conn-027 | Delete connector by identifier | `harness_delete(resource_type="connector", resource_id="my_connector")` | Connector deleted successfully | ⬜ Pending | | |
| TC-conn-028 | Delete connector with scope override | `harness_delete(resource_type="connector", resource_id="my_connector", org_id="other_org", project_id="other_project")` | Connector deleted from specified org/project | ⬜ Pending | | |
| TC-conn-029 | Test connection for a connector | `harness_execute(resource_type="connector", action="test_connection", connector_id="my_github_connector")` | Connection test result returned (success/failure) | ⬜ Pending | | |
| TC-conn-030 | Test connection with scope override | `harness_execute(resource_type="connector", action="test_connection", connector_id="my_connector", org_id="other_org", project_id="other_project")` | Connection test from specified org/project | ⬜ Pending | | |
| TC-conn-031 | Get connector with invalid identifier | `harness_get(resource_type="connector", resource_id="nonexistent_connector")` | Error: Connector not found (404) | ⬜ Pending | | |
| TC-conn-032 | Test connection for nonexistent connector | `harness_execute(resource_type="connector", action="test_connection", connector_id="nonexistent")` | Error: Connector not found (404) | ⬜ Pending | | |
| TC-conn-033 | Create connector in unauthorized project | `harness_create(resource_type="connector", org_id="no_access_org", project_id="no_access_project", body={identifier: "x", name: "X", type: "Github", spec: {}})` | Error: Unauthorized (401/403) | ⬜ Pending | | |
| TC-conn-034 | List connectors with empty results | `harness_list(resource_type="connector", filters={type: "Rancher"})` | Returns empty items array with total=0 | ⬜ Pending | | |
| TC-conn-035 | List connectors with max pagination | `harness_list(resource_type="connector", page=0, size=100)` | Returns up to 100 connectors | ⬜ Pending | | |
| TC-conn-036 | List connectors filtered by tags | `harness_list(resource_type="connector", filters={tags: {env: "prod"}})` | Returns connectors with matching tags | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 36 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 35 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

_(To be filled during testing)_
