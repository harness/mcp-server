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
| TC-se-001 | Basic list with default filters | `harness_list(resource_type="security_exemption")` | Returns paginated list of security exemptions | ✅ Passed | Returns empty exemption list with counts (requires status filter: Approved/Pending/Rejected/Expired) | Status must be PascalCase |
| TC-se-002 | Filter by status (Pending) | `harness_list(resource_type="security_exemption", status="Pending")` | Returns only Pending exemptions | ⬜ Pending | | |
| TC-se-003 | Filter by status (Approved) | `harness_list(resource_type="security_exemption", status="Approved")` | Returns only Approved exemptions | ⬜ Pending | | |
| TC-se-004 | Filter by status (Rejected) | `harness_list(resource_type="security_exemption", status="Rejected")` | Returns only Rejected exemptions | ⬜ Pending | | |
| TC-se-005 | Filter by status (Expired) | `harness_list(resource_type="security_exemption", status="Expired")` | Returns only Expired exemptions | ⬜ Pending | | |
| TC-se-006 | Filter by search | `harness_list(resource_type="security_exemption", search="CVE-2024")` | Returns exemptions matching search term | ⬜ Pending | | |
| TC-se-007 | Combined status + search | `harness_list(resource_type="security_exemption", status="Pending", search="critical")` | Returns Pending exemptions matching search | ⬜ Pending | | |
| TC-se-008 | Pagination - page 0, size 5 | `harness_list(resource_type="security_exemption", page=0, size=5)` | Returns first 5 exemptions | ⬜ Pending | | |
| TC-se-009 | Pagination - page 1 | `harness_list(resource_type="security_exemption", page=1, size=5)` | Returns second page of exemptions | ⬜ Pending | | |
| TC-se-010 | Approve exemption at project scope | `harness_execute(resource_type="security_exemption", action="approve", exemption_id="<id>", body={comment: "Approved"})` | Exemption is approved at project scope; server auto-fills approver_id from the authenticated user | ⬜ Pending | | |
| TC-se-011 | Approve without body | `harness_execute(resource_type="security_exemption", action="approve", exemption_id="<id>")` | Exemption is approved without a comment; server auto-fills approver_id | ⬜ Pending | | |
| TC-se-012 | Reject exemption | `harness_execute(resource_type="security_exemption", action="reject", exemption_id="<id>", body={comment: "Rejected - risk too high"})` | Exemption is rejected; server auto-fills approver_id | ⬜ Pending | | |
| TC-se-013 | Promote exemption to org scope | `harness_execute(resource_type="security_exemption", action="promote", exemption_id="<id>", body={scope: "ORG", comment: "Promoting to org level"})` | Exemption is approved and promoted to org scope in one call | ⬜ Pending | | |
| TC-se-014 | Promote with pipeline_id scope | `harness_execute(resource_type="security_exemption", action="promote", exemption_id="<id>", body={scope: "PIPELINE", pipeline_id: "<pid>"})` | Exemption is approved and promoted to the specified pipeline scope | ⬜ Pending | | |
| TC-se-015 | Promote with target_id scope | `harness_execute(resource_type="security_exemption", action="promote", exemption_id="<id>", body={scope: "TARGET", target_id: "<tid>"})` | Exemption is approved and promoted to the specified target scope | ⬜ Pending | | |
| TC-se-016 | Custom org and project | `harness_list(resource_type="security_exemption", org_id="custom_org", project_id="custom_project")` | Returns exemptions for specified org/project | ⬜ Pending | | |
| TC-se-017 | Promote without scope | `harness_execute(resource_type="security_exemption", action="promote", exemption_id="<id>", body={comment: "Missing scope"})` | Returns validation or API error because promote requires `body.scope` | ⬜ Pending | | |
| TC-se-018 | Invalid exemption_id | `harness_execute(resource_type="security_exemption", action="approve", exemption_id="nonexistent", body={comment: "Approved"})` | Returns not found error | ⬜ Pending | | |
| TC-se-019 | Invalid action name | `harness_execute(resource_type="security_exemption", action="invalid_action", exemption_id="<id>")` | Returns error — unknown action | ⬜ Pending | | |
| TC-se-020 | Approve already-approved exemption | `harness_execute(resource_type="security_exemption", action="approve", ...)` on approved exemption | Returns error or idempotent success | ⬜ Pending | | |
| TC-se-021 | Resource metadata | `harness_describe(resource_type="security_exemption")` | Returns metadata with execute actions (approve, reject, promote) and body schemas | ⬜ Pending | | |

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
