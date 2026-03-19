# Module: CD/CI

## PIPELINES — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | `list_pipelines` | `harness_list` (`pipeline`) | ✅ **259** = **259** |
| Filter "deploy" | `list_pipelines(search_term)` | `harness_list(search_term)` | ✅ **95** = **95** |
| Get | `get_pipeline` | `harness_get` (`pipeline`) | ✅ YAML identical |
| Summary | `get_pipeline_summary` | `harness_get` (full GET) | ✅ Both return pipeline metadata |
| Diagnose | N/A | `harness_diagnose` (`pipeline`) | ✅ v2-only — rich failure analysis |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 12 |
| ✅ Passed | 8 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 4 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| PIP-001 | List all pipelines | ✅ 259 pipelines (totalElements) | ✅ 259 pipelines (total) | Counts match exactly |
| PIP-002 | Page 1, size 5 | ✅ 5 items returned, 52 pages | ✅ 5 items returned, total=259 | Same 5 identifiers in same order |
| PIP-003 | Page 2, size 5 | ✅ 5 items (page 1), first=K8s_rolling_deployment12 | ✅ 5 items (page 1), first=K8s_rolling_deployment12 | Pagination offsets match |
| PIP-004 | Filter by search term "deploy" | ✅ 95 matches | ✅ 95 matches | Counts match; v2 returns deep links in name |
| PIP-005 | Get by ID (`custom_stage_pipeline`) | ✅ Full YAML + modules + storeType | ✅ Identical YAML + openInHarness URL | YAML identical; v2 adds `openInHarness` deep link |
| PIP-006 | Get Summary (`custom_stage_pipeline`) | ✅ Compact: name, stages, execSummary (lastStatus=Failed) | ✅ Full YAML + metadata + openInHarness | v1 has dedicated `get_pipeline_summary`; v2 returns full GET |
| PIP-007 | Create pipeline | N/A — v1 has no create | ⏭️ Skipped — destructive | v2-only CRUD |
| PIP-008 | Update pipeline | N/A — v1 has no update | ⏭️ Skipped — destructive | v2-only CRUD |
| PIP-009 | Delete pipeline | N/A — v1 has no delete | ⏭️ Skipped — destructive | v2-only CRUD |
| PIP-010 | Run pipeline (`wait_pipeline_10min_v8`) | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | v1 uses `execute_workflow` (IDP only); v2 uses `harness_execute(action=run)` |
| PIP-011 | Diagnose failure (`custom_stage_pipeline`) | N/A — no diagnose tool | ✅ Rich analysis: failed step=tag_resources, stage=custom_stage, script env vars, timing (12s), delegate=qa-ssca-attt | v2-only; identifies root cause (ShellScript failed, RESOURCE_IDS=null) |
| PIP-012 | Verify openInHarness URL | N/A | ✅ `https://qa.harness.io/ng/account/{id}/all/orgs/AI_Devops/projects/Sanity/pipelines/{pipelineId}/pipeline-studio?storeType=INLINE` | Valid format; includes `storeType` param; present in list, get, and diagnose responses |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| — | — | — | No issues found | — |

---

### Notes

- v1 and v2 both return **259** total pipelines — count matches exactly.
- Pagination is consistent: page 0 size 5 and page 1 size 5 return identical items in the same order across both servers.
- Filter by search term "deploy" returns **95** matches on both v1 and v2.
- v2 GET returns identical YAML to v1 for `custom_stage_pipeline`, plus `openInHarness` deep link.
- v1 has a dedicated `get_pipeline_summary` tool returning compact metadata (no YAML); v2 has no equivalent — `harness_get` always returns full pipeline YAML.
- Deep links are embedded in v2 list `name` field as markdown links and in get/diagnose as `openInHarness` field, including `storeType` query param.
- `harness_diagnose` (v2-only) returns detailed failure analysis: failed step, script context with environment variables, timing breakdown, bottleneck stage, and delegate info.
- v1 `execute_workflow` is for IDP workflows only, not pipeline execution. v1 has no direct pipeline run tool.
- CRUD and execute tests skipped as destructive operations.
- Revalidated 2026-03-19: All 8 executable tests passing; 4 skipped (destructive).
