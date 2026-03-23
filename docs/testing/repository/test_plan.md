# Test Plan: Repository (`repository`)

| Field | Value |
|-------|-------|
| **Resource Type** | `repository` |
| **Display Name** | Repository |
| **Toolset** | repositories |
| **Scope** | project |
| **Operations** | list, get, create, update |
| **Execute Actions** | None |
| **Identifier Fields** | repo_id |
| **Filter Fields** | query, sort |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-repo-001 | List | List all repositories with defaults | `harness_list(resource_type="repository")` | Returns paginated list of repositories with metadata |
| TC-repo-002 | List | List repositories with pagination | `harness_list(resource_type="repository", page=1, limit=5)` | Returns page 1 with up to 5 repositories |
| TC-repo-003 | List | Search repositories by name | `harness_list(resource_type="repository", query="my-app")` | Returns repositories matching "my-app" keyword |
| TC-repo-004 | List | Sort repositories | `harness_list(resource_type="repository", sort="identifier")` | Returns repositories sorted by identifier |
| TC-repo-005 | List | Combined filter and pagination | `harness_list(resource_type="repository", query="service", sort="identifier", page=0, limit=10)` | Returns filtered, sorted repositories with pagination |
| TC-repo-006 | Get | Get repository by ID | `harness_get(resource_type="repository", repo_id="my-repo")` | Returns full repository details including default branch, description, timestamps |
| TC-repo-007 | Create | Create a minimal repository | `harness_create(resource_type="repository", body={"identifier": "new-repo"})` | Creates repository with default settings, returns created repo details |
| TC-repo-008 | Create | Create repository with all options | `harness_create(resource_type="repository", body={"identifier": "full-repo", "default_branch": "develop", "description": "A test repo", "is_public": false, "readme": true, "git_ignore": "Node", "license": "MIT"})` | Creates repository with all specified options |
| TC-repo-009 | Update | Update repository description | `harness_update(resource_type="repository", repo_id="my-repo", body={"description": "Updated description"})` | Updates description, returns updated repo |
| TC-repo-010 | Update | Update default branch | `harness_update(resource_type="repository", repo_id="my-repo", body={"default_branch": "develop"})` | Changes default branch to develop |
| TC-repo-011 | Update | Update visibility | `harness_update(resource_type="repository", repo_id="my-repo", body={"is_public": true})` | Changes repository visibility to public |
| TC-repo-012 | Scope | List repositories with explicit org/project | `harness_list(resource_type="repository", org_id="custom-org", project_id="custom-project")` | Returns repositories scoped to specified org/project |
| TC-repo-013 | Error | Get non-existent repository | `harness_get(resource_type="repository", repo_id="nonexistent-repo")` | Returns 404 error with meaningful message |
| TC-repo-014 | Error | Create repository with missing identifier | `harness_create(resource_type="repository", body={})` | Returns validation error for missing required field |
| TC-repo-015 | Error | Create duplicate repository | `harness_create(resource_type="repository", body={"identifier": "existing-repo"})` | Returns conflict error (409) |
| TC-repo-016 | Deep Link | Verify deep link in response | `harness_get(resource_type="repository", repo_id="my-repo")` | Response includes valid Harness UI deep link |
| TC-repo-017 | Edge | List with zero results | `harness_list(resource_type="repository", query="zzz-nonexistent-name-zzz")` | Returns empty list with total=0 |

## Notes
- Repository uses Harness Code API (`/code/api/v1/repos`)
- Identifier field is `repo_id` which maps to `repoIdentifier` in path params
- Create body requires `identifier`; other fields have sensible defaults
- Deep link format: `/ng/account/{accountId}/module/code/orgs/{orgIdentifier}/projects/{projectIdentifier}/repos/{repoIdentifier}`
