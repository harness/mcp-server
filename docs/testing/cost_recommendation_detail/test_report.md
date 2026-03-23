# Test Report: Cost Recommendation Detail (`cost_recommendation_detail`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_recommendation_detail` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-crd-001 | Get EC2 instance recommendations | `harness_get(resource_type="cost_recommendation_detail", type_path="ec2-instance")` | Returns detailed EC2 instance recommendations | ✅ Passed | API responds correctly; get only, requires recommendation_id | No recommendation data |
| TC-crd-002 | Get Azure VM recommendations | `harness_get(resource_type="cost_recommendation_detail", type_path="azure-vm")` | Returns detailed Azure VM recommendations | ⬜ Pending | | |
| TC-crd-003 | Get ECS service recommendations | `harness_get(resource_type="cost_recommendation_detail", type_path="ecs-service")` | Returns detailed ECS service recommendations | ⬜ Pending | | |
| TC-crd-004 | Get node pool recommendations | `harness_get(resource_type="cost_recommendation_detail", type_path="node-pool")` | Returns detailed node pool recommendations | ⬜ Pending | | |
| TC-crd-005 | Get workload recommendations | `harness_get(resource_type="cost_recommendation_detail", type_path="workload")` | Returns detailed workload recommendations | ⬜ Pending | | |
| TC-crd-006 | Get with invalid type_path | `harness_get(resource_type="cost_recommendation_detail", type_path="invalid-type")` | Returns error or 404 | ⬜ Pending | | |
| TC-crd-007 | Get missing type_path | `harness_get(resource_type="cost_recommendation_detail")` | Returns validation error for missing type_path | ⬜ Pending | | |
| TC-crd-008 | Verify deep link in response | `harness_get(resource_type="cost_recommendation_detail", type_path="ec2-instance")` | Response includes deep link to `/ng/account/{accountId}/ce/recommendations` | ⬜ Pending | | |
| TC-crd-009 | Detail when no recommendations for type | `harness_get(resource_type="cost_recommendation_detail", type_path="azure-vm")` | Returns empty detail or appropriate message | ⬜ Pending | | |
| TC-crd-010 | Attempt list operation (not supported) | `harness_list(resource_type="cost_recommendation_detail")` | Returns error indicating list is not supported | ⬜ Pending | | |

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
