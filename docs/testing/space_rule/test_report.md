# Test Report: Space Protection Rule (`space_rule`)

| Field | Value |
|-------|-------|
| **Resource Type** | `space_rule` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-sr-001 | List all space-level rules | `harness_list(resource_type="space_rule")` | Returns paginated list of space protection rules | ✅ Passed | Returns empty list (no space rules configured); API responds correctly |  |
| TC-sr-002 | List rules with pagination | `harness_list(resource_type="space_rule", page=0, limit=5)` | Returns first page with up to 5 rules | ⬜ Pending | | |
| TC-sr-003 | Search rules by name | `harness_list(resource_type="space_rule", query="default-protection")` | Returns rules matching keyword | ⬜ Pending | | |
| TC-sr-004 | Filter rules by type (branch) | `harness_list(resource_type="space_rule", type="branch")` | Returns only branch protection rules | ⬜ Pending | | |
| TC-sr-005 | Filter rules by type (tag) | `harness_list(resource_type="space_rule", type="tag")` | Returns only tag protection rules | ⬜ Pending | | |
| TC-sr-006 | Filter rules by type (push) | `harness_list(resource_type="space_rule", type="push")` | Returns only push protection rules | ⬜ Pending | | |
| TC-sr-007 | Include inherited rules | `harness_list(resource_type="space_rule", inherited="true")` | Returns rules including those inherited from parent spaces | ⬜ Pending | | |
| TC-sr-008 | Sort rules | `harness_list(resource_type="space_rule", sort="updated_at", order="desc")` | Returns rules sorted by last update descending | ⬜ Pending | | |
| TC-sr-009 | Combined filters | `harness_list(resource_type="space_rule", type="branch", query="protect", sort="identifier", order="asc")` | Returns filtered, sorted rules | ⬜ Pending | | |
| TC-sr-010 | Get a specific space rule | `harness_get(resource_type="space_rule", rule_id="org-branch-protection")` | Returns full rule details including pattern and definition | ⬜ Pending | | |
| TC-sr-011 | Create a space-level branch rule | `harness_create(resource_type="space_rule", body={"identifier": "org-protect-main", "type": "branch", "state": "active", "pattern": {"default": true}, "definition": {"pullreq": {"approvals": {"require_minimum_count": 2}}}})` | Creates space-level branch protection rule (requires confirmation) | ⬜ Pending | | |
| TC-sr-012 | Update rule state to disabled | `harness_update(resource_type="space_rule", rule_id="org-protect-main", body={"state": "disabled"})` | Disables the rule (requires confirmation) | ⬜ Pending | | |
| TC-sr-013 | Update rule pattern | `harness_update(resource_type="space_rule", rule_id="org-protect-main", body={"pattern": {"include": ["main", "release/*"]}})` | Updates rule pattern | ⬜ Pending | | |
| TC-sr-014 | Delete a space rule | `harness_delete(resource_type="space_rule", rule_id="org-protect-main")` | Deletes the space-level protection rule | ⬜ Pending | | |
| TC-sr-015 | List rules at org level (no project) | `harness_list(resource_type="space_rule", org_id="my-org")` | Returns org-level space rules (omit project_id for org scope) | ⬜ Pending | | |
| TC-sr-016 | List rules with explicit project | `harness_list(resource_type="space_rule", org_id="my-org", project_id="my-project")` | Returns project-level space rules | ⬜ Pending | | |
| TC-sr-017 | Get non-existent rule | `harness_get(resource_type="space_rule", rule_id="nonexistent-rule")` | Returns 404 error | ⬜ Pending | | |
| TC-sr-018 | Create rule missing required fields | `harness_create(resource_type="space_rule", body={"identifier": "bad-rule"})` | Returns validation error for missing type, state, definition | ⬜ Pending | | |
| TC-sr-019 | Create rule with include/exclude pattern | `harness_create(resource_type="space_rule", body={"identifier": "complex-pattern", "type": "branch", "state": "active", "pattern": {"include": ["release/**"], "exclude": ["release/test*"]}, "definition": {"pullreq": {"approvals": {"require_minimum_count": 1}}}})` | Creates rule with complex include/exclude globstar patterns | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 19 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 18 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
