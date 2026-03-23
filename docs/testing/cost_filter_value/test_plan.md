# Test Plan: Cost Filter Value (`cost_filter_value`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_filter_value` |
| **Display Name** | Cost Filter Value |
| **Toolset** | ccm |
| **Scope** | account |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | None |
| **Filter Fields** | perspective_id, field_id, field_identifier |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-cfv-001 | List | List filter values with perspective_id | `harness_list(resource_type="cost_filter_value", perspective_id="<valid_id>")` | Returns available filter values for the perspective |
| TC-cfv-002 | List | List filter values with field_id | `harness_list(resource_type="cost_filter_value", perspective_id="<valid_id>", field_id="region")` | Returns available region values for the perspective |
| TC-cfv-003 | List | List with field_id=awsServicecode | `harness_list(resource_type="cost_filter_value", perspective_id="<valid_id>", field_id="awsServicecode")` | Returns available AWS service code values |
| TC-cfv-004 | List | List with field_id=awsUsageaccountid | `harness_list(resource_type="cost_filter_value", perspective_id="<valid_id>", field_id="awsUsageaccountid")` | Returns available AWS account ID values |
| TC-cfv-005 | List | List with field_id=cloudProvider | `harness_list(resource_type="cost_filter_value", perspective_id="<valid_id>", field_id="cloudProvider")` | Returns available cloud provider values |
| TC-cfv-006 | List | List without perspective_id | `harness_list(resource_type="cost_filter_value")` | Returns filter values across all perspectives or empty |
| TC-cfv-007 | List | List with field_identifier | `harness_list(resource_type="cost_filter_value", perspective_id="<valid_id>", field_identifier="AWS")` | Returns filter values scoped to AWS identifier |
| TC-cfv-008 | Error | List with invalid perspective_id | `harness_list(resource_type="cost_filter_value", perspective_id="nonexistent")` | Returns empty or GraphQL error |
| TC-cfv-009 | Error | Attempt get (not supported) | `harness_get(resource_type="cost_filter_value")` | Returns error indicating get is not supported |
| TC-cfv-010 | Edge | Filter values for empty perspective | `harness_list(resource_type="cost_filter_value", perspective_id="<empty_perspective>")` | Returns empty values list |

## Notes
- Uses GraphQL (`/ccm/api/graphql`) — sends `FetchPerspectiveFilters` query
- Query variables: `filters` (viewMetadataFilter from perspective_id), `values` (field_id array)
- Filter fields: perspective_id, field_id, field_identifier
- Response: `{ perspectiveFilters: { values: [{ name, id }] } }`
- Useful for discovering available dimension values before using cost_breakdown or cost_timeseries
