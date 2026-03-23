# Test Plan: SEI AI Raw Metric (`sei_ai_raw_metric`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_ai_raw_metric` |
| **Display Name** | SEI AI Raw Metric |
| **Toolset** | sei |
| **Scope** | account |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | _(none)_ |
| **Filter Fields** | team_ref_id, date_start, date_end, integration_type |
| **Deep Link** | Yes (`/ng/account/{accountId}/module/sei/insights/ai-coding`) |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-SARM-001 | List | List per-developer raw AI metrics | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns per-developer AI coding metrics |
| TC-SARM-002 | List / Filter | List with integration_type=cursor | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="cursor")` | Returns raw metrics filtered to Cursor |
| TC-SARM-003 | List / Filter | List with integration_type=windsurf | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="windsurf")` | Returns raw metrics filtered to Windsurf |
| TC-SARM-004 | List / Filter | List with integration_type=all_assistants | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", integration_type="all_assistants")` | Returns raw metrics for all assistants |
| TC-SARM-005 | List / Filter | List with different date range | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1", date_start="2025-06-01", date_end="2025-06-30")` | Returns raw metrics for June 2025 |
| TC-SARM-006 | Scope | Verify account-level scope | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Works without org/project identifiers |
| TC-SARM-007 | Error | Missing team_ref_id | `harness_list(resource_type="sei_ai_raw_metric", date_start="2025-01-01", date_end="2025-03-31")` | Error or returns all-team metrics |
| TC-SARM-008 | Error | Missing date range | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1")` | Error or returns data with default range |
| TC-SARM-009 | Error | Unsupported operation (get) | `harness_get(resource_type="sei_ai_raw_metric", id="some_id")` | Error: get operation not supported |
| TC-SARM-010 | Edge | Team with no AI coding data | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="no-ai-team", date_start="2025-01-01", date_end="2025-03-31")` | Returns empty list or zero-value metrics |
| TC-SARM-011 | Deep Link | Verify deep link in response | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Response includes deep link to AI coding insights |
| TC-SARM-012 | List | Verify per-developer breakdown | `harness_list(resource_type="sei_ai_raw_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Response includes individual developer metrics (lines suggested, accepted, acceptance rate) |

## Notes
- `sei_ai_raw_metric` only supports `list` via `POST /gateway/sei/api/v2/insights/coding-assistant/raw_metrics/v2`.
- Body built from: `teamRefId`, `dateStart`, `dateEnd`, `integrationType` (array).
- `integration_type=all_assistants` maps to `["cursor", "windsurf"]` in the body.
- Returns per-developer raw metrics: lines suggested, lines accepted, acceptance rates.
- Uses the v2 raw_metrics endpoint (not v1).
