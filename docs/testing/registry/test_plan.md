# Test Plan: Registry (`registry`)

| Field | Value |
|-------|-------|
| **Resource Type** | `registry` |
| **Display Name** | Registry |
| **Toolset** | registries |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | registry_id |
| **Filter Fields** | search, type, package_type |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-reg-001 | List | List all registries | `harness_list(resource_type="registry")` | Returns paginated list of artifact registries |
| TC-reg-002 | List | List registries with pagination | `harness_list(resource_type="registry", page=0, size=5)` | Returns first page with up to 5 registries |
| TC-reg-003 | List | Search registries by name | `harness_list(resource_type="registry", search="docker")` | Returns registries matching "docker" keyword |
| TC-reg-004 | List | Filter by type (UPSTREAM) | `harness_list(resource_type="registry", type="UPSTREAM")` | Returns only upstream proxy registries |
| TC-reg-005 | List | Filter by type (VIRTUAL) | `harness_list(resource_type="registry", type="VIRTUAL")` | Returns only virtual registries |
| TC-reg-006 | List | Filter by package_type (DOCKER) | `harness_list(resource_type="registry", package_type="DOCKER")` | Returns only Docker registries |
| TC-reg-007 | List | Filter by package_type (NPM) | `harness_list(resource_type="registry", package_type="NPM")` | Returns only NPM registries |
| TC-reg-008 | List | Filter by package_type (MAVEN) | `harness_list(resource_type="registry", package_type="MAVEN")` | Returns only Maven registries |
| TC-reg-009 | List | Filter by package_type (PYTHON) | `harness_list(resource_type="registry", package_type="PYTHON")` | Returns only Python/PyPI registries |
| TC-reg-010 | List | Filter by package_type (HELM) | `harness_list(resource_type="registry", package_type="HELM")` | Returns only Helm chart registries |
| TC-reg-011 | List | Combined filters | `harness_list(resource_type="registry", type="UPSTREAM", package_type="DOCKER", search="proxy", page=0, size=10)` | Returns filtered registries matching all criteria |
| TC-reg-012 | Get | Get registry by ID | `harness_get(resource_type="registry", registry_id="my-docker-registry")` | Returns full registry details including type, package type, config |
| TC-reg-013 | Scope | List registries with explicit org/project | `harness_list(resource_type="registry", org_id="custom-org", project_id="custom-project")` | Returns registries scoped to specified org/project |
| TC-reg-014 | Error | Get non-existent registry | `harness_get(resource_type="registry", registry_id="nonexistent-registry")` | Returns 404 error |
| TC-reg-015 | Error | List with invalid type filter | `harness_list(resource_type="registry", type="INVALID")` | Returns validation error or empty results |
| TC-reg-016 | Error | List with invalid package_type | `harness_list(resource_type="registry", package_type="INVALID")` | Returns validation error or empty results |
| TC-reg-017 | Deep Link | Verify deep link in response | `harness_get(resource_type="registry", registry_id="my-docker-registry")` | Response includes valid Harness UI deep link |
| TC-reg-018 | Edge | List with zero results | `harness_list(resource_type="registry", search="zzz-nonexistent-zzz")` | Returns empty list with total=0 |

## Notes
- Registry uses the Harness Artifact Registry API (`/har/api/v1/`)
- Space ref is built from account/org/project path: `{accountId}/{orgId}/{projectId}`
- List uses `size` param (not `limit`) and `search` (not `query`) for consistency with HAR API
- Type enum: `UPSTREAM`, `VIRTUAL`
- Package type enum: `CARGO`, `COMPOSER`, `CONDA`, `DART`, `DOCKER`, `GENERIC`, `GO`, `HELM`, `HUGGINGFACE`, `MAVEN`, `NPM`, `NUGET`, `PYTHON`, `RAW`, `RPM`, `SWIFT`
- Deep link format: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/registries/{registryIdentifier}`
