# Test Report: File Content (`file_content`)

| Field | Value |
|-------|-------|
| **Resource Type** | `file_content` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-fc-001 | Get file content at root | `harness_get(resource_type="file_content", repo_id="my-repo", path="README.md")` | Returns file content for README.md | ✅ Passed | Returns file content (base64 encoded) with SHA, path, size (get only) |  |
| TC-fc-002 | Get file content in subdirectory | `harness_get(resource_type="file_content", repo_id="my-repo", path="src/index.ts")` | Returns file content for src/index.ts | ⬜ Pending | | |
| TC-fc-003 | Get directory listing | `harness_get(resource_type="file_content", repo_id="my-repo", path="src")` | Returns directory listing for src/ | ⬜ Pending | | |
| TC-fc-004 | Get root directory listing | `harness_get(resource_type="file_content", repo_id="my-repo", path="")` | Returns root directory listing | ⬜ Pending | | |
| TC-fc-005 | Get file at specific branch | `harness_get(resource_type="file_content", repo_id="my-repo", path="README.md", git_ref="develop")` | Returns file content from develop branch | ⬜ Pending | | |
| TC-fc-006 | Get file at specific commit SHA | `harness_get(resource_type="file_content", repo_id="my-repo", path="README.md", git_ref="abc123def")` | Returns file content at the specified commit | ⬜ Pending | | |
| TC-fc-007 | Get file with include_commit flag | `harness_get(resource_type="file_content", repo_id="my-repo", path="README.md", include_commit="true")` | Returns file content along with last commit info | ⬜ Pending | | |
| TC-fc-008 | Git blame for a file | `harness_execute(resource_type="file_content", action="blame", repo_id="my-repo", path="src/index.ts")` | Returns git blame information for each line | ⬜ Pending | | |
| TC-fc-009 | Git blame with line range | `harness_execute(resource_type="file_content", action="blame", repo_id="my-repo", path="src/index.ts", line_from="10", line_to="20")` | Returns git blame for lines 10–20 only | ⬜ Pending | | |
| TC-fc-010 | Git blame at specific ref | `harness_execute(resource_type="file_content", action="blame", repo_id="my-repo", path="src/index.ts", git_ref="main")` | Returns git blame on main branch | ⬜ Pending | | |
| TC-fc-011 | Get file with explicit org/project | `harness_get(resource_type="file_content", repo_id="my-repo", path="README.md", org_id="custom-org", project_id="custom-project")` | Returns file content scoped to specified org/project | ⬜ Pending | | |
| TC-fc-012 | Get non-existent file | `harness_get(resource_type="file_content", repo_id="my-repo", path="nonexistent/file.txt")` | Returns 404 error | ⬜ Pending | | |
| TC-fc-013 | Get file from non-existent repo | `harness_get(resource_type="file_content", repo_id="nonexistent-repo", path="README.md")` | Returns 404 error for repository | ⬜ Pending | | |
| TC-fc-014 | Blame on non-existent file | `harness_execute(resource_type="file_content", action="blame", repo_id="my-repo", path="nonexistent.txt")` | Returns 404 error | ⬜ Pending | | |
| TC-fc-015 | Get binary file content | `harness_get(resource_type="file_content", repo_id="my-repo", path="image.png")` | Handles binary file appropriately | ⬜ Pending | | |

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
