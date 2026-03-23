# Test Plan: Code Repository Security (`code_repo_security`)

| Field | Value |
|-------|-------|
| **Resource Type** | `code_repo_security` |
| **Display Name** | Code Repository Security |
| **Toolset** | scs |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | repo_id |
| **Filter Fields** | search_term |
| **Deep Link** | Yes (`/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/supply-chain/repositories/{repoId}`) |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-CRS-001 | List | List scanned code repositories | `harness_list(resource_type="code_repo_security")` | Returns list of scanned code repositories |
| TC-CRS-002 | List / Pagination | List with explicit page | `harness_list(resource_type="code_repo_security", page=1)` | Returns second page of repositories |
| TC-CRS-003 | List / Pagination | List with custom page size | `harness_list(resource_type="code_repo_security", size=5)` | Returns at most 5 repositories |
| TC-CRS-004 | List / Filter | List with search_term | `harness_list(resource_type="code_repo_security", search_term="backend")` | Returns repositories matching "backend" |
| TC-CRS-005 | Get | Get code repo security overview | `harness_get(resource_type="code_repo_security", repo_id="repo-1")` | Returns security overview for the repository |
| TC-CRS-006 | Get | Verify overview structure | `harness_get(resource_type="code_repo_security", repo_id="repo-1")` | Response contains vulnerability counts and security posture |
| TC-CRS-007 | Scope | List with explicit org_id and project_id | `harness_list(resource_type="code_repo_security", org_id="my-org", project_id="my-project")` | Returns repos for specified org/project |
| TC-CRS-008 | Scope | Get with explicit org_id and project_id | `harness_get(resource_type="code_repo_security", repo_id="repo-1", org_id="my-org", project_id="my-project")` | Returns overview for specified org/project |
| TC-CRS-009 | Error | Get without repo_id | `harness_get(resource_type="code_repo_security")` | Error: repo_id is required |
| TC-CRS-010 | Error | Get with non-existent repo_id | `harness_get(resource_type="code_repo_security", repo_id="nonexistent")` | Returns 404 or not-found error |
| TC-CRS-011 | Error | Authentication failure | `harness_list(resource_type="code_repo_security")` (invalid key) | Returns 401 Unauthorized error |
| TC-CRS-012 | Edge | Project with no scanned repos | `harness_list(resource_type="code_repo_security")` | Returns empty items list |
| TC-CRS-013 | List / Filter | Search term with no matches | `harness_list(resource_type="code_repo_security", search_term="nonexistent_xyz")` | Returns empty items list |
| TC-CRS-014 | Deep Link | Verify deep link in get response | `harness_get(resource_type="code_repo_security", repo_id="repo-1")` | Response includes deep link to repository in supply chain view |

## Notes
- `list` via `POST /ssca-manager/v1/orgs/{org}/projects/{project}/code-repos/list`.
- `get` via `GET /ssca-manager/v1/orgs/{org}/projects/{project}/code-repos/{codeRepo}/overview`.
- Path params: `org_id` → `org`, `project_id` → `project`, `repo_id` → `codeRepo`.
- List supports `page` and `limit` query params; `search_term` in request body.
- Get returns the code repository security overview including vulnerability counts.
