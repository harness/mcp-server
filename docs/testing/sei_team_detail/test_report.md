# Test Report: SEI Team Detail (`sei_team_detail`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_team_detail` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | default |
| **Project** | SEI_AI_Prod |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-STD-001 | List team integrations | `harness_list(resource_type="sei_team_detail", team_ref_id="team-1", aspect="integrations")` | Returns list of integrations for the team | ✅ Passed | Returns team integrations, developers, filters (tested on SEI account) | Tested on SEI-enabled account |
| TC-STD-002 | List team developers | `harness_list(resource_type="sei_team_detail", team_ref_id="team-1", aspect="developers")` | Returns list of developers in the team | ⬜ Pending | | |
| TC-STD-003 | List team integration filters | `harness_list(resource_type="sei_team_detail", team_ref_id="team-1", aspect="integration_filters")` | Returns integration filters for the team | ⬜ Pending | | |
| TC-STD-004 | Integration filters with integration_type | `harness_list(resource_type="sei_team_detail", team_ref_id="team-1", aspect="integration_filters", integration_type="github")` | Returns filters scoped to github integration | ⬜ Pending | | |
| TC-STD-005 | Default aspect (integrations) | `harness_list(resource_type="sei_team_detail", team_ref_id="team-1")` | Defaults to integrations aspect | ⬜ Pending | | |
| TC-STD-006 | Verify account-level scope | `harness_list(resource_type="sei_team_detail", team_ref_id="team-1", aspect="developers")` | Works without org/project identifiers | ⬜ Pending | | |
| TC-STD-007 | Missing team_ref_id | `harness_list(resource_type="sei_team_detail", aspect="integrations")` | Error: team_ref_id is required | ⬜ Pending | | |
| TC-STD-008 | Invalid aspect value | `harness_list(resource_type="sei_team_detail", team_ref_id="team-1", aspect="invalid")` | Falls back to integration_filters or returns error | ⬜ Pending | | |
| TC-STD-009 | Non-existent team_ref_id | `harness_list(resource_type="sei_team_detail", team_ref_id="nonexistent", aspect="integrations")` | Returns 404 or empty result | ⬜ Pending | | |
| TC-STD-010 | Unsupported operation (get) | `harness_get(resource_type="sei_team_detail", team_ref_id="team-1")` | Error: get operation not supported | ⬜ Pending | | |
| TC-STD-011 | Team with no integrations | `harness_list(resource_type="sei_team_detail", team_ref_id="empty-team", aspect="integrations")` | Returns empty list | ⬜ Pending | | |
| TC-STD-012 | Verify deep link in response | `harness_list(resource_type="sei_team_detail", team_ref_id="team-1", aspect="developers")` | Response includes deep link to teams configuration | ⬜ Pending | | |

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
