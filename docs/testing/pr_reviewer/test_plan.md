# Test Plan: PR Reviewer (`pr_reviewer`)

| Field | Value |
|-------|-------|
| **Resource Type** | `pr_reviewer` |
| **Display Name** | PR Reviewer |
| **Toolset** | pull-requests |
| **Scope** | account |
| **Operations** | list, create |
| **Execute Actions** | submit_review |
| **Identifier Fields** | repo_id, pr_number |
| **Filter Fields** | None |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-prv-001 | List | List reviewers on a PR | `harness_list(resource_type="pr_reviewer", repo_id="my-repo", pr_number=1)` | Returns list of reviewers assigned to the PR with their review status |
| TC-prv-002 | List | List reviewers on PR with no reviewers | `harness_list(resource_type="pr_reviewer", repo_id="my-repo", pr_number=2)` | Returns empty list |
| TC-prv-003 | Create | Add a reviewer to a PR | `harness_create(resource_type="pr_reviewer", repo_id="my-repo", pr_number=1, body={"reviewer_id": 12345})` | Adds user as reviewer, returns reviewer details |
| TC-prv-004 | Execute | Approve a PR | `harness_execute(resource_type="pr_reviewer", action="submit_review", repo_id="my-repo", pr_number=1, body={"decision": "approved"})` | Submits approval review |
| TC-prv-005 | Execute | Request changes on a PR | `harness_execute(resource_type="pr_reviewer", action="submit_review", repo_id="my-repo", pr_number=1, body={"decision": "changereq"})` | Submits change request review |
| TC-prv-006 | Execute | Approve with commit SHA | `harness_execute(resource_type="pr_reviewer", action="submit_review", repo_id="my-repo", pr_number=1, body={"decision": "approved", "commit_sha": "abc123def456"})` | Submits approval pinned to specific commit |
| TC-prv-007 | Scope | List reviewers with explicit org/project | `harness_list(resource_type="pr_reviewer", repo_id="my-repo", pr_number=1, org_id="custom-org", project_id="custom-project")` | Returns reviewers scoped to specified org/project |
| TC-prv-008 | Error | Add reviewer to non-existent PR | `harness_create(resource_type="pr_reviewer", repo_id="my-repo", pr_number=99999, body={"reviewer_id": 12345})` | Returns 404 error for PR not found |
| TC-prv-009 | Error | Add reviewer with invalid user ID | `harness_create(resource_type="pr_reviewer", repo_id="my-repo", pr_number=1, body={"reviewer_id": 0})` | Returns error for invalid user ID |
| TC-prv-010 | Error | Submit review with invalid decision | `harness_execute(resource_type="pr_reviewer", action="submit_review", repo_id="my-repo", pr_number=1, body={"decision": "invalid"})` | Returns validation error for invalid decision value |
| TC-prv-011 | Error | Create reviewer missing reviewer_id | `harness_create(resource_type="pr_reviewer", repo_id="my-repo", pr_number=1, body={})` | Returns validation error for missing reviewer_id |
| TC-prv-012 | Edge | Add duplicate reviewer | `harness_create(resource_type="pr_reviewer", repo_id="my-repo", pr_number=1, body={"reviewer_id": 12345})` | Returns conflict error or idempotent success |

## Notes
- `pr_reviewer` requires both `repo_id` and `pr_number` as parent identifiers
- `reviewer_id` is a numeric user ID, not a username
- Execute action `submit_review` requires `decision` field: `approved` or `changereq`
- Optional `commit_sha` on submit_review pins the review to a specific commit
- No filter fields for list operation — returns all reviewers for the PR
