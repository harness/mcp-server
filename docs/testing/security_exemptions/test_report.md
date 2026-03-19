# Module: STO (Security Testing Orchestration)

## SECURITY EXEMPTIONS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List (Pending) | `sto_global_exemptions` (status=Pending) | `harness_list` (`security_exemption`, status=Pending) | ✅ Both return 0 items |
| List (Approved) | `sto_global_exemptions` (status=Approved) | `harness_list` (`security_exemption`, status=Approved) | ✅ Both return 0 items |
| Pagination | `sto_global_exemptions` (page/size) | `harness_list` (page/size) | ✅ Both return 0 items |
| Approve/Reject | `exemptions_reject_and_approve` | `harness_execute` | ⏭️ No pending exemptions to test |

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 5 |
| ✅ Passed | 3 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 2 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| EXM-001 | List security exemptions | ✅ Pass (0 items) | ✅ Pass (0 items) | v1: `sto_global_exemptions` (status=Pending). v2: `harness_list` (security_exemption, status=Pending). Both return 0. v2 requires `status` filter (HTTP 400 without it). |
| EXM-002 | Page 1, size 5, status Pending | ✅ Pass (0 items) | ✅ Pass (0 items) | Both handle pagination with empty results correctly |
| EXM-003 | Filter by status (Approved) | ✅ Pass (0 items) | ✅ Pass (0 items) | v1: status=Approved. v2: filters.status=Approved. Both return 0 approved exemptions |
| EXM-004 | Approve exemption | ⏭️ Skipped | ⏭️ Skipped | No pending exemptions available; v1 tool `exemptions_reject_and_approve` exists; v2 tool `harness_execute` with action=approve exists |
| EXM-005 | Reject exemption | ⏭️ Skipped | ⏭️ Skipped | No pending exemptions available; v1 tool `exemptions_reject_and_approve` exists; v2 tool `harness_execute` with action=reject exists |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | EXM-001 | Low | v2 `harness_list` with `security_exemption` returns HTTP 400 if `status` filter is omitted; v1 also requires status but at schema level | Info |

---

### Notes

- v1 tools: `sto_global_exemptions` (list), `exemptions_reject_and_approve` (approve/reject), `sto_exemptions_promote_and_approve` (promote to higher scope).
- v2 tools: `harness_list` with `resource_type=security_exemption` (list), `harness_execute` (approve/reject actions).
- Both v1 and v2 require a status filter (Pending, Approved, Rejected, Expired) for listing exemptions. v2 also accepts "Canceled".
- Both v1 and v2 now support STO exemption management. Previous report noted v2 lacked STO support; this is no longer accurate.
- Project AI_Devops/Sanity has 0 exemptions across all statuses (Pending=0, Approved=0, Rejected=0, Expired=0).
- EXM-004 and EXM-005 skipped because no exemptions exist to approve/reject. Both v1 and v2 have the required tools available.
