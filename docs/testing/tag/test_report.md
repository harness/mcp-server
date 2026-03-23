# Test Report: Tag (`tag`)

| Field | Value |
|-------|-------|
| **Resource Type** | `tag` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-tag-001 | List all tags in a repo | `harness_list(resource_type="tag", repo_id="my-repo")` | Returns paginated list of tags with target commit info | ✅ Passed | Returns 1 tag (v1.0.0-mcp-test) with SHA, annotated flag (requires repo_id filter) | Requires repo_id filter |
| TC-tag-002 | List tags with pagination | `harness_list(resource_type="tag", repo_id="my-repo", page=0, limit=5)` | Returns first page with up to 5 tags | ⬜ Pending | | |
| TC-tag-003 | Search tags by name | `harness_list(resource_type="tag", repo_id="my-repo", query="v1")` | Returns tags matching "v1" keyword | ⬜ Pending | | |
| TC-tag-004 | Sort tags | `harness_list(resource_type="tag", repo_id="my-repo", sort="name")` | Returns tags sorted by name | ⬜ Pending | | |
| TC-tag-005 | Sort tags descending | `harness_list(resource_type="tag", repo_id="my-repo", sort="name", order="desc")` | Returns tags sorted by name in descending order | ⬜ Pending | | |
| TC-tag-006 | Combined filters | `harness_list(resource_type="tag", repo_id="my-repo", query="release", sort="name", order="asc", page=0, limit=10)` | Returns filtered, sorted tags with pagination | ⬜ Pending | | |
| TC-tag-007 | Create a lightweight tag | `harness_create(resource_type="tag", repo_id="my-repo", body={"name": "v1.0.0", "target": "abc123def"})` | Creates lightweight tag pointing to specified commit | ⬜ Pending | | |
| TC-tag-008 | Create an annotated tag | `harness_create(resource_type="tag", repo_id="my-repo", body={"name": "v2.0.0", "target": "def456abc", "message": "Release v2.0.0"})` | Creates annotated tag with message | ⬜ Pending | | |
| TC-tag-009 | Delete a tag | `harness_delete(resource_type="tag", repo_id="my-repo", tag_name="v0.1.0")` | Deletes the tag successfully | ⬜ Pending | | |
| TC-tag-010 | List tags with explicit org/project | `harness_list(resource_type="tag", repo_id="my-repo", org_id="custom-org", project_id="custom-project")` | Returns tags scoped to specified org/project | ⬜ Pending | | |
| TC-tag-011 | Create tag with missing name | `harness_create(resource_type="tag", repo_id="my-repo", body={"target": "abc123"})` | Returns validation error for missing name | ⬜ Pending | | |
| TC-tag-012 | Create tag with missing target | `harness_create(resource_type="tag", repo_id="my-repo", body={"name": "v1.0.0"})` | Returns validation error for missing target | ⬜ Pending | | |
| TC-tag-013 | Create duplicate tag | `harness_create(resource_type="tag", repo_id="my-repo", body={"name": "v1.0.0", "target": "abc123"})` | Returns conflict error for existing tag name | ⬜ Pending | | |
| TC-tag-014 | Delete non-existent tag | `harness_delete(resource_type="tag", repo_id="my-repo", tag_name="nonexistent-tag")` | Returns 404 error | ⬜ Pending | | |
| TC-tag-015 | Tag with semantic version format | `harness_create(resource_type="tag", repo_id="my-repo", body={"name": "v1.2.3-beta.1", "target": "abc123"})` | Handles semver-style tag names correctly | ⬜ Pending | | |

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
