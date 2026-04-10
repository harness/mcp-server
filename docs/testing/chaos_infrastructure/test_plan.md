# Test Plan: Chaos Infrastructure (`chaos_infrastructure`)

| Field | Value |
|-------|-------|
| **Resource Type** | `chaos_infrastructure` |
| **Display Name** | Chaos Infrastructure |
| **Toolset** | chaos |
| **Scope** | project |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | infra_id |
| **Filter Fields** | status |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-ci-001 | List | List infrastructures with defaults | `harness_list(resource_type="chaos_infrastructure")` | Returns list of Active Linux infrastructures (default status=Active) |
| TC-ci-002 | List | List with status=Active | `harness_list(resource_type="chaos_infrastructure", status="Active")` | Returns only active infrastructures |
| TC-ci-003 | List | List with status=All | `harness_list(resource_type="chaos_infrastructure", status="All")` | Returns all infrastructures regardless of status |
| TC-ci-004 | List | List with explicit org and project | `harness_list(resource_type="chaos_infrastructure", org_id="myorg", project_id="myproject")` | Returns infrastructures scoped to specified org/project |
| TC-ci-005 | Scope | List with wrong project | `harness_list(resource_type="chaos_infrastructure", project_id="wrongproject")` | Returns empty list or error |
| TC-ci-006 | Edge | List when no infrastructures exist | `harness_list(resource_type="chaos_infrastructure")` | Returns empty infras array with totalNoOfInfras=0 |
| TC-ci-007 | Error | Attempt get (not supported) | `harness_get(resource_type="chaos_infrastructure", infra_id="<id>")` | Returns error indicating get is not supported |
| TC-ci-008 | Error | Invalid status value | `harness_list(resource_type="chaos_infrastructure", status="InvalidStatus")` | Returns error or ignores invalid filter |
| TC-ci-009 | Edge | Verify response structure | `harness_list(resource_type="chaos_infrastructure")` | Response contains items array and total count from totalNoOfInfras |

## Notes
- Chaos API uses `organizationIdentifier` instead of `orgIdentifier` (scopeParams override)
- List uses POST method (not GET): `/chaos/manager/api/rest/machine/infras`
- Static query params: `infraType=Linux`, `page=0`, `limit=15`
- Body includes filter (status) and sort (field: NAME, ascending: true)
- Default status filter is `Active` — omitting status returns active infras only
- Response structure: `{ totalNoOfInfras, infras: [...] }` (custom extractor)
