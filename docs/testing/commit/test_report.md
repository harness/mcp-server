# Test Report: Commit (`commit`)

| Field | Value |
|-------|-------|
| **Resource Type** | `commit` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-cm-001 | List all commits in a repo | `harness_list(resource_type="commit", repo_id="my-repo")` | Returns paginated list of commits with message, author, SHA | ✅ Passed | Returns commits with SHA, title, author, timestamp (requires repo_id filter) | Requires repo_id filter |
| TC-cm-002 | List commits with pagination | `harness_list(resource_type="commit", repo_id="my-repo", page=0, limit=10)` | Returns first page with up to 10 commits | ⬜ Pending | | |
| TC-cm-003 | Filter commits by git_ref (branch) | `harness_list(resource_type="commit", repo_id="my-repo", git_ref="develop")` | Returns commits on the develop branch | ⬜ Pending | | |
| TC-cm-004 | Filter commits by file path | `harness_list(resource_type="commit", repo_id="my-repo", path="src/index.ts")` | Returns commits that touched src/index.ts | ⬜ Pending | | |
| TC-cm-005 | Filter commits by date range | `harness_list(resource_type="commit", repo_id="my-repo", since="2025-01-01T00:00:00Z", until="2025-12-31T23:59:59Z")` | Returns commits within the specified date range | ⬜ Pending | | |
| TC-cm-006 | Filter commits by committer | `harness_list(resource_type="commit", repo_id="my-repo", committer="john@example.com")` | Returns commits by the specified committer | ⬜ Pending | | |
| TC-cm-007 | Combined filters | `harness_list(resource_type="commit", repo_id="my-repo", git_ref="main", path="README.md", since="2025-06-01T00:00:00Z")` | Returns commits matching all filter criteria | ⬜ Pending | | |
| TC-cm-008 | Get commit by SHA | `harness_get(resource_type="commit", repo_id="my-repo", commit_sha="abc123def456")` | Returns full commit details including message, author, parent SHAs | ⬜ Pending | | |
| TC-cm-009 | Get diff between two refs | `harness_execute(resource_type="commit", action="diff", repo_id="my-repo", range="main..feature-branch")` | Returns raw diff output between main and feature-branch | ⬜ Pending | | |
| TC-cm-010 | Get diff stats between two refs | `harness_execute(resource_type="commit", action="diff_stats", repo_id="my-repo", range="main..feature-branch")` | Returns diff stats: files changed, additions, deletions | ⬜ Pending | | |
| TC-cm-011 | Diff between two commit SHAs | `harness_execute(resource_type="commit", action="diff", repo_id="my-repo", range="abc123..def456")` | Returns diff between two specific commits | ⬜ Pending | | |
| TC-cm-012 | List commits with explicit org/project | `harness_list(resource_type="commit", repo_id="my-repo", org_id="custom-org", project_id="custom-project")` | Returns commits scoped to specified org/project | ⬜ Pending | | |
| TC-cm-013 | Get non-existent commit SHA | `harness_get(resource_type="commit", repo_id="my-repo", commit_sha="0000000000000000")` | Returns 404 error | ⬜ Pending | | |
| TC-cm-014 | Diff with invalid range format | `harness_execute(resource_type="commit", action="diff", repo_id="my-repo", range="invalid-range")` | Returns meaningful error about range format | ⬜ Pending | | |
| TC-cm-015 | List commits on empty repo | `harness_list(resource_type="commit", repo_id="empty-repo")` | Returns empty list | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 15 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 14 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
