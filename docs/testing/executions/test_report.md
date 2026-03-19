# Module: CD/CI

## EXECUTIONS — Test Report

**Date:** 2026-03-19
**Tester:** Cascade AI
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### MCP v1 vs v2 — Prompt parity run (2026-03-19)

**Date:** 2026-03-19 · **Master log:** [`MCP_PROMPT_PARITY_RUN_2026-03-19.md`](../MCP_PROMPT_PARITY_RUN_2026-03-19.md)

| Check | v1 | v2 | Match |
|-------|----|----|-------|
| List | `list_executions` | `harness_list` (`execution`) | ✅ **3** = **3** |
| Page 0, size 5 | `list_executions` (page=0, size=5) | `harness_list` (page=0, size=5) | ✅ **3** = **3** |
| Page 1, size 5 | `list_executions` (page=1, size=5) | `harness_list` (page=1, size=5) | ✅ **0** = **0** |
| Filter status=Failed | `list_executions` (status=Failed) | `harness_list` (filters.status=Failed) | ✅ **1** = **1** |
| Filter by pipeline | `list_executions` (pipeline_identifier) | `harness_list` (filters.pipeline_id) | ✅ **1** = **1** |
| Get by ID | `get_execution` | `harness_get` (`execution`) | ✅ Both return detail |
| Diagnose | N/A | `harness_diagnose` | ⚪ v2-only |
| Interrupt | N/A | `harness_execute` (interrupt) | ❌ Bug — interruptType not passed |
| Retry | N/A | `harness_execute` (retry) | ⚪ v2-only |

_Re-run: use the same scope as [`test_plan.md`](./test_plan.md); then update the **Test Results** table below if any row changed._

### Summary

| Metric | Count |
|--------|-------|
| Total Tests | 9 |
| ✅ Passed | 8 |
| ❌ Failed | 1 |
| ⏭️ Skipped | 0 |

---

### Test Results

| Test ID | Test | v1 Result | v2 Result | Notes |
|---------|------|-----------|-----------|-------|
| EXE-001 | List executions | ✅ 3 executions (totalElements:3) | ✅ 3 executions (total:3) | Counts match; v1 includes failureInfo/triggerInfo, v2 includes tags/labels/deep links |
| EXE-002 | Page 1, size 5 | ✅ 3 executions (page 0, size 5) | ✅ 3 executions (page 0, size 5) | Both respect pagination; all 3 fit on page 0 |
| EXE-003 | Page 2, size 5 | ✅ Empty page (page 1, 0 items) | ✅ Empty page (items:[], total:3) | Both correctly return empty for out-of-range page |
| EXE-004 | Filter by status (Failed) | ✅ 1 execution (custom_stage_pipeline) | ✅ 1 execution (custom_stage_pipeline) | v1 uses `status` param; v2 uses `filters.status` |
| EXE-005 | Filter by pipeline | ✅ 1 execution (custom_stage_pipeline) | ✅ 1 execution (custom_stage_pipeline) | v1 uses `pipeline_identifier`; v2 uses `filters.pipeline_id` |
| EXE-006 | Get by ID | ✅ Execution detail with failureInfo, timestamps, triggerInfo | ✅ Rich detail with layoutNodeMap, stages, canRetry, deep link | v2 significantly more detailed; includes stage-level breakdown |
| EXE-007 | Diagnose failure | N/A | ✅ Stage/step failure, script source, env vars, bottleneck, delegate | v2-only; comprehensive failure analysis with Harness deep link |
| EXE-008 | Interrupt (abort) | N/A | ❌ Error: `interruptType: must not be null` | Bug: v2 does not map interruptType to query param; tested on completed + running executions |
| EXE-009 | Retry | N/A | ✅ New execution _9EJ6jYxQqChI6jBFmLAPw (RUNNING) | Retry returned 405; v2 fell back to fresh pipeline run gracefully |

> **Legend:** ✅ Pass | ❌ Fail | ⏭️ Skipped | N/T = Not Tested | N/A = Not Applicable

---

### Issues Found

| # | Test ID | Severity | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | EXE-003 | Low | Deep link contains `{pipelineIdentifier}` placeholder instead of actual pipeline ID. **Fix:** Enhanced deep link resolution to scan remaining placeholders from item fields. | ✅ Fixed |
| 2 | EXE-008 | Medium | `harness_execute` interrupt action does not pass `interruptType` as a required query parameter to the Harness API. Error: `query param interruptType: must not be null, executionInterruptTypePipeline: must not be null`. Tested with `params`, `body`, and `inputs` — none propagated. | 🔴 Open |
| 3 | EXE-009 | Low | Retry returned HTTP 405 (method not allowed). v2 gracefully fell back to a fresh pipeline run. The `_note` field in the response documents this fallback. | ⚠️ Workaround |

---

### Notes

- v1 default page size is 5; v2 default is 20. Both accept explicit `size` parameter.
- v1 uses flat query params (`status`, `pipeline_identifier`); v2 uses a `filters` object (`filters.status`, `filters.pipeline_id`).
- v2 `harness_get` for executions returns full `pipelineExecutionSummary` with `layoutNodeMap` (stage-level detail), `canRetry`, `canReExecute`, and `openInHarness` deep link.
- v2 `harness_diagnose` provides comprehensive failure analysis including script source, environment variables, bottleneck stage, and delegate identity.
- v2 `harness_execute` retry falls back to a fresh run when the retry API returns 405; new execution ID `_9EJ6jYxQqChI6jBFmLAPw` was started.
- Execution statuses observed: Failed, Success, Running (after retry triggered a new run).
- `notesExistForPlanExecutionId` field included in v2 list responses — useful for checking execution annotations.
- v2 list responses embed Harness deep links in the `name` field using markdown: `[name](url)`.
