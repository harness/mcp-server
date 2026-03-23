# Test Report: Cost Anomaly Summary (`cost_anomaly_summary`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_anomaly_summary` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-cas-001 | Get anomaly summary stats | `harness_get(resource_type="cost_anomaly_summary")` | Returns total count, total anomalous spend, breakdown by cloud provider | ✅ Passed | Returns summary: count=9, costImpact= Get anomaly summary stats 955.15, deep link to anomaly detection |  |
| TC-cas-002 | Get summary with min_amount filter | `harness_get(resource_type="cost_anomaly_summary", min_amount=1000)` | Returns summary filtered by minimum actual amount | ⬜ Pending | | |
| TC-cas-003 | Get summary with min_anomalous_spend | `harness_get(resource_type="cost_anomaly_summary", min_anomalous_spend=500)` | Returns summary filtered by minimum anomalous spend | ⬜ Pending | | |
| TC-cas-004 | Get summary with both filters | `harness_get(resource_type="cost_anomaly_summary", min_amount=100, min_anomalous_spend=50)` | Returns summary matching both filters | ⬜ Pending | | |
| TC-cas-005 | Verify deep link in response | `harness_get(resource_type="cost_anomaly_summary")` | Response includes deep link to `/ng/account/{accountId}/ce/anomaly-detection` | ⬜ Pending | | |
| TC-cas-006 | Summary when no anomalies exist | `harness_get(resource_type="cost_anomaly_summary")` | Returns zero counts | ⬜ Pending | | |
| TC-cas-007 | Summary with very high min_amount | `harness_get(resource_type="cost_anomaly_summary", min_amount=999999999)` | Returns zero counts | ⬜ Pending | | |
| TC-cas-008 | Attempt list operation (not supported) | `harness_list(resource_type="cost_anomaly_summary")` | Returns error indicating list is not supported | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 8 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 7 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
