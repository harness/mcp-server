# Test Report: SEI AI Impact (`sei_ai_impact`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_ai_impact` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | default |
| **Project** | SEI_AI_Prod |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-SAI-001 | Get AI impact on PR velocity (default) | `harness_get(resource_type="sei_ai_impact", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns PR velocity impact data | ✅ Passed | Returns AI impact: PR velocity, rework metrics (tested on SEI account) | Tested on SEI-enabled account |
| TC-SAI-002 | Get with aspect=pr_velocity | `harness_get(resource_type="sei_ai_impact", aspect="pr_velocity", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns PR velocity summary | ⬜ Pending | | |
| TC-SAI-003 | Get with aspect=rework | `harness_get(resource_type="sei_ai_impact", aspect="rework", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns rework summary data | ⬜ Pending | | |
| TC-SAI-004 | Get with integration_type=cursor | `harness_get(resource_type="sei_ai_impact", aspect="pr_velocity", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="cursor")` | Returns impact metrics for Cursor | ⬜ Pending | | |
| TC-SAI-005 | Get with integration_type=windsurf | `harness_get(resource_type="sei_ai_impact", aspect="pr_velocity", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="windsurf")` | Returns impact metrics for Windsurf | ⬜ Pending | | |
| TC-SAI-006 | Get with integration_type=all_assistants | `harness_get(resource_type="sei_ai_impact", aspect="rework", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="all_assistants")` | Returns metrics for all assistants | ⬜ Pending | | |
| TC-SAI-007 | Get with granularity=DAILY | `harness_get(resource_type="sei_ai_impact", aspect="pr_velocity", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31", granularity="DAILY")` | Returns daily granularity data | ⬜ Pending | | |
| TC-SAI-008 | Get with granularity=WEEKLY | `harness_get(resource_type="sei_ai_impact", aspect="pr_velocity", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", granularity="WEEKLY")` | Returns weekly granularity data | ⬜ Pending | | |
| TC-SAI-009 | Get with granularity=MONTHLY | `harness_get(resource_type="sei_ai_impact", aspect="rework", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-06-30", granularity="MONTHLY")` | Returns monthly granularity data | ⬜ Pending | | |
| TC-SAI-010 | Verify account-level scope | `harness_get(resource_type="sei_ai_impact", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Works without org/project identifiers | ⬜ Pending | | |
| TC-SAI-011 | Missing date range | `harness_get(resource_type="sei_ai_impact", team_ref_id="team-1")` | Error or returns data with default range | ⬜ Pending | | |
| TC-SAI-012 | Unsupported operation (list) | `harness_list(resource_type="sei_ai_impact")` | Error: list operation not supported | ⬜ Pending | | |
| TC-SAI-013 | Invalid aspect value | `harness_get(resource_type="sei_ai_impact", aspect="invalid", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Falls back to pr-velocity/summary or returns error | ⬜ Pending | | |
| TC-SAI-014 | Verify deep link in response | `harness_get(resource_type="sei_ai_impact", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Response includes deep link to AI coding insights | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 14 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 13 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
