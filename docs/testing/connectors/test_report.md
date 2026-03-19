# Module: PLATFORM

## CONNECTORS — Test Report

**Date:** 2026-03-19
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### Tool Parity

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List (project) | `list_connectors` | `harness_list` (`connector`) | ✅ |
| List (org) | `list_connectors` (can't clear project default) | `harness_list` (`connector`, `project_id=""`) | ⚠️ v1 limitation |
| List (account) | `list_connectors` (can't clear org/project defaults) | `harness_list` (`connector`, `org_id=""`, `project_id=""`) | ⚠️ v1 limitation |
| Filter by type | `list_connectors(types=Github)` | `harness_list(filters.type=Github)` | ✅ |
| Get by ID | `get_connector_details` | `harness_get` | ✅ |
| Test connection | N/A | `harness_execute(test_connection)` | v2-only |
| Pagination | N/A (no page/size params) | `harness_list(page, size)` | v2-only |
| Create | N/A | `harness_create` | v2-only |
| Update | N/A | `harness_update` | v2-only |
| Delete | N/A | `harness_delete` | v2-only |

### Summary

| Metric | Count |
|--------|-------|
| Total  | 13    |
| ✅ Pass | 13    |
| ❌ Fail | 0     |

### Test Results

| ID | Test | v1 | v2 | Notes |
|----|------|----|----|-------|
| CON-001 | List (project scope) | ✅ 15 connectors | ✅ 15 connectors (total:15) | Counts match |
| CON-002 | List (org scope) | ⚠️ 15 (defaults to project) | ✅ 2 org-only. Deep link: `…/orgs/AI_Devops/settings/connectors/KBA_S3_WFS3_User` | |
| CON-003 | List (account scope) | ⚠️ 15 (defaults to project) | ✅ 1065 account-level. Deep link: `…/settings/connectors/mcp_test_connector` | |
| CON-004 | Page 0, size 5 (account) | N/A | ✅ 5 items, total:1065. Deep links resolve correctly | |
| CON-005 | Filter (Github) | ✅ 8 Github | ✅ 8 Github | Counts match |
| CON-006 | Get by ID | ✅ Full spec + status | ✅ Full spec + `openInHarness` link | Both return complete data |
| CON-007 | Test connection | N/A | ✅ `nginx_github_connector` → SUCCESS | v2-only |
| CON-008 | Create | N/A | ✅ Created `mcp_test_create_conn_0319` (Github/Anonymous), deep link resolved | v2-only |
| CON-009 | Update | N/A | ✅ Updated name → `UPDATED`, description added, deep link resolved | v2-only |
| CON-010 | Delete | N/A | ✅ Deleted test connector | v2-only, cleanup |
| CON-011 | Create deep link | N/A | ✅ `…/connectors/mcp_test_create_conn_0319` | Resolved correctly |
| CON-012 | Update deep link | N/A | ✅ Same URL preserved after update | |
| CON-013 | Get deep link | N/A | ✅ `…/connectors/nginx_github_connector` | |

### Issues

| # | Severity | Description | Status |
|---|----------|-------------|--------|
| 1 | Low | v1 `list_connectors` schema has hard defaults (`org_id=AI_Devops`, `project_id=Sanity`); empty string doesn't clear scope. | ℹ️ v1 limitation |
| 2 | Low | v1 has no create/update/delete connector tools. | ℹ️ v1 limitation |
| 3 | Low | v1 has no pagination params (`page`/`size`). | ℹ️ v1 limitation |
| 4 | Medium | v2 deep links for account/org-scoped resources had empty path segments (`orgs//projects//`). Fixed in `buildDeepLink` — strips empty scope segments. | ✅ Fixed |
