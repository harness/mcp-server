# Test Plan: Security Exemption (`security_exemption`)

| Field | Value |
|-------|-------|
| **Resource Type** | `security_exemption` |
| **Display Name** | Security Exemption |
| **Toolset** | sto |
| **Scope** | project |
| **Operations** | list, create |
| **Execute Actions** | approve, reject |
| **Identifier Fields** | exemption_id |
| **Filter Fields** | status, search, size, page |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-se-001 | List | Basic list with Pending status | `harness_list(resource_type="security_exemption", filters={status: "Pending", size: 5})` | Returns first page of Pending security exemptions |
| TC-se-002 | List | Filter by status (Approved) | `harness_list(resource_type="security_exemption", filters={status: "Approved", size: 5})` | Returns only Approved exemptions |
| TC-se-003 | List | Filter by status (Rejected) | `harness_list(resource_type="security_exemption", filters={status: "Rejected", size: 5})` | Returns only Rejected exemptions |
| TC-se-004 | List | Filter by status (Expired) | `harness_list(resource_type="security_exemption", filters={status: "Expired", size: 5})` | Returns only Expired exemptions |
| TC-se-005 | List | Filter by status (Canceled) | `harness_list(resource_type="security_exemption", filters={status: "Canceled", size: 5})` | Returns only Canceled exemptions |
| TC-se-006 | List | Filter by search | `harness_list(resource_type="security_exemption", filters={status: "Pending", search: "CVE-2024", size: 5})` | Returns Pending exemptions matching search term |
| TC-se-007 | List | Combined status + search | `harness_list(resource_type="security_exemption", filters={status: "Pending", search: "critical", size: 5})` | Returns Pending exemptions matching search |
| TC-se-008 | List | Pagination - page 0, size 5 | `harness_list(resource_type="security_exemption", filters={status: "Pending", page: 0, size: 5})` | Returns first 5 exemptions and includes `_nextPageHint` |
| TC-se-009 | List | Pagination - page 1 | `harness_list(resource_type="security_exemption", filters={status: "Pending", page: 1, size: 5})` | Returns second page while preserving the same status and size |
| TC-se-010 | Create | Create exemption with required fields | `harness_create(resource_type="security_exemption", body={issue_id: "<issue_id>", type: "Acceptable Risk", reason: "Accepted by security review", duration_days: 30})` | Creates exemption; requester is derived from the authenticated PAT |
| TC-se-011 | Execute | Approve at current scope | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<id>", body={scope: "CURRENT", comment: "Approved"})` | Exemption is approved at its existing scope; server auto-fills `approver_id` |
| TC-se-012 | Execute | Approve and elevate to org scope | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<id>", body={scope: "ORG", comment: "Approve org-wide"})` | Exemption is approved through the promote endpoint at org scope |
| TC-se-013 | Execute | Approve and elevate to account scope | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<id>", body={scope: "ACCOUNT", comment: "Approve account-wide"})` | Exemption is approved through the promote endpoint at account scope |
| TC-se-014 | Execute | Approve and elevate to project scope | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<id>", body={scope: "PROJECT", comment: "Approve project scope"})` | Exemption is approved through the promote endpoint at project scope |
| TC-se-015 | Execute | Reject exemption | `harness_execute(resource_type="security_exemption", action="reject", resource_id="<id>", body={comment: "Rejected - risk too high"})` | Exemption is rejected; server auto-fills `approver_id` |
| TC-se-016 | Error | Approve without scope | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<id>", body={})` | Returns preflight error because `body.scope` is required for approve |
| TC-se-017 | Error | Approve with invalid scope | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<id>", body={scope: "PIPELINE"})` | Returns validation error because scope must be CURRENT, ACCOUNT, ORG, or PROJECT |
| TC-se-018 | Error | Invalid exemption ID | `harness_execute(resource_type="security_exemption", action="approve", resource_id="nonexistent", body={scope: "CURRENT"})` | Returns not found error |
| TC-se-019 | Error | Invalid action name | `harness_execute(resource_type="security_exemption", action="promote", resource_id="<id>", body={scope: "ORG"})` | Returns error listing available actions: approve, reject |
| TC-se-020 | Edge | Approve already-approved exemption | `harness_execute(resource_type="security_exemption", action="approve", resource_id="<approved_id>", body={scope: "CURRENT"})` | Returns error or idempotent success from STO |
| TC-se-021 | Describe | Resource metadata | `harness_describe(resource_type="security_exemption")` | Returns metadata with list/create operations, approve/reject execute actions, and body schemas |

## Notes
- STO API uses non-standard scope params: `accountId`, `orgId`, `projectId`.
- `security_exemption` list is POST-based at `/sto/api/v2/frontend/exemptions` and always lists at project scope.
- Do not use `resource_scope`, `org_id`, or `project_id` as approval-scope signals on list calls. Phrases like "for org" or "for account" map to `body.scope` on `harness_execute`.
- Create endpoint is POST-based at `/sto/api/v2/exemptions`; `requester_id` is derived from the PAT and `duration_days` defaults to 30.
- Status filter enum: Pending, Approved, Rejected, Expired, Canceled.
- `approve` requires `body.scope`: `CURRENT`, `ACCOUNT`, `ORG`, or `PROJECT`. `CURRENT` calls `/approve`; other scopes call `/promote` internally.
- There is no separate `promote` execute action. Use `action="approve"` with a non-`CURRENT` `body.scope` for approval elevation.
- `approve` body: `scope` (required), `approver_id` (optional; auto-derived from authenticated user), `comment` (optional).
- `reject` body: `approver_id` (optional; auto-derived from authenticated user), `comment` (optional).
- STO gateway may have auth limitations with x-api-key PATs.
