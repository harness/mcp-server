# Test Report: PR Reviewer (`pr_reviewer`)

| Field | Value |
|-------|-------|
| **Resource Type** | `pr_reviewer` |
| **Date** | 2026-03-23 |
| **Tester** | Claude |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-prv-001 | List reviewers on a PR | `harness_list(resource_type="pr_reviewer", filters={"repo_id":"test-mcp", "pr_number":4}, org_id="AI_Devops", project_id="Sanity")` | Returns list of reviewers assigned to the PR with their review status | ✅ Passed | Empty list (no reviewers assigned to PR #4) | API works, just no data |
| TC-prv-002 | List reviewers on PR with no reviewers | `harness_list(resource_type="pr_reviewer", filters={"repo_id":"test-mcp", "pr_number":4}, org_id="AI_Devops", project_id="Sanity")` | Returns empty list | ✅ Passed | Returns empty list | |
| TC-prv-003 | Add a reviewer to a PR | `harness_create(resource_type="pr_reviewer", params={"repo_id":"test-mcp", "pr_number":1}, body={"reviewer_id": 12345}, org_id="AI_Devops", project_id="Sanity")` | Adds user as reviewer, returns reviewer details | ⬜ Pending | | |
| TC-prv-004 | Approve a PR | `harness_execute(resource_type="pr_reviewer", action="submit_review", params={"repo_id":"test-mcp", "pr_number":1}, body={"decision": "approved"}, org_id="AI_Devops", project_id="Sanity")` | Submits approval review | ⬜ Pending | | |
| TC-prv-005 | Request changes on a PR | `harness_execute(resource_type="pr_reviewer", action="submit_review", params={"repo_id":"test-mcp", "pr_number":1}, body={"decision": "changereq"}, org_id="AI_Devops", project_id="Sanity")` | Submits change request review | ⬜ Pending | | |
| TC-prv-006 | Approve with commit SHA | `harness_execute(resource_type="pr_reviewer", action="submit_review", params={"repo_id":"test-mcp", "pr_number":1}, body={"decision": "approved", "commit_sha": "abc123def456"}, org_id="AI_Devops", project_id="Sanity")` | Submits approval pinned to specific commit | ⬜ Pending | | |
| TC-prv-007 | List reviewers with explicit org/project | `harness_list(resource_type="pr_reviewer", filters={"repo_id":"test-mcp", "pr_number":4}, org_id="AI_Devops", project_id="Sanity")` | Returns reviewers scoped to specified org/project | ✅ Passed | Returns scoped response | |
| TC-prv-008 | Add reviewer to non-existent PR | `harness_create(resource_type="pr_reviewer", params={"repo_id":"test-mcp", "pr_number":99999}, body={"reviewer_id": 12345}, org_id="AI_Devops", project_id="Sanity")` | Returns 404 error for PR not found | ⬜ Pending | | |
| TC-prv-009 | Add reviewer with invalid user ID | `harness_create(resource_type="pr_reviewer", params={"repo_id":"test-mcp", "pr_number":1}, body={"reviewer_id": 0}, org_id="AI_Devops", project_id="Sanity")` | Returns error for invalid user ID | ⬜ Pending | | |
| TC-prv-010 | Submit review with invalid decision | `harness_execute(resource_type="pr_reviewer", action="submit_review", params={"repo_id":"test-mcp", "pr_number":1}, body={"decision": "invalid"}, org_id="AI_Devops", project_id="Sanity")` | Returns validation error for invalid decision value | ⬜ Pending | | |
| TC-prv-011 | Create reviewer missing reviewer_id | `harness_create(resource_type="pr_reviewer", params={"repo_id":"test-mcp", "pr_number":1}, body={}, org_id="AI_Devops", project_id="Sanity")` | Returns validation error for missing reviewer_id | ⬜ Pending | | |
| TC-prv-012 | Add duplicate reviewer | `harness_create(resource_type="pr_reviewer", params={"repo_id":"test-mcp", "pr_number":1}, body={"reviewer_id": 12345}, org_id="AI_Devops", project_id="Sanity")` | Returns conflict error or idempotent success | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 12 |
| ✅ Passed | 3 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 9 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

### List Reviewers (empty — no reviewers on PR #4)
```json
[]
```

### List Reviewers (from `default/MyFirstProj/harness` PR #1 — has reviewer data)
```json
[{
  "type": "self_assigned",
  "latest_review_id": 34796,
  "review_decision": "approved",
  "sha": "0e8549f0750cd0aa7f9703005b7ef5eb144b2f90",
  "reviewer": {"display_name": "abhinav.singh@harness.io", "email": "abhinav.singh@harness.io"}
}]
```
