# Test Report: Security Issue (`security_issue`)

| Field | Value |
|-------|-------|
| **Resource Type** | `security_issue` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-si-001 | Basic list with no filters | `harness_list(resource_type="security_issue")` | Returns paginated list of security issues with default page size | ✅ Passed | Returns empty issue list with pagination; deep link to STO issues page |  |
| TC-si-002 | Pagination - page 0, size 5 | `harness_list(resource_type="security_issue", page=0, size=5)` | Returns first 5 issues | ⬜ Pending | | |
| TC-si-003 | Pagination - page 1 | `harness_list(resource_type="security_issue", page=1, size=5)` | Returns second page of 5 issues | ⬜ Pending | | |
| TC-si-004 | Filter by severity_codes (Critical) | `harness_list(resource_type="security_issue", severity_codes="Critical")` | Returns only Critical severity issues | ⬜ Pending | | |
| TC-si-005 | Filter by severity_codes (multiple) | `harness_list(resource_type="security_issue", severity_codes="Critical,High")` | Returns Critical and High severity issues | ⬜ Pending | | |
| TC-si-006 | Filter by issue_types (SAST) | `harness_list(resource_type="security_issue", issue_types="SAST")` | Returns only SAST type issues | ⬜ Pending | | |
| TC-si-007 | Filter by issue_types (multiple) | `harness_list(resource_type="security_issue", issue_types="SAST,SCA")` | Returns SAST and SCA type issues | ⬜ Pending | | |
| TC-si-008 | Filter by search keyword | `harness_list(resource_type="security_issue", search="CVE-2024")` | Returns issues matching the search term | ⬜ Pending | | |
| TC-si-009 | Filter by target_types | `harness_list(resource_type="security_issue", target_types="container")` | Returns issues from container targets only | ⬜ Pending | | |
| TC-si-010 | Filter by target_ids | `harness_list(resource_type="security_issue", target_ids="<valid_target_id>")` | Returns issues for the specified target | ⬜ Pending | | |
| TC-si-011 | Filter by pipeline_ids | `harness_list(resource_type="security_issue", pipeline_ids="<valid_pipeline_id>")` | Returns issues from the specified pipeline | ⬜ Pending | | |
| TC-si-012 | Filter by scan_tools | `harness_list(resource_type="security_issue", scan_tools="aqua-trivy")` | Returns issues found by aqua-trivy scanner | ⬜ Pending | | |
| TC-si-013 | Filter by exemption_statuses | `harness_list(resource_type="security_issue", exemption_statuses="Approved")` | Returns issues with approved exemptions | ⬜ Pending | | |
| TC-si-014 | Combined filters | `harness_list(resource_type="security_issue", severity_codes="Critical", issue_types="SCA", scan_tools="aqua-trivy")` | Returns only Critical SCA issues from aqua-trivy | ⬜ Pending | | |
| TC-si-015 | Custom org and project | `harness_list(resource_type="security_issue", org_id="custom_org", project_id="custom_project")` | Returns issues scoped to specified org/project | ⬜ Pending | | |
| TC-si-016 | Invalid project | `harness_list(resource_type="security_issue", project_id="nonexistent")` | Returns meaningful error | ⬜ Pending | | |
| TC-si-017 | Invalid severity code | `harness_list(resource_type="security_issue", severity_codes="InvalidSeverity")` | Returns error or empty results | ⬜ Pending | | |
| TC-si-018 | Empty project (no issues) | `harness_list(resource_type="security_issue")` on empty project | Returns empty items array with total 0 | ⬜ Pending | | |
| TC-si-019 | Resource metadata | `harness_describe(resource_type="security_issue")` | Returns full resource metadata including filters, operations, deep link template | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 19 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 18 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
