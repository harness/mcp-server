# Test Report: Security Exemption (`security_exemption`)

| Field | Value |
|-------|-------|
| **Resource Type** | `security_exemption` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-se-001 | Basic list with Pending status | `harness_list(resource_type="security_exemption", filters={status: "Pending", size: 5})` | Returns first page of Pending security exemptions | ✅ Passed | Returns empty exemption list with counts (requires status filter: Approved/Pending/Rejected/Expired) | Status must be PascalCase |
| TC-se-002 | Filter by status (Pending) | `harness_list(resource_type="security_exemption", filters={status: "Pending", size: 5})` | Returns only Pending exemptions | ⬜ Pending | | |
| TC-se-003 | Filter by status (Approved) | `harness_list(resource_type="security_exemption", filters={status: "Approved", size: 5})` | Returns only Approved exemptions | ⬜ Pending | | |
| TC-se-004 | Filter by status (Rejected) | `harness_list(resource_type="security_exemption", filters={status: "Rejected", size: 5})` | Returns only Rejected exemptions | ⬜ Pending | | |
| TC-se-005 | Filter by status (Expired) | `harness_list(resource_type="security_exemption", filters={status: "Expired", size: 5})` | Returns only Expired exemptions | ⬜ Pending | | |
| TC-se-006 | Filter by search | `harness_list(resource_type="security_exemption", filters={status: "Pending", search: "CVE-2024", size: 5})` | Returns exemptions matching search term | ⬜ Pending | | |
| TC-se-007 | Combined status + search | `harness_list(resource_type="security_exemption", filters={status: "Pending", search: "critical", size: 5})` | Returns Pending exemptions matching search | ⬜ Pending | | |
| TC-se-008 | Pagination - page 0, size 5 | `harness_list(resource_type="security_exemption", filters={status: "Pending", page: 0, size: 5})` | Returns first 5 exemptions | ⬜ Pending | | |
| TC-se-009 | Pagination - page 1 | `harness_list(resource_type="security_exemption", filters={status: "Pending", page: 1, size: 5})` | Returns second page of exemptions | ⬜ Pending | | |
| TC-se-009a | Create exemption with required fields | `harness_create(resource_type="security_exemption", body={issue_id: "<issue_id>", type: "Acceptable Risk", reason: "Accepted by security review", duration_days: 30})` | Creates exemption; requester is derived from the authenticated PAT | ⬜ Pending | | |
| TC-se-010 | Approve exemption | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<id>", body={approver_id: "<uuid>", comment: "Approved"})` | Exemption status changes to Approved | ⬜ Pending | | |
| TC-se-011 | Approve without comment | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<id>", body={approver_id: "<uuid>"})` | Exemption approved without comment | ⬜ Pending | | |
| TC-se-012 | Reject exemption | `harness_execute(resource_type="security_exemption", action="reject", resource_id="<id>", body={approver_id: "<uuid>", comment: "Rejected - risk too high"})` | Exemption status changes to Rejected | ⬜ Pending | | |
| TC-se-013 | Promote exemption | `harness_execute(resource_type="security_exemption", action="promote", resource_id="<id>", body={scope: "ORG", approver_id: "<uuid>", comment: "Promoting to org level"})` | Exemption promoted to org scope | ⬜ Pending | | |
| TC-se-014 | Promote with pipeline_id scope | `harness_execute(resource_type="security_exemption", action="promote", resource_id="<id>", body={scope: "PIPELINE", approver_id: "<uuid>", pipeline_id: "<pid>"})` | Exemption promoted scoped to pipeline | ⬜ Pending | | |
| TC-se-015 | Promote with target_id scope | `harness_execute(resource_type="security_exemption", action="promote", resource_id="<id>", body={scope: "TARGET", approver_id: "<uuid>", target_id: "<tid>"})` | Exemption promoted scoped to target | ⬜ Pending | | |
| TC-se-016 | Custom org and project | `harness_list(resource_type="security_exemption", filters={status: "Pending", size: 5}, org_id="custom_org", project_id="custom_project")` | Returns exemptions for specified org/project | ⬜ Pending | | |
| TC-se-017 | Approve without approver_id | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<id>", body={})` | Derives approver_id from the authenticated PAT and approves the exemption | ⬜ Pending | | |
| TC-se-018 | Invalid exemption_id | `harness_execute(resource_type="security_exemption", action="approve", resource_id="nonexistent", body={approver_id: "<uuid>"})` | Returns not found error | ⬜ Pending | | |
| TC-se-019 | Invalid action name | `harness_execute(resource_type="security_exemption", action="invalid_action", resource_id="<id>")` | Returns error — unknown action | ⬜ Pending | | |
| TC-se-020 | Approve already-approved exemption | `harness_execute(resource_type="security_exemption", action="approve", ...)` on approved exemption | Returns error or idempotent success | ⬜ Pending | | |
| TC-se-021 | Resource metadata | `harness_describe(resource_type="security_exemption")` | Returns metadata with execute actions (approve, reject, promote) and body schemas | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 22 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 21 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
