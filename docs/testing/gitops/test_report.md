# Module: GITOPS (Requires License)

## GITOPS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List Agents | *(no gitops tools in v1)* | `harness_list` (`gitops_agent`) | N/A — v1 lacks gitops |
| List Applications | *(no gitops tools in v1)* | `harness_list` (`gitops_application`) | N/A — v1 lacks gitops |
| List Clusters | *(no gitops tools in v1)* | `harness_list` (`gitops_cluster`) | N/A — v1 lacks gitops |
| List Repositories | *(no gitops tools in v1)* | `harness_list` (`gitops_repository`) | N/A — v1 lacks gitops |
| Get Application | *(no gitops tools in v1)* | `harness_get` (`gitops_application`) | N/A — v1 lacks gitops |
| Sync Application | *(no gitops tools in v1)* | `harness_execute` (`sync`, `gitops_application`) | N/A — v1 lacks gitops |

_v1 has no gitops tools. v2 tools confirmed functional; no agents provisioned in test project._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 6 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⏭️ Skipped | 5 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| GIT-001 | List Agents | N/A | ✅ Pass | v2 `harness_list(gitops_agent)` returned empty list — API call succeeded, no agents in AI_Devops/Sanity |
| GIT-002 | List Applications | N/A | ⏭️ Skipped | v2 `harness_list(gitops_application)` requires `agent_id`; no agents exist. Tool routing verified (returns "agent does not exist" for placeholder). |
| GIT-003 | List Clusters | N/A | ⏭️ Skipped | v2 `harness_list(gitops_cluster)` requires `agent_id`; no agents exist. Tool routing verified. |
| GIT-004 | List Repositories | N/A | ⏭️ Skipped | v2 `harness_list(gitops_repository)` requires `agent_id`; no agents exist. Tool routing verified. |
| GIT-005 | Get Application | N/A | ⏭️ Skipped | v2 `harness_get(gitops_application)` requires `agent_id` + `app_name`; no agents/apps exist. Tool routing verified. |
| GIT-006 | Sync Application | N/A | ⏭️ Skipped | v2 `harness_execute(sync, gitops_application)` requires `agent_id` + `app_name`; no agents/apps exist. Tool routing verified. |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| — | — | — | No issues found | — |

---

### Notes

- **v1** has zero gitops tools — all v1 results are N/A.
- **v2** exposes four gitops resource types: `gitops_agent`, `gitops_application`, `gitops_cluster`, `gitops_repository`.
- GIT-001 confirmed that `harness_list(gitops_agent)` reaches the Harness API and returns a valid (empty) response.
- GIT-002 through GIT-006 require an existing agent. Since no agents are provisioned in AI_Devops/Sanity, these tests could not run end-to-end. Tool parameter routing and API error handling were verified with placeholder values.
- To fully validate GIT-002–GIT-006, provision a GitOps agent in the test project and re-run.
