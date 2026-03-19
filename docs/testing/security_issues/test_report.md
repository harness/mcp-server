# Module: STO (Security Testing Orchestration)

## SECURITY ISSUES — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | `get_all_security_issues` | `harness_list` (`security_issue`) | ✅ Both return 0 items |
| Pagination | `get_all_security_issues` (page/size) | `harness_list` (page/size) | ⚠️ v2 HTTP 500 on out-of-range page |
| Filter (severity) | `get_all_security_issues` (severityCodes) | `harness_list` (filters.severity_codes) | ✅ Both return 0 items |

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 4 |
| ✅ Passed | 3 |
| ❌ Failed | 1 |
| ⏭️ Skipped | 0 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| STO-001 | List security issues | ✅ Pass (0 items) | ✅ Pass (0 items) | Both return empty list; project has no STO scan data |
| STO-002 | Page 1, size 5 | ✅ Pass (0 items) | ✅ Pass (0 items) | Both handle pagination with empty results correctly |
| STO-003 | Page 2, size 5 | ✅ Pass (0 items) | ❌ Fail (HTTP 500) | v1 returns empty page gracefully; v2 returns HTTP 500 on page 1 when totalItems=0 |
| STO-004 | Filter by severity (Critical) | ✅ Pass (0 items) | ✅ Pass (0 items) | v1 uses `severityCodes=Critical`; v2 uses `filters.severity_codes=Critical`. Both return 0 |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | STO-003 | Medium | v2 `harness_list` returns HTTP 500 when requesting page beyond total pages (page=1, totalItems=0) | Open |

---

### Notes

- v1 tool: `get_all_security_issues` — supports page, size, severityCodes, issueTypes, scanTools, targetNames, targetTypes, exemptionStatuses, search, pipelineIds filters.
- v2 tool: `harness_list` with `resource_type=security_issue` — supports page, size, filters (severity_codes, issue_types, etc.).
- Both v1 and v2 now support STO security issue listing. Previous report noted v2 lacked STO support; this is no longer accurate.
- Project AI_Devops/Sanity has 0 STO issues, so all list/filter results are empty. Data-dependent tests (page 2) reveal a v2 edge-case bug (HTTP 500).
