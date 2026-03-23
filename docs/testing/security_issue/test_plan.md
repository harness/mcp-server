# Test Plan: Security Issue (`security_issue`)

| Field | Value |
|-------|-------|
| **Resource Type** | `security_issue` |
| **Display Name** | Security Issue |
| **Toolset** | sto |
| **Scope** | project |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | issue_id |
| **Filter Fields** | search, severity_codes, issue_types, target_ids, target_types, pipeline_ids, scan_tools, exemption_statuses |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-si-001 | List | Basic list with no filters | `harness_list(resource_type="security_issue")` | Returns paginated list of security issues with default page size |
| TC-si-002 | List | Pagination - page 0, size 5 | `harness_list(resource_type="security_issue", page=0, size=5)` | Returns first 5 issues |
| TC-si-003 | List | Pagination - page 1 | `harness_list(resource_type="security_issue", page=1, size=5)` | Returns second page of 5 issues |
| TC-si-004 | List | Filter by severity_codes (Critical) | `harness_list(resource_type="security_issue", severity_codes="Critical")` | Returns only Critical severity issues |
| TC-si-005 | List | Filter by severity_codes (multiple) | `harness_list(resource_type="security_issue", severity_codes="Critical,High")` | Returns Critical and High severity issues |
| TC-si-006 | List | Filter by issue_types (SAST) | `harness_list(resource_type="security_issue", issue_types="SAST")` | Returns only SAST type issues |
| TC-si-007 | List | Filter by issue_types (multiple) | `harness_list(resource_type="security_issue", issue_types="SAST,SCA")` | Returns SAST and SCA type issues |
| TC-si-008 | List | Filter by search keyword | `harness_list(resource_type="security_issue", search="CVE-2024")` | Returns issues matching the search term |
| TC-si-009 | List | Filter by target_types | `harness_list(resource_type="security_issue", target_types="container")` | Returns issues from container targets only |
| TC-si-010 | List | Filter by target_ids | `harness_list(resource_type="security_issue", target_ids="<valid_target_id>")` | Returns issues for the specified target |
| TC-si-011 | List | Filter by pipeline_ids | `harness_list(resource_type="security_issue", pipeline_ids="<valid_pipeline_id>")` | Returns issues from the specified pipeline |
| TC-si-012 | List | Filter by scan_tools | `harness_list(resource_type="security_issue", scan_tools="aqua-trivy")` | Returns issues found by aqua-trivy scanner |
| TC-si-013 | List | Filter by exemption_statuses | `harness_list(resource_type="security_issue", exemption_statuses="Approved")` | Returns issues with approved exemptions |
| TC-si-014 | List | Combined filters | `harness_list(resource_type="security_issue", severity_codes="Critical", issue_types="SCA", scan_tools="aqua-trivy")` | Returns only Critical SCA issues from aqua-trivy |
| TC-si-015 | Scope | Custom org and project | `harness_list(resource_type="security_issue", org_id="custom_org", project_id="custom_project")` | Returns issues scoped to specified org/project |
| TC-si-016 | Error | Invalid project | `harness_list(resource_type="security_issue", project_id="nonexistent")` | Returns meaningful error |
| TC-si-017 | Error | Invalid severity code | `harness_list(resource_type="security_issue", severity_codes="InvalidSeverity")` | Returns error or empty results |
| TC-si-018 | Edge | Empty project (no issues) | `harness_list(resource_type="security_issue")` on empty project | Returns empty items array with total 0 |
| TC-si-019 | Describe | Resource metadata | `harness_describe(resource_type="security_issue")` | Returns full resource metadata including filters, operations, deep link template |

## Notes
- STO API uses non-standard scope params: `accountId`, `orgId`, `projectId` instead of `accountIdentifier`, `orgIdentifier`, `projectIdentifier`
- STO gateway may have auth limitations with x-api-key PATs; auth errors may be a platform limitation
- List endpoint is GET-based at `/sto/api/v2/frontend/all-issues/issues`
- severity_codes enum: Critical, High, Medium, Low, Info
- issue_types enum: SAST, DAST, SCA, IAC, SECRET, MISCONFIG
- target_types enum: configuration, container, instance, repository
- exemption_statuses enum: None, Pending, Approved, Rejected, Expired
