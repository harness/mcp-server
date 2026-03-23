# Test Report: PR Comment (`pr_comment`)

| Field | Value |
|-------|-------|
| **Resource Type** | `pr_comment` |
| **Date** | 2026-03-23 (re-tested) |
| **Tester** | Claude |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Important Note

**The `list` operation was removed from `pr_comment`.** The Harness Code API does not have a GET endpoint for listing comments directly. To list comments, use `pr_activity` with `kind='comment'` filter:

```
harness_list(resource_type="pr_activity", filters={"repo_id":"test-mcp", "pr_number":4, "kind":"comment"}, org_id="AI_Devops", project_id="Sanity")
```

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-prc-001 | List all comments on a PR | Use `pr_activity` with `kind="comment"` | Returns list of comments via activities | ✅ Passed | 2 comments returned via pr_activity | Re-tested 2026-03-23 |
| TC-prc-002 | List comments on PR with no comments | Use `pr_activity` with `kind="comment"` | Returns empty list | ⬜ Pending | | See pr_activity |
| TC-prc-003 | Add a general comment | `harness_create(resource_type="pr_comment", params={"repo_id":"test-mcp", "pr_number":1}, body={"text":"Looks good!"}, org_id="AI_Devops", project_id="Sanity")` | Creates general PR comment, returns comment details | ⬜ Pending | | |
| TC-prc-004 | Add a markdown comment | `harness_create(resource_type="pr_comment", params={"repo_id":"test-mcp", "pr_number":1}, body={"text":"## Review\n- Fix typo"}, org_id="AI_Devops", project_id="Sanity")` | Creates comment with markdown formatting | ⬜ Pending | | |
| TC-prc-005 | Add an inline code comment | `harness_create(resource_type="pr_comment", params={"repo_id":"test-mcp", "pr_number":1}, body={"text":"Use constant", "path":"src/utils.ts", "line_new":42}, org_id="AI_Devops", project_id="Sanity")` | Creates inline code comment on specific file and line | ⬜ Pending | | |
| TC-prc-006 | Add inline comment on old file line | `harness_create(resource_type="pr_comment", params={"repo_id":"test-mcp", "pr_number":1}, body={"text":"Why removed?", "path":"src/helpers.ts", "line_old":15}, org_id="AI_Devops", project_id="Sanity")` | Creates inline comment referencing old file line | ⬜ Pending | | |
| TC-prc-007 | Add inline comment with commit context | `harness_create(resource_type="pr_comment", params={"repo_id":"test-mcp", "pr_number":1}, body={"text":"Refactor", "path":"src/index.ts", "line_new":10, "source_commit_sha":"abc123"}, org_id="AI_Devops", project_id="Sanity")` | Creates inline comment with commit context | ⬜ Pending | | |
| TC-prc-008 | Add comment to non-existent PR | `harness_create(resource_type="pr_comment", params={"repo_id":"test-mcp", "pr_number":99999}, body={"text":"test"}, org_id="AI_Devops", project_id="Sanity")` | Returns 404 error for PR not found | ⬜ Pending | | |
| TC-prc-009 | Create comment with empty text | `harness_create(resource_type="pr_comment", params={"repo_id":"test-mcp", "pr_number":1}, body={"text":""}, org_id="AI_Devops", project_id="Sanity")` | Returns validation error for empty text | ⬜ Pending | | |
| TC-prc-010 | Create comment missing text field | `harness_create(resource_type="pr_comment", params={"repo_id":"test-mcp", "pr_number":1}, body={}, org_id="AI_Devops", project_id="Sanity")` | Returns validation error for missing text | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 10 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 9 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|
| PRC-001 | High | `list` operation returned HTTP 405 | TC-prc-001 | ✅ Fixed |

## Fixes Applied

1. **Removed `list` operation** - The Harness Code API doesn't have a GET endpoint for `/comments`. Comments must be listed via `pr_activity` with `kind='comment'` filter.

## Sample Responses

### List Comments via pr_activity
```
harness_list(resource_type="pr_activity", filters={"repo_id":"test-mcp", "pr_number":4, "kind":"comment"}, org_id="AI_Devops", project_id="Sanity")
```
```json
[{
  "id": 658798,
  "type": "comment",
  "kind": "comment",
  "text": "looks good",
  "author": {"display_name": "Saranya", "email": "saranya.jena@harness.io"}
}]
```
