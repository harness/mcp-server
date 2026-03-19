# Module: REGISTRY

## ARTIFACT REGISTRY — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | *(not in v1 Cursor MCP list)* | `harness_list` (`registry`) | ✅ v2 only |
| Get | *(not in v1 Cursor MCP list)* | `harness_get` (`registry`) | ✅ v2 only |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 3 |
| ✅ Passed | 3 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 0 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| REG-001 | List registries | N/A | ✅ 1 registry (`test232213`), VIRTUAL, DOCKER, pageSize=20, itemCount=1 | v2-only; no v1 artifact registry tool |
| REG-002 | Page 1, size 5 | N/A | ✅ 1 registry returned, pageSize correctly set to 5 | Pagination size param honoured |
| REG-003 | Get by ID (`test232213`) | N/A | ✅ Full details: config (VIRTUAL, upstreamProxies=[]), createdAt, modifiedAt, packageType=DOCKER, url, uuid | Deep link resolves correctly to `/registries/test232213` |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | REG-003 | Low | `openInHarness` deep link previously contained `{registryIdentifier}` placeholder in list responses. Get response resolves correctly. | ✅ Fixed |

---

### Notes

- v2-only resource; no v1 equivalent tool for artifact registry.
- REG-001: Returns 1 VIRTUAL DOCKER registry with pagination metadata: `itemCount: 1, pageCount: 1, pageIndex: 0, pageSize: 20`.
- REG-002: Pagination `size=5` correctly applied (`pageSize: 5` in response).
- REG-003: `harness_get` returns full config including `cleanupPolicy`, `allowedPattern`, `blockedPattern`, `upstreamProxies`. Deep link now correctly resolves: `https://qa.harness.io/ng/account/.../registries/test232213`.
- List endpoint `openInHarness` still contains unresolved `{registryIdentifier}` placeholder — cosmetic only, does not affect functionality.
