# Module: SRM - Service Reliability Management (Requires License)

## SRM — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List monitored_service | N/A (no SRM tools) | ❌ resource_type not registered | N/A |
| List slo | N/A (no SRM tools) | ❌ resource_type not registered | N/A |
| Get monitored_service | N/A (no SRM tools) | ❌ resource_type not registered | N/A |
| Get slo | N/A (no SRM tools) | ❌ resource_type not registered | N/A |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 4 |
| ✅ Passed | 0 |
| ❌ Failed | 4 |
| ⏭️ Skipped | 0 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| SRM-001 | List Monitored Services | N/A | ❌ Fail | v1: No SRM tools in v1 server (confirmed — 60 tools, none SRM-specific). v2: `harness_list` with `resource_type=monitored_service` returns "Unknown resource_type". Not in the registered resource types list. |
| SRM-002 | List SLOs | N/A | ❌ Fail | v1: No SRM tools in v1 server. v2: `harness_list` with `resource_type=slo` returns "Unknown resource_type". Not in the registered resource types list. |
| SRM-003 | Get Monitored Service | N/A | ❌ Fail | v1: No SRM tools in v1 server. v2: `harness_get` with `resource_type=monitored_service` returns "Unknown resource_type". Blocked by SRM-001. |
| SRM-004 | Get SLO | N/A | ❌ Fail | v1: No SRM tools in v1 server. v2: `harness_get` with `resource_type=slo` returns "Unknown resource_type". Blocked by SRM-002. |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | SRM-001 | Medium | `monitored_service` resource_type not registered in v2 server. Test plan expected v2 to support it (🟢) but it is absent from the available resource types list. | Open |
| 2 | SRM-002 | Medium | `slo` resource_type not registered in v2 server. Test plan expected v2 to support it (🟢) but it is absent from the available resource types list. | Open |

---

### Notes

- v1 (`user-harness-mcp-v1`) has no SRM-related tools at all — confirmed by inspecting the full tools list (60 tools, none SRM-specific).
- v2 (`user-harness-mcp-v2`) does not register `monitored_service` or `slo` as resource types. Both `harness_list` and `harness_get` return "Unknown resource_type" for these values.
- The test plan expected v2 to support both resource types (marked 🟢), indicating a gap: the SRM toolset has not been implemented in the v2 server.
- This is distinct from a licensing issue — the resource types are not in the server's registry regardless of account licensing.
- SRM resource types need to be added to the v2 server's resource registry to enable monitored service and SLO management.
- Revalidated on 2026-03-19 — results unchanged from prior run. Both `monitored_service` and `slo` remain unregistered in v2.
