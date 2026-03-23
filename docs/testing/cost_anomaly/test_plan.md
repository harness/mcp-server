# Test Plan: Cost Anomaly (`cost_anomaly`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_anomaly` |
| **Display Name** | Cost Anomaly |
| **Toolset** | ccm |
| **Scope** | account |
| **Operations** | list |
| **Execute Actions** | report_feedback |
| **Identifier Fields** | anomaly_id |
| **Filter Fields** | perspective_id, status, min_amount, min_anomalous_spend, limit, offset |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-ca-001 | List | List anomalies with defaults | `harness_list(resource_type="cost_anomaly")` | Returns list of cost anomalies with default limit=25 |
| TC-ca-002 | List | List with status=ACTIVE | `harness_list(resource_type="cost_anomaly", status="ACTIVE")` | Returns only active anomalies |
| TC-ca-003 | List | List with status=IGNORED | `harness_list(resource_type="cost_anomaly", status="IGNORED")` | Returns only ignored anomalies |
| TC-ca-004 | List | List with status=ARCHIVED | `harness_list(resource_type="cost_anomaly", status="ARCHIVED")` | Returns only archived anomalies |
| TC-ca-005 | List | List with status=RESOLVED | `harness_list(resource_type="cost_anomaly", status="RESOLVED")` | Returns only resolved anomalies |
| TC-ca-006 | List | List with perspective_id filter | `harness_list(resource_type="cost_anomaly", perspective_id="<valid_id>")` | Returns anomalies for the specified perspective |
| TC-ca-007 | List | List with min_amount filter | `harness_list(resource_type="cost_anomaly", min_amount=1000)` | Returns anomalies with actual amount >= $1000 |
| TC-ca-008 | List | List with min_anomalous_spend | `harness_list(resource_type="cost_anomaly", min_anomalous_spend=500)` | Returns anomalies with anomalous spend >= $500 |
| TC-ca-009 | List | List with pagination | `harness_list(resource_type="cost_anomaly", limit=5, offset=0)` | Returns first 5 anomalies |
| TC-ca-010 | List | List with combined filters | `harness_list(resource_type="cost_anomaly", status="ACTIVE", min_amount=100, perspective_id="<id>", limit=10)` | Returns active anomalies matching all filters |
| TC-ca-011 | Execute | Report feedback TRUE_ANOMALY | `harness_execute(resource_type="cost_anomaly", action="report_feedback", anomaly_id="<id>", feedback="TRUE_ANOMALY")` | Reports anomaly as true anomaly |
| TC-ca-012 | Execute | Report feedback FALSE_ANOMALY | `harness_execute(resource_type="cost_anomaly", action="report_feedback", anomaly_id="<id>", feedback="FALSE_ANOMALY")` | Reports anomaly as false anomaly |
| TC-ca-013 | Execute | Report feedback TRUE_EXPECTED_ANOMALY | `harness_execute(resource_type="cost_anomaly", action="report_feedback", anomaly_id="<id>", feedback="TRUE_EXPECTED_ANOMALY")` | Reports anomaly as true expected anomaly |
| TC-ca-014 | Execute | Report feedback NOT_RESPONDED | `harness_execute(resource_type="cost_anomaly", action="report_feedback", anomaly_id="<id>", feedback="NOT_RESPONDED")` | Resets feedback to not responded |
| TC-ca-015 | Error | Report feedback missing anomaly_id | `harness_execute(resource_type="cost_anomaly", action="report_feedback", feedback="TRUE_ANOMALY")` | Returns validation error for missing anomaly_id |
| TC-ca-016 | Error | Invalid action name | `harness_execute(resource_type="cost_anomaly", action="invalid")` | Returns error about unsupported action |

## Notes
- Uses REST: POST `/ccm/api/anomaly` with body `{ anomalyFilterPropertiesDTO: { filterType: "Anomaly", limit, offset, status, minActualAmount, minAnomalousSpend } }`
- `perspective_id` maps to `perspectiveId` query parameter
- `status` accepts array or single value — sent as array to API: `["ACTIVE"]`
- Default limit: 25, default offset: 0
- **report_feedback**: PUT `/ccm/api/anomaly/feedback?anomalyId={id}&feedback={type}`
- Valid feedback types: TRUE_ANOMALY, TRUE_EXPECTED_ANOMALY, FALSE_ANOMALY, NOT_RESPONDED
- Replaces 4 separate anomaly tools from the official server (list, list_all, list_ignored, by_perspective) via filter parameters
