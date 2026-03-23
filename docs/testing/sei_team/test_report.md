# Test Report: SEI Team (`sei_team`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_team` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | default |
| **Project** | SEI_AI_Prod |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-ST-001 | List all SEI teams | `harness_list(resource_type="sei_team")` | Returns list of SEI teams | ✅ Passed | Returns teams (tested on IryldRo-RTii_oK3l4RQQA account); database error on px7xd account | Tested on SEI-enabled account |
| TC-ST-002 | Get a specific team by team_ref_id | `harness_get(resource_type="sei_team", team_ref_id="team-1")` | Returns team info for the specified team | ⬜ Pending | | |
| TC-ST-003 | Get team with valid ID | `harness_get(resource_type="sei_team", team_ref_id="existing-team-ref")` | Returns team details including name and members | ⬜ Pending | | |
| TC-ST-004 | Verify account-level scope | `harness_list(resource_type="sei_team")` | Works without org/project identifiers | ⬜ Pending | | |
| TC-ST-005 | Get with non-existent team_ref_id | `harness_get(resource_type="sei_team", team_ref_id="nonexistent-team")` | Returns 404 or appropriate not-found error | ⬜ Pending | | |
| TC-ST-006 | Get without team_ref_id | `harness_get(resource_type="sei_team")` | Error: missing required identifier team_ref_id | ⬜ Pending | | |
| TC-ST-007 | Invalid resource type spelling | `harness_list(resource_type="sei_teams")` | Error: unknown resource type | ⬜ Pending | | |
| TC-ST-008 | Empty account with no teams | `harness_list(resource_type="sei_team")` | Returns empty items list | ⬜ Pending | | |
| TC-ST-009 | Verify deep link in list response | `harness_list(resource_type="sei_team")` | Response includes deep link to teams configuration | ⬜ Pending | | |
| TC-ST-010 | Verify deep link in get response | `harness_get(resource_type="sei_team", team_ref_id="team-1")` | Response includes deep link to teams configuration | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 10 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 9 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
