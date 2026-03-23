# Test Plan: SCS Artifact Component (`scs_artifact_component`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scs_artifact_component` |
| **Display Name** | SCS Artifact Component |
| **Toolset** | scs |
| **Scope** | project |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | artifact_id |
| **Filter Fields** | search_term |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-SAC-001 | List | List components of an artifact | `harness_list(resource_type="scs_artifact_component", artifact_id="art-1")` | Returns list of components (dependencies) in the artifact |
| TC-SAC-002 | List / Pagination | List with explicit page | `harness_list(resource_type="scs_artifact_component", artifact_id="art-1", page=1)` | Returns second page of components |
| TC-SAC-003 | List / Pagination | List with custom page size | `harness_list(resource_type="scs_artifact_component", artifact_id="art-1", size=10)` | Returns at most 10 components |
| TC-SAC-004 | List / Filter | List with search_term | `harness_list(resource_type="scs_artifact_component", artifact_id="art-1", search_term="lodash")` | Returns components matching "lodash" |
| TC-SAC-005 | List / Query | List with sort and order | `harness_list(resource_type="scs_artifact_component", artifact_id="art-1", sort="name", order="asc")` | Returns sorted components |
| TC-SAC-006 | Scope | List with explicit org_id and project_id | `harness_list(resource_type="scs_artifact_component", artifact_id="art-1", org_id="my-org", project_id="my-project")` | Returns components for specified org/project |
| TC-SAC-007 | Error | List without artifact_id | `harness_list(resource_type="scs_artifact_component")` | Error: artifact_id is required |
| TC-SAC-008 | Error | Non-existent artifact_id | `harness_list(resource_type="scs_artifact_component", artifact_id="nonexistent")` | Returns 404 or empty list |
| TC-SAC-009 | Error | Unsupported operation (get) | `harness_get(resource_type="scs_artifact_component", artifact_id="art-1")` | Error: get operation not supported |
| TC-SAC-010 | Edge | Artifact with no components | `harness_list(resource_type="scs_artifact_component", artifact_id="empty-art")` | Returns empty items list |
| TC-SAC-011 | List / Filter | Search term with no matches | `harness_list(resource_type="scs_artifact_component", artifact_id="art-1", search_term="nonexistent_xyz")` | Returns empty items list |

## Notes
- `scs_artifact_component` only supports `list` via `POST /ssca-manager/v1/orgs/{org}/projects/{project}/artifacts/{artifact}/components`.
- Path params: `org_id` → `org`, `project_id` → `project`, `artifact_id` → `artifact`.
- Supports `sort` and `order` query params in addition to `page` and `limit`.
- `search_term` is sent in the request body.
- Components represent dependencies within an artifact (SBOM contents).
