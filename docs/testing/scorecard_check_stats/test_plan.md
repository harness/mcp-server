# Test Plan: Scorecard Check Stats (`scorecard_check_stats`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scorecard_check_stats` |
| **Display Name** | Scorecard Check Stats |
| **Toolset** | idp |
| **Scope** | account |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | check_id |
| **Filter Fields** | None |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-scorecard_check_stats-001 | Get | Get stats for a scorecard check | `harness_get(resource_type="scorecard_check_stats", check_id="my_check")` | Returns statistics for the specified check |
| TC-scorecard_check_stats-002 | Get | Get stats with is_custom param | `harness_get(resource_type="scorecard_check_stats", check_id="custom_check", is_custom=true)` | Returns stats for a custom check |
| TC-scorecard_check_stats-003 | Get | Get stats includes deep link | `harness_get(resource_type="scorecard_check_stats", check_id="my_check")` | Response includes deep link URL |
| TC-scorecard_check_stats-004 | Error | Get with missing check_id | `harness_get(resource_type="scorecard_check_stats")` | Error: check_id is required |
| TC-scorecard_check_stats-005 | Error | Get stats for non-existent check | `harness_get(resource_type="scorecard_check_stats", check_id="nonexistent")` | Error: check not found (404) |
| TC-scorecard_check_stats-006 | Error | Attempt to list (unsupported) | `harness_list(resource_type="scorecard_check_stats")` | Error: list operation not supported |
| TC-scorecard_check_stats-007 | Edge | Get stats with empty check_id | `harness_get(resource_type="scorecard_check_stats", check_id="")` | Error: invalid check_id |
| TC-scorecard_check_stats-008 | Edge | Get stats with special characters in ID | `harness_get(resource_type="scorecard_check_stats", check_id="check-v2_custom")` | Returns stats or appropriate error |

## Notes
- Only supports get operation; no list operation available
- Account-scoped resource
- API path: `/v1/checks/{checkIdentifier}/stats`
- Supports optional `is_custom` query param mapped to "custom"
- Deep link format: `/ng/account/{accountId}/idp/scorecards`
