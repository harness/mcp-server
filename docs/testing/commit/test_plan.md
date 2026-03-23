# Test Plan: Commit (`commit`)

| Field | Value |
|-------|-------|
| **Resource Type** | `commit` |
| **Display Name** | Commit |
| **Toolset** | repositories |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | diff, diff_stats |
| **Identifier Fields** | repo_id, commit_sha |
| **Filter Fields** | git_ref, path, since, until, committer |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-cm-001 | List | List all commits in a repo | `harness_list(resource_type="commit", repo_id="my-repo")` | Returns paginated list of commits with message, author, SHA |
| TC-cm-002 | List | List commits with pagination | `harness_list(resource_type="commit", repo_id="my-repo", page=0, limit=10)` | Returns first page with up to 10 commits |
| TC-cm-003 | List | Filter commits by git_ref (branch) | `harness_list(resource_type="commit", repo_id="my-repo", git_ref="develop")` | Returns commits on the develop branch |
| TC-cm-004 | List | Filter commits by file path | `harness_list(resource_type="commit", repo_id="my-repo", path="src/index.ts")` | Returns commits that touched src/index.ts |
| TC-cm-005 | List | Filter commits by date range | `harness_list(resource_type="commit", repo_id="my-repo", since="2025-01-01T00:00:00Z", until="2025-12-31T23:59:59Z")` | Returns commits within the specified date range |
| TC-cm-006 | List | Filter commits by committer | `harness_list(resource_type="commit", repo_id="my-repo", committer="john@example.com")` | Returns commits by the specified committer |
| TC-cm-007 | List | Combined filters | `harness_list(resource_type="commit", repo_id="my-repo", git_ref="main", path="README.md", since="2025-06-01T00:00:00Z")` | Returns commits matching all filter criteria |
| TC-cm-008 | Get | Get commit by SHA | `harness_get(resource_type="commit", repo_id="my-repo", commit_sha="abc123def456")` | Returns full commit details including message, author, parent SHAs |
| TC-cm-009 | Execute | Get diff between two refs | `harness_execute(resource_type="commit", action="diff", repo_id="my-repo", range="main..feature-branch")` | Returns raw diff output between main and feature-branch |
| TC-cm-010 | Execute | Get diff stats between two refs | `harness_execute(resource_type="commit", action="diff_stats", repo_id="my-repo", range="main..feature-branch")` | Returns diff stats: files changed, additions, deletions |
| TC-cm-011 | Execute | Diff between two commit SHAs | `harness_execute(resource_type="commit", action="diff", repo_id="my-repo", range="abc123..def456")` | Returns diff between two specific commits |
| TC-cm-012 | Scope | List commits with explicit org/project | `harness_list(resource_type="commit", repo_id="my-repo", org_id="custom-org", project_id="custom-project")` | Returns commits scoped to specified org/project |
| TC-cm-013 | Error | Get non-existent commit SHA | `harness_get(resource_type="commit", repo_id="my-repo", commit_sha="0000000000000000")` | Returns 404 error |
| TC-cm-014 | Error | Diff with invalid range format | `harness_execute(resource_type="commit", action="diff", repo_id="my-repo", range="invalid-range")` | Returns meaningful error about range format |
| TC-cm-015 | Edge | List commits on empty repo | `harness_list(resource_type="commit", repo_id="empty-repo")` | Returns empty list |

## Notes
- Commit is a child resource of repository; `repo_id` is always required
- Execute actions `diff` and `diff_stats` require a `range` parameter in `base..head` format
- List supports rich filtering: by branch/tag (`git_ref`), file `path`, date range (`since`/`until`), and `committer`
- No deep link template is defined for commits
