# Test Report: Approval Instance (`approval_instance`)

| Field | Value |
|-------|-------|
| **Resource Type** | `approval_instance` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-appr-001 | List all approval instances for an execution | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123"})` | Returns list of approval instances for the execution | ✅ Passed | Returns empty list (requires execution_id filter); API responds correctly | Requires execution_id filter |
| TC-appr-002 | List approvals filtered by WAITING status | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_status: "WAITING"})` | Returns only waiting/pending approval instances | ⬜ Pending | | |
| TC-appr-003 | List approvals filtered by APPROVED status | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_status: "APPROVED"})` | Returns only approved approval instances | ⬜ Pending | | |
| TC-appr-004 | List approvals filtered by REJECTED status | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_status: "REJECTED"})` | Returns only rejected approval instances | ⬜ Pending | | |
| TC-appr-005 | List approvals filtered by HarnessApproval type | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_type: "HarnessApproval"})` | Returns only Harness approval type instances | ⬜ Pending | | |
| TC-appr-006 | List approvals filtered by JiraApproval type | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_type: "JiraApproval"})` | Returns only Jira approval type instances | ⬜ Pending | | |
| TC-appr-007 | List approvals filtered by ServiceNowApproval type | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_type: "ServiceNowApproval"})` | Returns only ServiceNow approval instances | ⬜ Pending | | |
| TC-appr-008 | List approvals filtered by node_execution_id | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", node_execution_id: "node_xyz"})` | Returns approvals for the specified step/node | ⬜ Pending | | |
| TC-appr-009 | List approvals with combined filters | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_status: "WAITING", approval_type: "HarnessApproval"})` | Returns waiting Harness approvals for the execution | ⬜ Pending | | |
| TC-appr-010 | List approvals with scope override | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123"}, org_id="custom_org", project_id="custom_project")` | Returns approvals from specified org/project | ⬜ Pending | | |
| TC-appr-011 | Approve a waiting approval instance | `harness_execute(resource_type="approval_instance", action="approve", approval_id="appr_123", body={comments: "Looks good, approved"})` | Approval instance approved successfully | ⬜ Pending | | |
| TC-appr-012 | Approve with approver_inputs | `harness_execute(resource_type="approval_instance", action="approve", approval_id="appr_123", body={comments: "Approved with inputs", approver_inputs: [{name: "risk_level", value: "low"}]})` | Approval instance approved with custom inputs | ⬜ Pending | | |
| TC-appr-013 | Approve without comments | `harness_execute(resource_type="approval_instance", action="approve", approval_id="appr_123")` | Approval instance approved with empty comments | ⬜ Pending | | |
| TC-appr-014 | Reject a waiting approval instance | `harness_execute(resource_type="approval_instance", action="reject", approval_id="appr_123", body={comments: "Failing security review"})` | Approval instance rejected with reason | ⬜ Pending | | |
| TC-appr-015 | Reject without comments | `harness_execute(resource_type="approval_instance", action="reject", approval_id="appr_123")` | Approval instance rejected with empty comments | ⬜ Pending | | |
| TC-appr-016 | Approve with invalid approval_id | `harness_execute(resource_type="approval_instance", action="approve", approval_id="nonexistent_appr")` | Error: Approval instance not found (404) | ⬜ Pending | | |
| TC-appr-017 | Reject with invalid approval_id | `harness_execute(resource_type="approval_instance", action="reject", approval_id="nonexistent_appr")` | Error: Approval instance not found (404) | ⬜ Pending | | |
| TC-appr-018 | List approvals with invalid execution_id | `harness_list(resource_type="approval_instance", filters={execution_id: "nonexistent_exec"})` | Error or empty results | ⬜ Pending | | |
| TC-appr-019 | Approve already-approved instance | `harness_execute(resource_type="approval_instance", action="approve", approval_id="already_approved")` | Error: Approval already processed | ⬜ Pending | | |
| TC-appr-020 | List approvals with EXPIRED status | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_status: "EXPIRED"})` | Returns only expired approval instances | ⬜ Pending | | |
| TC-appr-021 | List approvals with FAILED status | `harness_list(resource_type="approval_instance", filters={execution_id: "exec_abc123", approval_status: "FAILED"})` | Returns only failed approval instances | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 21 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 20 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

_(To be filled during testing)_
