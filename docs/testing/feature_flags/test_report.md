# Module: FEATURE FLAGS

## FEATURE FLAGS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | *(not in v1 Cursor MCP list)* | `harness_list` (`feature_flag` / FME) | ✅ v2 only — no v1 FF tools |
| Get | *(not in v1 Cursor MCP list)* | `harness_get` (`feature_flag`) | ✅ v2 only |
| Create | *(not in v1 Cursor MCP list)* | `harness_create` (`feature_flag`) | ✅ v2 only |
| Delete | *(not in v1 Cursor MCP list)* | `harness_delete` (`feature_flag`) | ✅ v2 only |
| Toggle | *(not in v1 Cursor MCP list)* | `harness_execute` (`feature_flag`, action=toggle) | ✅ v2 only |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 7 |
| ✅ Passed | 4 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 3 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| FF-001 | List feature flags | N/A — no v1 FF tools | ✅ 2 flags returned | `mcp_crud_test_flag`, `My_Test_Flag`; pagination: itemCount=2, pageCount=1, pageSize=20 |
| FF-002 | Page 1, size 5 | N/A — no v1 FF tools | ✅ 2 flags, pageSize=5 | Both flags on page 0; itemCount=2, pageCount=1, pageIndex=0, pageSize=5 |
| FF-003 | Page 2, size 5 | N/A — no v1 FF tools | ✅ Empty page (expected) | pageIndex=1 returns features=[] — correct, only 2 flags total fit on page 0 |
| FF-004 | Get by ID | N/A — no v1 FF tools | ✅ Full details returned | `My_Test_Flag`: kind=boolean, state=off, 2 variations (true/false), envProperties present, openInHarness link resolved |
| FF-005 | Create flag | N/A — no v1 FF tools | ⏭️ Skipped — destructive | `harness_create` available for feature_flag |
| FF-006 | Delete flag | N/A — no v1 FF tools | ⏭️ Skipped — destructive | `harness_delete` available for feature_flag |
| FF-007 | Toggle flag | N/A — no v1 FF tools | ⏭️ Skipped — destructive | `harness_execute` (action=toggle) available for feature_flag |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | FF-003 | Low | v2 list `openInHarness` previously contained `{flagIdentifier}` placeholder. **Fix:** Enhanced deep link resolution to handle `features` array and resolve identifier. | ✅ Fixed |
| — | — | — | No new issues found in this run. All deep links now resolve correctly. | — |

---

### Notes

- v1 has zero feature flag tools — confirmed by inspecting all 60 v1 tool descriptors. FF module is v2-only.
- v2 returns rich flag metadata including kind, variations, environment properties (state, defaultServe, offVariation).
- Both flags (`mcp_crud_test_flag`, `My_Test_Flag`) are boolean type, currently in `off` state.
- Pagination works correctly: page 0 returns all 2 flags; page 1 returns empty array with correct metadata.
- `openInHarness` deep links now resolve fully (e.g. `.../feature-flags/My_Test_Flag`) — no more placeholder issue.
- FF-005/006/007 skipped as destructive but the v2 tools (`harness_create`, `harness_delete`, `harness_execute` with toggle) are confirmed available in the schema.
