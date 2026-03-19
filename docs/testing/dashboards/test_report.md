# Module: PLATFORM

## DASHBOARDS — Test Report

**Date:** 2026-03-19
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### Tool Parity

| Check | v1 | v2 | Match |
| ----- | -- | -- | ----- |
| List | `list_dashboards` — 44 total | `harness_list` (`dashboard`) — 44 total | ✅ |
| Get data | `get_dashboard_data` — 352 KB | `harness_get` (`dashboard_data`) — 352 KB | ✅ |
| Pagination | `list_dashboards(page, size)` 1-indexed | `harness_list(page, size)` 1-indexed | ✅ |

### Summary

| Metric | Count |
| ------ | ----- |
| Total  | 4     |
| ✅ Pass | 4     |
| ❌ Fail | 0     |

### Test Results

| ID | Test | v1 | v2 | Notes |
| -- | ---- | -- | -- | ----- |
| DSH-001 | List all dashboards | ✅ 44 total (9 categories) | ✅ 44 total (flat list with title/type) | Counts match |
| DSH-002 | Page 1, size 5 | ✅ 5 dashboards | ✅ 5 dashboards (STO, IaCM, IDP) | Both return first 5 |
| DSH-003 | Page 2, size 5 | ✅ 5 dashboards (Services CG, IDP Catalog, …) | ✅ 5 different dashboards (Services CG, IDP Catalog, IDP Workflow Execs, …) | 🔧 Fixed — `page` was missing from queryParams |
| DSH-004 | Get dashboard data (33257) | ✅ 352 KB IDP Adoption (tables, active users, plugins) | ✅ 352 KB structured tables (Total_Active_Users, Active_Users_List, …) | 🔧 Fixed — added ZIP+CSV parsing via `dashboard_data` resource type |

### Issues

| # | Severity | Description | Status |
| - | -------- | ----------- | ------ |
| 1 | Medium | `page` param was missing from list queryParams — pagination always returned page 1. Fixed by adding `page: "page"` mapping. | ✅ Fixed |
| 2 | High | `harness_get(dashboard)` hit non-existent endpoint `/dashboard/api/dashboards/{id}` (404). Removed broken `get` from `dashboard` resource. Dashboard data now served via `dashboard_data` resource type with binary ZIP→CSV parsing, matching v1's `get_dashboard_data`. | ✅ Fixed |
| 3 | Info | Dashboard API uses 1-indexed pages (page 1 = first page). Matches v1 behavior. Page 0 returns empty results. | ℹ️ By design |
| 4 | Info | v1 groups dashboards by category (CF, CI, STO, IDP, …); v2 returns flat list. | ℹ️ By design |
