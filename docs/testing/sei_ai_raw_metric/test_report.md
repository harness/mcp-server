# Test Report: SEI AI Raw Metric (`sei_ai_raw_metric`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_ai_raw_metric` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | default |
| **Project** | SEI_AI_Prod |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-SARM-001 | List per-developer raw AI metrics | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns per-developer AI coding metrics | ✅ Passed | Returns 425 developers with per-user productivity data (tested on SEI account) | Tested on SEI-enabled account |
| TC-SARM-002 | List with integration_type=cursor | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="cursor")` | Returns raw metrics filtered to Cursor | ⬜ Pending | | |
| TC-SARM-003 | List with integration_type=windsurf | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="windsurf")` | Returns raw metrics filtered to Windsurf | ⬜ Pending | | |
| TC-SARM-004 | List with integration_type=all_assistants | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="all_assistants")` | Returns raw metrics for all assistants | ⬜ Pending | | |
| TC-SARM-005 | List with different date range | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1", date_start="2025-06-01", date_end="2025-06-30")` | Returns raw metrics for June 2025 | ⬜ Pending | | |
| TC-SARM-006 | Verify account-level scope | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Works without org/project identifiers | ⬜ Pending | | |
| TC-SARM-007 | Missing team_ref_id | `harness_list(resource_type="sei_ai_raw_metric", date_start="2025-01-01", date_end="2025-03-31")` | Error or returns all-team metrics | ⬜ Pending | | |
| TC-SARM-008 | Missing date range | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1")` | Error or returns data with default range | ⬜ Pending | | |
| TC-SARM-009 | Unsupported operation (get) | `harness_get(resource_type="sei_ai_raw_metric", id="some_id")` | Error: get operation not supported | ⬜ Pending | | |
| TC-SARM-010 | Team with no AI coding data | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="no-ai-team", date_start="2025-01-01", date_end="2025-03-31")` | Returns empty list or zero-value metrics | ⬜ Pending | | |
| TC-SARM-011 | Verify deep link in response | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Response includes deep link to AI coding insights | ⬜ Pending | | |
| TC-SARM-012 | Verify per-developer breakdown | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Response includes individual developer metrics | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 12 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 11 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
