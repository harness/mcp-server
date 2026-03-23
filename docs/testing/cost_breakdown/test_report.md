# Test Report: Cost Breakdown (`cost_breakdown`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_breakdown` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-cb-001 | Get cost breakdown with defaults | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>")` | Returns cost breakdown grouped by product for LAST_30_DAYS | ✅ Passed | Returns empty list; API responds correctly |  |
| TC-cb-002 | Breakdown by region | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", group_by="region")` | Returns cost per region | ⬜ Pending | | |
| TC-cb-003 | Breakdown by awsServicecode | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", group_by="awsServicecode")` | Returns cost per AWS service | ⬜ Pending | | |
| TC-cb-004 | Breakdown by awsUsageaccountid | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", group_by="awsUsageaccountid")` | Returns cost per AWS account | ⬜ Pending | | |
| TC-cb-005 | Breakdown by cloudProvider | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", group_by="cloudProvider")` | Returns cost per cloud provider | ⬜ Pending | | |
| TC-cb-006 | Breakdown by awsInstancetype | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", group_by="awsInstancetype")` | Returns cost per instance type | ⬜ Pending | | |
| TC-cb-007 | Time filter LAST_7 | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", time_filter="LAST_7")` | Returns breakdown for last 7 days | ⬜ Pending | | |
| TC-cb-008 | Time filter THIS_MONTH | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", time_filter="THIS_MONTH")` | Returns breakdown for current month | ⬜ Pending | | |
| TC-cb-009 | Time filter LAST_MONTH | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", time_filter="LAST_MONTH")` | Returns breakdown for last month | ⬜ Pending | | |
| TC-cb-010 | Time filter LAST_12_MONTHS | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", time_filter="LAST_12_MONTHS")` | Returns breakdown for last 12 months | ⬜ Pending | | |
| TC-cb-011 | Custom limit and offset | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", limit=10, offset=5)` | Returns 10 items starting from offset 5 | ⬜ Pending | | |
| TC-cb-012 | Combined group_by and time_filter | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", group_by="awsServicecode", time_filter="THIS_MONTH", limit=5)` | Returns top 5 AWS services by cost this month | ⬜ Pending | | |
| TC-cb-013 | Missing perspective_id | `harness_list(resource_type="cost_breakdown")` | Returns error — perspective_id is required | ⬜ Pending | | |
| TC-cb-014 | Invalid perspective_id | `harness_list(resource_type="cost_breakdown", perspective_id="nonexistent")` | Returns empty or error from GraphQL | ⬜ Pending | | |
| TC-cb-015 | Breakdown with no cost data | `harness_list(resource_type="cost_breakdown", perspective_id="<empty_perspective>")` | Returns empty data array | ⬜ Pending | | |

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
