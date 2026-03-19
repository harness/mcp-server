# Module: CODE

## PULL REQUESTS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | `list_pull_requests` + `repo_id` | `harness_list` (`pull_request`) + `filters.repo_id` | ✅ Both return `[]` for `r1` |
| Page/Size | `list_pull_requests` + `page`/`limit` | `harness_list` + `page`/`size` | ✅ Both return `[]` |
| Filter state | `list_pull_requests` + `state=open` | `harness_list` + `filters.state=open` | ✅ Both return `[]` |
| Get PR | `get_pull_request` + `pr_number` | `harness_get` (`pull_request`) + `params.pr_number` | ✅ Both 404 (no PRs) |
| Get Activities | `get_pull_request_activities` | `harness_list` (`pr_activity`) | ⚠️ v2 uses list-only `pr_activity` type (no get) |
| Get Checks | `get_pull_request_checks` | `harness_list` (`pr_check`) | ⚠️ v2 uses list-only `pr_check` type (no get) |
| Create | `create_pull_request` | `harness_create` (`pull_request`) | ✅ Both error: branch not found |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 7 |
| ✅ Passed | 3 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 4 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| PR-001 | List pull requests | ✅ Pass (`[]`) | ✅ Pass (`[]`) | Both return empty array; repo `r1` has 0 PRs |
| PR-002 | Page 1, size 5 | ✅ Pass (`[]`) | ✅ Pass (`[]`) | Pagination params accepted; v1 `page=1,limit=5`, v2 `page=0,size=5` |
| PR-003 | Filter by state (open) | ✅ Pass (`[]`) | ✅ Pass (`[]`) | State filter accepted; both return empty |
| PR-004 | Get by ID | ⏭️ Skipped (404) | ⏭️ Skipped (Not Found) | PR #1 does not exist; both correctly return 404. v2 requires `pr_number` in `params`. |
| PR-005 | Get Activities | ⏭️ Skipped (404) | ⏭️ Skipped (Not Found) | PR #1 does not exist. v1 uses `get_pull_request_activities`; v2 uses `harness_list` with `resource_type=pr_activity` (list-only, no get). |
| PR-006 | Get Checks | ⏭️ Skipped (404) | ⏭️ Skipped (Not Found) | PR #1 does not exist. v1 uses `get_pull_request_checks`; v2 uses `harness_list` with `resource_type=pr_check` (list-only, no get). |
| PR-007 | Create | ⏭️ Skipped (400) | ⏭️ Skipped (400) | Both error: `branch "feature" does not exist in the repository "r1"`. Repo is empty. |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | PR-005 | Low | v2 `pr_activity` resource only supports `list`, not `get`; v1 has dedicated `get_pull_request_activities` tool | Noted |
| 2 | PR-006 | Low | v2 `pr_check` resource only supports `list`, not `get`; v1 has dedicated `get_pull_request_checks` tool | Noted |

---

### Notes

- Only 1 repo (`r1`) exists in the project, and it is empty with 0 pull requests and no branches.
- PR-001 through PR-003 (list operations) all pass with parity — both v1 and v2 return `[]`.
- PR-004 through PR-006 (get operations) could not be fully verified because PR #1 does not exist; both servers correctly return 404/Not Found.
- PR-007 (create) could not complete because the repo has no branches — both servers return the same "branch not found" error.
- v2 uses different resource type names for sub-resources: `pr_activity` instead of `pull_request_activity`, `pr_check` instead of `pull_request_check`.
- v2 `pr_activity` and `pr_check` support `list` only (via `harness_list`), not `get` (via `harness_get`). v1 has dedicated `get_pull_request_activities` and `get_pull_request_checks` tools.
- Full functional verification of get/create operations requires a repo with actual PRs and branches.
