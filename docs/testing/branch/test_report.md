# Test Report: Branch (`branch`)

| Field | Value |
|-------|-------|
| **Resource Type** | `branch` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-br-001 | List all branches in a repo | `harness_list(resource_type="branch", repo_id="my-repo")` | Returns paginated list of branches with latest commit info | ✅ Passed | Returns 3 branches (main, mcp-test-branch, testmcp) with SHA (requires repo_id filter) | Requires repo_id filter |
| TC-br-002 | List branches with pagination | `harness_list(resource_type="branch", repo_id="my-repo", page=0, limit=5)` | Returns first page with up to 5 branches | ⬜ Pending | | |
| TC-br-003 | Search branches by name | `harness_list(resource_type="branch", repo_id="my-repo", query="feature")` | Returns branches matching "feature" keyword | ⬜ Pending | | |
| TC-br-004 | Sort branches | `harness_list(resource_type="branch", repo_id="my-repo", sort="name")` | Returns branches sorted by name | ⬜ Pending | | |
| TC-br-005 | Sort branches descending | `harness_list(resource_type="branch", repo_id="my-repo", sort="name", order="desc")` | Returns branches sorted by name in descending order | ⬜ Pending | | |
| TC-br-006 | Combined filters | `harness_list(resource_type="branch", repo_id="my-repo", query="fix", sort="name", order="asc", page=0, limit=10)` | Returns filtered, sorted branches with pagination | ⬜ Pending | | |
| TC-br-007 | Get branch by name | `harness_get(resource_type="branch", repo_id="my-repo", branch_name="main")` | Returns branch details including latest commit | ⬜ Pending | | |
| TC-br-008 | Get feature branch | `harness_get(resource_type="branch", repo_id="my-repo", branch_name="feature/new-ui")` | Returns branch details for feature branch | ⬜ Pending | | |
| TC-br-009 | Create branch from another branch | `harness_create(resource_type="branch", repo_id="my-repo", body={"name": "feature/test", "target": "main"})` | Creates new branch from main, returns branch details | ⬜ Pending | | |
| TC-br-010 | Create branch from commit SHA | `harness_create(resource_type="branch", repo_id="my-repo", body={"name": "hotfix/urgent", "target": "abc123def"})` | Creates new branch from specific commit SHA | ⬜ Pending | | |
| TC-br-011 | Delete a branch | `harness_delete(resource_type="branch", repo_id="my-repo", branch_name="feature/old")` | Deletes the branch successfully | ⬜ Pending | | |
| TC-br-012 | List branches with explicit org/project | `harness_list(resource_type="branch", repo_id="my-repo", org_id="custom-org", project_id="custom-project")` | Returns branches scoped to specified org/project | ⬜ Pending | | |
| TC-br-013 | Get non-existent branch | `harness_get(resource_type="branch", repo_id="my-repo", branch_name="nonexistent-branch")` | Returns 404 error | ⬜ Pending | | |
| TC-br-014 | Create branch missing required fields | `harness_create(resource_type="branch", repo_id="my-repo", body={"name": "test"})` | Returns validation error for missing target field | ⬜ Pending | | |
| TC-br-015 | Create duplicate branch | `harness_create(resource_type="branch", repo_id="my-repo", body={"name": "main", "target": "main"})` | Returns conflict error | ⬜ Pending | | |
| TC-br-016 | List branches for non-existent repo | `harness_list(resource_type="branch", repo_id="nonexistent-repo")` | Returns 404 error for repository | ⬜ Pending | | |
| TC-br-017 | Branch name with slashes | `harness_get(resource_type="branch", repo_id="my-repo", branch_name="feature/deep/nested")` | Handles branch names with path separators correctly | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 17 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 16 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
