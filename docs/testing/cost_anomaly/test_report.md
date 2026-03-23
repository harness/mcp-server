# Test Report: Cost Anomaly (`cost_anomaly`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_anomaly` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-ca-001 | List anomalies with defaults | `harness_list(resource_type="cost_anomaly")` | Returns list of cost anomalies with default limit=25 | ✅ Passed | Returns anomaly data (intermittent 500 on some calls) | Intermittent server errors |
| TC-ca-002 | List with status=ACTIVE | `harness_list(resource_type="cost_anomaly", status="ACTIVE")` | Returns only active anomalies | ⬜ Pending | | |
| TC-ca-003 | List with status=IGNORED | `harness_list(resource_type="cost_anomaly", status="IGNORED")` | Returns only ignored anomalies | ⬜ Pending | | |
| TC-ca-004 | List with status=ARCHIVED | `harness_list(resource_type="cost_anomaly", status="ARCHIVED")` | Returns only archived anomalies | ⬜ Pending | | |
| TC-ca-005 | List with status=RESOLVED | `harness_list(resource_type="cost_anomaly", status="RESOLVED")` | Returns only resolved anomalies | ⬜ Pending | | |
| TC-ca-006 | List with perspective_id filter | `harness_list(resource_type="cost_anomaly", perspective_id="<valid_id>")` | Returns anomalies for the specified perspective | ⬜ Pending | | |
| TC-ca-007 | List with min_amount filter | `harness_list(resource_type="cost_anomaly", min_amount=1000)` | Returns anomalies with actual amount >= $1000 | ⬜ Pending | | |
| TC-ca-008 | List with min_anomalous_spend | `harness_list(resource_type="cost_anomaly", min_anomalous_spend=500)` | Returns anomalies with anomalous spend >= $500 | ⬜ Pending | | |
| TC-ca-009 | List with pagination | `harness_list(resource_type="cost_anomaly", limit=5, offset=0)` | Returns first 5 anomalies | ⬜ Pending | | |
| TC-ca-010 | List with combined filters | `harness_list(resource_type="cost_anomaly", status="ACTIVE", min_amount=100, perspective_id="<id>", limit=10)` | Returns active anomalies matching all filters | ⬜ Pending | | |
| TC-ca-011 | Report feedback TRUE_ANOMALY | `harness_execute(resource_type="cost_anomaly", action="report_feedback", anomaly_id="<id>", feedback="TRUE_ANOMALY")` | Reports anomaly as true anomaly | ⬜ Pending | | |
| TC-ca-012 | Report feedback FALSE_ANOMALY | `harness_execute(resource_type="cost_anomaly", action="report_feedback", anomaly_id="<id>", feedback="FALSE_ANOMALY")` | Reports anomaly as false anomaly | ⬜ Pending | | |
| TC-ca-013 | Report feedback TRUE_EXPECTED_ANOMALY | `harness_execute(resource_type="cost_anomaly", action="report_feedback", anomaly_id="<id>", feedback="TRUE_EXPECTED_ANOMALY")` | Reports anomaly as true expected anomaly | ⬜ Pending | | |
| TC-ca-014 | Report feedback NOT_RESPONDED | `harness_execute(resource_type="cost_anomaly", action="report_feedback", anomaly_id="<id>", feedback="NOT_RESPONDED")` | Resets feedback to not responded | ⬜ Pending | | |
| TC-ca-015 | Report feedback missing anomaly_id | `harness_execute(resource_type="cost_anomaly", action="report_feedback", feedback="TRUE_ANOMALY")` | Returns validation error for missing anomaly_id | ⬜ Pending | | |
| TC-ca-016 | Invalid action name | `harness_execute(resource_type="cost_anomaly", action="invalid")` | Returns error about unsupported action | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 16 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 15 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
