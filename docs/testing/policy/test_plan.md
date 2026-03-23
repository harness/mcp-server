# Test Plan: OPA Policy (`policy`)

| Field | Value |
|-------|-------|
| **Resource Type** | `policy` |
| **Display Name** | OPA Policy |
| **Toolset** | governance |
| **Scope** | project |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | None |
| **Identifier Fields** | policy_id |
| **Filter Fields** | search_term, sort, identifier_filter, exclude_rego, include_policy_set_count |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-pol-001 | List | Basic list of policies | `harness_list(resource_type="policy")` | Returns paginated list of OPA policies |
| TC-pol-002 | List | Pagination - page 0, size 5 | `harness_list(resource_type="policy", page=0, size=5)` | Returns first 5 policies |
| TC-pol-003 | List | Pagination - page 1 | `harness_list(resource_type="policy", page=1, size=5)` | Returns second page of policies |
| TC-pol-004 | List | Filter by search_term | `harness_list(resource_type="policy", search_term="pipeline")` | Returns policies matching "pipeline" |
| TC-pol-005 | List | Filter by identifier_filter | `harness_list(resource_type="policy", identifier_filter="<policy_id>")` | Returns specific policy by identifier filter |
| TC-pol-006 | List | Filter by sort | `harness_list(resource_type="policy", sort="name")` | Returns policies sorted by name |
| TC-pol-007 | List | Exclude rego from response | `harness_list(resource_type="policy", exclude_rego="true")` | Returns policies without rego source code |
| TC-pol-008 | List | Include policy set count | `harness_list(resource_type="policy", include_policy_set_count="true")` | Returns policies with count of referencing policy sets |
| TC-pol-009 | List | Combined filters | `harness_list(resource_type="policy", search_term="pipeline", exclude_rego="true")` | Returns matching policies without rego |
| TC-pol-010 | Get | Get policy by ID | `harness_get(resource_type="policy", policy_id="<valid_policy_id>")` | Returns full policy details including Rego source |
| TC-pol-011 | Create | Create policy | `harness_create(resource_type="policy", body={identifier: "test_policy", name: "Test Policy", rego: "package harness\ndefault allow = true"})` | Policy created |
| TC-pol-012 | Create | Create with git storage | `harness_create(resource_type="policy", body={identifier: "test_git_policy", name: "Git Policy", rego: "package harness", git_connector_ref: "<connector>", git_path: "policies/test.rego", git_repo: "my-repo"})` | Policy created with git connector |
| TC-pol-013 | Update | Update policy name | `harness_update(resource_type="policy", policy_id="test_policy", body={name: "Updated Policy"})` | Policy name updated |
| TC-pol-014 | Update | Update rego source | `harness_update(resource_type="policy", policy_id="test_policy", body={rego: "package harness\ndefault allow = false"})` | Rego source updated |
| TC-pol-015 | Delete | Delete policy | `harness_delete(resource_type="policy", policy_id="test_policy")` | Policy deleted |
| TC-pol-016 | Scope | Custom org and project | `harness_list(resource_type="policy", org_id="custom_org", project_id="custom_project")` | Returns policies for specified scope |
| TC-pol-017 | Error | Get nonexistent policy | `harness_get(resource_type="policy", policy_id="nonexistent")` | Returns not found error |
| TC-pol-018 | Error | Create without rego | `harness_create(resource_type="policy", body={identifier: "bad_policy", name: "Bad"})` | Returns validation error (rego required) |
| TC-pol-019 | Error | Create duplicate identifier | `harness_create(resource_type="policy", body={identifier: "<existing>", name: "Dup", rego: "package x"})` | Returns conflict error |
| TC-pol-020 | Edge | Search with no matches | `harness_list(resource_type="policy", search_term="zzz_nonexistent_zzz")` | Returns empty list |
| TC-pol-021 | Describe | Resource metadata | `harness_describe(resource_type="policy")` | Returns full metadata with create/update body schemas |

## Notes
- Uses v1 API: `/pm/api/v1/policies`
- List uses `per_page` instead of standard `pageSize` (mapped from `size`)
- Create body: identifier (required), name (required), rego (required), git_connector_ref (optional), git_path (optional), git_repo (optional)
- Update body (PATCH): name (optional), rego (optional)
- Deep link: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/governance/policies/edit/{identifier}`
- Response extractor: v1ListExtract for list, passthrough for get/create/update/delete
