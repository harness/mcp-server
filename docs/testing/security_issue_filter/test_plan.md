# Test Plan: Security Issue Filter (`security_issue_filter`)

| Field | Value |
|-------|-------|
| **Resource Type** | `security_issue_filter` |
| **Display Name** | Security Issue Filter |
| **Toolset** | sto |
| **Scope** | project |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | _(none)_ |
| **Filter Fields** | _(none)_ |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-sif-001 | List | Basic list of available filters | `harness_list(resource_type="security_issue_filter")` | Returns available filter values (targets, scan tools, pipelines) |
| TC-sif-002 | List | Pagination - page 0, size 5 | `harness_list(resource_type="security_issue_filter", page=0, size=5)` | Returns paginated filter values |
| TC-sif-003 | List | Pagination - page 1 | `harness_list(resource_type="security_issue_filter", page=1, size=5)` | Returns second page of filter values |
| TC-sif-004 | Scope | Custom org and project | `harness_list(resource_type="security_issue_filter", org_id="custom_org", project_id="custom_project")` | Returns filter values for specified org/project |
| TC-sif-005 | Scope | Different project | `harness_list(resource_type="security_issue_filter", project_id="another_project")` | Returns filter values for different project context |
| TC-sif-006 | Error | Invalid project | `harness_list(resource_type="security_issue_filter", project_id="nonexistent")` | Returns meaningful error |
| TC-sif-007 | Edge | Empty project (no scans) | `harness_list(resource_type="security_issue_filter")` on empty project | Returns empty or minimal filter values |
| TC-sif-008 | Describe | Resource metadata | `harness_describe(resource_type="security_issue_filter")` | Returns metadata showing list-only operation with description |

## Notes
- This resource is a discovery helper — it returns valid filter values to use with `security_issue` list calls
- STO API uses non-standard scope params: `accountId`, `orgId`, `projectId`
- No identifier fields — this is a metadata/lookup-only resource
- Endpoint: GET `/sto/api/v2/frontend/all-issues/filters`
- STO gateway may have auth limitations with x-api-key PATs
