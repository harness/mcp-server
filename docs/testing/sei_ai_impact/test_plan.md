# Test Plan: SEI AI Impact (`sei_ai_impact`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_ai_impact` |
| **Display Name** | SEI AI Impact |
| **Toolset** | sei |
| **Scope** | account |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | _(none)_ |
| **Filter Fields** | aspect, team_ref_id, date_start, date_end, integration_type, granularity |
| **Deep Link** | Yes (`/ng/account/{accountId}/module/sei/insights/ai-coding`) |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-SAI-001 | Get | Get AI impact on PR velocity (default) | `harness_get(resource_type="sei_ai_impact", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns PR velocity impact data |
| TC-SAI-002 | Get / Filter | Get with aspect=pr_velocity | `harness_get(resource_type="sei_ai_impact", aspect="pr_velocity", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns PR velocity summary |
| TC-SAI-003 | Get / Filter | Get with aspect=rework | `harness_get(resource_type="sei_ai_impact", aspect="rework", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns rework summary data |
| TC-SAI-004 | Get / Filter | Get with integration_type=cursor | `harness_get(resource_type="sei_ai_impact", aspect="pr_velocity", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="cursor")` | Returns impact metrics for Cursor |
| TC-SAI-005 | Get / Filter | Get with integration_type=windsurf | `harness_get(resource_type="sei_ai_impact", aspect="pr_velocity", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="windsurf")` | Returns impact metrics for Windsurf |
| TC-SAI-006 | Get / Filter | Get with integration_type=all_assistants | `harness_get(resource_type="sei_ai_impact", aspect="rework", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="all_assistants")` | Returns metrics for all assistants |
| TC-SAI-007 | Get / Filter | Get with granularity=DAILY | `harness_get(resource_type="sei_ai_impact", aspect="pr_velocity", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31", granularity="DAILY")` | Returns daily granularity data |
| TC-SAI-008 | Get / Filter | Get with granularity=WEEKLY | `harness_get(resource_type="sei_ai_impact", aspect="pr_velocity", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", granularity="WEEKLY")` | Returns weekly granularity data |
| TC-SAI-009 | Get / Filter | Get with granularity=MONTHLY | `harness_get(resource_type="sei_ai_impact", aspect="rework", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-06-30", granularity="MONTHLY")` | Returns monthly granularity data |
| TC-SAI-010 | Scope | Verify account-level scope | `harness_get(resource_type="sei_ai_impact", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Works without org/project identifiers |
| TC-SAI-011 | Error | Missing date range | `harness_get(resource_type="sei_ai_impact", team_ref_id="team-1")` | Error or returns data with default range |
| TC-SAI-012 | Error | Unsupported operation (list) | `harness_list(resource_type="sei_ai_impact")` | Error: list operation not supported |
| TC-SAI-013 | Error | Invalid aspect value | `harness_get(resource_type="sei_ai_impact", aspect="invalid", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Falls back to pr-velocity/summary or returns error |
| TC-SAI-014 | Deep Link | Verify deep link in response | `harness_get(resource_type="sei_ai_impact", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Response includes deep link to AI coding insights |

## Notes
- `sei_ai_impact` only supports `get` via `POST` with a dynamic path builder.
- Path mapping: `pr_velocity` (default) → `pr-velocity/summary`, `rework` → `rework/summary`.
- Body built from: `teamRefId`, `dateStart`, `dateEnd`, `integrationType` (array), `granularity`.
- `integration_type=all_assistants` maps to `["cursor", "windsurf"]`.
- `granularity` enum: `DAILY`, `WEEKLY`, `MONTHLY`.
