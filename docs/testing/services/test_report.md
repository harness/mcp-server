# Module: CD/CI

## SERVICES — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | N/A — no `list_services` tool in v1 | `harness_list` (`service`) | ✅ v2 `total` **14** |
| Get | N/A — no `get_service` tool in v1 | `harness_get` (`service`) | ✅ v2 full detail returned |

_v1 has no CD service tools (`list_services`/`get_service` absent from tool catalogue). Only IDP catalog `list_entities`/`get_entity` exist, which are unrelated._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 10 |
| ✅ Passed | 7 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 3 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| SVC-001 | List at Project scope | N/A — no service tool | ✅ 14 services returned | v2 `harness_list(resource_type=service, org_id=AI_Devops, project_id=Sanity)` — all project services returned with `createdAt`, `lastModifiedAt`, `openInHarness` |
| SVC-002 | List at Org scope | N/A — no service tool | ✅ 14 services returned | v2 `harness_list(resource_type=service, org_id=AI_Devops)` — server defaults to configured project; Harness services are project-scoped |
| SVC-003 | List at Account scope | N/A — no service tool | ✅ 14 services returned | v2 `harness_list(resource_type=service)` — server defaults to configured org/project; services are project-scoped in Harness |
| SVC-004 | Page 1, size 5 | N/A — no service tool | ✅ 5 items, total=14 | v2 `harness_list(page=0, size=5)` — first 5 services: mcp_crud_test_svc, deep_link_test_svc, crud_svc_test, sadx, retfd |
| SVC-005 | Page 2, size 5 | N/A — no service tool | ✅ 5 items, total=14 | v2 `harness_list(page=1, size=5)` — next 5 services: jnlk, k8s_multi_resource_service, spegel_service, helmDeployClone, helm_deploy. Different set from page 0 ✅ |
| SVC-006 | Get by ID | N/A — no service tool | ✅ Full detail returned | v2 `harness_get(resource_type=service, resource_id=k8s_multi_resource_service)` — returns name, description, YAML, tags, storeType, openInHarness |
| SVC-007 | Create | N/A — v2 only | ⏭️ Skipped — destructive | `harness_create` with `resource_type=service` available but not executed |
| SVC-008 | Update | N/A — v2 only | ⏭️ Skipped — destructive | `harness_update` with `resource_type=service` available but not executed |
| SVC-009 | Delete | N/A — v2 only | ⏭️ Skipped — destructive | `harness_delete` with `resource_type=service` available but not executed |
| SVC-010 | Verify openInHarness URL | N/A — v2 only | ✅ URL format valid | List & Get both return `https://qa.harness.io/ng/account/{accountId}/all/orgs/{orgId}/projects/{projectId}/settings/services/{serviceId}` — no placeholder tokens, fully resolved |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | SVC-003 | Low | v2 list `openInHarness` previously contained `{serviceIdentifier}` placeholder. **Fix:** Enhanced deep link resolution to check nested wrapper objects. | ✅ Fixed |
| 2 | — | Info | v1 MCP server has no CD service tools (`list_services`, `get_service`). Only IDP catalog `list_entities`/`get_entity` exist. | ⚠️ Gap |
| 3 | SVC-002/003 | Info | Org-scope and account-scope list calls return same 14 project-scoped services — server falls back to configured default project. Harness services are inherently project-scoped. | ℹ️ By design |

---

### Notes

- v2 returns 14 services at project scope with compact metadata (`createdAt`, `lastModifiedAt`, `openInHarness`).
- `openInHarness` deep links are fully resolved in both `harness_list` and `harness_get` responses — no placeholder tokens.
- Pagination works correctly: page 0 and page 1 (size 5) return distinct, non-overlapping service sets.
- `harness_get` returns full service detail including YAML definition, tags (`ai_generated: true`), storeType, and validity status.
- v1 has **no** CD/CI service tools; the only entity tools (`list_entities`/`get_entity`) target the IDP Catalog, not CD services.
- CRUD tests (SVC-007/008/009) skipped to avoid destructive side effects; v2 tools (`harness_create`, `harness_update`, `harness_delete`) support `resource_type=service`.
