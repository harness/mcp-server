# Module: PLATFORM

## ROLE ASSIGNMENTS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | `list_role_assignments` — returns `pageSize:50`, empty content | `harness_list` (`role_assignment`) — returns 7 items with timestamps | ❌ v1 empty |
| Paginate (size 5) | `list_role_assignments` — returns `pageSize:50`, ignores size param | `harness_list` (`role_assignment`) — 5 items, total=7 | ❌ v1 no pagination |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 3 |
| ✅ Passed | 2 |
| ❌ Failed | 0 |
| ⚠️ Partial | 2 |
| ⏭️ Skipped | 1 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| RAS-001 | List role assignments | ⚠️ `SUCCESS`, pageSize 50, empty content — no items returned | ✅ 7 assignments returned (compact: createdAt/lastModifiedAt) | v1 returns metadata only; v2 returns actual items |
| RAS-002 | Page 0, size 5 | ⚠️ `SUCCESS`, pageSize 50, empty content — `size` param ignored | ✅ 5 items returned, total=7, pagination correct | v1 ignores size param and returns no items; v2 paginates correctly |
| RAS-003 | Create role assignment | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | CRUD test not safe to run in shared environment |

> **Legend:** ✅ Pass | ❌ Fail | ⚠️ Partial | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | RAS-001 | Medium | v1 `list_role_assignments` returns empty content with only pageSize metadata; v2 returns 7 actual items | Open |
| 2 | RAS-002 | Medium | v1 ignores `size` parameter — always reports pageSize 50 with no items | Open |

---

### Notes

- v1 `list_role_assignments` consistently returns `{"status":"SUCCESS","data":{"pageSize":50}}` with no role assignment items regardless of params.
- v2 `harness_list` with `resource_type=role_assignment` returns 7 items in compact mode (createdAt, lastModifiedAt only).
- v2 pagination confirmed working: requesting size=5 returns 5 items with total=7.
- RAS-003 (Create) skipped as destructive — would create a role assignment in the shared Sanity project.
