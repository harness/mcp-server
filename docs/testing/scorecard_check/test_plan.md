# Test Plan: Scorecard Check (`scorecard_check`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scorecard_check` |
| **Display Name** | Scorecard Check |
| **Toolset** | idp |
| **Scope** | account |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | check_id |
| **Filter Fields** | None |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-scorecard_check-001 | List | List all scorecard checks with defaults | `harness_list(resource_type="scorecard_check")` | Returns paginated list of scorecard checks |
| TC-scorecard_check-002 | List | List with pagination | `harness_list(resource_type="scorecard_check", page=0, size=5)` | Returns first page with up to 5 checks |
| TC-scorecard_check-003 | List | List second page | `harness_list(resource_type="scorecard_check", page=1, size=5)` | Returns second page of checks |
| TC-scorecard_check-004 | List | List with large page size | `harness_list(resource_type="scorecard_check", size=100)` | Returns up to 100 checks |
| TC-scorecard_check-005 | Get | Get check by check_id | `harness_get(resource_type="scorecard_check", check_id="my_check")` | Returns full check details |
| TC-scorecard_check-006 | Get | Get check with is_custom query param | `harness_get(resource_type="scorecard_check", check_id="custom_check", is_custom=true)` | Returns custom check details |
| TC-scorecard_check-007 | Error | Get with missing check_id | `harness_get(resource_type="scorecard_check")` | Error: check_id is required |
| TC-scorecard_check-008 | Error | Get non-existent check | `harness_get(resource_type="scorecard_check", check_id="nonexistent")` | Error: check not found (404) |
| TC-scorecard_check-009 | Edge | List with page beyond data | `harness_list(resource_type="scorecard_check", page=9999)` | Returns empty list |
| TC-scorecard_check-010 | Edge | List with size=1 | `harness_list(resource_type="scorecard_check", size=1)` | Returns exactly 1 check |

## Notes
- Account-scoped resource; no org_id/project_id required
- Get operation supports an optional `is_custom` query parameter mapped to "custom"
- No deep link template defined
