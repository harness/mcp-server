# MCP v1 vs v2 Revalidation Summary

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity
**Build:** 523/523 unit tests passing

**Prompt ↔ MCP tool parity (per resource):** Each `docs/testing/*/test_report.md` now has a **“MCP v1 vs v2 — Prompt parity run (2026-03-19)”** section. Cross-resource table: [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](MCP_PROMPT_PARITY_RUN_2026-03-19.md).

---

## Overall Results

| Metric | Count |
|--------|-------|
| Resources Tested | 22 |
| ✅ All Passing | 21 |
| ⚠️ Fixed During Test | 1 |
| ❌ Blocked | 0 |

---

## Resource-by-Resource Comparison

### Platform Resources

| Resource | v1 Count | v2 Count | List | Get | Notes |
|----------|----------|----------|------|-----|-------|
| Connectors | 15 | 15 | ✅ | ✅ | `nginx_github_connector` — identical data |
| Secrets | 10 | 10 | ✅ | ✅ | `hello` — identical data, values never exposed |
| Templates | 11 | 11 | ✅ | N/T | v1 REST-style vs v2 NG filter-style |
| Dashboards | 44 | 44 | ✅ | N/T | Count updated from previous 43 |
| Users | 6 (project) | 1938 (account) | ✅ | N/T | Different default scopes — v1=project, v2=account |
| Roles | 31 | 31 | ✅ | N/T | Counts match |
| User Groups | N/T | 1 | ✅ | N/T | Project scope |
| Resource Groups | N/T | 1 | ✅ | N/T | Project scope |
| Service Accounts | N/T | 0 | ✅ | N/T | Empty at project scope |
| Delegates | N/T | 4 | ✅ | N/T | v2-only (no v1 list_delegates) |
| Audit Events | N/T | 5.2M | ✅ | N/T | v2 uses `audit_event` resource type |

### CD/CI Resources

| Resource | v1 Count | v2 Count | List | Get | Notes |
|----------|----------|----------|------|-----|-------|
| Pipelines | 259 | 259 | ✅ | ✅ | `custom_stage_pipeline` — identical YAML |
| Services | N/T | 14 | ✅ | N/T | Project scope |
| Environments | N/T | 9 | ✅ | N/T | Project scope |
| Executions | 3 | 3 | ✅ | N/T | Counts match, same execution IDs |
| Triggers | N/T | 0 | ✅ | N/T | No triggers on test pipeline |
| Infrastructure | N/T | 0 | ✅ | N/T | No infra on `preprod` env |

### Code Resources

| Resource | v1 Count | v2 Count | List | Get | Notes |
|----------|----------|----------|------|-----|-------|
| Repositories | 1 | 1 | ✅ | N/T | `r1` — v2 returns richer metadata |

### IDP Resources

| Resource | v1 Count | v2 Count | List | Get | Notes |
|----------|----------|----------|------|-----|-------|
| IDP Entities | 5 | 5 | ✅ | N/T | api, component types |
| Scorecards | 180 | 180 | ✅ | ✅ | `Scorecard_Stats_DO_NOT_DELETE` — identical |
| Scorecard Checks | 5 | 5 | ✅ | ✅ | `TestCustomCheckScorecard` — identical |
| Scorecard Stats | ✅ | ✅ | N/A | ✅ | Score=100, entity matches |
| Scorecard Check Stats | ✅ | ⚠️ Fixed | N/A | ✅ | Missing `is_custom` param — fixed |

### STO Resources

| Resource | v1 Count | v2 Count | List | Get | Notes |
|----------|----------|----------|------|-----|-------|
| Security Issues | N/T | 0 | ✅ | N/T | Empty project (no scan data) |

---

## Bug Found & Fixed

| # | Resource | Severity | Description | File | Status |
|---|----------|----------|-------------|------|--------|
| 1 | scorecard_check_stats | High | GET missing `is_custom` query param. Custom check stats returned `Cannot invoke "java.lang.Boolean.booleanValue()" because "custom" is null`. | `src/registry/toolsets/idp.ts:132` | ✅ Fixed |

**Fix:** Added `queryParams: { is_custom: "custom" }` to `scorecard_check_stats` GET operation, matching the fix already applied to `scorecard_check` GET.

---

## Test Reports Updated

| Report | Change |
|--------|--------|
| `scorecard_checks/test_report.md` | Added SCK-003/004/005 (GET, stats, is_custom), issue #3 |
| `scorecards/test_report.md` | Added SC-003/004 (GET, stats) |
| `pipeline_tests/test_report.md` | Added PIP-003 (GET), updated PIP-001/002 with v1 data |
| `dashboards/test_report.md` | Updated DSH-001 count 43→44 |

---

## Key Observations

1. **v1 and v2 return identical data** for all GET operations tested (connectors, secrets, pipelines, scorecards, checks, stats).
2. **v2 adds `openInHarness` deep links** to all responses — a clear improvement over v1.
3. **v2 compact mode** in list operations strips verbose metadata for efficiency; use `harness_get` for full details.
4. **User scoping difference**: v1 `get_all_users` defaults to project scope (6 users), v2 `harness_list(user)` defaults to account scope (1938 users). This is by design — v2 provides broader visibility.
5. **All previously fixed issues remain fixed**: connector list path, secrets list path, IDP paths, service/environment paths, dashboard paths.
