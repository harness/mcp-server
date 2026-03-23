# Test Report: OPA Policy (`policy`)

| Field | Value |
|-------|-------|
| **Resource Type** | `policy` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-pol-001 | Basic list of policies | `harness_list(resource_type="policy")` | Returns paginated list of OPA policies | ✅ Passed | Returns 1 policy (mcp_test_policy) with identifier, name, deep link |  |
| TC-pol-002 | Pagination - page 0, size 5 | `harness_list(resource_type="policy", page=0, size=5)` | Returns first 5 policies | ⬜ Pending | | |
| TC-pol-003 | Pagination - page 1 | `harness_list(resource_type="policy", page=1, size=5)` | Returns second page of policies | ⬜ Pending | | |
| TC-pol-004 | Filter by search_term | `harness_list(resource_type="policy", search_term="pipeline")` | Returns policies matching "pipeline" | ⬜ Pending | | |
| TC-pol-005 | Filter by identifier_filter | `harness_list(resource_type="policy", identifier_filter="<policy_id>")` | Returns specific policy by identifier filter | ⬜ Pending | | |
| TC-pol-006 | Filter by sort | `harness_list(resource_type="policy", sort="name")` | Returns policies sorted by name | ⬜ Pending | | |
| TC-pol-007 | Exclude rego from response | `harness_list(resource_type="policy", exclude_rego="true")` | Returns policies without rego source code | ⬜ Pending | | |
| TC-pol-008 | Include policy set count | `harness_list(resource_type="policy", include_policy_set_count="true")` | Returns policies with count of referencing policy sets | ⬜ Pending | | |
| TC-pol-009 | Combined filters | `harness_list(resource_type="policy", search_term="pipeline", exclude_rego="true")` | Returns matching policies without rego | ⬜ Pending | | |
| TC-pol-010 | Get policy by ID | `harness_get(resource_type="policy", policy_id="<valid_policy_id>")` | Returns full policy details including Rego source | ⬜ Pending | | |
| TC-pol-011 | Create policy | `harness_create(resource_type="policy", body={identifier: "test_policy", name: "Test Policy", rego: "package harness\ndefault allow = true"})` | Policy created | ⬜ Pending | | |
| TC-pol-012 | Create with git storage | `harness_create(resource_type="policy", body={identifier: "test_git_policy", name: "Git Policy", rego: "package harness", git_connector_ref: "<connector>", git_path: "policies/test.rego", git_repo: "my-repo"})` | Policy created with git connector | ⬜ Pending | | |
| TC-pol-013 | Update policy name | `harness_update(resource_type="policy", policy_id="test_policy", body={name: "Updated Policy"})` | Policy name updated | ⬜ Pending | | |
| TC-pol-014 | Update rego source | `harness_update(resource_type="policy", policy_id="test_policy", body={rego: "package harness\ndefault allow = false"})` | Rego source updated | ⬜ Pending | | |
| TC-pol-015 | Delete policy | `harness_delete(resource_type="policy", policy_id="test_policy")` | Policy deleted | ⬜ Pending | | |
| TC-pol-016 | Custom org and project | `harness_list(resource_type="policy", org_id="custom_org", project_id="custom_project")` | Returns policies for specified scope | ⬜ Pending | | |
| TC-pol-017 | Get nonexistent policy | `harness_get(resource_type="policy", policy_id="nonexistent")` | Returns not found error | ⬜ Pending | | |
| TC-pol-018 | Create without rego | `harness_create(resource_type="policy", body={identifier: "bad_policy", name: "Bad"})` | Returns validation error (rego required) | ⬜ Pending | | |
| TC-pol-019 | Create duplicate identifier | `harness_create(resource_type="policy", body={identifier: "<existing>", name: "Dup", rego: "package x"})` | Returns conflict error | ⬜ Pending | | |
| TC-pol-020 | Search with no matches | `harness_list(resource_type="policy", search_term="zzz_nonexistent_zzz")` | Returns empty list | ⬜ Pending | | |
| TC-pol-021 | Resource metadata | `harness_describe(resource_type="policy")` | Returns full metadata with create/update body schemas | ⬜ Pending | | |

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
