# Test Plan: Repository Protection Rule (`repo_rule`)

| Field | Value |
|-------|-------|
| **Resource Type** | `repo_rule` |
| **Display Name** | Repository Protection Rule |
| **Toolset** | repositories |
| **Scope** | project |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | None |
| **Identifier Fields** | repo_id, rule_id |
| **Filter Fields** | query, sort, order, type, inherited |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-rr-001 | List | List all rules for a repo | `harness_list(resource_type="repo_rule", repo_id="my-repo")` | Returns paginated list of protection rules |
| TC-rr-002 | List | List rules with pagination | `harness_list(resource_type="repo_rule", repo_id="my-repo", page=0, limit=5)` | Returns first page with up to 5 rules |
| TC-rr-003 | List | Search rules by name | `harness_list(resource_type="repo_rule", repo_id="my-repo", query="main-protection")` | Returns rules matching keyword |
| TC-rr-004 | List | Filter rules by type (branch) | `harness_list(resource_type="repo_rule", repo_id="my-repo", type="branch")` | Returns only branch protection rules |
| TC-rr-005 | List | Filter rules by type (tag) | `harness_list(resource_type="repo_rule", repo_id="my-repo", type="tag")` | Returns only tag protection rules |
| TC-rr-006 | List | Filter rules by type (push) | `harness_list(resource_type="repo_rule", repo_id="my-repo", type="push")` | Returns only push protection rules |
| TC-rr-007 | List | Include inherited rules | `harness_list(resource_type="repo_rule", repo_id="my-repo", inherited="true")` | Returns rules including those inherited from parent spaces |
| TC-rr-008 | List | Sort rules | `harness_list(resource_type="repo_rule", repo_id="my-repo", sort="created_at", order="desc")` | Returns rules sorted by creation date descending |
| TC-rr-009 | List | Combined filters | `harness_list(resource_type="repo_rule", repo_id="my-repo", type="branch", query="protect", sort="identifier", order="asc")` | Returns filtered, sorted rules |
| TC-rr-010 | Get | Get a specific rule | `harness_get(resource_type="repo_rule", repo_id="my-repo", rule_id="main-protection")` | Returns full rule details including pattern and definition |
| TC-rr-011 | Create | Create a branch protection rule | `harness_create(resource_type="repo_rule", repo_id="my-repo", body={"identifier": "protect-main", "type": "branch", "state": "active", "pattern": {"default": true}, "definition": {"pullreq": {"approvals": {"require_minimum_count": 1}}}})` | Creates branch protection rule (requires confirmation) |
| TC-rr-012 | Update | Update rule state | `harness_update(resource_type="repo_rule", repo_id="my-repo", rule_id="protect-main", body={"state": "disabled"})` | Disables the rule (requires confirmation) |
| TC-rr-013 | Update | Update rule description | `harness_update(resource_type="repo_rule", repo_id="my-repo", rule_id="protect-main", body={"description": "Updated protection for main branch"})` | Updates rule description |
| TC-rr-014 | Delete | Delete a rule | `harness_delete(resource_type="repo_rule", repo_id="my-repo", rule_id="protect-main")` | Deletes the protection rule |
| TC-rr-015 | Scope | List rules with explicit org/project | `harness_list(resource_type="repo_rule", repo_id="my-repo", org_id="custom-org", project_id="custom-project")` | Returns rules scoped to specified org/project |
| TC-rr-016 | Error | Get non-existent rule | `harness_get(resource_type="repo_rule", repo_id="my-repo", rule_id="nonexistent-rule")` | Returns 404 error |
| TC-rr-017 | Error | Create rule missing required fields | `harness_create(resource_type="repo_rule", repo_id="my-repo", body={"identifier": "bad-rule"})` | Returns validation error for missing type, state, definition |
| TC-rr-018 | Edge | Create rule with monitor state | `harness_create(resource_type="repo_rule", repo_id="my-repo", body={"identifier": "monitor-rule", "type": "branch", "state": "monitor", "pattern": {"include": ["release/*"]}, "definition": {"pullreq": {"approvals": {"require_minimum_count": 2}}}})` | Creates rule in monitor mode with glob pattern |

## Notes
- `repo_rule` is scoped to a specific repository; `repo_id` is always required
- Create, update, and delete operations require user confirmation (`blockWithoutConfirmation: true`)
- Rule types: `branch`, `tag`, `push`
- Rule states: `active`, `disabled`, `monitor`
- Pattern supports `{default: true}` for default branch or `{include: [...], exclude: [...]}` with globstar patterns
- Definition object contains `bypass`, `pullreq`, and `lifecycle` sections
- Sort fields: `created_at`, `identifier`, `updated_at`
