# Module: CD/CI

## TRIGGERS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List for pipeline | `list_triggers` + `target_identifier` | `harness_list` (`trigger`) + `filters.pipeline_id` | ✅ **0** for `custom_stage_pipeline` both |
| Page 0, size 5 | `list_triggers` page=0 size=5 | `harness_list` page=0 size=5 | ✅ **0** both |
| Page 1, size 5 | `list_triggers` page=1 size=5 | `harness_list` page=1 size=5 | ✅ **0** both |
| Get by ID | N/A (v1 has no get) | `harness_get` (`trigger`) + `trigger_id` | ✅ correct 404 for non-existent trigger |

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
| TRG-001 | List triggers | ✅ Pass (0 items, `empty:true`) | ✅ Pass (0 items, `total:0`) | Both return 0 triggers for `custom_stage_pipeline` — parity confirmed |
| TRG-002 | Page 1, size 5 | ✅ Pass (0 items, page 0, size 5) | ✅ Pass (0 items, `total:0`) | Pagination params accepted; empty result consistent |
| TRG-003 | Page 2, size 5 | ✅ Pass (0 items, page 1, size 5) | ✅ Pass (0 items, `total:0`) | Page 2 returns empty on both; no out-of-range error |
| TRG-004 | Get by ID | N/A | ✅ Pass (404: "does not exist") | v2 `harness_get` correctly returns error for non-existent trigger; requires `trigger_id` + `pipeline_id` in params |
| TRG-005 | Create | N/A | ⏭️ Skipped — destructive | Write operation; not safe for automated parity testing |
| TRG-006 | Update | N/A | ⏭️ Skipped — destructive | Write operation; not safe for automated parity testing |
| TRG-007 | Delete | N/A | ⏭️ Skipped — destructive | Write operation; not safe for automated parity testing |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| — | — | — | No issues found | — |

---

### Notes

- Pipeline `custom_stage_pipeline` has 0 triggers; all list tests confirm empty results with parity across v1 and v2.
- v1 `list_triggers` requires `target_identifier` (pipeline ID) as a required param; v2 `harness_list` uses `filters.pipeline_id`.
- v2 `harness_get` for triggers requires both `trigger_id` in params and `pipeline_id` in params — returns proper 404 for non-existent triggers.
- TRG-005/006/007 (Create/Update/Delete) skipped as destructive operations not suitable for automated parity runs.
- v1 default `size` is 5; v2 default `size` is 20 — pagination defaults differ but both handle explicit size correctly.
