# Test Report: Cost Recommendation (`cost_recommendation`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_recommendation` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-cr-001 | List all recommendations | `harness_list(resource_type="cost_recommendation")` | Returns recommendations across all resource types (EC2, Azure VM, ECS, Node Pool, Workload) | ✅ Passed | Returns empty list; API responds correctly |  |
| TC-cr-002 | Get perspective-scoped recommendations | `harness_get(resource_type="cost_recommendation", perspective_id="<valid_id>")` | Returns recommendations and savings stats for the perspective | ⬜ Pending | | |
| TC-cr-003 | Get with min_saving filter | `harness_get(resource_type="cost_recommendation", perspective_id="<valid_id>", min_saving=100)` | Returns only recommendations with savings >= $100 | ⬜ Pending | | |
| TC-cr-004 | Get with time_filter LAST_7 | `harness_get(resource_type="cost_recommendation", perspective_id="<valid_id>", time_filter="LAST_7")` | Returns recommendations for last 7 days | ⬜ Pending | | |
| TC-cr-005 | Get with time_filter THIS_MONTH | `harness_get(resource_type="cost_recommendation", perspective_id="<valid_id>", time_filter="THIS_MONTH")` | Returns recommendations for current month | ⬜ Pending | | |
| TC-cr-006 | Get with limit and offset | `harness_get(resource_type="cost_recommendation", perspective_id="<valid_id>", limit=5, offset=0)` | Returns first 5 recommendations | ⬜ Pending | | |
| TC-cr-007 | Get with combined filters | `harness_get(resource_type="cost_recommendation", perspective_id="<valid_id>", min_saving=50, time_filter="LAST_30_DAYS", limit=10)` | Returns filtered recommendations | ⬜ Pending | | |
| TC-cr-008 | Update recommendation state to APPLIED | `harness_execute(resource_type="cost_recommendation", action="update_state", recommendation_id="<id>", state="APPLIED")` | Updates state to APPLIED | ⬜ Pending | | |
| TC-cr-009 | Update recommendation state to IGNORED | `harness_execute(resource_type="cost_recommendation", action="update_state", recommendation_id="<id>", state="IGNORED")` | Updates state to IGNORED | ⬜ Pending | | |
| TC-cr-010 | Update recommendation state to OPEN | `harness_execute(resource_type="cost_recommendation", action="update_state", recommendation_id="<id>", state="OPEN")` | Updates state to OPEN | ⬜ Pending | | |
| TC-cr-011 | Override savings for recommendation | `harness_execute(resource_type="cost_recommendation", action="override_savings", recommendation_id="<id>", overridden_savings=200)` | Overrides estimated savings to $200 | ⬜ Pending | | |
| TC-cr-012 | Create Jira ticket for recommendation | `harness_execute(resource_type="cost_recommendation", action="create_jira_ticket", body={recommendation_id: "<id>", connectorIdentifier: "<jira_conn>", projectKey: "PROJ", issueType: "Task", summary: "Cost optimization"})` | Creates Jira ticket linked to recommendation | ⬜ Pending | | |
| TC-cr-013 | Create ServiceNow ticket | `harness_execute(resource_type="cost_recommendation", action="create_snow_ticket", body={recommendation_id: "<id>", connectorIdentifier: "<snow_conn>", ticketType: "incident", description: "Cost recommendation"})` | Creates ServiceNow ticket linked to recommendation | ⬜ Pending | | |
| TC-cr-014 | Get missing perspective_id | `harness_get(resource_type="cost_recommendation")` | Returns validation error for missing perspective_id | ⬜ Pending | | |
| TC-cr-015 | Invalid action name | `harness_execute(resource_type="cost_recommendation", action="invalid")` | Returns error about unsupported action | ⬜ Pending | | |
| TC-cr-016 | Recommendations with no savings | `harness_get(resource_type="cost_recommendation", perspective_id="<valid_id>", min_saving=999999)` | Returns empty items list | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 16 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 15 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
