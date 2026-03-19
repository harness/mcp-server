# Module: IDP (Internal Developer Portal)

## IDP ENTITIES — Test Report

**Date:** 2026-03-19 (Updated: 2026-03-19)
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | `list_entities` (`scope_level=ACCOUNT` required) | `harness_list` (`idp_entity`) | ✅ Both return paginated entities |
| Get | `get_entity` (404 — namespace bug) | `harness_get` (`idp_entity`) (404) | ⚠️ Both fail on get — see issues |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 5 |
| ✅ Passed | 4 |
| ❌ Failed | 1 |
| ⏭️ Skipped | 0 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| IDP-001 | List all IDP entities | ✅ 20 entities (scope_level=ACCOUNT, kind=component,api,resource) | ✅ 20 entities (api + component types, compact metadata) | Both return entities; v1 requires `scope_level=ACCOUNT` (ALL returns empty); v1 returns full YAML, v2 returns compact fields |
| IDP-002 | Page 1, size 5 | ✅ 5 entities (first page) | ✅ 5 entities (billing-api, default_petstore, grpc-docs-test, invoice-api, ng-manager) | Pagination works on both; v1 returns only components (kind default), v2 returns apis first |
| IDP-003 | Page 2, size 5 | ✅ 5 entities (second page, different from page 1) | ✅ 5 entities (payment-api, payment-gateway-api, petstore, petstore1, petstore2) | Both correctly paginate to different result sets |
| IDP-004 | Filter by kind (component) | ✅ 20 component entities returned | ✅ 20 component entities via `filters: {kind: "component"}` | Both filter correctly; v1 uses `kind` param directly, v2 uses `filters.kind` |
| IDP-005 | Get by ID | ❌ 404 `ENTITY_NOT_FOUND` — entityRef=`component:demo-service` | ❌ HTTP 404 Not Found | v1 constructs entityRef as `kind:identifier` but actual refs include namespace (`kind:account/identifier`); v2 `harness_get` for idp_entity also 404 |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | IDP-001 | Medium | v1 `list_entities` with `scope_level=ALL` returns empty `[]`. Must use `scope_level=ACCOUNT` for IDP entities. | ⚠️ Open |
| 2 | IDP-005 | High | v1 `get_entity` returns 404 for all entities. Constructs entityRef as `component:identifier` but catalog stores refs with namespace `component:account/identifier`. Missing namespace in ref construction. | ⚠️ Open |
| 3 | IDP-005 | High | v2 `harness_get` with `resource_type=idp_entity` returns HTTP 404 for all entity IDs. The get endpoint path resolution appears broken. | ⚠️ Open |

---

### Notes

- IDP entities are **account-scoped** — org/project params are ignored by the IDP catalog API.
- v1 `list_entities` returns full entity data including YAML definitions, annotations, scorecards, git details, and lifecycle info.
- v2 `harness_list` returns compact metadata: identifier, kind, type, name (with Harness UI link), description, owner, tags, status.
- v1 requires explicit `scope_level=ACCOUNT`; v2 handles scope internally.
- Both v1 and v2 list operations work correctly with pagination and kind filtering.
- **Root cause (IDP-005):** v1 constructs entity ref as `{kind}:{entity_id}` but IDP catalog API expects `{kind}:{namespace}/{entity_id}` where namespace is typically `account`. v2 likely has a similar path resolution issue for the get endpoint.
- v2 `harness_list` supports `filters.search` for text search and `filters.kind` for kind filtering (confirmed via `harness_describe`).
