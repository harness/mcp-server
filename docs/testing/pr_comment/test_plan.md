# Test Plan: PR Comment (`pr_comment`)

| Field | Value |
|-------|-------|
| **Resource Type** | `pr_comment` |
| **Display Name** | PR Comment |
| **Toolset** | pull-requests |
| **Scope** | account |
| **Operations** | list, create |
| **Execute Actions** | None |
| **Identifier Fields** | repo_id, pr_number |
| **Filter Fields** | None |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-prc-001 | List | List all comments on a PR | `harness_list(resource_type="pr_comment", repo_id="my-repo", pr_number=1)` | Returns list of comments with text, author, timestamps |
| TC-prc-002 | List | List comments on PR with no comments | `harness_list(resource_type="pr_comment", repo_id="my-repo", pr_number=2)` | Returns empty list |
| TC-prc-003 | Create | Add a general comment | `harness_create(resource_type="pr_comment", repo_id="my-repo", pr_number=1, body={"text": "Looks good overall, just a few minor suggestions."})` | Creates general PR comment, returns comment details |
| TC-prc-004 | Create | Add a markdown comment | `harness_create(resource_type="pr_comment", repo_id="my-repo", pr_number=1, body={"text": "## Review Notes\n- Fix typo on line 42\n- Add error handling"})` | Creates comment with markdown formatting |
| TC-prc-005 | Create | Add an inline code comment | `harness_create(resource_type="pr_comment", repo_id="my-repo", pr_number=1, body={"text": "This should use a constant instead of magic number", "path": "src/utils.ts", "line_new": 42})` | Creates inline code comment on specific file and line |
| TC-prc-006 | Create | Add inline comment on old file line | `harness_create(resource_type="pr_comment", repo_id="my-repo", pr_number=1, body={"text": "Why was this removed?", "path": "src/helpers.ts", "line_old": 15})` | Creates inline comment referencing old file line |
| TC-prc-007 | Create | Add inline comment with commit context | `harness_create(resource_type="pr_comment", repo_id="my-repo", pr_number=1, body={"text": "Consider refactoring", "path": "src/index.ts", "line_new": 10, "source_commit_sha": "abc123", "target_commit_sha": "def456"})` | Creates inline comment with source and target commit context |
| TC-prc-008 | Scope | List comments with explicit org/project | `harness_list(resource_type="pr_comment", repo_id="my-repo", pr_number=1, org_id="custom-org", project_id="custom-project")` | Returns comments scoped to specified org/project |
| TC-prc-009 | Error | Add comment to non-existent PR | `harness_create(resource_type="pr_comment", repo_id="my-repo", pr_number=99999, body={"text": "test"})` | Returns 404 error for PR not found |
| TC-prc-010 | Error | Create comment with empty text | `harness_create(resource_type="pr_comment", repo_id="my-repo", pr_number=1, body={"text": ""})` | Returns validation error for empty text |
| TC-prc-011 | Error | Create comment missing text field | `harness_create(resource_type="pr_comment", repo_id="my-repo", pr_number=1, body={})` | Returns validation error for missing text |
| TC-prc-012 | Edge | Create comment with very long text | `harness_create(resource_type="pr_comment", repo_id="my-repo", pr_number=1, body={"text": "A very long comment text..."})` | Handles long comment text appropriately |

## Notes
- `pr_comment` requires both `repo_id` and `pr_number` as parent identifiers
- General comments only need `text`; inline code comments also need `path` and `line_new`/`line_old`
- Inline comments can optionally include `source_commit_sha` and `target_commit_sha` for precise diff context
- Text field supports markdown formatting
- No filter fields for list — returns all comments on the PR
