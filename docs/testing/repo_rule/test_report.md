# Test Report: Repository Protection Rule (`repo_rule`)

| Field | Value |
|-------|-------|
| **Resource Type** | `repo_rule` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-rr-001 | List all rules for a repo | `harness_list(resource_type="repo_rule", repo_id="my-repo")` | Returns paginated list of protection rules | ✅ Passed | Returns empty list (no repo rules configured); API responds correctly |  |
| TC-rr-002 | List rules with pagination | `harness_list(resource_type="repo_rule", repo_id="my-repo", page=0, limit=5)` | Returns first page with up to 5 rules | ⬜ Pending | | |
| TC-rr-003 | Search rules by name | `harness_list(resource_type="repo_rule", repo_id="my-repo", query="main-protection")` | Returns rules matching keyword | ⬜ Pending | | |
| TC-rr-004 | Filter rules by type (branch) | `harness_list(resource_type="repo_rule", repo_id="my-repo", type="branch")` | Returns only branch protection rules | ⬜ Pending | | |
| TC-rr-005 | Filter rules by type (tag) | `harness_list(resource_type="repo_rule", repo_id="my-repo", type="tag")` | Returns only tag protection rules | ⬜ Pending | | |
| TC-rr-006 | Filter rules by type (push) | `harness_list(resource_type="repo_rule", repo_id="my-repo", type="push")` | Returns only push protection rules | ⬜ Pending | | |
| TC-rr-007 | Include inherited rules | `harness_list(resource_type="repo_rule", repo_id="my-repo", inherited="true")` | Returns rules including those inherited from parent spaces | ⬜ Pending | | |
| TC-rr-008 | Sort rules | `harness_list(resource_type="repo_rule", repo_id="my-repo", sort="created_at", order="desc")` | Returns rules sorted by creation date descending | ⬜ Pending | | |
| TC-rr-009 | Combined filters | `harness_list(resource_type="repo_rule", repo_id="my-repo", type="branch", query="protect", sort="identifier", order="asc")` | Returns filtered, sorted rules | ⬜ Pending | | |
| TC-rr-010 | Get a specific rule | `harness_get(resource_type="repo_rule", repo_id="my-repo", rule_id="main-protection")` | Returns full rule details including pattern and definition | ⬜ Pending | | |
| TC-rr-011 | Create a branch protection rule | `harness_create(resource_type="repo_rule", repo_id="my-repo", body={"identifier": "protect-main", "type": "branch", "state": "active", "pattern": {"default": true}, "definition": {"pullreq": {"approvals": {"require_minimum_count": 1}}}})` | Creates branch protection rule (requires confirmation) | ⬜ Pending | | |
| TC-rr-012 | Update rule state | `harness_update(resource_type="repo_rule", repo_id="my-repo", rule_id="protect-main", body={"state": "disabled"})` | Disables the rule (requires confirmation) | ⬜ Pending | | |
| TC-rr-013 | Update rule description | `harness_update(resource_type="repo_rule", repo_id="my-repo", rule_id="protect-main", body={"description": "Updated protection for main branch"})` | Updates rule description | ⬜ Pending | | |
| TC-rr-014 | Delete a rule | `harness_delete(resource_type="repo_rule", repo_id="my-repo", rule_id="protect-main")` | Deletes the protection rule | ⬜ Pending | | |
| TC-rr-015 | List rules with explicit org/project | `harness_list(resource_type="repo_rule", repo_id="my-repo", org_id="custom-org", project_id="custom-project")` | Returns rules scoped to specified org/project | ⬜ Pending | | |
| TC-rr-016 | Get non-existent rule | `harness_get(resource_type="repo_rule", repo_id="my-repo", rule_id="nonexistent-rule")` | Returns 404 error | ⬜ Pending | | |
| TC-rr-017 | Create rule missing required fields | `harness_create(resource_type="repo_rule", repo_id="my-repo", body={"identifier": "bad-rule"})` | Returns validation error for missing type, state, definition | ⬜ Pending | | |
| TC-rr-018 | Create rule with monitor state | `harness_create(resource_type="repo_rule", repo_id="my-repo", body={"identifier": "monitor-rule", "type": "branch", "state": "monitor", "pattern": {"include": ["release/*"]}, "definition": {"pullreq": {"approvals": {"require_minimum_count": 2}}}})` | Creates rule in monitor mode with glob pattern | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 18 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 17 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
