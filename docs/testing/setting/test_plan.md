# Test Plan: Setting (`setting`)

| Field | Value |
|-------|-------|
| **Resource Type** | `setting` |
| **Display Name** | Setting |
| **Toolset** | settings |
| **Scope** | project (supportedScopes: account, org, project) |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | (none) |
| **Filter Fields** | category (required), group, include_parent_scopes |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-set-001 | List | List settings by category CD | `harness_list(resource_type="setting", category="CD")` | Returns list of CD-related platform settings |
| TC-set-002 | List | List settings by category CI | `harness_list(resource_type="setting", category="CI")` | Returns list of CI-related platform settings |
| TC-set-003 | List | List settings by category CE | `harness_list(resource_type="setting", category="CE")` | Returns list of CE (Cloud Cost) platform settings |
| TC-set-004 | List | List settings by category CORE | `harness_list(resource_type="setting", category="CORE")` | Returns list of core platform settings |
| TC-set-005 | List | List settings by category PMS | `harness_list(resource_type="setting", category="PMS")` | Returns list of PMS (Pipeline Management Service) settings |
| TC-set-006 | List | List settings by category NOTIFICATIONS | `harness_list(resource_type="setting", category="NOTIFICATIONS")` | Returns list of notification settings |
| TC-set-007 | List | Filter settings by category and group | `harness_list(resource_type="setting", category="CD", group="pipeline")` | Returns CD settings filtered by group |
| TC-set-008 | List | Include parent scopes | `harness_list(resource_type="setting", category="CD", include_parent_scopes=true)` | Returns settings including inherited parent scope settings |
| TC-set-009 | List | Exclude parent scopes | `harness_list(resource_type="setting", category="CD", include_parent_scopes=false)` | Returns only project-level settings, no inherited |
| TC-set-010 | List | Combined filters: category + group + include_parent_scopes | `harness_list(resource_type="setting", category="CORE", group="security", include_parent_scopes=true)` | Returns filtered settings with parent scope inclusion |
| TC-set-011 | List | List settings without category (required) | `harness_list(resource_type="setting")` | Registry error: Missing required filter(s) for listing setting: category |
| TC-set-012 | Scope | List settings with different org_id | `harness_list(resource_type="setting", category="CD", org_id="custom_org")` | Returns settings from specified org |
| TC-set-013 | Scope | List settings with different project_id | `harness_list(resource_type="setting", category="CD", org_id="default", project_id="other_project")` | Returns settings from specified project |
| TC-set-013a | Scope | Account-level list | `harness_list(resource_type="setting", resource_scope="account", category="CE")` | Returns account-level settings (no org/project query params) |
| TC-set-013b | Scope | Org-level list | `harness_list(resource_type="setting", resource_scope="org", org_id="custom_org", category="CD")` | Returns org-level settings (org only, no project) |
| TC-set-014 | Error | List settings with invalid category | `harness_list(resource_type="setting", category="INVALID_CAT")` | Error or empty results: invalid category |
| TC-set-015 | Edge | List settings with non-existent group | `harness_list(resource_type="setting", category="CD", group="nonexistent_group")` | Returns empty results or ignores invalid group |
| TC-set-016 | Deep Link | Verify deep link concept | `harness_list(resource_type="setting", category="CD")` | Settings response references general settings deep link |

## Notes
- Settings only support the `list` operation — no get, create, update, or delete.
- The `category` filter is required and must be one of the declared category values (e.g. CE, CI, CD, CORE, PMS, NOTIFICATIONS).
- Default list scope is project. Pass `resource_scope=account` or `org` for account- or org-level settings.
- No identifier fields — settings are a collection without individual identifiers via this API.
- The `include_parent_scopes` filter is a boolean that controls whether inherited settings are included.
- Deep link format: `/ng/account/{accountId}/settings` (general settings page, not per-setting).
