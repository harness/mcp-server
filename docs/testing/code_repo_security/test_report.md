# Test Report: Code Repository Security (`code_repo_security`)

| Field | Value |
|-------|-------|
| **Resource Type** | `code_repo_security` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-CRS-001 | List scanned code repositories | `harness_list(resource_type="code_repo_security")` | Returns list of scanned code repositories | ✅ Passed | Returns empty list; API responds correctly |  |
| TC-CRS-002 | List with explicit page | `harness_list(resource_type="code_repo_security", page=1)` | Returns second page of repositories | ⬜ Pending | | |
| TC-CRS-003 | List with custom page size | `harness_list(resource_type="code_repo_security", size=5)` | Returns at most 5 repositories | ⬜ Pending | | |
| TC-CRS-004 | List with search_term | `harness_list(resource_type="code_repo_security", search_term="backend")` | Returns repositories matching "backend" | ⬜ Pending | | |
| TC-CRS-005 | Get code repo security overview | `harness_get(resource_type="code_repo_security", repo_id="repo-1")` | Returns security overview for the repository | ⬜ Pending | | |
| TC-CRS-006 | Verify overview structure | `harness_get(resource_type="code_repo_security", repo_id="repo-1")` | Response contains vulnerability counts and security posture | ⬜ Pending | | |
| TC-CRS-007 | List with explicit org_id and project_id | `harness_list(resource_type="code_repo_security", org_id="my-org", project_id="my-project")` | Returns repos for specified org/project | ⬜ Pending | | |
| TC-CRS-008 | Get with explicit org_id and project_id | `harness_get(resource_type="code_repo_security", repo_id="repo-1", org_id="my-org", project_id="my-project")` | Returns overview for specified org/project | ⬜ Pending | | |
| TC-CRS-009 | Get without repo_id | `harness_get(resource_type="code_repo_security")` | Error: repo_id is required | ⬜ Pending | | |
| TC-CRS-010 | Get with non-existent repo_id | `harness_get(resource_type="code_repo_security", repo_id="nonexistent")` | Returns 404 or not-found error | ⬜ Pending | | |
| TC-CRS-011 | Authentication failure | `harness_list(resource_type="code_repo_security")` (invalid key) | Returns 401 Unauthorized error | ⬜ Pending | | |
| TC-CRS-012 | Project with no scanned repos | `harness_list(resource_type="code_repo_security")` | Returns empty items list | ⬜ Pending | | |
| TC-CRS-013 | Search term with no matches | `harness_list(resource_type="code_repo_security", search_term="nonexistent_xyz")` | Returns empty items list | ⬜ Pending | | |
| TC-CRS-014 | Verify deep link in get response | `harness_get(resource_type="code_repo_security", repo_id="repo-1")` | Response includes deep link to repository in supply chain view | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 14 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 13 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
