# Test Plan: Cost Breakdown (`cost_breakdown`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_breakdown` |
| **Display Name** | Cost Breakdown |
| **Toolset** | ccm |
| **Scope** | account |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | perspective_id |
| **Filter Fields** | group_by, time_filter, limit, offset |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-cb-001 | List | Get cost breakdown with defaults | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>")` | Returns cost breakdown grouped by product for LAST_30_DAYS |
| TC-cb-002 | List | Breakdown by region | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", group_by="region")` | Returns cost per region |
| TC-cb-003 | List | Breakdown by awsServicecode | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", group_by="awsServicecode")` | Returns cost per AWS service |
| TC-cb-004 | List | Breakdown by awsUsageaccountid | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", group_by="awsUsageaccountid")` | Returns cost per AWS account |
| TC-cb-005 | List | Breakdown by cloudProvider | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", group_by="cloudProvider")` | Returns cost per cloud provider |
| TC-cb-006 | List | Breakdown by awsInstancetype | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", group_by="awsInstancetype")` | Returns cost per instance type |
| TC-cb-007 | List | Time filter LAST_7 | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", time_filter="LAST_7")` | Returns breakdown for last 7 days |
| TC-cb-008 | List | Time filter THIS_MONTH | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", time_filter="THIS_MONTH")` | Returns breakdown for current month |
| TC-cb-009 | List | Time filter LAST_MONTH | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", time_filter="LAST_MONTH")` | Returns breakdown for last month |
| TC-cb-010 | List | Time filter LAST_12_MONTHS | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", time_filter="LAST_12_MONTHS")` | Returns breakdown for last 12 months |
| TC-cb-011 | List | Custom limit and offset | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", limit=10, offset=5)` | Returns 10 items starting from offset 5 |
| TC-cb-012 | List | Combined group_by and time_filter | `harness_list(resource_type="cost_breakdown", perspective_id="<valid_id>", group_by="awsServicecode", time_filter="THIS_MONTH", limit=5)` | Returns top 5 AWS services by cost this month |
| TC-cb-013 | Error | Missing perspective_id | `harness_list(resource_type="cost_breakdown")` | Returns error — perspective_id is required |
| TC-cb-014 | Error | Invalid perspective_id | `harness_list(resource_type="cost_breakdown", perspective_id="nonexistent")` | Returns empty or error from GraphQL |
| TC-cb-015 | Edge | Breakdown with no cost data | `harness_list(resource_type="cost_breakdown", perspective_id="<empty_perspective>")` | Returns empty data array |

## Notes
- Uses GraphQL (`/ccm/api/graphql`) — sends `FetchperspectiveGrid` query
- `perspective_id` is required — obtain from `cost_perspective` list first
- Default time_filter: LAST_30_DAYS, default group_by: product, default limit: 25, default offset: 0
- Valid group_by values: region, awsUsageaccountid, awsServicecode, awsBillingEntity, awsInstancetype, awsLineItemType, awspayeraccountid, awsUsageType, cloudProvider, none, product
- Valid time_filter values: LAST_7, THIS_MONTH, LAST_30_DAYS, THIS_QUARTER, THIS_YEAR, LAST_MONTH, LAST_QUARTER, LAST_YEAR, LAST_3_MONTHS, LAST_6_MONTHS, LAST_12_MONTHS
- GraphQL variables include: filters (viewMetadataFilter + timeFilter), groupBy (entityGroupBy), limit, offset, aggregateFunction (SUM/cost), isClusterOnly, preferences
- Response data: `{ name, id, cost, costTrend }` per entity
