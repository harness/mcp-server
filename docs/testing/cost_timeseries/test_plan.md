# Test Plan: Cost Time Series (`cost_timeseries`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_timeseries` |
| **Display Name** | Cost Time Series |
| **Toolset** | ccm |
| **Scope** | account |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | perspective_id |
| **Filter Fields** | group_by, time_filter, time_resolution, limit |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-cts-001 | List | Get time series with defaults | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="product")` | Returns daily cost time series grouped by product for LAST_30_DAYS |
| TC-cts-002 | List | Time series by region | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="region")` | Returns cost over time per region |
| TC-cts-003 | List | Time series by awsServicecode | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="awsServicecode")` | Returns cost over time per AWS service |
| TC-cts-004 | List | Time series by cloudProvider | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="cloudProvider")` | Returns cost over time per cloud provider |
| TC-cts-005 | List | Time filter LAST_7 | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="product", time_filter="LAST_7")` | Returns daily data for last 7 days |
| TC-cts-006 | List | Time filter THIS_MONTH | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="product", time_filter="THIS_MONTH")` | Returns data for current month |
| TC-cts-007 | List | Time filter LAST_12_MONTHS | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="product", time_filter="LAST_12_MONTHS")` | Returns data for last 12 months |
| TC-cts-008 | List | Time resolution DAY | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="product", time_resolution="DAY")` | Returns daily data points |
| TC-cts-009 | List | Time resolution MONTH | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="product", time_resolution="MONTH")` | Returns monthly data points |
| TC-cts-010 | List | Time resolution WEEK | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="product", time_resolution="WEEK")` | Returns weekly data points |
| TC-cts-011 | List | Custom limit | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="product", limit=5)` | Returns top 5 series |
| TC-cts-012 | List | Combined filters | `harness_list(resource_type="cost_timeseries", perspective_id="<valid_id>", group_by="awsServicecode", time_filter="THIS_MONTH", time_resolution="DAY", limit=3)` | Returns daily data for top 3 AWS services this month |
| TC-cts-013 | Error | Missing perspective_id | `harness_list(resource_type="cost_timeseries", group_by="product")` | Returns error — perspective_id is required |
| TC-cts-014 | Error | Invalid perspective_id | `harness_list(resource_type="cost_timeseries", perspective_id="nonexistent", group_by="product")` | Returns empty or error from GraphQL |
| TC-cts-015 | Edge | Time series with no data | `harness_list(resource_type="cost_timeseries", perspective_id="<empty>", group_by="product")` | Returns empty stats array |

## Notes
- Uses GraphQL (`/ccm/api/graphql`) — sends `FetchPerspectiveTimeSeries` query
- `perspective_id` and `group_by` are required (group_by defaults to "product" if omitted)
- Default time_filter: LAST_30_DAYS, default time_resolution: DAY, default limit: 12
- GraphQL groupBy includes both `timeTruncGroupBy` (resolution) and `entityGroupBy` (dimension)
- Valid group_by: region, awsUsageaccountid, awsServicecode, awsBillingEntity, awsInstancetype, awsLineItemType, awspayeraccountid, awsUsageType, cloudProvider, none, product
- Valid time_filter: LAST_7, THIS_MONTH, LAST_30_DAYS, THIS_QUARTER, THIS_YEAR, LAST_MONTH, LAST_QUARTER, LAST_YEAR, LAST_3_MONTHS, LAST_6_MONTHS, LAST_12_MONTHS
- Valid time_resolution: DAY, MONTH, WEEK
- Response: `{ stats: [{ values: [{ key: {id, name, type}, value }], time }] }`
