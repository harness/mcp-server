# Module: PLATFORM

## SERVICE ACCOUNTS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | *(no list tool in v1 MCP set)* | `harness_list` (`service_account`) | v2 only |
| Get | `get_service_account` | `harness_get` (`service_account`) | ✅ both |
| Create | `create_service_account` | `harness_create` (`service_account`) | ✅ both |
| Delete | `delete_service_account` | `harness_delete` (`service_account`) | ✅ both |

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
| SAC-001 | List at Project scope | N/A — no list tool | ✅ 0 items | No service accounts at project scope |
| SAC-002 | List at Org scope | N/A — no list tool | ✅ 0 items | No service accounts at org scope |
| SAC-003 | List at Account scope | N/A — no list tool | ✅ 0 items | No service accounts at account scope |
| SAC-004 | Page 1, size 5 | N/A — no list tool | ✅ 0 items | Pagination accepted; empty result set |
| SAC-005 | Get by ID | ✅ 400 "doesn't exist in scope" | ✅ error (generic) | Both correctly error on non-existent SA; v1 returns specific message, v2 returns generic error |
| SAC-006 | Create at Project scope | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | |
| SAC-007 | Create at Org scope | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | |
| SAC-008 | Create at Account scope | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | |
| SAC-009 | Delete | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | SAC-005 | Low | v2 `harness_get` returns generic "Oops, something went wrong" instead of specific "doesn't exist in scope" error like v1 | Open |

---

### Notes

- v1 has no list tool for service accounts; only `get_service_account`, `create_service_account`, and `delete_service_account`.
- No service accounts exist at any scope (project, org, account); all list calls correctly returned empty results.
- SAC-005 tested with placeholder ID `test_sa` since no real service accounts exist. Both servers correctly reject the request.
- v1 error message is more informative (includes specific SA identifier and scope), while v2 returns a generic internal error message.
- CRUD tests (SAC-006 through SAC-009) skipped as destructive operations.
