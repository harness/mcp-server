# Test Report: Cost Filter Value (`cost_filter_value`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_filter_value` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-cfv-001 | List filter values with perspective_id | `harness_list(resource_type="cost_filter_value", perspective_id="<valid_id>")` | Returns available filter values for the perspective | ✅ Passed | API responds correctly; requires perspective_id filter | Requires perspective_id filter |
| TC-cfv-002 | List filter values with field_id=region | `harness_list(resource_type="cost_filter_value", perspective_id="<valid_id>", field_id="region")` | Returns available region values for the perspective | ⬜ Pending | | |
| TC-cfv-003 | List with field_id=awsServicecode | `harness_list(resource_type="cost_filter_value", perspective_id="<valid_id>", field_id="awsServicecode")` | Returns available AWS service code values | ⬜ Pending | | |
| TC-cfv-004 | List with field_id=awsUsageaccountid | `harness_list(resource_type="cost_filter_value", perspective_id="<valid_id>", field_id="awsUsageaccountid")` | Returns available AWS account ID values | ⬜ Pending | | |
| TC-cfv-005 | List with field_id=cloudProvider | `harness_list(resource_type="cost_filter_value", perspective_id="<valid_id>", field_id="cloudProvider")` | Returns available cloud provider values | ⬜ Pending | | |
| TC-cfv-006 | List without perspective_id | `harness_list(resource_type="cost_filter_value")` | Returns filter values across all perspectives or empty | ⬜ Pending | | |
| TC-cfv-007 | List with field_identifier | `harness_list(resource_type="cost_filter_value", perspective_id="<valid_id>", field_identifier="AWS")` | Returns filter values scoped to AWS identifier | ⬜ Pending | | |
| TC-cfv-008 | List with invalid perspective_id | `harness_list(resource_type="cost_filter_value", perspective_id="nonexistent")` | Returns empty or GraphQL error | ⬜ Pending | | |
| TC-cfv-009 | Attempt get (not supported) | `harness_get(resource_type="cost_filter_value")` | Returns error indicating get is not supported | ⬜ Pending | | |
| TC-cfv-010 | Filter values for empty perspective | `harness_list(resource_type="cost_filter_value", perspective_id="<empty_perspective>")` | Returns empty values list | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 10 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 9 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
