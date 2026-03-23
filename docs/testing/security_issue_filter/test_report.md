# Test Report: Security Issue Filter (`security_issue_filter`)

| Field | Value |
|-------|-------|
| **Resource Type** | `security_issue_filter` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-sif-001 | Basic list of available filters | `harness_list(resource_type="security_issue_filter")` | Returns available filter values (targets, scan tools, pipelines) | ✅ Passed | Returns filter metadata with latestBaselineScans, reachabilityFlag, exploitabilityFlag |  |
| TC-sif-002 | Pagination - page 0, size 5 | `harness_list(resource_type="security_issue_filter", page=0, size=5)` | Returns paginated filter values | ⬜ Pending | | |
| TC-sif-003 | Pagination - page 1 | `harness_list(resource_type="security_issue_filter", page=1, size=5)` | Returns second page of filter values | ⬜ Pending | | |
| TC-sif-004 | Custom org and project | `harness_list(resource_type="security_issue_filter", org_id="custom_org", project_id="custom_project")` | Returns filter values for specified org/project | ⬜ Pending | | |
| TC-sif-005 | Different project | `harness_list(resource_type="security_issue_filter", project_id="another_project")` | Returns filter values for different project context | ⬜ Pending | | |
| TC-sif-006 | Invalid project | `harness_list(resource_type="security_issue_filter", project_id="nonexistent")` | Returns meaningful error | ⬜ Pending | | |
| TC-sif-007 | Empty project (no scans) | `harness_list(resource_type="security_issue_filter")` on empty project | Returns empty or minimal filter values | ⬜ Pending | | |
| TC-sif-008 | Resource metadata | `harness_describe(resource_type="security_issue_filter")` | Returns metadata showing list-only operation with description | ⬜ Pending | | |

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
