# Test Plan: PR Activity (`pr_activity`)

| Field | Value |
|-------|-------|
| **Resource Type** | `pr_activity` |
| **Display Name** | PR Activity |
| **Toolset** | pull-requests |
| **Scope** | account |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | repo_id, pr_number |
| **Filter Fields** | None |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-pra-001 | List | List all activity on a PR | `harness_list(resource_type="pr_activity", repo_id="my-repo", pr_number=1)` | Returns chronological list of activities (comments, reviews, status changes) |
| TC-pra-002 | List | List activity on PR with no activity | `harness_list(resource_type="pr_activity", repo_id="my-repo", pr_number=2)` | Returns empty list or minimal creation activity |
| TC-pra-003 | List | List activity on PR with comments | `harness_list(resource_type="pr_activity", repo_id="my-repo", pr_number=3)` | Returns activity entries including comment events |
| TC-pra-004 | List | List activity on PR with reviews | `harness_list(resource_type="pr_activity", repo_id="my-repo", pr_number=4)` | Returns activity entries including review approval/rejection events |
| TC-pra-005 | List | List activity on merged PR | `harness_list(resource_type="pr_activity", repo_id="my-repo", pr_number=5)` | Returns full activity timeline including merge event |
| TC-pra-006 | List | List activity on PR with state changes | `harness_list(resource_type="pr_activity", repo_id="my-repo", pr_number=6)` | Returns activity entries including open/close state changes |
| TC-pra-007 | Scope | List activity with explicit org/project | `harness_list(resource_type="pr_activity", repo_id="my-repo", pr_number=1, org_id="custom-org", project_id="custom-project")` | Returns activities scoped to specified org/project |
| TC-pra-008 | Error | List activity for non-existent PR | `harness_list(resource_type="pr_activity", repo_id="my-repo", pr_number=99999)` | Returns 404 error for PR not found |
| TC-pra-009 | Error | List activity for non-existent repo | `harness_list(resource_type="pr_activity", repo_id="nonexistent-repo", pr_number=1)` | Returns 404 error for repository not found |
| TC-pra-010 | Edge | List activity on PR with many events | `harness_list(resource_type="pr_activity", repo_id="my-repo", pr_number=7)` | Returns activities for a PR with extensive activity history |

## Notes
- `pr_activity` is a read-only resource — only supports the `list` operation
- Requires both `repo_id` and `pr_number` as parent identifiers
- Activity types include: comments, reviews, status changes, merge events, push events
- Returns a chronological timeline of all PR events
- No filter fields — returns all activities for the PR
