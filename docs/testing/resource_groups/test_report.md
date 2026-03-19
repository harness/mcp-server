# Module: PLATFORM

## RESOURCE GROUPS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | *(no list tool in v1 MCP set)* | `harness_list` (`resource_group`) | ✅ v2 only (smoke) |
| Get | *(no get tool in v1 MCP set)* | `harness_get` (`resource_group`) | ✅ v2 only |
| Create | `create_resource_group` | `harness_create` (`resource_group`) | ✅ both have create |
| Delete | `delete_resource_group` | `harness_delete` (`resource_group`) | ✅ both have delete |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 8 |
| ✅ Passed | 4 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 4 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| RGR-001 | List at Project scope | N/A — no list tool | ✅ 1 resource group (`_all_project_level_resources`) | v2 returns project-level resource groups with deep links |
| RGR-002 | List at Org scope | N/A — no list tool | ✅ 1 resource group | Org-scope query succeeded; returned `_all_project_level_resources` |
| RGR-003 | List at Account scope | N/A — no list tool | ✅ 1 resource group | Account-scope query succeeded; returned same resource group |
| RGR-004 | Page 0, size 5 | N/A — no list tool | ✅ 1 resource group (total=1) | Pagination works; only 1 resource group exists at this scope |
| RGR-005 | Create at Project scope | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | v1: `create_resource_group`; v2: `harness_create` |
| RGR-006 | Create at Org scope | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | v1: `create_resource_group`; v2: `harness_create` |
| RGR-007 | Create at Account scope | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | v1: `create_resource_group`; v2: `harness_create` |
| RGR-008 | Delete | ⏭️ Skipped — destructive | ⏭️ Skipped — destructive | v1: `delete_resource_group`; v2: `harness_delete` |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Supplemental: harness_get validation

| Resource ID | Result | Notes |
|-------------|--------|-------|
| `_all_project_level_resources` | ✅ Full details returned | name="All Project Level Resources", harnessManaged=true, includeAllResources=true, deep link resolves correctly |

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | RGR-002 | Low | v2 list `openInHarness` contains `{resourceGroupIdentifier}` placeholder. **Fix:** Enhanced deep link resolution to check nested wrapper objects. | ✅ Fixed |

---

### Notes

- v1 has no `list_resource_groups` or `get_resource_group` tool; only CRUD operations (`create_resource_group`, `delete_resource_group`).
- v2 `harness_list` with `resource_type=resource_group` returns compact metadata with working deep links.
- v2 `harness_get` returns full resource group detail including `resourceFilter`, `allowedScopeLevels`, and `includedScopes`.
- Only 1 resource group (`_all_project_level_resources`, Harness-managed) exists across all tested scopes.
- CRUD tests (RGR-005 through RGR-008) skipped as destructive; both v1 and v2 expose the required tools.
