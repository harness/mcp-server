# Test Plan: Artifact Security (`artifact_security`)

| Field | Value |
|-------|-------|
| **Resource Type** | `artifact_security` |
| **Display Name** | Artifact Security |
| **Toolset** | scs |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | source_id, artifact_id |
| **Filter Fields** | search_term |
| **Deep Link** | Yes (`/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/supply-chain/artifacts/{artifactId}`) |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-AS-001 | List | List artifacts from a source | `harness_list(resource_type="artifact_security", source_id="src-1")` | Returns list of artifacts from the specified source |
| TC-AS-002 | List / Pagination | List with explicit page | `harness_list(resource_type="artifact_security", source_id="src-1", page=1)` | Returns second page of artifacts |
| TC-AS-003 | List / Pagination | List with custom page size | `harness_list(resource_type="artifact_security", source_id="src-1", size=5)` | Returns at most 5 artifacts |
| TC-AS-004 | List / Filter | List with search_term | `harness_list(resource_type="artifact_security", source_id="src-1", search_term="nginx")` | Returns artifacts matching "nginx" |
| TC-AS-005 | List / Query | List with sort and order | `harness_list(resource_type="artifact_security", source_id="src-1", sort="name", order="asc")` | Returns sorted artifacts |
| TC-AS-006 | Get | Get artifact security overview | `harness_get(resource_type="artifact_security", source_id="src-1", artifact_id="art-1")` | Returns artifact security overview with vulnerability summary |
| TC-AS-007 | Scope | List with explicit org_id and project_id | `harness_list(resource_type="artifact_security", source_id="src-1", org_id="my-org", project_id="my-project")` | Returns artifacts for specified org/project |
| TC-AS-008 | Error | List without source_id | `harness_list(resource_type="artifact_security")` | Error: source_id is required for listing artifacts |
| TC-AS-009 | Error | Get without artifact_id | `harness_get(resource_type="artifact_security", source_id="src-1")` | Error: artifact_id is required |
| TC-AS-010 | Error | Get with non-existent artifact | `harness_get(resource_type="artifact_security", source_id="src-1", artifact_id="nonexistent")` | Returns 404 or not-found error |
| TC-AS-011 | Error | Authentication failure | `harness_list(resource_type="artifact_security", source_id="src-1")` (invalid key) | Returns 401 Unauthorized error |
| TC-AS-012 | Edge | Source with no artifacts | `harness_list(resource_type="artifact_security", source_id="empty-src")` | Returns empty items list |
| TC-AS-013 | Deep Link | Verify deep link in get response | `harness_get(resource_type="artifact_security", source_id="src-1", artifact_id="art-1")` | Response includes deep link to artifact in supply chain view |
| TC-AS-014 | List / Filter | Search term with no matches | `harness_list(resource_type="artifact_security", source_id="src-1", search_term="nonexistent_xyz")` | Returns empty items list |

## Notes
- `list` via `POST /ssca-manager/v1/orgs/{org}/projects/{project}/artifact-sources/{source}/artifacts`.
- `get` via `GET /ssca-manager/v1/orgs/{org}/projects/{project}/artifact-sources/{source}/artifacts/{artifact}/overview`.
- Path params: `org_id` → `org`, `project_id` → `project`, `source_id` → `source`, `artifact_id` → `artifact`.
- List supports `sort` and `order` query params in addition to `page` and `limit`.
- `search_term` is sent in the request body for list operations.
- Get returns the artifact security overview including vulnerability summary.
