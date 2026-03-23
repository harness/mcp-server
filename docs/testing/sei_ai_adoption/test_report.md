# Test Report: SEI AI Adoption (`sei_ai_adoption`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_ai_adoption` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | default |
| **Project** | SEI_AI_Prod |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-SAA-001 | Get AI adoption metrics (default aspect) | `harness_get(resource_type="sei_ai_adoption", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns AI adoption metrics | ✅ Passed | Returns AI adoption: breakdown, metrics, summary (tested on SEI account) | Tested on SEI-enabled account |
| TC-SAA-002 | Get with aspect=metrics | `harness_get(resource_type="sei_ai_adoption", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns adoption metrics data | ⬜ Pending | | |
| TC-SAA-003 | Get with aspect=summary | `harness_get(resource_type="sei_ai_adoption", aspect="summary", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns adoption summary | ⬜ Pending | | |
| TC-SAA-004 | List with aspect=breakdown | `harness_list(resource_type="sei_ai_adoption", aspect="breakdown", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns adoption breakdown data | ⬜ Pending | | |
| TC-SAA-005 | Get with integration_type=cursor | `harness_get(resource_type="sei_ai_adoption", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="cursor")` | Returns adoption metrics for Cursor | ⬜ Pending | | |
| TC-SAA-006 | Get with integration_type=windsurf | `harness_get(resource_type="sei_ai_adoption", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="windsurf")` | Returns adoption metrics for Windsurf | ⬜ Pending | | |
| TC-SAA-007 | Get with integration_type=all_assistants | `harness_get(resource_type="sei_ai_adoption", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="all_assistants")` | Returns metrics for all assistants | ⬜ Pending | | |
| TC-SAA-008 | Get with granularity=DAILY | `harness_get(resource_type="sei_ai_adoption", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31", granularity="DAILY")` | Returns daily granularity data | ⬜ Pending | | |
| TC-SAA-009 | Get with granularity=WEEKLY | `harness_get(resource_type="sei_ai_adoption", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", granularity="WEEKLY")` | Returns weekly granularity data | ⬜ Pending | | |
| TC-SAA-010 | Get with granularity=MONTHLY | `harness_get(resource_type="sei_ai_adoption", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-06-30", granularity="MONTHLY")` | Returns monthly granularity data | ⬜ Pending | | |
| TC-SAA-011 | Verify account-level scope | `harness_get(resource_type="sei_ai_adoption", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Works without org/project identifiers | ⬜ Pending | | |
| TC-SAA-012 | Missing date range | `harness_get(resource_type="sei_ai_adoption", team_ref_id="team-1")` | Error or returns data with default range | ⬜ Pending | | |
| TC-SAA-013 | Invalid aspect value | `harness_get(resource_type="sei_ai_adoption", aspect="invalid", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Falls back to adoptions or returns error | ⬜ Pending | | |
| TC-SAA-014 | Verify deep link in response | `harness_get(resource_type="sei_ai_adoption", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Response includes deep link to AI coding insights | ⬜ Pending | | |

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
