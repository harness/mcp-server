# Test Plan: SEI Productivity Metric (`sei_productivity_metric`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_productivity_metric` |
| **Display Name** | SEI Productivity Metric |
| **Toolset** | sei |
| **Scope** | account |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | _(none)_ |
| **Filter Fields** | team_ref_id, date_start, date_end, feature_type, granularity |
| **Deep Link** | Yes (`/ng/account/{accountId}/module/sei/insights/productivity`) |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-SPM-001 | Get | Get productivity metrics with required params | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31")` | Returns PR velocity productivity metrics for the team |
| TC-SPM-002 | Get / Filter | Get with explicit feature_type PR_VELOCITY | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31", feature_type="PR_VELOCITY")` | Returns PR velocity metrics |
| TC-SPM-003 | Get / Filter | Get with granularity WEEKLY | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", granularity="WEEKLY")` | Returns metrics with weekly granularity |
| TC-SPM-004 | Get / Filter | Get with granularity MONTHLY | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-06-30", granularity="MONTHLY")` | Returns metrics with monthly granularity |
| TC-SPM-005 | Get / Filter | Get with developer_ids | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31", developer_ids=["dev-1","dev-2"])` | Returns metrics scoped to specific developers |
| TC-SPM-006 | Get / Filter | Get with team_ids | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31", team_ids=["t1","t2"])` | Returns metrics scoped to specific team IDs |
| TC-SPM-007 | Get / Filter | Get with stack_by | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31", stack_by="developer")` | Returns metrics stacked by developer |
| TC-SPM-008 | Scope | Verify account-level scope | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31")` | Works without org/project identifiers |
| TC-SPM-009 | Error | Missing team_ref_id | `harness_get(resource_type="sei_productivity_metric", date_start="2025-01-01", date_end="2025-01-31")` | Error or empty/null response due to missing team reference |
| TC-SPM-010 | Error | Invalid date range | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-12-01", date_end="2025-01-01")` | Error or empty result for reversed date range |
| TC-SPM-011 | Error | Unsupported operation (list) | `harness_list(resource_type="sei_productivity_metric")` | Error: list operation not supported for sei_productivity_metric |
| TC-SPM-012 | Edge | Very large date range | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2020-01-01", date_end="2025-12-31")` | Returns aggregated metrics for entire range |
| TC-SPM-013 | Deep Link | Verify deep link in response | `harness_get(resource_type="sei_productivity_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31")` | Response includes deep link to SEI productivity insights |

## Notes
- `sei_productivity_metric` only supports `get` via `POST /gateway/sei/api/v2/productivityv3/feature_metrics`.
- The body is built from filter fields: `teamRefId`, `dateStart`, `dateEnd`, `featureType`, `granularity`.
- Defaults: `feature_type` → `PR_VELOCITY`, `granularity` → `WEEKLY`.
- Additional optional body fields: `developerIds`, `teamIds`, `stackBy`, `page`, `pageSize`.
