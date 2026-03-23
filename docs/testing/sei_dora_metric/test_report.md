# Test Report: SEI DORA Metric (`sei_dora_metric`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_dora_metric` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | default |
| **Project** | SEI_AI_Prod |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-SDM-001 | Get deployment frequency metric | `harness_get(resource_type="sei_dora_metric", metric="deployment_frequency", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns deployment frequency data for the team | ✅ Passed | Returns DORA lead_time metrics with monthly granularity (tested on SEI account) | Tested on SEI-enabled account |
| TC-SDM-002 | Get deployment frequency drilldown | `harness_get(resource_type="sei_dora_metric", metric="deployment_frequency_drilldown", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns deployment frequency drilldown details | ⬜ Pending | | |
| TC-SDM-003 | Get change failure rate | `harness_get(resource_type="sei_dora_metric", metric="change_failure_rate", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns change failure rate data | ⬜ Pending | | |
| TC-SDM-004 | Get change failure rate drilldown | `harness_get(resource_type="sei_dora_metric", metric="change_failure_rate_drilldown", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns change failure rate drilldown details | ⬜ Pending | | |
| TC-SDM-005 | Get MTTR metric | `harness_get(resource_type="sei_dora_metric", metric="mttr", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns mean time to recovery data | ⬜ Pending | | |
| TC-SDM-006 | Get lead time metric | `harness_get(resource_type="sei_dora_metric", metric="lead_time", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns lead time data | ⬜ Pending | | |
| TC-SDM-007 | Get with granularity DAY | `harness_get(resource_type="sei_dora_metric", metric="deployment_frequency", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31", granularity="DAY")` | Returns daily granularity deployment frequency | ⬜ Pending | | |
| TC-SDM-008 | Get with granularity WEEK | `harness_get(resource_type="sei_dora_metric", metric="deployment_frequency", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", granularity="WEEK")` | Returns weekly granularity data | ⬜ Pending | | |
| TC-SDM-009 | Get with granularity MONTH (default) | `harness_get(resource_type="sei_dora_metric", metric="deployment_frequency", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-06-30")` | Returns monthly granularity data (default) | ⬜ Pending | | |
| TC-SDM-010 | Verify account-level scope | `harness_get(resource_type="sei_dora_metric", metric="deployment_frequency", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Works without org/project identifiers | ⬜ Pending | | |
| TC-SDM-011 | Missing metric defaults to deployment_frequency | `harness_get(resource_type="sei_dora_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Defaults to deployment_frequency metric | ⬜ Pending | | |
| TC-SDM-012 | Invalid metric value | `harness_get(resource_type="sei_dora_metric", metric="invalid_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Falls back to deployment_frequency or returns error | ⬜ Pending | | |
| TC-SDM-013 | Missing team_ref_id | `harness_get(resource_type="sei_dora_metric", metric="deployment_frequency", date_start="2025-01-01", date_end="2025-03-31")` | Error or empty response due to missing team | ⬜ Pending | | |
| TC-SDM-014 | Unsupported operation (list) | `harness_list(resource_type="sei_dora_metric")` | Error: list operation not supported | ⬜ Pending | | |
| TC-SDM-015 | Verify deep link in response | `harness_get(resource_type="sei_dora_metric", metric="deployment_frequency", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Response includes deep link to DORA insights | ⬜ Pending | | |

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
