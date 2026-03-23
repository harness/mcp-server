# Test Report: PR Check (`pr_check`)

| Field | Value |
|-------|-------|
| **Resource Type** | `pr_check` |
| **Date** | 2026-03-23 |
| **Tester** | Claude |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-prk-001 | List status checks on a PR | `harness_list(resource_type="pr_check", filters={"repo_id":"test-mcp", "pr_number":4}, org_id="AI_Devops", project_id="Sanity")` | Returns list of status checks with name, status, and details | ✅ Passed | Returns check structure with commit_sha, checks=null (no checks configured) | |
| TC-prk-002 | List checks on PR with no checks | `harness_list(resource_type="pr_check", filters={"repo_id":"test-mcp", "pr_number":4}, org_id="AI_Devops", project_id="Sanity")` | Returns empty list | ✅ Passed | Returns `{"commit_sha":"...","checks":null}` | No checks configured on repo |
| TC-prk-003 | List checks on PR with passing checks | `harness_list(resource_type="pr_check", filters={"repo_id":"test-mcp", "pr_number":3}, org_id="AI_Devops", project_id="Sanity")` | Returns checks all showing success/passing status | ⬜ Pending | | No CI configured |
| TC-prk-004 | List checks on PR with failing checks | `harness_list(resource_type="pr_check", filters={"repo_id":"test-mcp", "pr_number":4}, org_id="AI_Devops", project_id="Sanity")` | Returns checks showing failure status | ⬜ Pending | | No CI configured |
| TC-prk-005 | List checks on PR with mixed statuses | `harness_list(resource_type="pr_check", filters={"repo_id":"test-mcp", "pr_number":5}, org_id="AI_Devops", project_id="Sanity")` | Returns checks with various statuses (pass, fail, pending) | ⬜ Pending | | No CI configured |
| TC-prk-006 | List checks with explicit org/project | `harness_list(resource_type="pr_check", filters={"repo_id":"test-mcp", "pr_number":4}, org_id="AI_Devops", project_id="Sanity")` | Returns checks scoped to specified org/project | ✅ Passed | Returns scoped response | |
| TC-prk-007 | List checks for non-existent PR | `harness_list(resource_type="pr_check", filters={"repo_id":"test-mcp", "pr_number":99999}, org_id="AI_Devops", project_id="Sanity")` | Returns 404 error for PR not found | ⬜ Pending | | |
| TC-prk-008 | List checks for non-existent repo | `harness_list(resource_type="pr_check", filters={"repo_id":"nonexistent-repo", "pr_number":1}, org_id="AI_Devops", project_id="Sanity")` | Returns 404 error for repository not found | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 8 |
| ✅ Passed | 3 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 5 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

### List Checks (no checks configured)
```json
{
  "commit_sha": "d3641db02dc1baa598a133aee7312309bc7bf323",
  "checks": null
}
```
