# Test Plan: Security Exemption (`security_exemption`)

| Field | Value |
|-------|-------|
| **Resource Type** | `security_exemption` |
| **Display Name** | Security Exemption |
| **Toolset** | sto |
| **Scope** | project |
| **Operations** | list |
| **Execute Actions** | approve, reject, promote |
| **Identifier Fields** | exemption_id |
| **Filter Fields** | status, search |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-se-001 | List | Basic list with default filters | `harness_list(resource_type="security_exemption")` | Returns paginated list of security exemptions |
| TC-se-002 | List | Filter by status (Pending) | `harness_list(resource_type="security_exemption", status="Pending")` | Returns only Pending exemptions |
| TC-se-003 | List | Filter by status (Approved) | `harness_list(resource_type="security_exemption", status="Approved")` | Returns only Approved exemptions |
| TC-se-004 | List | Filter by status (Rejected) | `harness_list(resource_type="security_exemption", status="Rejected")` | Returns only Rejected exemptions |
| TC-se-005 | List | Filter by status (Expired) | `harness_list(resource_type="security_exemption", status="Expired")` | Returns only Expired exemptions |
| TC-se-006 | List | Filter by search | `harness_list(resource_type="security_exemption", search="CVE-2024")` | Returns exemptions matching search term |
| TC-se-007 | List | Combined status + search | `harness_list(resource_type="security_exemption", status="Pending", search="critical")` | Returns Pending exemptions matching search |
| TC-se-008 | List | Pagination - page 0, size 5 | `harness_list(resource_type="security_exemption", page=0, size=5)` | Returns first 5 exemptions |
| TC-se-009 | List | Pagination - page 1 | `harness_list(resource_type="security_exemption", page=1, size=5)` | Returns second page of exemptions |
| TC-se-010 | Execute | Approve exemption | `harness_execute(resource_type="security_exemption", action="approve", exemption_id="<id>", body={approver_id: "<uuid>", comment: "Approved"})` | Exemption status changes to Approved |
| TC-se-011 | Execute | Approve without comment | `harness_execute(resource_type="security_exemption", action="approve", exemption_id="<id>", body={approver_id: "<uuid>"})` | Exemption approved without comment |
| TC-se-012 | Execute | Reject exemption | `harness_execute(resource_type="security_exemption", action="reject", exemption_id="<id>", body={approver_id: "<uuid>", comment: "Rejected - risk too high"})` | Exemption status changes to Rejected |
| TC-se-013 | Execute | Promote exemption | `harness_execute(resource_type="security_exemption", action="promote", exemption_id="<id>", body={approver_id: "<uuid>", comment: "Promoting to org level"})` | Exemption promoted to org/account level |
| TC-se-014 | Execute | Promote with pipeline_id scope | `harness_execute(resource_type="security_exemption", action="promote", exemption_id="<id>", body={approver_id: "<uuid>", pipeline_id: "<pid>"})` | Exemption promoted scoped to pipeline |
| TC-se-015 | Execute | Promote with target_id scope | `harness_execute(resource_type="security_exemption", action="promote", exemption_id="<id>", body={approver_id: "<uuid>", target_id: "<tid>"})` | Exemption promoted scoped to target |
| TC-se-016 | Scope | Custom org and project | `harness_list(resource_type="security_exemption", org_id="custom_org", project_id="custom_project")` | Returns exemptions for specified org/project |
| TC-se-017 | Error | Approve without approver_id | `harness_execute(resource_type="security_exemption", action="approve", exemption_id="<id>", body={})` | Returns validation error — approver_id required |
| TC-se-018 | Error | Invalid exemption_id | `harness_execute(resource_type="security_exemption", action="approve", exemption_id="nonexistent", body={approver_id: "<uuid>"})` | Returns not found error |
| TC-se-019 | Error | Invalid action name | `harness_execute(resource_type="security_exemption", action="invalid_action", exemption_id="<id>")` | Returns error — unknown action |
| TC-se-020 | Edge | Approve already-approved exemption | `harness_execute(resource_type="security_exemption", action="approve", ...)` on approved exemption | Returns error or idempotent success |
| TC-se-021 | Describe | Resource metadata | `harness_describe(resource_type="security_exemption")` | Returns metadata with execute actions (approve, reject, promote) and body schemas |

## Notes
- STO API uses non-standard scope params: `accountId`, `orgId`, `projectId`
- List endpoint is POST-based at `/sto/api/v2/frontend/exemptions`
- status filter enum: Pending, Approved, Rejected, Expired, Canceled
- Execute actions use PUT method with path params
- approve body: `approver_id` (required), `comment` (optional)
- reject body: `approver_id` (required), `comment` (optional)
- promote body: `approver_id` (required), `comment` (optional), `pipeline_id` (optional), `target_id` (optional)
- STO gateway may have auth limitations with x-api-key PATs
