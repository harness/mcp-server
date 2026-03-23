# Test Plan: Artifact Version (`artifact_version`)

| Field | Value |
|-------|-------|
| **Resource Type** | `artifact_version` |
| **Display Name** | Artifact Version |
| **Toolset** | registries |
| **Scope** | project |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | registry_id, artifact_id, version |
| **Filter Fields** | search |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-av-001 | List | List all versions of an artifact | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry", artifact_id="my-app")` | Returns paginated list of artifact versions |
| TC-av-002 | List | List versions with pagination | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry", artifact_id="my-app", page=0, size=5)` | Returns first page with up to 5 versions |
| TC-av-003 | List | Search versions by name | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry", artifact_id="my-app", search="1.0")` | Returns versions matching "1.0" keyword |
| TC-av-004 | List | List versions page 2 | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry", artifact_id="my-app", page=1, size=10)` | Returns second page of versions |
| TC-av-005 | List | Search with no results | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry", artifact_id="my-app", search="zzz-nonexistent-zzz")` | Returns empty list |
| TC-av-006 | Scope | List versions with explicit org/project | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry", artifact_id="my-app", org_id="custom-org", project_id="custom-project")` | Returns versions scoped to specified org/project |
| TC-av-007 | Error | List versions for non-existent registry | `harness_list(resource_type="artifact_version", registry_id="nonexistent-registry", artifact_id="my-app")` | Returns 404 error for registry not found |
| TC-av-008 | Error | List versions for non-existent artifact | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry", artifact_id="nonexistent-artifact")` | Returns 404 error for artifact not found |
| TC-av-009 | Error | List versions without required params | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry")` | Returns validation error for missing artifact_id |
| TC-av-010 | Edge | List versions for artifact with single version | `harness_list(resource_type="artifact_version", registry_id="my-docker-registry", artifact_id="new-app")` | Returns list with exactly one version |

## Notes
- Artifact version is a child of artifact, which is a child of registry; both `registry_id` and `artifact_id` are required
- Only supports `list` operation (no get, create, update, delete)
- Uses HAR API path: `/har/api/v1/registry/{registryRef}/+/artifact/{artifact}/+/versions`
- Identifier fields include `version` but it's primarily used for identifying specific versions in child resources (artifact_file)
- List uses `size` (not `limit`) and `search` (not `query`) for consistency with HAR API
