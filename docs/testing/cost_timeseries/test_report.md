# Test Report: Cost Time Series (`cost_timeseries`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_timeseries` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-cts-001 | Get time series with defaults | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="product")` | Returns daily cost time series grouped by product for LAST_30_DAYS | ✅ Passed | Returns empty array; API responds correctly |  |
| TC-cts-002 | Time series by region | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="region")` | Returns cost over time per region | ⬜ Pending | | |
| TC-cts-003 | Time series by awsServicecode | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="awsServicecode")` | Returns cost over time per AWS service | ⬜ Pending | | |
| TC-cts-004 | Time series by cloudProvider | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="cloudProvider")` | Returns cost over time per cloud provider | ⬜ Pending | | |
| TC-cts-005 | Time filter LAST_7 | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="product", time_filter="LAST_7")` | Returns daily data for last 7 days | ⬜ Pending | | |
| TC-cts-006 | Time filter THIS_MONTH | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="product", time_filter="THIS_MONTH")` | Returns data for current month | ⬜ Pending | | |
| TC-cts-007 | Time filter LAST_12_MONTHS | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="product", time_filter="LAST_12_MONTHS")` | Returns data for last 12 months | ⬜ Pending | | |
| TC-cts-008 | Time resolution DAY | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="product", time_resolution="DAY")` | Returns daily data points | ⬜ Pending | | |
| TC-cts-009 | Time resolution MONTH | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="product", time_resolution="MONTH")` | Returns monthly data points | ⬜ Pending | | |
| TC-cts-010 | Time resolution WEEK | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="product", time_resolution="WEEK")` | Returns weekly data points | ⬜ Pending | | |
| TC-cts-011 | Custom limit | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="product", limit=5)` | Returns top 5 series | ⬜ Pending | | |
| TC-cts-012 | Combined filters | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="awsServicecode", time_filter="THIS_MONTH", time_resolution="DAY", limit=3)` | Returns daily data for top 3 AWS services this month | ⬜ Pending | | |
| TC-cts-013 | Missing perspective_id | `harness_list(resource_type="cost_timeseries", group_by="product")` | Returns error — perspective_id is required | ⬜ Pending | | |
| TC-cts-014 | Invalid perspective_id | `harness_list(resource_type="cost_timeseries", perspective_id="nonexistent", group_by="product")` | Returns empty or error from GraphQL | ⬜ Pending | | |
| TC-cts-015 | Time series with no data | `harness_list(resource_type="cost_timeseries", perspective_id="<empty>", group_by="product")` | Returns empty stats array | ⬜ Pending | | |

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
