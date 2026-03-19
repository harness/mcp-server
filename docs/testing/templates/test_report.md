# Module: PLATFORM

## TEMPLATES — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | `list_templates` (5 default) | `harness_list` (`template`) (11 total) | ⚠️ v1 default page size **5** vs v2 default size **20** returns all **11** |
| Page 0 size 5 | `list_templates` 5 items | `harness_list` 5 items (total 11) | ✅ Identical items and order |
| Page 1 size 5 | `list_templates` 5 items | `harness_list` 5 items (total 11) | ✅ Identical items and order |
| Filter Pipeline | `list_templates` entity_type ignored | `harness_list` template_type=Pipeline → 7 | ❌ v1 filter not applied |
| Get by ID | N/A | `harness_get` full YAML + deep link | ✅ v2 only |

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
| TPL-001 | List all templates | ✅ 5 returned (page 0, default size 5) | ✅ 11 returned (default size 20) | v1 default page size is 5; v2 returns all 11 in one page. Same identifiers across both. |
| TPL-002 | Page 0, size 5 | ✅ 5 items | ✅ 5 items (total 11) | Both return identical 5 templates in same order. Pagination works correctly. |
| TPL-003 | Page 1, size 5 | ✅ 5 items | ✅ 5 items (total 11) | Both return identical next 5 templates. v2 includes `total` field; v1 does not. |
| TPL-004 | Filter by type (Pipeline) | ❌ Filter ignored — returned 5 mixed types (includes Stage) | ✅ 7 Pipeline templates | v1 `entity_type=Pipeline` param had no effect; results identical to unfiltered TPL-001. v2 `template_type` filter works correctly. |
| TPL-005 | Get by ID (`native_helm_deployment`) | N/A (no `get_template` tool in v1) | ✅ Full YAML + metadata + deep link | v2 returns full template YAML, `openInHarness` URL, entityValidityDetails. Deep link format: `https://qa.harness.io/ng/account/{id}/all/orgs/{org}/projects/{proj}/setup/resources/templates/{tplId}?storeType=INLINE` |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | TPL-004 | Medium | v1 `list_templates` ignores `entity_type` filter param — returns unfiltered results identical to default list | Open |

---

### Notes

- v1 uses GET `/template/api/v1/templates` (REST-style), v2 uses POST `/template/api/templates/list` (NG filter-style). Different API paradigms but both functional.
- v2 embeds deep links in the `name` field as markdown `[name](url)` in list responses; `harness_get` returns a separate `openInHarness` field with the direct URL.
- v1 default page size is 5 (max 20); v2 default page size is 20 (max 100).
- v1 does not expose a `total` count in list responses; v2 always returns `total` alongside `items`.
- v1 has no `get_template` equivalent — only list is available. v2 supports both `harness_list` and `harness_get` for templates.
- Pagination (page + size) works identically on both v1 and v2 — same items in same order when using matching parameters.
- v1 `entity_type` filter appears non-functional: passing `entity_type: "Pipeline"` returns the same results as no filter (TPL-004).
