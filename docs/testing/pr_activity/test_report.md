# Test Report: PR Activity (`pr_activity`)

| Field | Value |
|-------|-------|
| **Resource Type** | `pr_activity` |
| **Date** | 2026-03-23 (re-tested) |
| **Tester** | Claude |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-pra-001 | List all activity on a PR | `harness_list(resource_type="pr_activity", filters={"repo_id":"test-mcp", "pr_number":4}, org_id="AI_Devops", project_id="Sanity")` | Returns chronological list of activities | ✅ Passed | 3 activities: 2 comments, 1 title-change | Re-tested 2026-03-23 |
| TC-pra-002 | Filter by kind=comment | `harness_list(resource_type="pr_activity", filters={"repo_id":"test-mcp", "pr_number":4, "kind":"comment"}, org_id="AI_Devops", project_id="Sanity")` | Returns only comment activities | ✅ Passed | Returns 1 comment: "looks good" | |
| TC-pra-003 | Filter by kind=system | `harness_list(resource_type="pr_activity", filters={"repo_id":"test-mcp", "pr_number":4, "kind":"system"}, org_id="AI_Devops", project_id="Sanity")` | Returns only system activities | ⬜ Pending | | |
| TC-pra-004 | Filter by type=review-submit | `harness_list(resource_type="pr_activity", filters={"repo_id":"test-mcp", "pr_number":4, "type":"review-submit"}, org_id="AI_Devops", project_id="Sanity")` | Returns only review submission events | ⬜ Pending | | |
| TC-pra-005 | Filter by type=state-change | `harness_list(resource_type="pr_activity", filters={"repo_id":"test-mcp", "pr_number":4, "type":"state-change"}, org_id="AI_Devops", project_id="Sanity")` | Returns only state change events | ⬜ Pending | | |
| TC-pra-006 | Filter by type=merge | `harness_list(resource_type="pr_activity", filters={"repo_id":"test-mcp", "pr_number":4, "type":"merge"}, org_id="AI_Devops", project_id="Sanity")` | Returns only merge events | ⬜ Pending | | |
| TC-pra-007 | Filter by after timestamp | `harness_list(resource_type="pr_activity", filters={"repo_id":"test-mcp", "pr_number":4, "after":1774264000000}, org_id="AI_Devops", project_id="Sanity")` | Returns activities after timestamp | ⬜ Pending | | |
| TC-pra-008 | Filter by before timestamp | `harness_list(resource_type="pr_activity", filters={"repo_id":"test-mcp", "pr_number":4, "before":1774265000000}, org_id="AI_Devops", project_id="Sanity")` | Returns activities before timestamp | ⬜ Pending | | |
| TC-pra-009 | List activity with explicit org/project | `harness_list(resource_type="pr_activity", filters={"repo_id":"test-mcp", "pr_number":4}, org_id="AI_Devops", project_id="Sanity")` | Returns activities scoped to specified org/project | ✅ Passed | Returns scoped activities | |
| TC-pra-010 | List activity for non-existent PR | `harness_list(resource_type="pr_activity", filters={"repo_id":"test-mcp", "pr_number":99999}, org_id="AI_Devops", project_id="Sanity")` | Returns 404 error for PR not found | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 10 |
| ✅ Passed | 3 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 7 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|
| PRA-001 | Medium | Missing filter support for kind, type, after, before | TC-pra-002 | ✅ Fixed |

## Fixes Applied

1. **Added filter fields** - Added `kind`, `type`, `after`, `before` to `listFilterFields` and `queryParams` to match v1 functionality.

## Filter Reference

| Filter | Type | Description | Values |
|--------|------|-------------|--------|
| `kind` | string | Activity kind | `change-comment`, `comment`, `system` |
| `type` | string | Activity type | `branch-delete`, `branch-restore`, `branch-update`, `code-comment`, `comment`, `label-modify`, `merge`, `review-submit`, `reviewer-add`, `reviewer-delete`, `state-change`, `target-branch-change`, `title-change` |
| `after` | number | Unix timestamp (millis) | Activities created at or after |
| `before` | number | Unix timestamp (millis) | Activities created before |

## Sample Responses

### List All Activities (3 activities on PR #4)
```json
[
  {"id": 658798, "type": "comment", "kind": "comment", "text": "looks good", "author": {"display_name": "Saranya"}, "created": 1774264790930},
  {"id": 659053, "type": "comment", "kind": "comment", "text": "Automated test comment from MCP v2 testing", "author": {"display_name": "Saranya"}, "created": 1774271224885},
  {"id": 659054, "type": "title-change", "kind": "system", "payload": {"new": "Test PR deep link fix - updated by MCP", "old": "Test PR deep link fix"}, "created": 1774271535468}
]
```

### List Only Comments (kind=comment)
Use this to list PR comments since `pr_comment` doesn't have a `list` operation:
```
harness_list(resource_type="pr_activity", filters={"repo_id":"test-mcp", "pr_number":4, "kind":"comment"}, org_id="AI_Devops", project_id="Sanity")
```
