# Test Plan: Space Protection Rule (`space_rule`)

| Field | Value |
|-------|-------|
| **Resource Type** | `space_rule` |
| **Display Name** | Space Protection Rule |
| **Toolset** | repositories |
| **Scope** | project |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | None |
| **Identifier Fields** | rule_id |
| **Filter Fields** | query, sort, order, type, inherited |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-sr-001 | List | List all space-level rules | `harness_list(resource_type="space_rule")` | Returns paginated list of space protection rules |
| TC-sr-002 | List | List rules with pagination | `harness_list(resource_type="space_rule", page=0, limit=5)` | Returns first page with up to 5 rules |
| TC-sr-003 | List | Search rules by name | `harness_list(resource_type="space_rule", query="default-protection")` | Returns rules matching keyword |
| TC-sr-004 | List | Filter rules by type (branch) | `harness_list(resource_type="space_rule", type="branch")` | Returns only branch protection rules |
| TC-sr-005 | List | Filter rules by type (tag) | `harness_list(resource_type="space_rule", type="tag")` | Returns only tag protection rules |
| TC-sr-006 | List | Filter rules by type (push) | `harness_list(resource_type="space_rule", type="push")` | Returns only push protection rules |
| TC-sr-007 | List | Include inherited rules | `harness_list(resource_type="space_rule", inherited="true")` | Returns rules including those inherited from parent spaces |
| TC-sr-008 | List | Sort rules | `harness_list(resource_type="space_rule", sort="updated_at", order="desc")` | Returns rules sorted by last update descending |
| TC-sr-009 | List | Combined filters | `harness_list(resource_type="space_rule", type="branch", query="protect", sort="identifier", order="asc")` | Returns filtered, sorted rules |
| TC-sr-010 | Get | Get a specific space rule | `harness_get(resource_type="space_rule", rule_id="org-branch-protection")` | Returns full rule details including pattern and definition |
| TC-sr-011 | Create | Create a space-level branch rule | `harness_create(resource_type="space_rule", body={"identifier": "org-protect-main", "type": "branch", "state": "active", "pattern": {"default": true}, "definition": {"pullreq": {"approvals": {"require_minimum_count": 2}}}})` | Creates space-level branch protection rule (requires confirmation) |
| TC-sr-012 | Update | Update rule state to disabled | `harness_update(resource_type="space_rule", rule_id="org-protect-main", body={"state": "disabled"})` | Disables the rule (requires confirmation) |
| TC-sr-013 | Update | Update rule pattern | `harness_update(resource_type="space_rule", rule_id="org-protect-main", body={"pattern": {"include": ["main", "release/*"]}})` | Updates rule pattern |
| TC-sr-014 | Delete | Delete a space rule | `harness_delete(resource_type="space_rule", rule_id="org-protect-main")` | Deletes the space-level protection rule |
| TC-sr-015 | Scope | List rules at org level (no project) | `harness_list(resource_type="space_rule", org_id="my-org")` | Returns org-level space rules (omit project_id for org scope) |
| TC-sr-016 | Scope | List rules with explicit project | `harness_list(resource_type="space_rule", org_id="my-org", project_id="my-project")` | Returns project-level space rules |
| TC-sr-017 | Error | Get non-existent rule | `harness_get(resource_type="space_rule", rule_id="nonexistent-rule")` | Returns 404 error |
| TC-sr-018 | Error | Create rule missing required fields | `harness_create(resource_type="space_rule", body={"identifier": "bad-rule"})` | Returns validation error for missing type, state, definition |
| TC-sr-019 | Edge | Create rule with include/exclude pattern | `harness_create(resource_type="space_rule", body={"identifier": "complex-pattern", "type": "branch", "state": "active", "pattern": {"include": ["release/**"], "exclude": ["release/test*"]}, "definition": {"pullreq": {"approvals": {"require_minimum_count": 1}}}})` | Creates rule with complex include/exclude globstar patterns |

## Notes
- `space_rule` applies across all repositories in a space (project/org/account level)
- Unlike `repo_rule`, does NOT require `repo_id` — it is scoped to project/org/account
- Scope is determined by provided `org_id`/`project_id`: omit `project_id` for org-level, omit both for account-level
- Create, update, and delete operations require user confirmation (`blockWithoutConfirmation: true`)
- Same rule types (`branch`, `tag`, `push`) and states (`active`, `disabled`, `monitor`) as `repo_rule`
- Sort fields: `created_at`, `identifier`, `updated_at`
