# Module: IDP (Internal Developer Portal)

## SCORECARD CHECKS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | `list_scorecard_checks` (5 items, default size=5) | `harness_list` (`scorecard_check`) (20 items, default size=20) | ✅ Same data; different default page sizes & field shapes |
| Get by ID | `get_scorecard_check` | `harness_get` (`scorecard_check`, params `is_custom`) | ✅ Identical check details |
| Get Stats | `get_scorecard_check_stats` | `harness_get` (`scorecard_check_stats`, params `is_custom`) | ✅ Identical entity PASS/FAIL stats |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 4 |
| ✅ Passed | 4 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 0 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| CHK-001 | List all scorecard checks | ✅ 5 checks returned (default size=5). Fields: custom, data_source, expression, identifier, name, tags | ✅ 20 checks returned (total=20, default size=20). Fields: identifier, name, description, tags | Both return checks. v1 default page size 5, v2 default 20. v1 includes richer fields (expression, data_source, custom flag); v2 compact mode strips those. |
| CHK-002 | Page 0, size 5 | ✅ 5 checks returned | ✅ 5 checks returned (total=5) | Both correctly paginate. Same 5 checks in same order. |
| CHK-003 | Get check by ID (`TestCustomCheckScorecard`) | ✅ Full details: rules, expression, rule_strategy, tags, percentage, default_behaviour | ✅ Full details: same fields. Requires `params: {is_custom: "true"}` | Identical data. v2 initially 404'd without `is_custom`; passing it via `params` fixed it. |
| CHK-004 | Get check stats (`TestCustomCheckScorecard`) | ✅ 10 entity stats (8 PASS, 2 FAIL) | ✅ 10 entity stats (8 PASS, 2 FAIL) + `openInHarness` URL | Identical entity-level PASS/FAIL results. v2 adds Harness UI deep link. |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | SCK-001 | High | v2 used wrong API path `/v1/scorecards/checks`. **Fix:** Changed to `/v1/checks` (discovered from v1 MCP logs). | ✅ Fixed |
| 2 | SCK-003 | High | `scorecard_check` GET missing `is_custom` query param. Custom checks returned 404 without it. **Fix:** Added `queryParams: { is_custom: "custom" }` to `idp.ts`. | ✅ Fixed |
| 3 | SCK-004 | High | `scorecard_check_stats` GET missing `is_custom` query param. Custom check stats returned null boolean error. **Fix:** Added `queryParams: { is_custom: "custom" }` to `idp.ts`. | ✅ Fixed (2026-03-19) |
| 4 | CHK-003 | Low | v2 `harness_get` for custom checks requires `params: {is_custom: "true"}` to avoid 404. Works correctly when provided. | ⚠️ By design |

---

### Notes

- **Root cause (SCK-001):** IDP checks API uses `/v1/checks`, not `/v1/scorecards/checks`.
- **Root cause (SCK-003/004):** The `/v1/checks/{id}` and `/v1/checks/{id}/stats` endpoints require `custom=true` query param for custom checks.
- All fixes applied in `src/registry/toolsets/idp.ts`.
- v1 and v2 return identical data for both check details and check stats.
- v2 list returns more items by default (page size 20 vs v1 page size 5) and uses compact field shapes.
- v2 get/stats responses include `openInHarness` deep link URL not present in v1.
- Revalidated 2026-03-19: All 4 tests (CHK-001 through CHK-004) passing on both v1 and v2.
