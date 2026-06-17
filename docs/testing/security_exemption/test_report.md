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
| TC-se-001 | Basic list with Pending status | `harness_list(resource_type="security_exemption", filters={status: "Pending", size: 5})` | Returns first page of Pending security exemptions | ✅ Passed | Returns empty exemption list with counts | Status must be PascalCase |
| TC-se-002 | Filter by status (Approved) | `harness_list(resource_type="security_exemption", filters={status: "Approved", size: 5})` | Returns only Approved exemptions | ⬜ Pending | | |
| TC-se-003 | Filter by status (Rejected) | `harness_list(resource_type="security_exemption", filters={status: "Rejected", size: 5})` | Returns only Rejected exemptions | ⬜ Pending | | |
| TC-se-004 | Filter by status (Expired) | `harness_list(resource_type="security_exemption", filters={status: "Expired", size: 5})` | Returns only Expired exemptions | ⬜ Pending | | |
| TC-se-005 | Filter by status (Canceled) | `harness_list(resource_type="security_exemption", filters={status: "Canceled", size: 5})` | Returns only Canceled exemptions | ⬜ Pending | | |
| TC-se-006 | Filter by search | `harness_list(resource_type="security_exemption", filters={status: "Pending", search: "CVE-2024", size: 5})` | Returns Pending exemptions matching search term | ⬜ Pending | | |
| TC-se-007 | Combined status + search | `harness_list(resource_type="security_exemption", filters={status: "Pending", search: "critical", size: 5})` | Returns Pending exemptions matching search | ⬜ Pending | | |
| TC-se-008 | Pagination - page 0, size 5 | `harness_list(resource_type="security_exemption", filters={status: "Pending", page: 0, size: 5})` | Returns first 5 exemptions and includes `_nextPageHint` | ⬜ Pending | | |
| TC-se-009 | Pagination - page 1 | `harness_list(resource_type="security_exemption", filters={status: "Pending", page: 1, size: 5})` | Returns second page while preserving the same status and size | ⬜ Pending | | |
| TC-se-010 | Create exemption with required fields | `harness_create(resource_type="security_exemption", body={issue_id: "<issue_id>", type: "Acceptable Risk", reason: "Accepted by security review", duration_days: 30})` | Creates exemption; requester is derived from the authenticated PAT | ⬜ Pending | | |
| TC-se-011 | Approve at current scope | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<id>", body={scope: "CURRENT", comment: "Approved"})` | Exemption is approved at its existing scope; server auto-fills `approver_id` | ⬜ Pending | | |
| TC-se-012 | Approve and elevate to org scope | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<id>", body={scope: "ORG", comment: "Approve org-wide"})` | Exemption is approved through the promote endpoint at org scope | ⬜ Pending | | |
| TC-se-013 | Approve and elevate to account scope | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<id>", body={scope: "ACCOUNT", comment: "Approve account-wide"})` | Exemption is approved through the promote endpoint at account scope | ⬜ Pending | | |
| TC-se-014 | Approve and elevate to project scope | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<id>", body={scope: "PROJECT", comment: "Approve project scope"})` | Exemption is approved through the promote endpoint at project scope | ⬜ Pending | | |
| TC-se-015 | Reject exemption | `harness_execute(resource_type="security_exemption", action="reject", resource_id="<id>", body={comment: "Rejected - risk too high"})` | Exemption is rejected; server auto-fills `approver_id` | ⬜ Pending | | |
| TC-se-016 | Approve without scope | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<id>", body={})` | Returns preflight error because `body.scope` is required for approve | ⬜ Pending | | |
| TC-se-017 | Approve with invalid scope | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<id>", body={scope: "PIPELINE"})` | Returns validation error because scope must be CURRENT, ACCOUNT, ORG, or PROJECT | ⬜ Pending | | |
| TC-se-018 | Invalid exemption ID | `harness_execute(resource_type="security_exemption", action="approve", resource_id="nonexistent", body={scope: "CURRENT"})` | Returns not found error | ⬜ Pending | | |
| TC-se-019 | Invalid action name | `harness_execute(resource_type="security_exemption", action="promote", resource_id="<id>", body={scope: "ORG"})` | Returns error listing available actions: approve, reject | ⬜ Pending | | |
| TC-se-020 | Approve already-approved exemption | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<approved_id>", body={scope: "CURRENT"})` | Returns error or idempotent success from STO | ⬜ Pending | | |
| TC-se-021 | Resource metadata | `harness_describe(resource_type="security_exemption")` | Returns metadata with list/create operations, approve/reject execute actions, and body schemas | ⬜ Pending | | |

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
