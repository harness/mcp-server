# Test Report: SEI AI Usage (`sei_ai_usage`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_ai_usage` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | default |
| **Project** | SEI_AI_Prod |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-SAU-001 | Get AI usage metrics (default aspect) | `harness_get(resource_type="sei_ai_usage", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns AI usage metrics | ✅ Passed | Returns AI coding usage: breakdown, metrics, summary, top languages (tested on SEI account) | Tested on SEI-enabled account |
| TC-SAU-002 | Get with aspect=metrics | `harness_get(resource_type="sei_ai_usage", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns usage metrics data | ⬜ Pending | | |
| TC-SAU-003 | Get with aspect=summary | `harness_get(resource_type="sei_ai_usage", aspect="summary", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns usage summary | ⬜ Pending | | |
| TC-SAU-004 | List with aspect=breakdown | `harness_list(resource_type="sei_ai_usage", aspect="breakdown", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns usage breakdown data | ⬜ Pending | | |
| TC-SAU-005 | List with aspect=top_languages | `harness_list(resource_type="sei_ai_usage", aspect="top_languages", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns top languages data | ⬜ Pending | | |
| TC-SAU-006 | Get with integration_type=cursor | `harness_get(resource_type="sei_ai_usage", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="cursor")` | Returns metrics filtered to Cursor IDE | ⬜ Pending | | |
| TC-SAU-007 | Get with integration_type=windsurf | `harness_get(resource_type="sei_ai_usage", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="windsurf")` | Returns metrics filtered to Windsurf | ⬜ Pending | | |
| TC-SAU-008 | Get with integration_type=all_assistants | `harness_get(resource_type="sei_ai_usage", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="all_assistants")` | Returns metrics for all assistants | ⬜ Pending | | |
| TC-SAU-009 | Get with granularity=DAILY | `harness_get(resource_type="sei_ai_usage", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31", granularity="DAILY")` | Returns daily granularity data | ⬜ Pending | | |
| TC-SAU-010 | Get with granularity=WEEKLY | `harness_get(resource_type="sei_ai_usage", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", granularity="WEEKLY")` | Returns weekly granularity data | ⬜ Pending | | |
| TC-SAU-011 | Get with metric_type=linesAccepted | `harness_get(resource_type="sei_ai_usage", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", metric_type="linesAccepted")` | Returns lines accepted metric | ⬜ Pending | | |
| TC-SAU-012 | Get with metric_type=DAILY_ACTIVE_USERS | `harness_get(resource_type="sei_ai_usage", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", metric_type="DAILY_ACTIVE_USERS")` | Returns daily active users metric | ⬜ Pending | | |
| TC-SAU-013 | Verify account-level scope | `harness_get(resource_type="sei_ai_usage", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Works without org/project identifiers | ⬜ Pending | | |
| TC-SAU-014 | Missing date range | `harness_get(resource_type="sei_ai_usage", team_ref_id="team-1")` | Error or returns data with default range | ⬜ Pending | | |
| TC-SAU-015 | Verify deep link in response | `harness_get(resource_type="sei_ai_usage", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Response includes deep link to AI coding insights | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 15 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 14 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
