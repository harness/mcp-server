# Test Plan: Artifact (`artifact`)

| Field | Value |
|-------|-------|
| **Resource Type** | `artifact` |
| **Display Name** | Artifact |
| **Toolset** | registries |
| **Scope** | project |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | registry_id, artifact_id |
| **Filter Fields** | search |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-art-001 | List | List all artifacts in a registry | `harness_list(resource_type="artifact", registry_id="my-docker-registry")` | Returns paginated list of artifacts in the registry |
| TC-art-002 | List | List artifacts with pagination | `harness_list(resource_type="artifact", registry_id="my-docker-registry", page=0, size=5)` | Returns first page with up to 5 artifacts |
| TC-art-003 | List | Search artifacts by name | `harness_list(resource_type="artifact", registry_id="my-docker-registry", search="my-app")` | Returns artifacts matching "my-app" keyword |
| TC-art-004 | List | List artifacts page 2 | `harness_list(resource_type="artifact", registry_id="my-docker-registry", page=1, size=10)` | Returns second page of artifacts |
| TC-art-005 | List | Search with no results | `harness_list(resource_type="artifact", registry_id="my-docker-registry", search="zzz-nonexistent-zzz")` | Returns empty list |
| TC-art-006 | Scope | List artifacts with explicit org/project | `harness_list(resource_type="artifact", registry_id="my-docker-registry", org_id="custom-org", project_id="custom-project")` | Returns artifacts scoped to specified org/project |
| TC-art-007 | Error | List artifacts for non-existent registry | `harness_list(resource_type="artifact", registry_id="nonexistent-registry")` | Returns 404 error for registry not found |
| TC-art-008 | Error | List artifacts without registry_id | `harness_list(resource_type="artifact")` | Returns validation error for missing required registry_id |
| TC-art-009 | Deep Link | Verify deep link in list results | `harness_list(resource_type="artifact", registry_id="my-docker-registry")` | Response items include valid Harness UI deep links |
| TC-art-010 | Edge | List artifacts in empty registry | `harness_list(resource_type="artifact", registry_id="empty-registry")` | Returns empty list with total=0 |

## Notes
- Artifact is a child resource of registry; `registry_id` is always required
- Only supports `list` operation (no get, create, update, delete)
- Uses HAR API path: `/har/api/v1/registry/{spaceRef}/{registryName}/+/artifacts`
- List uses `size` (not `limit`) and `search` (not `query`) for consistency with HAR API
- Deep link format: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/registries/{registryIdentifier}/artifacts/{artifactIdentifier}`
