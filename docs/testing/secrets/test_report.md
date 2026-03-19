# Module: PLATFORM

## SECRETS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List (project scope) | `list_secrets` → 10 | `harness_list` (`secret`) → 10 | ✅ **10** = **10** |
| List (org scope) | `list_secrets` → 10 (default fallback) | `harness_list` (`secret`) → 1 | ⚠️ v1 falls back to project defaults |
| List (account scope) | `list_secrets` → 10 (default fallback) | `harness_list` (`secret`) → 1942 | ⚠️ v1 falls back to project defaults |
| Pagination (p0, sz5) | `list_secrets` → 5 items | `harness_list` → 5 items | ✅ Identical items |
| Pagination (p1, sz5) | `list_secrets` → 5 items | `harness_list` → 5 items | ✅ Identical items |
| Filter (SecretText) | `list_secrets` → 10 | `harness_list` → 10 | ✅ **10** = **10** |
| Get by ID | `get_secret` → metadata | `harness_get` → metadata + deep link | ✅ Core fields match |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 7 |
| ✅ Passed | 5 |
| ⚠️ Passed with notes | 2 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 0 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| SEC-001 | List at Project scope | ✅ 10 secrets (5/page, 2 pages) | ✅ 10 secrets (single page) | Counts match. v1 default pageSize=5; v2 default pageSize=20. |
| SEC-002 | List at Org scope | ⚠️ 10 secrets (falls back to project defaults) | ✅ 1 org-level secret | v1 does not support clearing scope via empty string — returns project-level results. v2 correctly returns only org-scoped secret (`wefdawde`). |
| SEC-003 | List at Account scope | ⚠️ 10 secrets (falls back to project defaults) | ✅ 1942 account-level secrets | Same as SEC-002: v1 cannot clear org/project defaults. v2 correctly lists account-wide secrets. |
| SEC-004 | Page 1, size 5 | ✅ 5 items (total 10) | ✅ 5 items (total 10) | Identical items: account_level_text_secret, hello, VAULT_URL, VAULT_TOKEN, testerror. |
| SEC-005 | Page 2, size 5 | ✅ 5 items (total 10) | ✅ 5 items (total 10) | Identical items: my-test-key, testSecre, testSecret, pat1, pat. Different set from page 0. |
| SEC-006 | Filter by type (SecretText) | ✅ 10 items (all SecretText) | ✅ 10 items (all SecretText) | All project secrets are SecretText. v2 `filters.type` must be a string, not array (array causes JSON parse error). |
| SEC-007 | Get by ID (`hello`) | ✅ Full metadata (name, type, tags, description, secretManagerIdentifier) | ✅ Full metadata + orgIdentifier, projectIdentifier, valueType, value=null, openInHarness URL | Both return correct metadata. No secret value exposed (value=null/absent). v2 deep link valid: `https://qa.harness.io/ng/account/px7xd_BFRCi-pfWPYXVjvw/all/orgs/AI_Devops/projects/Sanity/setup/resources/secrets/hello`. |

> **Legend:** ✅ Pass | ❌ Fail | ⚠️ Pass with notes | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | SEC-002, SEC-003 | Medium | v1 `list_secrets` ignores empty-string org_id/project_id — falls back to hard-coded defaults (`AI_Devops`/`Sanity`) instead of scoping to org or account level. v2 handles dynamic scoping correctly. | 🔍 Open (v1 limitation) |
| 2 | SEC-006 | Low | v2 `harness_list` `filters.type` rejects array values (e.g. `["SecretText"]`) with "Unable to process JSON". Must pass string `"SecretText"`. v1 accepts `["SecretText"]` array as documented. | 🔍 Open (v2 quirk) |
| 3 | SEC-001 | Info | v1 default page size is 5 (max 20); v2 default page size is 20 (max 100). Total counts match. | ℹ️ By design |

---

### Notes

- Secrets are read-only in MCP — no create/update/delete operations exposed (CRUD tests N/A).
- v1 returns paginated results with `totalPages`, `totalItems`, `pageItemCount`, `pageSize`. v2 returns flat `items` array with `total` count.
- v2 `harness_get` returns additional fields vs v1: `orgIdentifier`, `projectIdentifier`, `valueType: "Inline"`, `governanceMetadata`, and `openInHarness` deep link.
- Secret values confirmed never exposed in either v1 or v2 (value field is null or absent).
- v2 `openInHarness` URLs in list and get responses all contain correct secret identifiers (no placeholder issue observed in this run).
- v2 supports true dynamic scope (org-only and account-only listing); v1 falls back to defaults when empty strings are passed.
