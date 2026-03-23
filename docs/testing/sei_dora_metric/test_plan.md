# Test Plan: SEI DORA Metric (`sei_dora_metric`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_dora_metric` |
| **Display Name** | SEI DORA Metric |
| **Toolset** | sei |
| **Scope** | account |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | _(none)_ |
| **Filter Fields** | metric, team_ref_id, date_start, date_end, granularity |
| **Deep Link** | Yes (`/ng/account/{accountId}/module/sei/insights/dora`) |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-SDM-001 | Get | Get deployment frequency metric | `harness_get(resource_type="sei_dora_metric", metric="deployment_frequency", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns deployment frequency data for the team |
| TC-SDM-002 | Get / Filter | Get deployment frequency drilldown | `harness_get(resource_type="sei_dora_metric", metric="deployment_frequency_drilldown", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns deployment frequency drilldown details |
| TC-SDM-003 | Get / Filter | Get change failure rate | `harness_get(resource_type="sei_dora_metric", metric="change_failure_rate", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns change failure rate data |
| TC-SDM-004 | Get / Filter | Get change failure rate drilldown | `harness_get(resource_type="sei_dora_metric", metric="change_failure_rate_drilldown", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns change failure rate drilldown details |
| TC-SDM-005 | Get / Filter | Get MTTR metric | `harness_get(resource_type="sei_dora_metric", metric="mttr", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns mean time to recovery data |
| TC-SDM-006 | Get / Filter | Get lead time metric | `harness_get(resource_type="sei_dora_metric", metric="lead_time", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Returns lead time data |
| TC-SDM-007 | Get / Filter | Get with granularity DAY | `harness_get(resource_type="sei_dora_metric", metric="deployment_frequency", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-01-31", granularity="DAY")` | Returns daily granularity deployment frequency |
| TC-SDM-008 | Get / Filter | Get with granularity WEEK | `harness_get(resource_type="sei_dora_metric", metric="deployment_frequency", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31", granularity="WEEK")` | Returns weekly granularity data |
| TC-SDM-009 | Get / Filter | Get with granularity MONTH (default) | `harness_get(resource_type="sei_dora_metric", metric="deployment_frequency", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-06-30")` | Returns monthly granularity data (default) |
| TC-SDM-010 | Scope | Verify account-level scope | `harness_get(resource_type="sei_dora_metric", metric="deployment_frequency", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Works without org/project identifiers |
| TC-SDM-011 | Error | Missing metric defaults to deployment_frequency | `harness_get(resource_type="sei_dora_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Defaults to deployment_frequency metric |
| TC-SDM-012 | Error | Invalid metric value | `harness_get(resource_type="sei_dora_metric", metric="invalid_metric", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Falls back to deployment_frequency or returns error |
| TC-SDM-013 | Error | Missing team_ref_id | `harness_get(resource_type="sei_dora_metric", metric="deployment_frequency", date_start="2025-01-01", date_end="2025-03-31")` | Error or empty response due to missing team |
| TC-SDM-014 | Error | Unsupported operation (list) | `harness_list(resource_type="sei_dora_metric")` | Error: list operation not supported |
| TC-SDM-015 | Deep Link | Verify deep link in response | `harness_get(resource_type="sei_dora_metric", metric="deployment_frequency", team_ref_id="team-1", date_start="2025-01-01", date_end="2025-03-31")` | Response includes deep link to DORA insights |

## Notes
- `sei_dora_metric` supports `get` via `POST` with a dynamic path builder based on the `metric` filter.
- Path mapping: `deployment_frequency` → `/v2/insights/efficiency/deploymentFrequency`, `change_failure_rate` → `/changeFailureRate`, `mttr` → `/mttr`, `lead_time` → `/leadtime`, and `*_drilldown` variants.
- Body is built from: `teamRefId`, `dateStart`, `dateEnd`, `granularity` (default: `MONTH`).
- Granularity enum: `DAY`, `WEEK`, `MONTH`.
