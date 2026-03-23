# Test Report: Repository (`repository`)

| Field | Value |
|-------|-------|
| **Resource Type** | `repository` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-repo-001 | List all repositories with defaults | `harness_list(resource_type="repository")` | Returns paginated list of repositories with metadata | ✅ Passed | Returns 3 repositories (mcp-test-repo-auto, r1, test-mcp) with git URLs, branch info |  |
| TC-repo-002 | List repositories with pagination | `harness_list(resource_type="repository", page=1, limit=5)` | Returns page 1 with up to 5 repositories | ⬜ Pending | | |
| TC-repo-003 | Search repositories by name | `harness_list(resource_type="repository", query="my-app")` | Returns repositories matching "my-app" keyword | ⬜ Pending | | |
| TC-repo-004 | Sort repositories | `harness_list(resource_type="repository", sort="identifier")` | Returns repositories sorted by identifier | ⬜ Pending | | |
| TC-repo-005 | Combined filter and pagination | `harness_list(resource_type="repository", query="service", sort="identifier", page=0, limit=10)` | Returns filtered, sorted repositories with pagination | ⬜ Pending | | |
| TC-repo-006 | Get repository by ID | `harness_get(resource_type="repository", repo_id="my-repo")` | Returns full repository details including default branch, description, timestamps | ⬜ Pending | | |
| TC-repo-007 | Create a minimal repository | `harness_create(resource_type="repository", body={"identifier": "new-repo"})` | Creates repository with default settings, returns created repo details | ⬜ Pending | | |
| TC-repo-008 | Create repository with all options | `harness_create(resource_type="repository", body={"identifier": "full-repo", "default_branch": "develop", "description": "A test repo", "is_public": false, "readme": true, "git_ignore": "Node", "license": "MIT"})` | Creates repository with all specified options | ⬜ Pending | | |
| TC-repo-009 | Update repository description | `harness_update(resource_type="repository", repo_id="my-repo", body={"description": "Updated description"})` | Updates description, returns updated repo | ⬜ Pending | | |
| TC-repo-010 | Update default branch | `harness_update(resource_type="repository", repo_id="my-repo", body={"default_branch": "develop"})` | Changes default branch to develop | ⬜ Pending | | |
| TC-repo-011 | Update visibility | `harness_update(resource_type="repository", repo_id="my-repo", body={"is_public": true})` | Changes repository visibility to public | ⬜ Pending | | |
| TC-repo-012 | List repositories with explicit org/project | `harness_list(resource_type="repository", org_id="custom-org", project_id="custom-project")` | Returns repositories scoped to specified org/project | ⬜ Pending | | |
| TC-repo-013 | Get non-existent repository | `harness_get(resource_type="repository", repo_id="nonexistent-repo")` | Returns 404 error with meaningful message | ⬜ Pending | | |
| TC-repo-014 | Create repository with missing identifier | `harness_create(resource_type="repository", body={})` | Returns validation error for missing required field | ⬜ Pending | | |
| TC-repo-015 | Create duplicate repository | `harness_create(resource_type="repository", body={"identifier": "existing-repo"})` | Returns conflict error (409) | ⬜ Pending | | |
| TC-repo-016 | Verify deep link in response | `harness_get(resource_type="repository", repo_id="my-repo")` | Response includes valid Harness UI deep link | ⬜ Pending | | |
| TC-repo-017 | List with zero results | `harness_list(resource_type="repository", query="zzz-nonexistent-name-zzz")` | Returns empty list with total=0 | ⬜ Pending | | |

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
