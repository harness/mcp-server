# Test Plan: Pull Request (`pull_request`)

| Field | Value |
|-------|-------|
| **Resource Type** | `pull_request` |
| **Display Name** | Pull Request |
| **Toolset** | pull-requests |
| **Scope** | account |
| **Operations** | list, get, create, update |
| **Execute Actions** | merge |
| **Identifier Fields** | repo_id, pr_number |
| **Filter Fields** | state, query |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-pr-001 | List | List all pull requests | `harness_list(resource_type="pull_request", repo_id="my-repo")` | Returns paginated list of pull requests |
| TC-pr-002 | List | List PRs with pagination | `harness_list(resource_type="pull_request", repo_id="my-repo", page=0, limit=5)` | Returns first page with up to 5 PRs |
| TC-pr-003 | List | Filter PRs by state (open) | `harness_list(resource_type="pull_request", repo_id="my-repo", state="open")` | Returns only open pull requests |
| TC-pr-004 | List | Filter PRs by state (closed) | `harness_list(resource_type="pull_request", repo_id="my-repo", state="closed")` | Returns only closed pull requests |
| TC-pr-005 | List | Filter PRs by state (merged) | `harness_list(resource_type="pull_request", repo_id="my-repo", state="merged")` | Returns only merged pull requests |
| TC-pr-006 | List | Search PRs by keyword | `harness_list(resource_type="pull_request", repo_id="my-repo", query="bugfix")` | Returns PRs matching "bugfix" keyword |
| TC-pr-007 | List | Combined filters | `harness_list(resource_type="pull_request", repo_id="my-repo", state="open", query="feature", page=0, limit=10)` | Returns open PRs matching "feature" with pagination |
| TC-pr-008 | Get | Get PR by number | `harness_get(resource_type="pull_request", repo_id="my-repo", pr_number=1)` | Returns full PR details including title, description, branches, state |
| TC-pr-009 | Create | Create a pull request | `harness_create(resource_type="pull_request", repo_id="my-repo", body={"title": "Add new feature", "source_branch": "feature/new-ui", "target_branch": "main", "description": "This PR adds a new UI component"})` | Creates PR, returns PR details with pr_number |
| TC-pr-010 | Create | Create PR with minimal fields | `harness_create(resource_type="pull_request", repo_id="my-repo", body={"title": "Quick fix", "source_branch": "hotfix/bug", "target_branch": "main"})` | Creates PR without description |
| TC-pr-011 | Update | Update PR title | `harness_update(resource_type="pull_request", repo_id="my-repo", pr_number=1, body={"title": "Updated title"})` | Updates PR title |
| TC-pr-012 | Update | Update PR description | `harness_update(resource_type="pull_request", repo_id="my-repo", pr_number=1, body={"description": "Updated description with more details"})` | Updates PR description |
| TC-pr-013 | Update | Close a PR | `harness_update(resource_type="pull_request", repo_id="my-repo", pr_number=1, body={"state": "closed"})` | Changes PR state to closed |
| TC-pr-014 | Update | Reopen a PR | `harness_update(resource_type="pull_request", repo_id="my-repo", pr_number=1, body={"state": "open"})` | Reopens a closed PR |
| TC-pr-015 | Execute | Merge PR with default method | `harness_execute(resource_type="pull_request", action="merge", repo_id="my-repo", pr_number=1)` | Merges PR using default merge method |
| TC-pr-016 | Execute | Squash merge PR | `harness_execute(resource_type="pull_request", action="merge", repo_id="my-repo", pr_number=1, body={"method": "squash", "delete_source_branch": true})` | Squash merges PR and deletes source branch |
| TC-pr-017 | Execute | Dry run merge | `harness_execute(resource_type="pull_request", action="merge", repo_id="my-repo", pr_number=1, body={"dry_run": true})` | Simulates merge without executing, returns merge feasibility |
| TC-pr-018 | Execute | Rebase merge | `harness_execute(resource_type="pull_request", action="merge", repo_id="my-repo", pr_number=1, body={"method": "rebase"})` | Rebases and merges PR |
| TC-pr-019 | Scope | List PRs with explicit org/project | `harness_list(resource_type="pull_request", repo_id="my-repo", org_id="custom-org", project_id="custom-project")` | Returns PRs scoped to specified org/project |
| TC-pr-020 | Error | Get non-existent PR | `harness_get(resource_type="pull_request", repo_id="my-repo", pr_number=99999)` | Returns 404 error |
| TC-pr-021 | Error | Create PR with missing source_branch | `harness_create(resource_type="pull_request", repo_id="my-repo", body={"title": "Bad PR", "target_branch": "main"})` | Returns validation error for missing source_branch |
| TC-pr-022 | Error | Merge already-merged PR | `harness_execute(resource_type="pull_request", action="merge", repo_id="my-repo", pr_number=1)` | Returns error that PR is already merged |
| TC-pr-023 | Deep Link | Verify deep link in response | `harness_get(resource_type="pull_request", repo_id="my-repo", pr_number=1)` | Response includes valid Harness UI deep link |

## Notes
- Pull request scope is `account` — org_id/project_id are optional and determine repo scope
- Identifier fields: `repo_id` (always required) and `pr_number`
- State filter supports enum values: `open`, `closed`, `merged`
- Merge action supports methods: `merge`, `squash`, `rebase`, `fast-forward`
- Merge body supports `source_sha` for optimistic locking
- Deep link format: `/ng/account/{accountId}/module/code/orgs/{orgIdentifier}/projects/{projectIdentifier}/repos/{repoIdentifier}/pull-requests/{prNumber}`
