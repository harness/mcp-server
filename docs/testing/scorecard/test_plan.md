# Test Plan: Scorecard (`scorecard`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scorecard` |
| **Display Name** | Scorecard |
| **Toolset** | idp |
| **Scope** | account |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | scorecard_id |
| **Filter Fields** | None |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-scorecard-001 | List | List all scorecards with defaults | `harness_list(resource_type="scorecard")` | Returns paginated list of scorecards |
| TC-scorecard-002 | List | List with pagination page 0 | `harness_list(resource_type="scorecard", page=0, size=5)` | Returns first page with up to 5 scorecards |
| TC-scorecard-003 | List | List with pagination page 1 | `harness_list(resource_type="scorecard", page=1, size=5)` | Returns second page with up to 5 scorecards |
| TC-scorecard-004 | List | List with large page size | `harness_list(resource_type="scorecard", size=100)` | Returns up to 100 scorecards |
| TC-scorecard-005 | Get | Get scorecard by ID | `harness_get(resource_type="scorecard", scorecard_id="my_scorecard")` | Returns full scorecard details |
| TC-scorecard-006 | Get | Get scorecard includes deep link | `harness_get(resource_type="scorecard", scorecard_id="my_scorecard")` | Response includes deep link URL |
| TC-scorecard-007 | Error | Get with missing scorecard_id | `harness_get(resource_type="scorecard")` | Error: scorecard_id is required |
| TC-scorecard-008 | Error | Get non-existent scorecard | `harness_get(resource_type="scorecard", scorecard_id="nonexistent")` | Error: scorecard not found (404) |
| TC-scorecard-009 | Edge | List with page beyond available data | `harness_list(resource_type="scorecard", page=9999)` | Returns empty list |
| TC-scorecard-010 | Edge | List with size=1 | `harness_list(resource_type="scorecard", size=1)` | Returns exactly 1 scorecard |

## Notes
- Account-scoped resource; no org_id/project_id required
- Deep link format: `/ng/account/{accountId}/idp/scorecards/{scorecardIdentifier}`
- No list filter fields available; only pagination params supported
