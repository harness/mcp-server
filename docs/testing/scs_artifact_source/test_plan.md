# Test Plan: SCS Artifact Source (`scs_artifact_source`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scs_artifact_source` |
| **Display Name** | SCS Artifact Source |
| **Toolset** | scs |
| **Scope** | project |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | source_id |
| **Filter Fields** | search_term _(via request body)_ |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-SAS-001 | List | List artifact sources with defaults | `harness_list(resource_type="scs_artifact_source")` | Returns list of artifact sources in the project |
| TC-SAS-002 | List / Pagination | List with explicit page | `harness_list(resource_type="scs_artifact_source", page=1)` | Returns second page of artifact sources |
| TC-SAS-003 | List / Pagination | List with custom page size | `harness_list(resource_type="scs_artifact_source", size=5)` | Returns at most 5 artifact sources |
| TC-SAS-004 | List / Filter | List with search_term | `harness_list(resource_type="scs_artifact_source", search_term="docker")` | Returns artifact sources matching "docker" |
| TC-SAS-005 | Scope | List with explicit org_id and project_id | `harness_list(resource_type="scs_artifact_source", org_id="my-org", project_id="my-project")` | Returns artifact sources for specified org/project |
| TC-SAS-006 | Scope | List with default org/project from config | `harness_list(resource_type="scs_artifact_source")` | Uses default org/project from environment config |
| TC-SAS-007 | Error | List without project scope | `harness_list(resource_type="scs_artifact_source")` (no project configured) | Error: project identifier required |
| TC-SAS-008 | Error | Unsupported operation (get) | `harness_get(resource_type="scs_artifact_source", source_id="src-1")` | Error: get operation not supported for scs_artifact_source |
| TC-SAS-009 | Error | Authentication failure | `harness_list(resource_type="scs_artifact_source")` (invalid key) | Returns 401 Unauthorized error |
| TC-SAS-010 | Edge | Empty project with no artifact sources | `harness_list(resource_type="scs_artifact_source")` | Returns empty items list |
| TC-SAS-011 | List / Filter | Search term with no matches | `harness_list(resource_type="scs_artifact_source", search_term="nonexistent_xyz")` | Returns empty items list |

## Notes
- `scs_artifact_source` only supports `list` via `POST /ssca-manager/v1/orgs/{org}/projects/{project}/artifact-sources`.
- The org and project are embedded in the URL path (not query params) — SCS API pattern.
- Pagination uses `page` and `limit` (mapped from `size`) query params.
- The `search_term` filter is sent in the request body, not as a query param.
