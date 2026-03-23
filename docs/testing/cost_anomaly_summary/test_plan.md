# Test Plan: Cost Anomaly Summary (`cost_anomaly_summary`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_anomaly_summary` |
| **Display Name** | Cost Anomaly Summary |
| **Toolset** | ccm |
| **Scope** | account |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | None |
| **Filter Fields** | None |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-cas-001 | Get | Get anomaly summary stats | `harness_get(resource_type="cost_anomaly_summary")` | Returns total count, total anomalous spend, breakdown by cloud provider |
| TC-cas-002 | Get | Get summary with min_amount filter | `harness_get(resource_type="cost_anomaly_summary", min_amount=1000)` | Returns summary filtered by minimum actual amount |
| TC-cas-003 | Get | Get summary with min_anomalous_spend | `harness_get(resource_type="cost_anomaly_summary", min_anomalous_spend=500)` | Returns summary filtered by minimum anomalous spend |
| TC-cas-004 | Get | Get summary with both filters | `harness_get(resource_type="cost_anomaly_summary", min_amount=100, min_anomalous_spend=50)` | Returns summary matching both filters |
| TC-cas-005 | Deep Link | Verify deep link in response | `harness_get(resource_type="cost_anomaly_summary")` | Response includes deep link to `/ng/account/{accountId}/ce/anomaly-detection` |
| TC-cas-006 | Edge | Summary when no anomalies exist | `harness_get(resource_type="cost_anomaly_summary")` | Returns zero counts |
| TC-cas-007 | Edge | Summary with very high min_amount | `harness_get(resource_type="cost_anomaly_summary", min_amount=999999999)` | Returns zero counts |
| TC-cas-008 | Error | Attempt list operation (not supported) | `harness_list(resource_type="cost_anomaly_summary")` | Returns error indicating list is not supported |

## Notes
- REST endpoint: POST `/ccm/api/anomaly/v2/summary`
- Body: `{ anomalyFilterPropertiesDTO: { filterType: "Anomaly", minActualAmount, minAnomalousSpend } }`
- No identifier fields required — returns account-level summary
- Deep link: `/ng/account/{accountId}/ce/anomaly-detection`
- Response includes total anomaly count and spend breakdown by cloud provider
