# Module: PLATFORM

## AUDIT — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List / filter | `list_user_audits` | `harness_list` (`audit_event`) | ✅ Both return results; v2 honors page/size (pageIndex/pageSize fix) |
| Get YAML diff | `get_audit_yaml` | `harness_get` (`audit_event`) | ✅ Both return oldYaml/newYaml (v2 fix: path /audit/api/auditYaml + routingId) |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 5 |
| ✅ Passed | 5 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 0 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| AUD-001 | List audit events | ✅ 61 events (5/page, 13 pages) — rich metadata (resource type/identifier, action, module, principal, timestamp) | ✅ 5,233,114 events (20/page default) — compact metadata (auditId, module, openInHarness) | Both work; v1 requires explicit start_time/end_time; v1 returns richer per-event metadata |
| AUD-002 | Page 1, size 5 | ✅ 5 items returned on page 0, totalItems=61, 13 pages | ✅ 5 items on page 0, total=5,233,114 | v2 pagination fix (pageIndex/pageSize) — size now honored |
| AUD-003 | Page 2, size 5 | ✅ 5 different items on page 1 (correct offset from page 0) | ✅ 5 different items on page 2 (correct offset from page 0) | v2 pagination fix — page param now effective |
| AUD-004 | Filter by action (CREATE) | ✅ 32 CREATE events filtered correctly (5/page, 7 pages) | ✅ 1,808,182 CREATE events via `filters.action` | Both correctly filter by action; v2 uses `filters: {"action": "CREATE"}` |
| AUD-005 | Get YAML diff | ✅ oldYaml/newYaml returned showing connector update diff (description field added) | ✅ oldYaml/newYaml returned — connector update diff (name, description) | v2 fix: path `/audit/api/auditYaml`, `auditId` as query param, `routingId` required |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | AUD-001 | Low | v1 `list_user_audits` panics when called with empty start_time/end_time defaults. Works correctly when explicit ISO 8601 times are provided. | Workaround — always pass time params |
| 2 | AUD-002 | Medium | v2 `harness_list` ignores `size` param for `audit_event` — always returns ~50 items regardless of requested page size. | **Fixed** — queryParams now use pageIndex/pageSize (2026-03-19) |
| 3 | AUD-003 | Medium | v2 `harness_list` ignores `page` param for `audit_event` — page 0 and page 1 return identical results. | **Fixed** — queryParams now use pageIndex/pageSize (2026-03-19) |
| 4 | AUD-005 | High | v2 `harness_get` with `resource_type=audit_event` returned internal server error. | **Fixed** — use path `/audit/api/auditYaml`, auditId as query param, routingId (2026-03-19) |

---
