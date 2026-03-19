# Module: CD/CI

## ENVIRONMENTS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List (Project) | `list_entities` (IDP Catalog) — returns `[]` | `harness_list` (`environment`) — **9** envs | ❌ Not comparable (different APIs) |
| List (Account) | `list_entities` — returns `[]` | `harness_list` — **80** envs | ❌ Not comparable |
| Get by ID | `get_entity` — 404 `ENTITY_NOT_FOUND` | `harness_get` — ✅ full details | ❌ Not comparable |

> **Note:** v1 has no dedicated CD environment tools (`list_environments` / `get_environment`). The closest v1 tools are `list_entities` / `get_entity` which query the **IDP Catalog**, not the CD environment API. All v1 calls return empty or 404 for CD environments.

---

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 11 |
| ✅ Passed | 6 |
| ⚠️ Partial | 1 |
| ⏭️ Skipped | 3 |
| N/A (v1) | 1 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| ENV-001 | List at Project scope | N/A — `list_entities` returns `[]` | ✅ 9 environments (total=9) | v1 has no CD env tool; IDP Catalog returns empty |
| ENV-002 | List at Org scope | N/A — `list_entities` returns `[]` | ✅ 0 environments (total=0) | No org-level envs exist in AI_Devops |
| ENV-003 | List at Account scope | N/A — `list_entities` returns `[]` | ✅ 80 environments (total=80) | Account has 80 envs across all orgs/projects |
| ENV-004 | Page 0, size 5 | N/A — `list_entities` returns `[]` | ✅ 5 items returned, total=9 | Pagination works; first 5 of 9 |
| ENV-005 | Page 1, size 5 | N/A — `list_entities` returns `[]` | ✅ 4 items returned, total=9 | Correct remainder (9−5=4) |
| ENV-006 | Filter by type (Production) | N/A — `list_entities` returns `[]` | ⚠️ Returns all 9 (filter ignored) | `env_type=Production` not applied; both Production and PreProduction filters return 9. Bug: filter not passed to API or API ignores it. |
| ENV-007 | Get by ID (preprod) | ❌ 404 `ENTITY_NOT_FOUND` | ✅ Full details: PreProd, type=PreProduction, tags, YAML, openInHarness | v1 `get_entity` queries IDP Catalog, not CD API |
| ENV-008 | Create | ⚪ N/A (v2 only) | ⏭️ Skipped — destructive | v2 `harness_create` supports `resource_type=environment` |
| ENV-009 | Update | ⚪ N/A (v2 only) | ⏭️ Skipped — destructive | v2 `harness_update` supports `resource_type=environment` |
| ENV-010 | Delete | ⚪ N/A (v2 only) | ⏭️ Skipped — destructive | v2 `harness_delete` supports `resource_type=environment` |
| ENV-011 | Verify openInHarness URL | N/A | ✅ Valid deep links | Pattern: `https://qa.harness.io/ng/account/{accountId}/all/orgs/{org}/projects/{project}/settings/environments/{envId}/details`. Account-scope links have empty org/project segments. |

> **Legend:** ✅ Pass | ❌ Fail | ⚠️ Partial | ⏭️ Skipped | N/A = Not Applicable | ⚪ = Not supported in version

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | ENV-006 | Medium | v2 `env_type` filter not applied — `harness_list` with `filters.env_type=Production` returns all 9 environments instead of only Production ones. Both "Production" and "PreProduction" filters return the full set. Filter may not be forwarded to the Harness API. | 🔴 Open |
| 2 | ENV-001–007 | Info | v1 has no dedicated CD environment tools. `list_entities` / `get_entity` target the IDP Catalog, not the CD environment API. All v1 environment tests return empty or 404. | ℹ️ By Design |
| 3 | ENV-003 | Low | Account-scope deep links contain empty org/project segments (`/orgs//projects//`). Cosmetic but may confuse users. | 🟡 Open |
| 4 | ENV-003 | Low | v2 list `openInHarness` previously contained `{environmentIdentifier}` placeholder. **Fix:** Enhanced deep link resolution to check nested wrapper objects. | ✅ Fixed |

---

### Notes

- v2 returns 9 environments at project scope (AI_Devops/Sanity), 0 at org scope, 80 at account scope.
- Pagination works correctly: page 0/size 5 → 5 items, page 1/size 5 → 4 items, total=9 consistent.
- v2 `harness_get` returns comprehensive data: YAML, tags, timestamps, storeType, openInHarness link.
- v1 `list_entities`/`get_entity` are IDP Catalog tools — they do not cover CD environments. No functional parity is possible for this module.
- Deep links are fully resolved with actual identifiers (no placeholders). Format validated as correct.
- CRUD operations (ENV-008–010) skipped per policy — v2 `harness_create`, `harness_update`, `harness_delete` all advertise environment support via `harness_describe`.
