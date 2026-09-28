# Test Plan: PR Comment (`pr_comment`)

| Field | Value |
|-------|-------|
| **Resource Type** | `pr_comment` |
| **Display Name** | PR Comment |
| **Toolset** | pull-requests |
| **Scope** | account |
| **Operations** | create, update, delete |
| **Execute Actions** | None |
| **Identifier Fields** | repo_id, pr_number, comment_id |
| **Filter Fields** | None |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-prc-001 | Create | Add a general comment | `harness_create(resource_type="pr_comment", params={"repo_id":"my-repo", "pr_number":1}, body={"text": "Looks good overall, just a few minor suggestions."})` | Creates general PR comment, returns comment activity details |
| TC-prc-002 | Create | Add a markdown comment | `harness_create(resource_type="pr_comment", params={"repo_id":"my-repo", "pr_number":1}, body={"text": "## Review Notes\n- Fix typo on line 42\n- Add error handling"})` | Creates comment with markdown formatting |
| TC-prc-003 | Create | Add an inline code comment | `harness_create(resource_type="pr_comment", params={"repo_id":"my-repo", "pr_number":1}, body={"text": "This should use a constant instead of magic number", "path": "src/utils.ts", "line_new": 42, "source_commit_sha": "abc123", "target_commit_sha": "def456"})` | Creates inline code comment on the new side of the diff |
| TC-prc-004 | Create | Add inline comment on old file line | `harness_create(resource_type="pr_comment", params={"repo_id":"my-repo", "pr_number":1}, body={"text": "Why was this removed?", "path": "src/helpers.ts", "line_old": 15, "source_commit_sha": "abc123", "target_commit_sha": "def456"})` | Creates inline code comment on the old side of the diff |
| TC-prc-005 | Update | Update an existing comment | `harness_update(resource_type="pr_comment", resource_id="123", params={"repo_id":"my-repo", "pr_number":1}, body={"text": "Updated comment"})` | Updates comment `123` |
| TC-prc-006 | Delete | Delete an existing comment | `harness_delete(resource_type="pr_comment", resource_id="123", params={"repo_id":"my-repo", "pr_number":1})` | Deletes comment `123` |
| TC-prc-007 | Scope | Create comment with explicit org/project | `harness_create(resource_type="pr_comment", params={"repo_id":"my-repo", "pr_number":1}, org_id="custom-org", project_id="custom-project", body={"text": "Scoped comment"})` | Creates a comment in the specified scoped repo |
| TC-prc-008 | Error | Add comment to non-existent PR | `harness_create(resource_type="pr_comment", params={"repo_id":"my-repo", "pr_number":99999}, body={"text": "test"})` | Returns 404 error for PR not found |
| TC-prc-009 | Error | Create comment with empty text | `harness_create(resource_type="pr_comment", params={"repo_id":"my-repo", "pr_number":1}, body={"text": ""})` | Returns validation error for empty text |
| TC-prc-010 | Error | Create comment missing text field | `harness_create(resource_type="pr_comment", params={"repo_id":"my-repo", "pr_number":1}, body={})` | Returns validation error for missing text |
| TC-prc-011 | Edge | Create comment with very long text | `harness_create(resource_type="pr_comment", params={"repo_id":"my-repo", "pr_number":1}, body={"text": "A very long comment text..."})` | Handles long comment text appropriately |

## Notes
- `pr_comment` is write-only for comment create/update/delete. Read comments with `pr_activity`.
- To read all PR comments, use `harness_list(resource_type="pr_activity", params={"repo_id":"my-repo", "pr_number":1}, filters={"type":["comment","code-comment"]})`.
- `pr_comment` create requires `repo_id` and `pr_number`; update/delete also require `comment_id` or `resource_id`
- General comments only need `text`; inline PR comments also need `path` and `line_new`/`line_old`
- Inline comments can optionally include `source_commit_sha` and `target_commit_sha` for precise diff context
- Text field supports markdown formatting
