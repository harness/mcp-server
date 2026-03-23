# Test Plan: Cost Summary (`cost_summary`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_summary` |
| **Display Name** | Cost Summary |
| **Toolset** | ccm |
| **Scope** | account |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | perspective_id |
| **Filter Fields** | time_filter |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-cs-001 | List | Get cost summary for a perspective | `harness_list(resource_type="cost_summary", perspective_id="<valid_id>")` | Returns trend stats: cost, idle cost, unallocated cost, efficiency score, forecast |
| TC-cs-002 | List | Summary with time_filter LAST_7 | `harness_list(resource_type="cost_summary", perspective_id="<valid_id>", time_filter="LAST_7")` | Returns summary for last 7 days |
| TC-cs-003 | List | Summary with time_filter THIS_MONTH | `harness_list(resource_type="cost_summary", perspective_id="<valid_id>", time_filter="THIS_MONTH")` | Returns summary for current month |
| TC-cs-004 | List | Summary with time_filter LAST_MONTH | `harness_list(resource_type="cost_summary", perspective_id="<valid_id>", time_filter="LAST_MONTH")` | Returns summary for last month |
| TC-cs-005 | List | Summary with time_filter LAST_12_MONTHS | `harness_list(resource_type="cost_summary", perspective_id="<valid_id>", time_filter="LAST_12_MONTHS")` | Returns summary for last 12 months |
| TC-cs-006 | List | Get CCM metadata (no perspective_id) | `harness_list(resource_type="cost_summary")` | Returns CCM metadata: available connectors, default perspective IDs, currency preferences |
| TC-cs-007 | Get | Get budget status for perspective | `harness_get(resource_type="cost_summary", perspective_id="<valid_id>")` | Returns budget summary: id, name, budgetAmount, actualCost, timeLeft |
| TC-cs-008 | Get | Get budget for perspective with no budget | `harness_get(resource_type="cost_summary", perspective_id="<no_budget_id>")` | Returns empty budget list |
| TC-cs-009 | Get | Get budget with invalid perspective_id | `harness_get(resource_type="cost_summary", perspective_id="nonexistent")` | Returns empty or error |
| TC-cs-010 | Error | Get budget missing perspective_id | `harness_get(resource_type="cost_summary")` | Returns validation error for missing perspective_id |
| TC-cs-011 | Edge | Summary for cluster perspective | `harness_list(resource_type="cost_summary", perspective_id="<cluster_perspective_id>")` | Returns cluster-specific metrics (idle cost, unallocated cost, efficiency) |
| TC-cs-012 | Edge | Verify forecast data present | `harness_list(resource_type="cost_summary", perspective_id="<valid_id>")` | Response includes perspectiveForecastCost with statsLabel, statsTrend, statsValue |

## Notes
- Uses GraphQL (`/ccm/api/graphql`) for all operations
- **list with perspective_id**: sends `FetchPerspectiveDetailsSummaryWithBudget` query — returns trend stats, forecast, idle/unallocated/utilized costs, efficiency score
- **list without perspective_id**: sends `FetchCcmMetaData` query — returns CCM metadata (connector presence, default perspective IDs, currency preferences)
- **get**: sends `FetchPerspectiveBudget` query — returns budget summary list for the perspective
- Valid time_filter: LAST_7, THIS_MONTH, LAST_30_DAYS, THIS_QUARTER, THIS_YEAR, LAST_MONTH, LAST_QUARTER, LAST_YEAR, LAST_3_MONTHS, LAST_6_MONTHS, LAST_12_MONTHS
- Default time_filter: LAST_30_DAYS
- Summary response structure includes: cost, idleCost, unallocatedCost, utilizedCost, efficiencyScoreStats
