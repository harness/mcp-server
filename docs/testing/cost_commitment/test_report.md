# Test Report: Cost Commitment (`cost_commitment`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_commitment` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-cco-001 | Get commitment coverage | `harness_get(resource_type="cost_commitment", aspect="coverage")` | Returns compute coverage data for RI/savings plans | ✅ Passed | API responds correctly; get only, requires date parameters | Requires StartDate/EndDate |
| TC-cco-002 | Get commitment savings | `harness_get(resource_type="cost_commitment", aspect="savings")` | Returns savings data from commitments | ⬜ Pending | | |
| TC-cco-003 | Get commitment utilisation | `harness_get(resource_type="cost_commitment", aspect="utilisation")` | Returns commitment utilisation data | ⬜ Pending | | |
| TC-cco-004 | Get commitment analysis | `harness_get(resource_type="cost_commitment", aspect="analysis")` | Returns spend analysis data (v2 endpoint) | ⬜ Pending | | |
| TC-cco-005 | Get estimated savings | `harness_get(resource_type="cost_commitment", aspect="estimated_savings", cloud_account_id="<cloud_account_id>")` | Returns estimated savings for specified cloud account | ⬜ Pending | | |
| TC-cco-006 | Get default (coverage) with no aspect | `harness_get(resource_type="cost_commitment")` | Returns coverage data (default aspect) | ⬜ Pending | | |
| TC-cco-007 | Estimated savings without cloud_account_id | `harness_get(resource_type="cost_commitment", aspect="estimated_savings")` | Returns error — cloud_account_id is required for estimated_savings | ⬜ Pending | | |
| TC-cco-008 | Invalid aspect value | `harness_get(resource_type="cost_commitment", aspect="invalid")` | Falls back to coverage endpoint or returns error | ⬜ Pending | | |
| TC-cco-009 | Verify deep link in response | `harness_get(resource_type="cost_commitment", aspect="coverage")` | Response includes deep link to `/ng/account/{accountId}/ce/commitment-orchestration` | ⬜ Pending | | |
| TC-cco-010 | Coverage when no commitments exist | `harness_get(resource_type="cost_commitment", aspect="coverage")` | Returns empty or zero-value coverage | ⬜ Pending | | |
| TC-cco-011 | Attempt list operation (not supported) | `harness_list(resource_type="cost_commitment")` | Returns error indicating list is not supported | ⬜ Pending | | |
| TC-cco-012 | Estimated savings with invalid cloud_account_id | `harness_get(resource_type="cost_commitment", aspect="estimated_savings", cloud_account_id="nonexistent")` | Returns error from Lightwing API | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 12 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 11 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
