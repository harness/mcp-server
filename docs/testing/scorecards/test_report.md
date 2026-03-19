# Module: IDP (Internal Developer Portal)

## SCORECARDS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | `list_scorecards` | `harness_list` (`scorecard`) | ✅ Both return **180** scorecards |
| Get | `get_scorecard` | `harness_get` (`scorecard`) | ✅ Identical core data; v2 adds `openInHarness` |
| Stats | `get_scorecard_stats` | `harness_get` (`scorecard_stats`) | ✅ Identical entity/score; v2 adds `openInHarness` |

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
| SCR-001 | List scorecards | ✅ 180 scorecards (identifier, name, checks, published) | ✅ 180 scorecards (name+link, identifier, description) | Counts match exactly |
| SCR-002 | Get scorecard by ID | ✅ Full checks (weightage), filter (kind, scopes, tags), components=1, percentage=100 | ✅ Same data + `openInHarness`, `on_demand`, `checks_missing` fields | `Scorecard_Stats_DO_NOT_DELETE` — identical core data |
| SCR-003 | Get scorecard stats | ✅ 1 entity (AUTOMATION-DONOTDELETE), score=100 | ✅ 1 entity (AUTOMATION-DONOTDELETE), score=100 + `openInHarness` | `Scorecard_Stats_DO_NOT_DELETE` — data matches |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | SCR-001 | High | v2 used wrong API path `/gateway/idp/api/scorecards`. **Fix:** Changed to `/v1/scorecards` (discovered from v1 MCP logs). | ✅ Fixed |

---

### Notes

- **Root cause (historical):** IDP APIs use `/v1/` prefix directly (e.g., `/v1/scorecards`), not `/gateway/idp/api/`.
- **Fix applied:** Updated `idp.ts` to use correct path `/v1/scorecards`.
- v1 list returns full check objects with expressions; v2 list returns compact items (name, identifier, description).
- v2 GET returns identical data to v1 plus `openInHarness` deep link, `on_demand`, and `checks_missing` fields.
- v2 stats uses `resource_type=scorecard_stats` with `harness_get` — returns same entity/score data plus `openInHarness`.
- Revalidated 2026-03-19: All 3 test plan IDs (SCR-001, SCR-002, SCR-003) passing on both v1 and v2.
