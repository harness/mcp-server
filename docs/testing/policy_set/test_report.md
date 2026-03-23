# Test Report: OPA Policy Set (`policy_set`)

| Field | Value |
|-------|-------|
| **Resource Type** | `policy_set` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-ps-001 | Basic list of policy sets | `harness_list(resource_type="policy_set")` | Returns paginated list of OPA policy sets | ✅ Passed | Returns 1 policy set (mcp_test_policy_set) with type, enabled flag, deep link |  |
| TC-ps-002 | Pagination - page 0, size 5 | `harness_list(resource_type="policy_set", page=0, size=5)` | Returns first 5 policy sets | ⬜ Pending | | |
| TC-ps-003 | Pagination - page 1 | `harness_list(resource_type="policy_set", page=1, size=5)` | Returns second page of policy sets | ⬜ Pending | | |
| TC-ps-004 | Filter by search_term | `harness_list(resource_type="policy_set", search_term="pipeline")` | Returns policy sets matching "pipeline" | ⬜ Pending | | |
| TC-ps-005 | Filter by type (pipeline) | `harness_list(resource_type="policy_set", type="pipeline")` | Returns policy sets for pipeline entity type | ⬜ Pending | | |
| TC-ps-006 | Filter by type (connector) | `harness_list(resource_type="policy_set", type="connector")` | Returns policy sets for connector entity type | ⬜ Pending | | |
| TC-ps-007 | Filter by action (onrun) | `harness_list(resource_type="policy_set", action="onrun")` | Returns policy sets with onrun enforcement | ⬜ Pending | | |
| TC-ps-008 | Filter by action (onsave) | `harness_list(resource_type="policy_set", action="onsave")` | Returns policy sets with onsave enforcement | ⬜ Pending | | |
| TC-ps-009 | Filter by identifier_filter | `harness_list(resource_type="policy_set", identifier_filter="<ps_id>")` | Returns specific policy set | ⬜ Pending | | |
| TC-ps-010 | Filter by sort | `harness_list(resource_type="policy_set", sort="name")` | Returns policy sets sorted by name | ⬜ Pending | | |
| TC-ps-011 | Combined filters | `harness_list(resource_type="policy_set", type="pipeline", action="onrun")` | Returns pipeline policy sets with onrun action | ⬜ Pending | | |
| TC-ps-012 | Get policy set by ID | `harness_get(resource_type="policy_set", policy_set_id="<valid_id>")` | Returns full policy set details | ⬜ Pending | | |
| TC-ps-013 | Create policy set | `harness_create(resource_type="policy_set", body={identifier: "test_ps", name: "Test Policy Set", action: "onrun", type: "pipeline", enabled: true})` | Policy set created | ⬜ Pending | | |
| TC-ps-014 | Create with policies | `harness_create(resource_type="policy_set", body={..., policies: [{identifier: "<policy_id>", severity: "error"}]})` | Policy set created with linked policies | ⬜ Pending | | |
| TC-ps-015 | Create disabled | `harness_create(resource_type="policy_set", body={..., enabled: false, description: "Disabled for testing"})` | Disabled policy set created | ⬜ Pending | | |
| TC-ps-016 | Update policy set name | `harness_update(resource_type="policy_set", policy_set_id="test_ps", body={name: "Updated PS"})` | Policy set name updated | ⬜ Pending | | |
| TC-ps-017 | Enable/disable policy set | `harness_update(resource_type="policy_set", policy_set_id="test_ps_off", body={enabled: true})` | Policy set enabled | ⬜ Pending | | |
| TC-ps-018 | Update policies list | `harness_update(resource_type="policy_set", policy_set_id="test_ps", body={policies: [{identifier: "<policy_id>", severity: "warning"}]})` | Linked policies updated | ⬜ Pending | | |
| TC-ps-019 | Delete policy set | `harness_delete(resource_type="policy_set", policy_set_id="test_ps")` | Policy set deleted | ⬜ Pending | | |
| TC-ps-020 | Custom org and project | `harness_list(resource_type="policy_set", org_id="custom_org", project_id="custom_project")` | Returns policy sets for specified scope | ⬜ Pending | | |
| TC-ps-021 | Get nonexistent policy set | `harness_get(resource_type="policy_set", policy_set_id="nonexistent")` | Returns not found error | ⬜ Pending | | |
| TC-ps-022 | Create without required fields | `harness_create(resource_type="policy_set", body={identifier: "bad_ps", name: "Bad"})` | Returns validation error (action, type, enabled required) | ⬜ Pending | | |
| TC-ps-023 | Search with no matches | `harness_list(resource_type="policy_set", search_term="zzz_nonexistent_zzz")` | Returns empty list | ⬜ Pending | | |
| TC-ps-024 | Resource metadata | `harness_describe(resource_type="policy_set")` | Returns full metadata with create/update body schemas | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 24 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 23 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
