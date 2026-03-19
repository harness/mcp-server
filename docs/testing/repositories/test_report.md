# Module: CODE

## CODE REPOSITORIES — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | `list_repositories` | `harness_list` (`repository`) | ✅ Both return 1 repo (`r1`) |
| Get | `get_repository` | `harness_get` (`repository`) | ✅ Both return `r1` details |
| Pagination (page 1, size 5) | `list_repositories` (page=1, limit=5) | `harness_list` (page=0, size=5) | ✅ Both return 1 repo |
| Pagination (page 2, size 5) | `list_repositories` (page=2, limit=5) | `harness_list` (page=1, size=5) | ⚠️ v1 returns `[]`, v2 still returns `r1` |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 4 |
| ✅ Passed | 3 |
| ⚠️ Partial | 1 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 0 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| REP-001 | List repositories | ✅ 1 repo (`r1`) — 12 fields | ✅ 1 repo (`r1`) — 25 fields | Counts match; v2 includes size, fork_id, num_pulls, tags, is_public, archived, is_favorite |
| REP-002 | Page 1, size 5 | ✅ 1 repo (`r1`) — page=1, limit=5 | ✅ 1 repo (`r1`) — page=0, size=5 | Both return same single repo; v1 is 1-indexed, v2 is 0-indexed |
| REP-003 | Page 2, size 5 | ✅ Empty `[]` (correct) | ⚠️ Returns `r1` again on page=1 | v2 pagination does not return empty beyond last page; v1 correctly returns `[]` |
| REP-004 | Get by ID (`r1`) | ✅ Returns repo details (12 fields) | ✅ Returns repo details (25 fields) + `openInHarness` link | Both return same core data; v2 adds UI deep link |

> **Legend:** ✅ Pass | ❌ Fail | ⚠️ Partial | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | REP-003 | Medium | v2 `harness_list` returns data on page=1 (0-indexed page 2) when only 1 repo exists with size=5 — should return empty | Open |

---

### Notes

- Both v1 and v2 return identical core repository data — 1 repo `r1` (empty, INLINE, default_branch=main).
- v2 includes additional fields beyond v1: description, size, size_lfs, size_updated, fork_id, num_forks, num_pulls, num_closed_pulls, num_open_pulls, num_merged_pulls, state, tags, is_public, importing, archived, is_favorite, uid.
- v2 `harness_get` additionally returns an `openInHarness` deep link to the Harness UI.
- v1 pagination is 1-indexed (`page=1` is first page); v2 is 0-indexed (`page=0` is first page).
- v2 has a pagination issue: requesting page=1 with size=5 when total items=1 still returns data instead of an empty result set.
