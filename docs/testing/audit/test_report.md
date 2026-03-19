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
| List / filter | `list_user_audits` | `harness_list` (`audit_event`) | ✅ Both return results; v2 ignores page/size |
| Get YAML diff | `get_audit_yaml` | `harness_get` (`audit_event`) | ❌ v2 returns internal error |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 5 |
| ✅ Passed | 3 |
| ❌ Failed | 2 |
| ⏭️ Skipped | 0 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| AUD-001 | List audit events | ✅ 61 events (5/page, 13 pages) — rich metadata (resource type/identifier, action, module, principal, timestamp) | ✅ 5,236,190 events (50/page) — compact metadata (auditId, module, openInHarness) | Both work; v1 requires explicit start_time/end_time; v1 returns richer per-event metadata |
| AUD-002 | Page 1, size 5 | ✅ 5 items returned on page 0, totalItems=61, 13 pages | ❌ size param ignored — returned 50 items instead of 5; total=5,236,190 | v2 does not honor `size` param for `audit_event` resource type |
| AUD-003 | Page 2, size 5 | ✅ 5 different items on page 1 (correct offset from page 0) | ❌ Returned identical items as page 0 — pagination not effective | v2 `page` param has no visible effect on `audit_event` results |
| AUD-004 | Filter by action (CREATE) | ✅ 32 CREATE events filtered correctly (5/page, 7 pages) | ✅ 1,809,486 CREATE events via `filters.action` | Both correctly filter by action; v2 uses `filters: {"action": "CREATE"}` |
| AUD-005 | Get YAML diff | ✅ oldYaml/newYaml returned showing connector update diff (description field added) | ❌ Internal server error: "Oops, something went wrong on our end" | v2 `harness_get` does not support `audit_event` resource type for YAML diffs |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | AUD-001 | Low | v1 `list_user_audits` panics when called with empty start_time/end_time defaults. Works correctly when explicit ISO 8601 times are provided. | Workaround — always pass time params |
| 2 | AUD-002 | Medium | v2 `harness_list` ignores `size` param for `audit_event` — always returns ~50 items regardless of requested page size. | Open |
| 3 | AUD-003 | Medium | v2 `harness_list` ignores `page` param for `audit_event` — page 0 and page 1 return identical results. | Open |
| 4 | AUD-005 | High | v2 `harness_get` with `resource_type=audit_event` returns internal server error (-32603). No way to retrieve YAML diffs in v2. | Open |

---

### Notes

- v2 uses resource type `audit_event` (not `audit`). Using `audit` returns an error listing available types.
- v1 works when explicit `start_time` and `end_time` are provided (ISO 8601). Panics only on empty defaults.
- v1 returned 61 audit events (7-day window) with rich metadata (resource type/identifier, action, module, principal, timestamp).
- v2 returns 5.2M+ audit events across all time with compact metadata (auditId, module, openInHarness link).
- v2 pagination (`page`, `size`) is non-functional for `audit_event` — always returns the same ~50 items.
- v2 action filtering works via `filters: {"action": "CREATE"}` — correctly narrowed to 1.8M CREATE events.
- v2 does not support `harness_get` for `audit_event` — returns internal server error. No YAML diff capability in v2.
- **Re-tested 2026-03-19:** All 5 test IDs from test_plan.md executed against both servers.
