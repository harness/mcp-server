# Test Plan: SEI Team (`sei_team`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_team` |
| **Display Name** | SEI Team |
| **Toolset** | sei |
| **Scope** | account |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | team_ref_id |
| **Filter Fields** | _(none)_ |
| **Deep Link** | Yes (`/ng/account/{accountId}/module/sei/configuration/teams`) |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-ST-001 | List | List all SEI teams | `harness_list(resource_type="sei_team")` | Returns list of SEI teams |
| TC-ST-002 | Get | Get a specific team by team_ref_id | `harness_get(resource_type="sei_team", team_ref_id="team-1")` | Returns team info for the specified team |
| TC-ST-003 | Get | Get team with valid ID | `harness_get(resource_type="sei_team", team_ref_id="existing-team-ref")` | Returns team details including name and members |
| TC-ST-004 | Scope | Verify account-level scope | `harness_list(resource_type="sei_team")` | Works without org/project identifiers |
| TC-ST-005 | Error | Get with non-existent team_ref_id | `harness_get(resource_type="sei_team", team_ref_id="nonexistent-team")` | Returns 404 or appropriate not-found error |
| TC-ST-006 | Error | Get without team_ref_id | `harness_get(resource_type="sei_team")` | Error: missing required identifier team_ref_id |
| TC-ST-007 | Error | Invalid resource type spelling | `harness_list(resource_type="sei_teams")` | Error: unknown resource type |
| TC-ST-008 | Edge | Empty account with no teams | `harness_list(resource_type="sei_team")` | Returns empty items list |
| TC-ST-009 | Deep Link | Verify deep link in list response | `harness_list(resource_type="sei_team")` | Response includes deep link to teams configuration |
| TC-ST-010 | Deep Link | Verify deep link in get response | `harness_get(resource_type="sei_team", team_ref_id="team-1")` | Response includes deep link to teams configuration |

## Notes
- `sei_team` supports `list` via `GET /gateway/sei/api/v2/teams/list` and `get` via `GET /gateway/sei/api/v2/teams/{teamRefId}/team_info`.
- The `get` operation uses path param mapping: `team_ref_id` → `teamRefId`.
- Both operations use passthrough response extractor.
