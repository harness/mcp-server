# Test Plan: SEI AI Usage (`sei_ai_usage`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_ai_usage` |
| **Display Name** | SEI AI Usage |
| **Toolset** | sei |
| **Scope** | account |
| **Operations** | get, list |
| **Execute Actions** | None |
| **Identifier Fields** | _(none)_ |
| **Filter Fields** | aspect, team_ref_id, date_start, date_end, integration_type, granularity, metric_type |
| **Deep Link** | Yes (`/ng/account/{accountId}/module/sei/insights/ai-coding`) |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-SAU-001 | Get | Get AI usage metrics (default aspect) | `harness_get(resource_type="sei_ai_usage", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns AI usage metrics |
| TC-SAU-002 | Get / Filter | Get with aspect=metrics | `harness_get(resource_type="sei_ai_usage", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns usage metrics data |
| TC-SAU-003 | Get / Filter | Get with aspect=summary | `harness_get(resource_type="sei_ai_usage", aspect="summary", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns usage summary |
| TC-SAU-004 | List | List with aspect=breakdown | `harness_list(resource_type="sei_ai_usage", aspect="breakdown", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns usage breakdown data |
| TC-SAU-005 | List | List with aspect=top_languages | `harness_list(resource_type="sei_ai_usage", aspect="top_languages", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns top languages data |
| TC-SAU-006 | Get / Filter | Get with integration_type=cursor | `harness_get(resource_type="sei_ai_usage", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="cursor")` | Returns metrics filtered to Cursor IDE |
| TC-SAU-007 | Get / Filter | Get with integration_type=windsurf | `harness_get(resource_type="sei_ai_usage", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="windsurf")` | Returns metrics filtered to Windsurf |
| TC-SAU-008 | Get / Filter | Get with integration_type=all_assistants | `harness_get(resource_type="sei_ai_usage", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="all_assistants")` | Returns metrics for all assistants (cursor + windsurf) |
| TC-SAU-009 | Get / Filter | Get with granularity=DAILY | `harness_get(resource_type="sei_ai_usage", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31", granularity="DAILY")` | Returns daily granularity data |
| TC-SAU-010 | Get / Filter | Get with granularity=WEEKLY | `harness_get(resource_type="sei_ai_usage", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", granularity="WEEKLY")` | Returns weekly granularity data |
| TC-SAU-011 | Get / Filter | Get with metric_type=linesAccepted | `harness_get(resource_type="sei_ai_usage", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", metric_type="linesAccepted")` | Returns lines accepted metric |
| TC-SAU-012 | Get / Filter | Get with metric_type=DAILY_ACTIVE_USERS | `harness_get(resource_type="sei_ai_usage", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", metric_type="DAILY_ACTIVE_USERS")` | Returns daily active users metric |
| TC-SAU-013 | Scope | Verify account-level scope | `harness_get(resource_type="sei_ai_usage", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Works without org/project identifiers |
| TC-SAU-014 | Error | Missing date range | `harness_get(resource_type="sei_ai_usage", team_ref_id="team-1")` | Error or returns data with default range |
| TC-SAU-015 | Deep Link | Verify deep link in response | `harness_get(resource_type="sei_ai_usage", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Response includes deep link to AI coding insights |

## Notes
- `sei_ai_usage` supports both `get` and `list` with dynamic path builder based on `aspect`.
- Path mapping: `metrics` → `usage/metrics`, `breakdown` → `usage/breakdown`, `summary` → `usage/summary`, `top_languages` → `usage/top_languages`.
- Body built from: `teamRefId`, `dateStart`, `dateEnd`, `integrationType` (array), `granularity`, `metricType`.
- `integration_type=all_assistants` maps to `["cursor", "windsurf"]` in the body.
- `metric_type` enum: `linesAddedPerContributor`, `linesSuggested`, `linesAccepted`, `acceptanceRatePercentage`, `DAILY_ACTIVE_USERS`.
- `granularity` enum: `DAILY`, `WEEKLY`, `MONTHLY`.
