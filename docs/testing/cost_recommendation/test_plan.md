# Test Plan: Cost Recommendation (`cost_recommendation`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_recommendation` |
| **Display Name** | Cost Recommendation |
| **Toolset** | ccm |
| **Scope** | account |
| **Operations** | list, get |
| **Execute Actions** | update_state, override_savings, create_jira_ticket, create_snow_ticket |
| **Identifier Fields** | perspective_id |
| **Filter Fields** | min_saving, time_filter, limit, offset |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-cr-001 | List | List all recommendations | `harness_list(resource_type="cost_recommendation")` | Returns recommendations across all resource types (EC2, Azure VM, ECS, Node Pool, Workload) |
| TC-cr-002 | Get | Get perspective-scoped recommendations | `harness_get(resource_type="cost_recommendation", perspective_id="<valid_id>")` | Returns recommendations and savings stats for the perspective |
| TC-cr-003 | Get | Get with min_saving filter | `harness_get(resource_type="cost_recommendation", perspective_id="<valid_id>", min_saving=100)` | Returns only recommendations with savings >= $100 |
| TC-cr-004 | Get | Get with time_filter LAST_7 | `harness_get(resource_type="cost_recommendation", perspective_id="<valid_id>", time_filter="LAST_7")` | Returns recommendations for last 7 days |
| TC-cr-005 | Get | Get with time_filter THIS_MONTH | `harness_get(resource_type="cost_recommendation", perspective_id="<valid_id>", time_filter="THIS_MONTH")` | Returns recommendations for current month |
| TC-cr-006 | Get | Get with limit and offset | `harness_get(resource_type="cost_recommendation", perspective_id="<valid_id>", limit=5, offset=0)` | Returns first 5 recommendations |
| TC-cr-007 | Get | Get with combined filters | `harness_get(resource_type="cost_recommendation", perspective_id="<valid_id>", min_saving=50, time_filter="LAST_30_DAYS", limit=10)` | Returns filtered recommendations |
| TC-cr-008 | Execute | Update recommendation state to APPLIED | `harness_execute(resource_type="cost_recommendation", action="update_state", recommendation_id="<id>", state="APPLIED")` | Updates state to APPLIED |
| TC-cr-009 | Execute | Update recommendation state to IGNORED | `harness_execute(resource_type="cost_recommendation", action="update_state", recommendation_id="<id>", state="IGNORED")` | Updates state to IGNORED |
| TC-cr-010 | Execute | Update recommendation state to OPEN | `harness_execute(resource_type="cost_recommendation", action="update_state", recommendation_id="<id>", state="OPEN")` | Updates state to OPEN |
| TC-cr-011 | Execute | Override savings for recommendation | `harness_execute(resource_type="cost_recommendation", action="override_savings", recommendation_id="<id>", overridden_savings=200)` | Overrides estimated savings to $200 |
| TC-cr-012 | Execute | Create Jira ticket for recommendation | `harness_execute(resource_type="cost_recommendation", action="create_jira_ticket", body={recommendation_id: "<id>", connectorIdentifier: "<jira_conn>", projectKey: "PROJ", issueType: "Task", summary: "Cost optimization"})` | Creates Jira ticket linked to recommendation |
| TC-cr-013 | Execute | Create ServiceNow ticket | `harness_execute(resource_type="cost_recommendation", action="create_snow_ticket", body={recommendation_id: "<id>", connectorIdentifier: "<snow_conn>", ticketType: "incident", description: "Cost recommendation"})` | Creates ServiceNow ticket linked to recommendation |
| TC-cr-014 | Error | Get missing perspective_id | `harness_get(resource_type="cost_recommendation")` | Returns validation error for missing perspective_id |
| TC-cr-015 | Error | Invalid action name | `harness_execute(resource_type="cost_recommendation", action="invalid")` | Returns error about unsupported action |
| TC-cr-016 | Edge | Recommendations with no savings | `harness_get(resource_type="cost_recommendation", perspective_id="<valid_id>", min_saving=999999)` | Returns empty items list |

## Notes
- **list** uses REST: POST `/ccm/api/recommendation/overview/list` (empty body)
- **get** uses GraphQL: `PerspectiveRecommendations` query with perspectiveFilters, limit, offset, minSaving
- GraphQL response includes: recommendationStatsV2 (totalMonthlyCost, totalMonthlySaving, count) and recommendationsV2.items (clusterName, namespace, id, resourceType, resourceName, monthlyCost, monthlySaving)
- **update_state**: POST `/ccm/api/recommendation/overview/change-state?recommendationId={id}&state={state}` — valid states: OPEN, APPLIED, IGNORED
- **override_savings**: PUT `/ccm/api/recommendation/overview/override-savings?recommendationId={id}&overriddenSavings={amount}`
- **create_jira_ticket**: POST `/ccm/api/recommendation/jira/create` — body includes recommendationId + Jira fields
- **create_snow_ticket**: POST `/ccm/api/recommendation/servicenow/create` — body includes recommendationId + ServiceNow fields
- Replaces 5 separate resource-type-specific tools from the official server (EC2, Azure VM, ECS, Node Pool, Workload)
