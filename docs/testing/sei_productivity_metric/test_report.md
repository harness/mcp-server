# Test Report: SEI Productivity Metric (`sei_productivity_metric`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_productivity_metric` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | default |
| **Project** | SEI_AI_Prod |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-SPM-001 | Get productivity metrics with required params | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31")` | Returns PR velocity productivity metrics for the team | ✅ Passed | Returns PR velocity with weekly datapoints (tested on SEI account) | Tested on SEI-enabled account |
| TC-SPM-002 | Get with explicit feature_type PR_VELOCITY | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31", feature_type="PR_VELOCITY")` | Returns PR velocity metrics | ⬜ Pending | | |
| TC-SPM-003 | Get with granularity WEEKLY | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", granularity="WEEKLY")` | Returns metrics with weekly granularity | ⬜ Pending | | |
| TC-SPM-004 | Get with granularity MONTHLY | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-06-30", granularity="MONTHLY")` | Returns metrics with monthly granularity | ⬜ Pending | | |
| TC-SPM-005 | Get with developer_ids | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31", developer_ids=["dev-1","dev-2"])` | Returns metrics scoped to specific developers | ⬜ Pending | | |
| TC-SPM-006 | Get with team_ids | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31", team_ids=["t1","t2"])` | Returns metrics scoped to specific team IDs | ⬜ Pending | | |
| TC-SPM-007 | Get with stack_by | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31", stack_by="developer")` | Returns metrics stacked by developer | ⬜ Pending | | |
| TC-SPM-008 | Verify account-level scope | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31")` | Works without org/project identifiers | ⬜ Pending | | |
| TC-SPM-009 | Missing team_ref_id | `harness_get(resource_type="sei_productivity_metric", date_start="2025-01-01", date_end="2025-01-31")` | Error or empty/null response due to missing team reference | ⬜ Pending | | |
| TC-SPM-010 | Invalid date range | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-12-01", date_end="2025-01-01")` | Error or empty result for reversed date range | ⬜ Pending | | |
| TC-SPM-011 | Unsupported operation (list) | `harness_list(resource_type="sei_productivity_metric")` | Error: list operation not supported for sei_productivity_metric | ⬜ Pending | | |
| TC-SPM-012 | Very large date range | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2020-01-01", date_end="2025-12-31")` | Returns aggregated metrics for entire range | ⬜ Pending | | |
| TC-SPM-013 | Verify deep link in response | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31")` | Response includes deep link to SEI productivity insights | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 13 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 12 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
