# Module: PLATFORM

## USERS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | `get_all_users` | `harness_list` (`user`) | ⚠️ v2 ignores org_id/project_id — always returns account-level users (1938) |
| Get | `get_user_info` | `harness_get` (`user`) | ❌ v2 returns error -32603; does not support resource_type=user |
| Invite | `invite_users` | N/A | ❌ v2 has no user invite capability |

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 6 |
| ✅ Passed | 1 |
| ⚠️ Partial | 2 |
| ❌ Failed | 2 |
| ⏭️ Skipped | 1 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| USR-001 | List at Account scope | ✅ 6 users (project-scoped via defaults) | ✅ 1938 users (account scope) | v1 defaults to org=AI_Devops/project=Sanity; v2 returns true account-level data. Both return data. |
| USR-002 | List at Project scope | ✅ 6 project users (total 6, page 0) | ❌ 1938 users (ignores org_id/project_id) | v2 does not filter users by project scope — still returns all account users |
| USR-003 | Page 0, size 5 | ✅ 5 users (page 0 of 2, total 6) | ⚠️ 5 items (page 0, total 1938); compact=openInHarness only | v2 pagination works mechanically but against account scope; compact mode strips all user metadata |
| USR-004 | Page 1, size 5 | ✅ 1 user (page 1 of 2, total 6) | ⚠️ 5 items (page 1, total 1938); compact=openInHarness only | v1 correctly shows last page (1 remaining); v2 page 1 still has items since total is 1938 |
| USR-005 | Get by ID | ✅ name, email, uuid, role assignments | ❌ Error -32603: "Oops, something went wrong" | v2 `harness_get` does not support resource_type=user |
| USR-006 | Invite user | ⏭️ Skipped (write op; tool available) | ⏭️ Skipped (no user invite in v2) | v1 has `invite_users` tool; v2 `harness_create` does not support user invites |

> **Legend:** ✅ Pass | ❌ Fail | ⚠️ Partial | ⏭️ Skipped | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | USR-002 | High | v2 `harness_list` ignores `org_id`/`project_id` for resource_type=user — always returns account-level users (1938 vs 6 expected) | Open |
| 2 | USR-005 | High | v2 `harness_get` does not support resource_type=user — returns error -32603 | Open |
| 3 | USR-003/004 | Medium | v2 compact mode returns only `openInHarness` link per user — no name, email, or role metadata | Open |
| 4 | USR-006 | Low | v2 has no user invite capability (v1 has `invite_users`) | Open |

---

### Notes

- v1 `get_all_users` defaults to org_id=AI_Devops, project_id=Sanity — it cannot query true account-level users without overriding defaults to empty.
- v2 `harness_list` with resource_type=user consistently returns 1938 account-level users regardless of org_id/project_id params.
- v2 compact mode (default) for users returns only `openInHarness` deep links — no user identity fields (name, email, uuid).
- v1 returns rich user metadata: name, email, uuid, locked, disabled, roleAssignmentMetadata.
- **Key regression from prior report (2026-03-18):** Previous report stated v2 "now correctly returns 6 users matching v1." Current run shows v2 returns 1938 account-level users — project scoping appears broken again.
- Test user for USR-005: uuid=`oClLoR9sRtavObBNLyoEZg` (Saranya, saranya.jena@harness.io).
