# Test Plan: Policy Evaluation (`policy_evaluation`)

| Field | Value |
|-------|-------|
| **Resource Type** | `policy_evaluation` |
| **Display Name** | Policy Evaluation |
| **Toolset** | governance |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | evaluation_id |
| **Filter Fields** | entity, type, action, status, execution_id, created_date_from, created_date_to, include_child_scopes |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-pe-001 | List | Basic list of evaluations | `harness_list(resource_type="policy_evaluation")` | Returns paginated list of policy evaluations |
| TC-pe-002 | List | Pagination - page 0, size 5 | `harness_list(resource_type="policy_evaluation", page=0, size=5)` | Returns first 5 evaluations |
| TC-pe-003 | List | Pagination - page 1 | `harness_list(resource_type="policy_evaluation", page=1, size=5)` | Returns second page of evaluations |
| TC-pe-004 | List | Filter by entity | `harness_list(resource_type="policy_evaluation", entity="<pipeline_id>")` | Returns evaluations for specific entity |
| TC-pe-005 | List | Filter by type (pipeline) | `harness_list(resource_type="policy_evaluation", type="pipeline")` | Returns evaluations for pipeline entity type |
| TC-pe-006 | List | Filter by action (onrun) | `harness_list(resource_type="policy_evaluation", action="onrun")` | Returns evaluations triggered on run |
| TC-pe-007 | List | Filter by action (onsave) | `harness_list(resource_type="policy_evaluation", action="onsave")` | Returns evaluations triggered on save |
| TC-pe-008 | List | Filter by status | `harness_list(resource_type="policy_evaluation", status="error")` | Returns evaluations with error status |
| TC-pe-009 | List | Filter by execution_id | `harness_list(resource_type="policy_evaluation", execution_id="<execution_id>")` | Returns evaluations for specific execution |
| TC-pe-010 | List | Filter by date range | `harness_list(resource_type="policy_evaluation", created_date_from="2025-01-01T00:00:00Z", created_date_to="2025-12-31T23:59:59Z")` | Returns evaluations within date range |
| TC-pe-011 | List | Include child scopes | `harness_list(resource_type="policy_evaluation", include_child_scopes="true")` | Returns evaluations including child scopes |
| TC-pe-012 | List | Combined filters | `harness_list(resource_type="policy_evaluation", type="pipeline", action="onrun", status="error")` | Returns failed pipeline onrun evaluations |
| TC-pe-013 | Get | Get evaluation by ID | `harness_get(resource_type="policy_evaluation", evaluation_id="<valid_id>")` | Returns full evaluation details with policy results |
| TC-pe-014 | Scope | Custom org and project | `harness_list(resource_type="policy_evaluation", org_id="custom_org", project_id="custom_project")` | Returns evaluations for specified scope |
| TC-pe-015 | Error | Get nonexistent evaluation | `harness_get(resource_type="policy_evaluation", evaluation_id="nonexistent")` | Returns not found error |
| TC-pe-016 | Error | Invalid date format | `harness_list(resource_type="policy_evaluation", created_date_from="not-a-date")` | Returns error or ignores invalid date |
| TC-pe-017 | Edge | Empty project (no evaluations) | `harness_list(resource_type="policy_evaluation")` on empty project | Returns empty list |
| TC-pe-018 | Describe | Resource metadata | `harness_describe(resource_type="policy_evaluation")` | Returns metadata showing list/get operations and all filter fields |

## Notes
- Read-only resource — no create, update, or delete operations
- Uses v1 API: `/pm/api/v1/evaluations`
- List uses `per_page` instead of standard `pageSize` (mapped from `size`)
- Filter fields: entity, type, action, status, execution_id, created_date_from, created_date_to, include_child_scopes
- Date filters use ISO 8601 format
- Deep link: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/governance/evaluation/{id}`
