# Test Plan: SEI Business Alignment (`sei_business_alignment`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_business_alignment` |
| **Display Name** | SEI Business Alignment |
| **Toolset** | sei |
| **Scope** | account |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | profile_id |
| **Filter Fields** | aspect, profile_id, team_ref_id, date_start, date_end |
| **Deep Link** | Yes (`/ng/account/{accountId}/module/sei/insights/business-alignment`) |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-SBA-001 | List | List business alignment profiles | `harness_list(resource_type="sei_business_alignment")` | Returns list of BA profiles |
| TC-SBA-002 | Get | Get feature metrics (default aspect) | `harness_get(resource_type="sei_business_alignment", profile_id="prof-1", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns feature_metrics data |
| TC-SBA-003 | Get / Filter | Get with aspect=feature_metrics | `harness_get(resource_type="sei_business_alignment", aspect="feature_metrics", profile_id="prof-1", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns feature metrics data |
| TC-SBA-004 | Get / Filter | Get with aspect=feature_summary | `harness_get(resource_type="sei_business_alignment", aspect="feature_summary", profile_id="prof-1", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns feature summary data |
| TC-SBA-005 | Get / Filter | Get with aspect=drilldown | `harness_get(resource_type="sei_business_alignment", aspect="drilldown", profile_id="prof-1", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns drilldown data |
| TC-SBA-006 | Get / Filter | Get with only profile_id | `harness_get(resource_type="sei_business_alignment", profile_id="prof-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns metrics without team filter |
| TC-SBA-007 | Scope | Verify account-level scope | `harness_list(resource_type="sei_business_alignment")` | Works without org/project identifiers |
| TC-SBA-008 | Error | Get without profile_id | `harness_get(resource_type="sei_business_alignment", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Error or incomplete data |
| TC-SBA-009 | Error | Invalid aspect value | `harness_get(resource_type="sei_business_alignment", aspect="invalid", profile_id="prof-1", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Falls back to feature_metrics or error |
| TC-SBA-010 | Error | Invalid date range | `harness_get(resource_type="sei_business_alignment", profile_id="prof-1", team_ref_id="team-1", date_start="2025-12-01", date_end="2025-01-01")` | Error or empty result |
| TC-SBA-011 | Edge | Empty profiles list | `harness_list(resource_type="sei_business_alignment")` | Returns empty list if no profiles configured |
| TC-SBA-012 | Deep Link | Verify deep link in list response | `harness_list(resource_type="sei_business_alignment")` | Response includes deep link to BA insights |
| TC-SBA-013 | Deep Link | Verify deep link in get response | `harness_get(resource_type="sei_business_alignment", profile_id="prof-1", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Response includes deep link to BA insights |

## Notes
- `list` fetches BA profiles via `GET /gateway/sei/api/v2/insights/ba/profiles`.
- `get` uses a dynamic path builder based on `aspect`: `feature_metrics` (default), `feature_summary`, `drilldown`.
- `get` is a `POST` with body built from: `profileId`, `teamRefId`, `dateStart`, `dateEnd`.
- The `aspect` filter field has enum: `feature_metrics`, `feature_summary`, `drilldown`.
