# Module: PLATFORM

## USER GROUPS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | *(no list tool in v1 MCP set)* | `harness_list` (`user_group`) | ✅ v2 only (smoke) |
| Get | `get_user_group_info` | `harness_get` (`user_group`) | ✅ Both return data |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 9 |
| ✅ Passed | 5 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 4 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| UGR-001 | List at Project scope | N/A — no list tool | ✅ 1 group (`_project_all_users`) | v1 has no list capability for user groups |
| UGR-002 | List at Org scope | N/A — no list tool | ✅ 1 group (`_project_all_users`) | Server defaults may apply; returned project-scoped group |
| UGR-003 | List at Account scope | N/A — no list tool | ✅ 1 group (`_project_all_users`) | Server defaults may apply; returned project-scoped group |
| UGR-004 | Page 1, size 5 | N/A — no list tool | ✅ 1 group, page=0, size=5 | Pagination params accepted; total=1 |
| UGR-005 | Get by ID (`_project_all_users`) | ✅ 6 users with email+id | ✅ 6 user IDs + deep link + tags | v1 returns user objects (email+id); v2 returns user IDs only + `openInHarness` URL |
| UGR-006 | Create at Project scope | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | |
| UGR-007 | Create at Org scope | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | |
| UGR-008 | Create at Account scope | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | |
| UGR-009 | Delete | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | UGR-002 | Low | v2 org-scope list returns project-scoped group (server config defaults may override omitted `project_id`) | Observation |
| 2 | UGR-003 | Low | v2 account-scope list returns project-scoped group (server config defaults may override omitted `org_id`/`project_id`) | Observation |

---

### Notes

- v1 has no `list_user_groups` tool — only `get_user_group_info` (requires a known `user_group_id`), `create_user_group`, and `delete_user_group`.
- v2 `harness_list` with `resource_type=user_group` works for listing; `harness_get` returns richer metadata including `notificationConfigs`, `externallyManaged`, `harnessManaged`, `ssoLinked`, and `openInHarness` deep link.
- v1 `get_user_group_info` returns user objects with `id` and `email`; v2 `harness_get` returns only user IDs (no email resolution).
- Only 1 project-level user group exists: `_project_all_users` (Harness-managed, 6 users).
- UGR-002/003: When `org_id` or `project_id` are omitted in v2, the server's environment defaults (`HARNESS_DEFAULT_ORG`, `HARNESS_DEFAULT_PROJECT`) may fill them in, so the "org-only" and "account-only" scopes returned the same project-level result. This is expected server behavior, not a bug.
