# Test Report: Policy Evaluation (`policy_evaluation`)

| Field | Value |
|-------|-------|
| **Resource Type** | `policy_evaluation` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-pe-001 | Basic list of evaluations | `harness_list(resource_type="policy_evaluation")` | Returns paginated list of policy evaluations | ✅ Passed | Returns 3 evaluations with status, type, deep links |  |
| TC-pe-002 | Pagination - page 0, size 5 | `harness_list(resource_type="policy_evaluation", page=0, size=5)` | Returns first 5 evaluations | ⬜ Pending | | |
| TC-pe-003 | Pagination - page 1 | `harness_list(resource_type="policy_evaluation", page=1, size=5)` | Returns second page of evaluations | ⬜ Pending | | |
| TC-pe-004 | Filter by entity | `harness_list(resource_type="policy_evaluation", entity="<pipeline_id>")` | Returns evaluations for specific entity | ⬜ Pending | | |
| TC-pe-005 | Filter by type (pipeline) | `harness_list(resource_type="policy_evaluation", type="pipeline")` | Returns evaluations for pipeline entity type | ⬜ Pending | | |
| TC-pe-006 | Filter by action (onrun) | `harness_list(resource_type="policy_evaluation", action="onrun")` | Returns evaluations triggered on run | ⬜ Pending | | |
| TC-pe-007 | Filter by action (onsave) | `harness_list(resource_type="policy_evaluation", action="onsave")` | Returns evaluations triggered on save | ⬜ Pending | | |
| TC-pe-008 | Filter by status | `harness_list(resource_type="policy_evaluation", status="error")` | Returns evaluations with error status | ⬜ Pending | | |
| TC-pe-009 | Filter by execution_id | `harness_list(resource_type="policy_evaluation", execution_id="<execution_id>")` | Returns evaluations for specific execution | ⬜ Pending | | |
| TC-pe-010 | Filter by date range | `harness_list(resource_type="policy_evaluation", created_date_from="2025-01-01T00:00:00Z", created_date_to="2025-12-31T23:59:59Z")` | Returns evaluations within date range | ⬜ Pending | | |
| TC-pe-011 | Include child scopes | `harness_list(resource_type="policy_evaluation", include_child_scopes="true")` | Returns evaluations including child scopes | ⬜ Pending | | |
| TC-pe-012 | Combined filters | `harness_list(resource_type="policy_evaluation", type="pipeline", action="onrun", status="error")` | Returns failed pipeline onrun evaluations | ⬜ Pending | | |
| TC-pe-013 | Get evaluation by ID | `harness_get(resource_type="policy_evaluation", evaluation_id="<valid_id>")` | Returns full evaluation details with policy results | ⬜ Pending | | |
| TC-pe-014 | Custom org and project | `harness_list(resource_type="policy_evaluation", org_id="custom_org", project_id="custom_project")` | Returns evaluations for specified scope | ⬜ Pending | | |
| TC-pe-015 | Get nonexistent evaluation | `harness_get(resource_type="policy_evaluation", evaluation_id="nonexistent")` | Returns not found error | ⬜ Pending | | |
| TC-pe-016 | Invalid date format | `harness_list(resource_type="policy_evaluation", created_date_from="not-a-date")` | Returns error or ignores invalid date | ⬜ Pending | | |
| TC-pe-017 | Empty project (no evaluations) | `harness_list(resource_type="policy_evaluation")` on empty project | Returns empty list | ⬜ Pending | | |
| TC-pe-018 | Resource metadata | `harness_describe(resource_type="policy_evaluation")` | Returns metadata showing list/get operations and all filter fields | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 18 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 17 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
