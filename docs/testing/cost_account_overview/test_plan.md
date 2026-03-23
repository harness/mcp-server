# Test Plan: Cost Account Overview (`cost_account_overview`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_account_overview` |
| **Display Name** | Cost Account Overview |
| **Toolset** | ccm |
| **Scope** | account |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | None |
| **Filter Fields** | start_time, end_time, group_by |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-cao-001 | Get | Get account overview with defaults | `harness_get(resource_type="cost_account_overview")` | Returns account-level cost overview |
| TC-cao-002 | Get | Get with start_time and end_time | `harness_get(resource_type="cost_account_overview", start_time="2025-01-01T00:00:00Z", end_time="2025-01-31T23:59:59Z")` | Returns overview for specified time range |
| TC-cao-003 | Get | Get with group_by | `harness_get(resource_type="cost_account_overview", group_by="SERVICE")` | Returns overview grouped by service |
| TC-cao-004 | Get | Get with all parameters | `harness_get(resource_type="cost_account_overview", start_time="2025-01-01T00:00:00Z", end_time="2025-01-31T23:59:59Z", group_by="REGION")` | Returns overview for time range grouped by region |
| TC-cao-005 | Get | Get with only start_time | `harness_get(resource_type="cost_account_overview", start_time="2025-01-01T00:00:00Z")` | Returns overview from start_time to now |
| TC-cao-006 | Deep Link | Verify deep link in response | `harness_get(resource_type="cost_account_overview")` | Response includes deep link to `/ng/account/{accountId}/ce/overview` |
| TC-cao-007 | Error | Attempt list operation (not supported) | `harness_list(resource_type="cost_account_overview")` | Returns error indicating list is not supported |
| TC-cao-008 | Edge | Overview when no cost data exists | `harness_get(resource_type="cost_account_overview")` | Returns empty or zero-value overview |
| TC-cao-009 | Edge | Invalid time range (end before start) | `harness_get(resource_type="cost_account_overview", start_time="2025-12-31T00:00:00Z", end_time="2025-01-01T00:00:00Z")` | Returns error or empty result |

## Notes
- REST endpoint: GET `/ccm/api/overview`
- Query params: start_time→startTime, end_time→endTime, group_by→groupBy
- Time params expect ISO 8601 format
- Account-scoped — no org/project required
- Deep link: `/ng/account/{accountId}/ce/overview`
- Use `cost_summary` for perspective-scoped data instead
