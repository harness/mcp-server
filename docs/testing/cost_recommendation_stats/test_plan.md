# Test Plan: Cost Recommendation Stats (`cost_recommendation_stats`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_recommendation_stats` |
| **Display Name** | Cost Recommendation Stats |
| **Toolset** | ccm |
| **Scope** | account |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | None |
| **Filter Fields** | group_by |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-crs-001 | Get | Get aggregate recommendation stats | `harness_get(resource_type="cost_recommendation_stats")` | Returns aggregate stats: total savings, total cost, recommendation count |
| TC-crs-002 | Get | Get stats grouped by resource type | `harness_get(resource_type="cost_recommendation_stats", group_by="type")` | Returns stats broken down by resource type (resize, terminate, etc.) |
| TC-crs-003 | Deep Link | Verify deep link in response | `harness_get(resource_type="cost_recommendation_stats")` | Response includes deep link to `/ng/account/{accountId}/ce/recommendations` |
| TC-crs-004 | Edge | Stats when no recommendations exist | `harness_get(resource_type="cost_recommendation_stats")` | Returns zero counts and savings |
| TC-crs-005 | Error | Attempt list operation (not supported) | `harness_list(resource_type="cost_recommendation_stats")` | Returns error indicating list is not supported |
| TC-crs-006 | Error | Invalid group_by value | `harness_get(resource_type="cost_recommendation_stats", group_by="invalid")` | Uses default aggregate endpoint or returns error |
| TC-crs-007 | Edge | Stats by type when only one type exists | `harness_get(resource_type="cost_recommendation_stats", group_by="type")` | Returns single resource type breakdown |
| TC-crs-008 | Edge | Verify response structure | `harness_get(resource_type="cost_recommendation_stats")` | Response contains expected fields (totalSavings, totalCost, count) |

## Notes
- REST endpoints — path varies based on `group_by`:
  - Default (no group_by): POST `/ccm/api/recommendation/overview/stats`
  - group_by=type: POST `/ccm/api/recommendation/overview/resource-type/stats`
- Uses `pathBuilder` to dynamically select endpoint based on `group_by` value
- Empty body `{}` for both endpoints
- Deep link: `/ng/account/{accountId}/ce/recommendations`
- Only valid group_by value is `type` — other values fall back to aggregate stats endpoint
