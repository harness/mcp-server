# Module: PLATFORM

## ROLES — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | `list_available_roles` (31 total) | `harness_list` (`role`) (31 total) | ✅ Counts match |
| Get | `get_role_info` (`_project_admin`) | `harness_get` (`role`, `_project_admin`) | ✅ Both return full permissions list |

---

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 6 |
| ✅ Passed | 4 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 2 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| ROL-001 | List roles | ✅ 31 total (5 per page default) | ✅ 31 total (20 per page default) | Counts match; v1 default page size 5, v2 default page size 20 |
| ROL-002 | Page 1, size 5 | ✅ 5 items returned (page 0); first: `_project_admin` | ✅ 5 items returned (page 0); first: `_project_admin` | Same items, same order |
| ROL-003 | Page 2, size 5 | ✅ 5 items returned (page 1); first: `_idp_admin` | ✅ 5 items returned (page 1); first: `_idp_admin` | Same items, same order |
| ROL-004 | Get by ID | ✅ `_project_admin` — identifier, name, permissions, description, scope, harnessManaged | ✅ `_project_admin` — identifier, name, permissions, description, harnessManaged, openInHarness | Both return full permissions list; v2 adds deep link |
| ROL-005 | Create | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | |
| ROL-006 | Delete | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | — | — | No issues found in this run | — |

---

### Notes

- v1 `list_available_roles` defaults to page size 5 (max 20); v2 `harness_list` defaults to page size 20 (max 100).
- Both v1 and v2 return 31 total roles — perfect count match.
- Pagination verified: page 0 and page 1 with size 5 return identical role sets in the same order across v1 and v2.
- v1 `get_role_info` returns `scope` with empty identifiers and `allowedScopeLevels`; v2 `harness_get` returns `scope: null` and adds `openInHarness` deep link.
- v1 returns full role details including all permissions per role in list responses (can be very large for admin roles).
- v2 compact list returns only timestamps and deep link — use `harness_get` for full details.
- CRUD tests (ROL-005, ROL-006) skipped as destructive operations.
