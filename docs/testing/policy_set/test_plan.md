# Test Plan: OPA Policy Set (`policy_set`)

| Field | Value |
|-------|-------|
| **Resource Type** | `policy_set` |
| **Display Name** | OPA Policy Set |
| **Toolset** | governance |
| **Scope** | project |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | None |
| **Identifier Fields** | policy_set_id |
| **Filter Fields** | search_term, type, action, sort, identifier_filter |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-ps-001 | List | Basic list of policy sets | `harness_list(resource_type="policy_set")` | Returns paginated list of OPA policy sets |
| TC-ps-002 | List | Pagination - page 0, size 5 | `harness_list(resource_type="policy_set", page=0, size=5)` | Returns first 5 policy sets |
| TC-ps-003 | List | Pagination - page 1 | `harness_list(resource_type="policy_set", page=1, size=5)` | Returns second page of policy sets |
| TC-ps-004 | List | Filter by search_term | `harness_list(resource_type="policy_set", search_term="pipeline")` | Returns policy sets matching "pipeline" |
| TC-ps-005 | List | Filter by type (pipeline) | `harness_list(resource_type="policy_set", type="pipeline")` | Returns policy sets for pipeline entity type |
| TC-ps-006 | List | Filter by type (connector) | `harness_list(resource_type="policy_set", type="connector")` | Returns policy sets for connector entity type |
| TC-ps-007 | List | Filter by action (onrun) | `harness_list(resource_type="policy_set", action="onrun")` | Returns policy sets with onrun enforcement |
| TC-ps-008 | List | Filter by action (onsave) | `harness_list(resource_type="policy_set", action="onsave")` | Returns policy sets with onsave enforcement |
| TC-ps-009 | List | Filter by identifier_filter | `harness_list(resource_type="policy_set", identifier_filter="<ps_id>")` | Returns specific policy set |
| TC-ps-010 | List | Filter by sort | `harness_list(resource_type="policy_set", sort="name")` | Returns policy sets sorted by name |
| TC-ps-011 | List | Combined filters | `harness_list(resource_type="policy_set", type="pipeline", action="onrun")` | Returns pipeline policy sets with onrun action |
| TC-ps-012 | Get | Get policy set by ID | `harness_get(resource_type="policy_set", policy_set_id="<valid_id>")` | Returns full policy set details |
| TC-ps-013 | Create | Create policy set | `harness_create(resource_type="policy_set", body={identifier: "test_ps", name: "Test Policy Set", action: "onrun", type: "pipeline", enabled: true})` | Policy set created |
| TC-ps-014 | Create | Create with policies | `harness_create(resource_type="policy_set", body={identifier: "test_ps_pol", name: "PS With Policies", action: "onrun", type: "pipeline", enabled: true, policies: [{identifier: "<policy_id>", severity: "error"}]})` | Policy set created with linked policies |
| TC-ps-015 | Create | Create disabled | `harness_create(resource_type="policy_set", body={identifier: "test_ps_off", name: "Disabled PS", action: "onsave", type: "connector", enabled: false, description: "Disabled for testing"})` | Disabled policy set created |
| TC-ps-016 | Update | Update policy set name | `harness_update(resource_type="policy_set", policy_set_id="test_ps", body={name: "Updated PS"})` | Policy set name updated |
| TC-ps-017 | Update | Enable/disable policy set | `harness_update(resource_type="policy_set", policy_set_id="test_ps_off", body={enabled: true})` | Policy set enabled |
| TC-ps-018 | Update | Update policies list | `harness_update(resource_type="policy_set", policy_set_id="test_ps", body={policies: [{identifier: "<policy_id>", severity: "warning"}]})` | Linked policies updated |
| TC-ps-019 | Delete | Delete policy set | `harness_delete(resource_type="policy_set", policy_set_id="test_ps")` | Policy set deleted |
| TC-ps-020 | Scope | Custom org and project | `harness_list(resource_type="policy_set", org_id="custom_org", project_id="custom_project")` | Returns policy sets for specified scope |
| TC-ps-021 | Error | Get nonexistent policy set | `harness_get(resource_type="policy_set", policy_set_id="nonexistent")` | Returns not found error |
| TC-ps-022 | Error | Create without required fields | `harness_create(resource_type="policy_set", body={identifier: "bad_ps", name: "Bad"})` | Returns validation error (action, type, enabled required) |
| TC-ps-023 | Edge | Search with no matches | `harness_list(resource_type="policy_set", search_term="zzz_nonexistent_zzz")` | Returns empty list |
| TC-ps-024 | Describe | Resource metadata | `harness_describe(resource_type="policy_set")` | Returns full metadata with create/update body schemas |

## Notes
- Uses v1 API: `/pm/api/v1/policysets`
- List uses `per_page` instead of standard `pageSize` (mapped from `size`)
- Create body: identifier (required), name (required), action (required), type (required), enabled (required), description (optional), policies (optional array of {identifier, severity}), yaml_version (optional)
- Update body (PATCH): name, action, type, enabled, description, policies, resource_groups, entity_selector — all optional
- action values: onrun, onsave, onpush, etc.
- type values: pipeline, connector, service, environment, etc.
- policies array items: `{ identifier: string, severity: 'warning' | 'error' }`
- Deep link: `/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/governance/policy-sets/{identifier}`
