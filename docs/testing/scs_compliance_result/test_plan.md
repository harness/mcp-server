# Test Plan: SCS Compliance Result (`scs_compliance_result`)

| Field | Value |
|-------|-------|
| **Resource Type** | `scs_compliance_result` |
| **Display Name** | SCS Compliance Result |
| **Toolset** | scs |
| **Scope** | project |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | artifact_id |
| **Filter Fields** | standards, status _(via request body)_ |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-SCR-001 | List | List compliance results for an artifact | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1")` | Returns list of compliance scan results |
| TC-SCR-002 | List / Pagination | List with explicit page | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1", page=1)` | Returns second page of compliance results |
| TC-SCR-003 | List / Pagination | List with custom page size | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1", size=5)` | Returns at most 5 compliance results |
| TC-SCR-004 | List / Filter | List filtered by standards | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1", standards=["CIS"])` | Returns results filtered to CIS standard |
| TC-SCR-005 | List / Filter | List filtered by status | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1", status="PASS")` | Returns only passing compliance results |
| TC-SCR-006 | List / Filter | List filtered by status FAIL | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1", status="FAIL")` | Returns only failing compliance results |
| TC-SCR-007 | List / Filter | List with combined filters | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1", standards=["SLSA"], status="PASS")` | Returns passing SLSA compliance results |
| TC-SCR-008 | Scope | List with explicit org_id and project_id | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1", org_id="my-org", project_id="my-project")` | Returns results for specified org/project |
| TC-SCR-009 | Error | List without artifact_id | `harness_list(resource_type="scs_compliance_result")` | Error: artifact_id is required |
| TC-SCR-010 | Error | Non-existent artifact_id | `harness_list(resource_type="scs_compliance_result", artifact_id="nonexistent")` | Returns 404 or empty list |
| TC-SCR-011 | Error | Unsupported operation (get) | `harness_get(resource_type="scs_compliance_result", artifact_id="art-1")` | Error: get operation not supported |
| TC-SCR-012 | Edge | Artifact with no compliance scans | `harness_list(resource_type="scs_compliance_result", artifact_id="unscanned-art")` | Returns empty items list |
| TC-SCR-013 | Edge | Filter by non-existent standard | `harness_list(resource_type="scs_compliance_result", artifact_id="art-1", standards=["NONEXISTENT"])` | Returns empty items list |

## Notes
- `scs_compliance_result` only supports `list` via `POST /ssca-manager/v1/orgs/{org}/projects/{project}/artifact/{artifact}/compliance-results/list`.
- Note: The path uses singular `artifact` (not `artifacts`) — API inconsistency.
- Path params: `org_id` → `org`, `project_id` → `project`, `artifact_id` → `artifact`.
- Body filters: `standards` (array of compliance standard names), `status` (pass/fail filter).
- Pagination via `page` and `limit` query params.
