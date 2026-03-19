# Module: PLATFORM

## CONNECTORS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List (project scope) | `list_connectors` → 15 | `harness_list` (`connector`) → 15 | ✅ counts match |
| List (org scope) | `list_connectors` → 15 (defaults not cleared) | `harness_list` → 2 org-only | ⚠️ v1 can't clear project default |
| List (account scope) | `list_connectors` → 15 (defaults not cleared) | `harness_list` → 1065 | ⚠️ v1 can't clear scope defaults |
| Filter (Github) | `list_connectors(types=Github)` → 8 | `harness_list(filters.type=Github)` → 8 | ✅ counts match |
| Get by ID | `get_connector_details` ✅ | `harness_get` ✅ | ✅ both return full details |
| Test connection | N/A (v1 has no tool) | `harness_execute(test_connection)` → SUCCESS | ✅ v2-only, works |
| Pagination | N/A (v1 has no page/size params) | `harness_list(page, size)` ✅ | ✅ v2-only, works |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 13 |
| ✅ Passed | 9 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 4 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| CON-001 | List at Project scope | 15 connectors | 15 connectors (total:15) | ✅ Counts match; v1 returns full spec, v2 returns compact metadata with `openInHarness` |
| CON-002 | List at Org scope | 15 connectors (defaults to project) | 2 connectors (total:2) | ✅ v2 correctly returns org-only (KBA_S3_WFS3_User, harnessSecretManager); v1 schema defaults `project_id=Sanity`, empty string does not clear it |
| CON-003 | List at Account scope | 15 connectors (defaults to project) | 1065 connectors (total:1065) | ✅ v2 correctly returns account-level; v1 can't clear `org_id`/`project_id` defaults |
| CON-004 | Page 1, size 5 | N/A (no pagination params) | 5 items (total:15) | ✅ v2 pagination works; v1 `list_connectors` has no `page`/`size` params |
| CON-005 | Page 2, size 5 | N/A (no pagination params) | 5 items (total:15) | ✅ Different set from page 0; v1 has no pagination support |
| CON-006 | Filter by type (Github) | 8 Github connectors | 8 Github connectors (total:8) | ✅ Counts match; v1 uses `types` param, v2 uses `filters.type` |
| CON-007 | Get by ID | Full details (name, type, spec, status=SUCCESS) | Full details + `openInHarness` URL | ✅ Both return complete connector data for `nginx_github_connector` |
| CON-008 | Create | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | Not run to avoid side effects |
| CON-009 | Update | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | Not run to avoid side effects |
| CON-010 | Delete | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | Not run to avoid side effects |
| CON-011 | Test Connection | N/A (v1 has no tool) | SUCCESS — delegateId: `fGmj_Hx4TkOBP73SJsDmIQ` | ✅ `nginx_github_connector` test passed via `harness_execute(action=test_connection)` |
| CON-012 | Deep link after create | ⏭️ Skipped (no create run) | ⏭️ Skipped (no create run) | Create not executed; cannot verify post-create deep link |
| CON-013 | Deep link after get | N/A | `https://qa.harness.io/ng/account/px7xd_BFRCi-pfWPYXVjvw/all/orgs/AI_Devops/projects/Sanity/settings/connectors/nginx_github_connector` | ✅ Valid URL with actual connector ID (no placeholder) |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | CON-006 | High | Type filter not applied — `bodyBuilder` read `input.type` but LLM passes `types` (plural). Body had no `types` field, returning all 14 instead of 7 Github connectors. | ✅ Fixed — added `input.type ?? input.types` fallback |
| 2 | CON-004 | Medium | Pagination query params wrong — sent `page`/`size` but API expects `pageIndex`/`pageSize`. Pagination was silently ignored, always returning page 0 with default size. | ✅ Fixed — mapped to `pageIndex`/`pageSize` |
| 3 | CON-001 | Low | v2 list `openInHarness` URLs contain `{connectorIdentifier}` placeholder instead of actual ID. **Fix:** Enhanced deep link resolution to check nested wrapper objects. | ✅ Fixed |
| 4 | CON-002/003 | Low | v1 `list_connectors` schema has hard defaults (`org_id=AI_Devops`, `project_id=Sanity`); empty string does not clear scope. Cannot test org-only or account-only listing via v1. | ℹ️ v1 limitation — by design |

---

### Notes

- v1 `list_connectors` returns full connector spec (name, identifier, type, spec, status) while v2 `harness_list` returns compact metadata (createdAt, status, openInHarness). Use `harness_get` for full details.
- v2 `harness_execute(action=test_connection)` is v2-only — no equivalent tool in v1.
- v1 `list_connectors` does not support pagination (no `page`/`size` params in schema). All results are returned in a single response.
- v1 scope defaults are baked into the schema (`org_id=AI_Devops`, `project_id=Sanity`); passing empty strings does not override them, making org-only and account-only listing impossible via v1.
- v2 `harness_get` response includes `openInHarness` deep link with resolved connector identifier (no placeholders).
- CON-006: v1 filter uses `types` param (matches schema enum), v2 uses `filters.type` — both return 8 Github connectors (up from 7 in previous run due to new test connectors).
- CON-011: `nginx_github_connector` test connection succeeded with delegateId `fGmj_Hx4TkOBP73SJsDmIQ`.
- All CRUD tests (CON-008 through CON-010) skipped as destructive operations.
- CON-012 skipped because create was not run this session.
