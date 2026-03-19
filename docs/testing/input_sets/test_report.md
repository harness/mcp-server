# Module: CD/CI

## INPUT SETS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List for pipeline | `list_input_sets` + `pipeline_identifier` | `harness_list` (`input_set`) + `filters.pipeline_id` | ✅ **0** for `custom_stage_pipeline` both |
| Page 1 size 5 | `list_input_sets` page=0 size=5 | `harness_list` page=0 size=5 | ✅ **0** items both |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 5 |
| ✅ Passed | 2 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 3 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| INS-001 | List input sets | ✅ Pass — 0 items | ✅ Pass — 0 items | Both return empty; pipeline has no input sets. v1: `pageSize:100, empty:true`; v2: `items:[], total:0` |
| INS-002 | Page 1, size 5 | ✅ Pass — 0 items | ✅ Pass — 0 items | Pagination params accepted; both return empty. v1: `pageSize:100, empty:true`; v2: `items:[], total:0` |
| INS-003 | Get by ID | ⏭️ Skipped | ⏭️ Skipped | No input sets exist for `custom_stage_pipeline` — cannot test get-by-ID |
| INS-004 | Create | N/A | ⏭️ Skipped — destructive | v1 has no create tool; v2 skipped to avoid side effects |
| INS-005 | Delete | N/A | ⏭️ Skipped — destructive | v1 has no delete tool; v2 skipped to avoid side effects |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | INS-002 | Low | v1 ignores `size` param — always returns `pageSize: 100` regardless of requested size 5 | Noted |

---

### Notes

- Input sets are nested under pipelines — require `pipeline_id` / `pipeline_identifier` to list.
- Pipeline `custom_stage_pipeline` has no input sets, so both v1 and v2 correctly return empty results.
- INS-003 (Get by ID) skipped because there are no input sets to retrieve.
- INS-004 / INS-005 (Create / Delete) skipped as destructive operations per test policy.
- v1 `list_input_sets` returns `pageSize: 100` even when `size: 5` is requested, suggesting it may not honor the size parameter. v2 `harness_list` accepted the size parameter without issue.
