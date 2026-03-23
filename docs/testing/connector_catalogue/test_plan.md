# Test Plan: Connector Catalogue (`connector_catalogue`)

| Field | Value |
|-------|-------|
| **Resource Type** | `connector_catalogue` |
| **Display Name** | Connector Catalogue |
| **Toolset** | connectors |
| **Scope** | account |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | _(none)_ |
| **Filter Fields** | _(none)_ |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-ccat-001 | List | List all available connector types | `harness_list(resource_type="connector_catalogue")` | Returns catalogue of all available connector types |
| TC-ccat-002 | List | List connector catalogue with default scope | `harness_list(resource_type="connector_catalogue")` | Returns account-level catalogue (no org/project required) |
| TC-ccat-003 | Scope | List connector catalogue with explicit org_id | `harness_list(resource_type="connector_catalogue", org_id="default")` | Returns catalogue (scope ignored, account-level resource) |
| TC-ccat-004 | Edge | Verify catalogue contains known types | `harness_list(resource_type="connector_catalogue")` | Catalogue includes Github, DockerRegistry, K8sCluster, Aws, Gcp, Azure |
| TC-ccat-005 | Edge | Verify catalogue structure | `harness_list(resource_type="connector_catalogue")` | Response contains categorized connector types with metadata |
| TC-ccat-006 | Error | List catalogue with invalid account credentials | `harness_list(resource_type="connector_catalogue")` (with invalid API key) | Error: Unauthorized (401) |
| TC-ccat-007 | Edge | Verify catalogue includes all categories | `harness_list(resource_type="connector_catalogue")` | Contains CLOUD_PROVIDER, SECRET_MANAGER, CODE_REPO, MONITORING, etc. |
| TC-ccat-008 | Edge | Repeated calls return consistent results | `harness_list(resource_type="connector_catalogue")` called twice | Both calls return identical catalogue data |

## Notes
- Connector catalogue is a read-only, account-scoped resource
- No filters or pagination — returns the entire catalogue in one call
- No identifier fields — not an entity that can be retrieved individually
- Uses GET `/ng/api/connectors/catalogue` endpoint
- Useful for discovering available connector types before creating connectors
