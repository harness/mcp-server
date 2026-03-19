# Module: PLATFORM

## DASHBOARDS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | `list_dashboards` — **44** total | `harness_list` (`dashboard`) — **44** total | ✅ Counts match |
| Get | `get_dashboard_data` — ✅ 360 KB | `harness_get` (`dashboard`) — ❌ 404 | ❌ v2 missing |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 4 |
| ✅ Passed | 2 |
| ❌ Failed | 1 |
| ⚠️ Partial | 1 |
| ⏭️ Skipped | 0 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| DSH-001 | List all dashboards | ✅ 44 total (9 categories) | ✅ 44 total (flat list) | Counts match; v1 groups by category (CF, CI, STO, IDP, …), v2 returns flat items with title/type/openInHarness |
| DSH-002 | Page 1, size 5 | ✅ 5 dashboards (FF Analytics, CG Dashboard, Deployments CG, Builds Executions, Repositories Metric) | ✅ 5 dashboards (FF Analytics, Builds Executions, Repositories Metric, CG Dashboard, Deployments CG) | Both return 5; ordering differs (v1=category-grouped, v2=flat) |
| DSH-003 | Page 2, size 5 | ✅ 5 dashboards (Services CG, IDP Catalog, IDP Workflow Execs, Security Testing Dashboard, STO Usage Dashboard) | ⚠️ Returns same 5 as page 0 | v2 dashboard pagination does not advance — page param ignored; v1 paginates correctly |
| DSH-004 | Get dashboard data (33257) | ✅ 360 KB IDP Adoption data (tables, active users, plugin stats) | ❌ HTTP 404 Not Found | v2 `harness_get` does not support `dashboard` resource_type; v1 returns full dashboard data |

> **Legend:** ✅ Pass | ❌ Fail | ⚠️ Partial | ⏭️ Skipped | N/A = Not Applicable | N/T = Not Tested

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | DSH-003 | Medium | v2 `harness_list(resource_type=dashboard)` ignores page param — always returns same first page | Open |
| 2 | DSH-004 | High | v2 `harness_get(resource_type=dashboard, resource_id=33257)` returns HTTP 404 — dashboard get not implemented in v2 | Open |

---

### Notes

- v1 `list_dashboards` returns dashboards grouped by category (CF, CG_CD, CI, CI_TI, IACM, IDP, STO, UNIVERSAL, custom) with rich metadata (id, title, view_count, favorite_count, data_source, type, created_at, last_accessed_at).
- v2 `harness_list(resource_type=dashboard)` returns a flat list with compact metadata (title, type, resourceIdentifier, openInHarness). All items share the same `resourceIdentifier: "53"`.
- v1 `list_dashboards` supports pagination (1-indexed pages); v2 pagination param is ignored for dashboards.
- v1 `get_dashboard_data` returns full dashboard content including Looker tables, user activity, and metrics (~360 KB for IDP Adoption).
- v2 `harness_get` does not support `dashboard` as a resource_type — returns 404. This is a feature gap.
- Both v1 and v2 report 44 total dashboards.
