# Test Plan: Scorecard Stats (`scorecard_stats`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scorecard_stats` |
| **Display Name** | Scorecard Stats |
| **Toolset** | idp |
| **Scope** | account |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | scorecard_id |
| **Filter Fields** | None |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-scorecard_stats-001 | Get | Get stats for a scorecard | `harness_get(resource_type="scorecard_stats", scorecard_id="my_scorecard")` | Returns aggregate statistics for the scorecard |
| TC-scorecard_stats-002 | Get | Get stats includes deep link | `harness_get(resource_type="scorecard_stats", scorecard_id="my_scorecard")` | Response includes deep link to scorecard |
| TC-scorecard_stats-003 | Error | Get with missing scorecard_id | `harness_get(resource_type="scorecard_stats")` | Error: scorecard_id is required |
| TC-scorecard_stats-004 | Error | Get stats for non-existent scorecard | `harness_get(resource_type="scorecard_stats", scorecard_id="nonexistent")` | Error: scorecard not found (404) |
| TC-scorecard_stats-005 | Error | Attempt to list (unsupported) | `harness_list(resource_type="scorecard_stats")` | Error: list operation not supported |
| TC-scorecard_stats-006 | Get | Verify stats response structure | `harness_get(resource_type="scorecard_stats", scorecard_id="my_scorecard")` | Response contains aggregate stats fields |
| TC-scorecard_stats-007 | Edge | Get stats with empty scorecard_id | `harness_get(resource_type="scorecard_stats", scorecard_id="")` | Error: invalid scorecard_id |
| TC-scorecard_stats-008 | Edge | Get stats with special characters in ID | `harness_get(resource_type="scorecard_stats", scorecard_id="test-scorecard_v2")` | Returns stats or appropriate error |

## Notes
- Only supports get operation; no list operation available
- Account-scoped resource
- API path: `/v1/scorecards/{scorecardIdentifier}/stats`
- Deep link format: `/ng/account/{accountId}/idp/scorecards/{scorecardIdentifier}`
