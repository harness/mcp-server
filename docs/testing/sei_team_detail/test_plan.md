# Test Plan: SEI Team Detail (`sei_team_detail`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_team_detail` |
| **Display Name** | SEI Team Detail |
| **Toolset** | sei |
| **Scope** | account |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | team_ref_id |
| **Filter Fields** | aspect, integration_type |
| **Deep Link** | Yes (`/ng/account/{accountId}/module/sei/configuration/teams`) |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-STD-001 | List | List team integrations | `harness_list(resource_type="sei_team_detail", team_ref_id="team-1", aspect="integrations")` | Returns list of integrations for the team |
| TC-STD-002 | List | List team developers | `harness_list(resource_type="sei_team_detail", team_ref_id="team-1", aspect="developers")` | Returns list of developers in the team |
| TC-STD-003 | List | List team integration filters | `harness_list(resource_type="sei_team_detail", team_ref_id="team-1", aspect="integration_filters")` | Returns integration filters for the team |
| TC-STD-004 | List / Filter | Integration filters with integration_type | `harness_list(resource_type="sei_team_detail", team_ref_id="team-1", aspect="integration_filters", integration_type="github")` | Returns filters scoped to github integration |
| TC-STD-005 | List / Filter | Default aspect (integrations) | `harness_list(resource_type="sei_team_detail", team_ref_id="team-1")` | Defaults to integrations aspect |
| TC-STD-006 | Scope | Verify account-level scope | `harness_list(resource_type="sei_team_detail", team_ref_id="team-1", aspect="developers")` | Works without org/project identifiers |
| TC-STD-007 | Error | Missing team_ref_id | `harness_list(resource_type="sei_team_detail", aspect="integrations")` | Error: team_ref_id is required |
| TC-STD-008 | Error | Invalid aspect value | `harness_list(resource_type="sei_team_detail", team_ref_id="team-1", aspect="invalid")` | Falls back to integration_filters or returns error |
| TC-STD-009 | Error | Non-existent team_ref_id | `harness_list(resource_type="sei_team_detail", team_ref_id="nonexistent", aspect="integrations")` | Returns 404 or empty result |
| TC-STD-010 | Error | Unsupported operation (get) | `harness_get(resource_type="sei_team_detail", team_ref_id="team-1")` | Error: get operation not supported |
| TC-STD-011 | Edge | Team with no integrations | `harness_list(resource_type="sei_team_detail", team_ref_id="empty-team", aspect="integrations")` | Returns empty list |
| TC-STD-012 | Deep Link | Verify deep link in response | `harness_list(resource_type="sei_team_detail", team_ref_id="team-1", aspect="developers")` | Response includes deep link to teams configuration |

## Notes
- `sei_team_detail` only supports `list` with a dynamic path builder: `GET /gateway/sei/api/v2/teams/{teamRefId}/{aspect}`.
- Path builder maps `aspect` values: `integrations`, `developers`, `integration_filters`.
- The `integration_type` query param is passed as `integrationType` and only applies to `aspect=integration_filters`.
- `team_ref_id` is mandatory — the path builder throws if missing.
