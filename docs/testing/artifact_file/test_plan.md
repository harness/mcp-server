# Test Plan: Artifact File (`artifact_file`)

| Field | Value |
|-------|-------|
| **Resource Type** | `artifact_file` |
| **Display Name** | Artifact File |
| **Toolset** | registries |
| **Scope** | project |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | registry_id, artifact_id, version |
| **Filter Fields** | search, sort_order, sort_field |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-af-001 | List | List all files in an artifact version | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app", version="1.0.0")` | Returns paginated list of files in the artifact version |
| TC-af-002 | List | List files with pagination | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app", version="1.0.0", page=0, size=5)` | Returns first page with up to 5 files |
| TC-af-003 | List | Search files by name | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app", version="1.0.0", search="layer")` | Returns files matching "layer" keyword |
| TC-af-004 | List | Sort files by field | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app", version="1.0.0", sort_field="size", sort_order="desc")` | Returns files sorted by size descending |
| TC-af-005 | List | Combined filters | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app", version="1.0.0", search="config", sort_field="name", sort_order="asc", page=0, size=10)` | Returns filtered and sorted files |
| TC-af-006 | Scope | List files with explicit org/project | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app", version="1.0.0", org_id="custom-org", project_id="custom-project")` | Returns files scoped to specified org/project |
| TC-af-007 | Error | List files for non-existent registry | `harness_list(resource_type="artifact_file", registry_id="nonexistent-registry", artifact_id="my-app", version="1.0.0")` | Returns 404 error for registry not found |
| TC-af-008 | Error | List files for non-existent artifact | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="nonexistent", version="1.0.0")` | Returns 404 error for artifact not found |
| TC-af-009 | Error | List files for non-existent version | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app", version="99.99.99")` | Returns 404 error for version not found |
| TC-af-010 | Error | List files without required params | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app")` | Returns validation error for missing version |
| TC-af-011 | Edge | List files for version with no files | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="empty-artifact", version="0.0.1")` | Returns empty list |
| TC-af-012 | Edge | Search with no matching files | `harness_list(resource_type="artifact_file", registry_id="my-docker-registry", artifact_id="my-app", version="1.0.0", search="zzz-nonexistent-zzz")` | Returns empty list |

## Notes
- Artifact file is the deepest child resource: registry > artifact > version > files
- Requires all three parent identifiers: `registry_id`, `artifact_id`, `version`
- Only supports `list` operation (no get, create, update, delete)
- Uses HAR API path: `/har/api/v1/registry/{registryRef}/+/artifact/{artifact}/+/version/{version}/files`
- Supports `sort_order` and `sort_field` query params in addition to `search`
- List uses `size` (not `limit`) for consistency with HAR API
