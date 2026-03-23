# Test Plan: SEI AI Adoption (`sei_ai_adoption`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_ai_adoption` |
| **Display Name** | SEI AI Adoption |
| **Toolset** | sei |
| **Scope** | account |
| **Operations** | get, list |
| **Execute Actions** | None |
| **Identifier Fields** | _(none)_ |
| **Filter Fields** | aspect, team_ref_id, date_start, date_end, integration_type, granularity |
| **Deep Link** | Yes (`/ng/account/{accountId}/module/sei/insights/ai-coding`) |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-SAA-001 | Get | Get AI adoption metrics (default aspect) | `harness_get(resource_type="sei_ai_adoption", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns AI adoption metrics |
| TC-SAA-002 | Get / Filter | Get with aspect=metrics | `harness_get(resource_type="sei_ai_adoption", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns adoption metrics data |
| TC-SAA-003 | Get / Filter | Get with aspect=summary | `harness_get(resource_type="sei_ai_adoption", aspect="summary", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns adoption summary |
| TC-SAA-004 | List | List with aspect=breakdown | `harness_list(resource_type="sei_ai_adoption", aspect="breakdown", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns adoption breakdown data |
| TC-SAA-005 | Get / Filter | Get with integration_type=cursor | `harness_get(resource_type="sei_ai_adoption", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="cursor")` | Returns adoption metrics for Cursor |
| TC-SAA-006 | Get / Filter | Get with integration_type=windsurf | `harness_get(resource_type="sei_ai_adoption", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="windsurf")` | Returns adoption metrics for Windsurf |
| TC-SAA-007 | Get / Filter | Get with integration_type=all_assistants | `harness_get(resource_type="sei_ai_adoption", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="all_assistants")` | Returns metrics for all assistants |
| TC-SAA-008 | Get / Filter | Get with granularity=DAILY | `harness_get(resource_type="sei_ai_adoption", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31", granularity="DAILY")` | Returns daily granularity data |
| TC-SAA-009 | Get / Filter | Get with granularity=WEEKLY | `harness_get(resource_type="sei_ai_adoption", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", granularity="WEEKLY")` | Returns weekly granularity data |
| TC-SAA-010 | Get / Filter | Get with granularity=MONTHLY | `harness_get(resource_type="sei_ai_adoption", aspect="metrics", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-06-30", granularity="MONTHLY")` | Returns monthly granularity data |
| TC-SAA-011 | Scope | Verify account-level scope | `harness_get(resource_type="sei_ai_adoption", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Works without org/project identifiers |
| TC-SAA-012 | Error | Missing date range | `harness_get(resource_type="sei_ai_adoption", team_ref_id="team-1")` | Error or returns data with default range |
| TC-SAA-013 | Error | Invalid aspect value | `harness_get(resource_type="sei_ai_adoption", aspect="invalid", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Falls back to adoptions or returns error |
| TC-SAA-014 | Deep Link | Verify deep link in response | `harness_get(resource_type="sei_ai_adoption", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Response includes deep link to AI coding insights |

## Notes
- `sei_ai_adoption` supports `get` and `list` with dynamic path builder based on `aspect`.
- Path mapping: `metrics` (default) → `adoptions`, `breakdown` → `adoptions/breakdown`, `summary` → `adoptions/summary`.
- Body built from: `teamRefId`, `dateStart`, `dateEnd`, `integrationType` (array), `granularity`.
- `integration_type=all_assistants` maps to `["cursor", "windsurf"]` in the body.
- `granularity` enum: `DAILY`, `WEEKLY`, `MONTHLY`.
