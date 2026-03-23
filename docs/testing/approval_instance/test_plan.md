# Test Plan: Approval Instance (`approval_instance`)

| Field | Value |
|-------|-------|
| **Resource Type** | `approval_instance` |
| **Display Name** | Approval Instance |
| **Toolset** | pipelines |
| **Scope** | project |
| **Operations** | list |
| **Execute Actions** | approve, reject |
| **Identifier Fields** | execution_id |
| **Filter Fields** | approval_status, approval_type, node_execution_id |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-appr-001 | List | List all approval instances for an execution | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123"})` | Returns list of approval instances for the execution |
| TC-appr-002 | List | List approvals filtered by WAITING status | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_status: "WAITING"})` | Returns only waiting/pending approval instances |
| TC-appr-003 | List | List approvals filtered by APPROVED status | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_status: "APPROVED"})` | Returns only approved approval instances |
| TC-appr-004 | List | List approvals filtered by REJECTED status | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_status: "REJECTED"})` | Returns only rejected approval instances |
| TC-appr-005 | List | List approvals filtered by HarnessApproval type | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_type: "HarnessApproval"})` | Returns only Harness approval type instances |
| TC-appr-006 | List | List approvals filtered by JiraApproval type | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_type: "JiraApproval"})` | Returns only Jira approval type instances |
| TC-appr-007 | List | List approvals filtered by ServiceNowApproval type | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_type: "ServiceNowApproval"})` | Returns only ServiceNow approval instances |
| TC-appr-008 | List | List approvals filtered by node_execution_id | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", node_execution_id: "node_xyz"})` | Returns approvals for the specified step/node |
| TC-appr-009 | List | List approvals with combined filters | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_status: "WAITING", approval_type: "HarnessApproval"})` | Returns waiting Harness approvals for the execution |
| TC-appr-010 | List | List approvals with scope override | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123"}, org_id="custom_org", project_id="custom_project")` | Returns approvals from specified org/project |
| TC-appr-011 | Execute | Approve a waiting approval instance | `harness_execute(resource_type="approval_instance", action="approve", approval_id="appr_123", body={comments: "Looks good, approved"})` | Approval instance approved successfully |
| TC-appr-012 | Execute | Approve with approver_inputs | `harness_execute(resource_type="approval_instance", action="approve", approval_id="appr_123", body={comments: "Approved with inputs", approver_inputs: [{name: "risk_level", value: "low"}]})` | Approval instance approved with custom inputs |
| TC-appr-013 | Execute | Approve without comments | `harness_execute(resource_type="approval_instance", action="approve", approval_id="appr_123")` | Approval instance approved with empty comments |
| TC-appr-014 | Execute | Reject a waiting approval instance | `harness_execute(resource_type="approval_instance", action="reject", approval_id="appr_123", body={comments: "Failing security review"})` | Approval instance rejected with reason |
| TC-appr-015 | Execute | Reject without comments | `harness_execute(resource_type="approval_instance", action="reject", approval_id="appr_123")` | Approval instance rejected with empty comments |
| TC-appr-016 | Error | Approve with invalid approval_id | `harness_execute(resource_type="approval_instance", action="approve", approval_id="nonexistent_appr")` | Error: Approval instance not found (404) |
| TC-appr-017 | Error | Reject with invalid approval_id | `harness_execute(resource_type="approval_instance", action="reject", approval_id="nonexistent_appr")` | Error: Approval instance not found (404) |
| TC-appr-018 | Error | List approvals with invalid execution_id | `harness_list(resource_type="approval_instance", filters={execution_id: "nonexistent_exec"})` | Error or empty results |
| TC-appr-019 | Error | Approve already-approved instance | `harness_execute(resource_type="approval_instance", action="approve", approval_id="already_approved")` | Error: Approval already processed |
| TC-appr-020 | Edge | List approvals with EXPIRED status | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_status: "EXPIRED"})` | Returns only expired approval instances |
| TC-appr-021 | Edge | List approvals with FAILED status | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_status: "FAILED"})` | Returns only failed approval instances |

## Notes
- Approval instances are scoped to a pipeline execution (`execution_id` is required for list)
- Uses v1 API path: `/v1/orgs/{org}/projects/{project}/approvals/execution/{executionId}`
- `approve` action sends `action: "APPROVE"` to `/pipeline/api/approvals/{approvalInstanceId}/harness/activity`
- `reject` action sends `action: "REJECT"` to the same endpoint
- `approval_status` enum: WAITING, APPROVED, REJECTED, FAILED, ABORTED, EXPIRED
- `approval_type` enum: HarnessApproval, JiraApproval, CustomApproval, ServiceNowApproval
- `approver_inputs` is an array of `{name, value}` objects for custom approval fields
