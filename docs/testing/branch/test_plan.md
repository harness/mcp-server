# Test Plan: Branch (`branch`)

| Field | Value |
|-------|-------|
| **Resource Type** | `branch` |
| **Display Name** | Branch |
| **Toolset** | repositories |
| **Scope** | project |
| **Operations** | list, get, create, delete |
| **Execute Actions** | None |
| **Identifier Fields** | repo_id, branch_name |
| **Filter Fields** | query, sort, order |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-br-001 | List | List all branches in a repo | `harness_list(resource_type="branch", repo_id="my-repo")` | Returns paginated list of branches with latest commit info |
| TC-br-002 | List | List branches with pagination | `harness_list(resource_type="branch", repo_id="my-repo", page=0, limit=5)` | Returns first page with up to 5 branches |
| TC-br-003 | List | Search branches by name | `harness_list(resource_type="branch", repo_id="my-repo", query="feature")` | Returns branches matching "feature" keyword |
| TC-br-004 | List | Sort branches | `harness_list(resource_type="branch", repo_id="my-repo", sort="name")` | Returns branches sorted by name |
| TC-br-005 | List | Sort branches descending | `harness_list(resource_type="branch", repo_id="my-repo", sort="name", order="desc")` | Returns branches sorted by name in descending order |
| TC-br-006 | List | Combined filters | `harness_list(resource_type="branch", repo_id="my-repo", query="fix", sort="name", order="asc", page=0, limit=10)` | Returns filtered, sorted branches with pagination |
| TC-br-007 | Get | Get branch by name | `harness_get(resource_type="branch", repo_id="my-repo", branch_name="main")` | Returns branch details including latest commit |
| TC-br-008 | Get | Get feature branch | `harness_get(resource_type="branch", repo_id="my-repo", branch_name="feature/new-ui")` | Returns branch details for feature branch |
| TC-br-009 | Create | Create branch from another branch | `harness_create(resource_type="branch", repo_id="my-repo", body={"name": "feature/test", "target": "main"})` | Creates new branch from main, returns branch details |
| TC-br-010 | Create | Create branch from commit SHA | `harness_create(resource_type="branch", repo_id="my-repo", body={"name": "hotfix/urgent", "target": "abc123def"})` | Creates new branch from specific commit SHA |
| TC-br-011 | Delete | Delete a branch | `harness_delete(resource_type="branch", repo_id="my-repo", branch_name="feature/old")` | Deletes the branch successfully |
| TC-br-012 | Scope | List branches with explicit org/project | `harness_list(resource_type="branch", repo_id="my-repo", org_id="custom-org", project_id="custom-project")` | Returns branches scoped to specified org/project |
| TC-br-013 | Error | Get non-existent branch | `harness_get(resource_type="branch", repo_id="my-repo", branch_name="nonexistent-branch")` | Returns 404 error |
| TC-br-014 | Error | Create branch missing required fields | `harness_create(resource_type="branch", repo_id="my-repo", body={"name": "test"})` | Returns validation error for missing target field |
| TC-br-015 | Error | Create duplicate branch | `harness_create(resource_type="branch", repo_id="my-repo", body={"name": "main", "target": "main"})` | Returns conflict error |
| TC-br-016 | Error | List branches for non-existent repo | `harness_list(resource_type="branch", repo_id="nonexistent-repo")` | Returns 404 error for repository |
| TC-br-017 | Edge | Branch name with slashes | `harness_get(resource_type="branch", repo_id="my-repo", branch_name="feature/deep/nested")` | Handles branch names with path separators correctly |

## Notes
- Branch is a child resource of repository; `repo_id` is always required
- Branch names can contain slashes (e.g., `feature/my-branch`) — ensure URL encoding is handled
- Create requires both `name` and `target` (branch name or commit SHA)
- Deep link format: `/ng/account/{accountId}/module/code/orgs/{orgIdentifier}/projects/{projectIdentifier}/repos/{repoIdentifier}/files/{branchName}`
