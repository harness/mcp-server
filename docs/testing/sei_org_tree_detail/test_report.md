# Test Report: SEI Org Tree Detail (`sei_org_tree_detail`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_org_tree_detail` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | default |
| **Project** | SEI_AI_Prod |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-SOTD-001 | Get efficiency profile for org tree | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="efficiency_profile")` | Returns efficiency profile for the org tree | ✅ Passed | Returns efficiency/productivity profiles, teams (tested on SEI account) | Tested on SEI-enabled account |
| TC-SOTD-002 | Get productivity profile | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="productivity_profile")` | Returns productivity profile for the org tree | ⬜ Pending | | |
| TC-SOTD-003 | Get business alignment profile | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="business_alignment_profile")` | Returns business alignment profile | ⬜ Pending | | |
| TC-SOTD-004 | Get org tree integrations | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="integrations")` | Returns integrations configured for the org tree | ⬜ Pending | | |
| TC-SOTD-005 | Get org tree teams | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="teams")` | Returns teams under the org tree | ⬜ Pending | | |
| TC-SOTD-006 | List org tree integrations | `harness_list(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="integrations")` | Returns list of integrations | ⬜ Pending | | |
| TC-SOTD-007 | List org tree teams | `harness_list(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="teams")` | Returns list of teams under the org tree | ⬜ Pending | | |
| TC-SOTD-008 | Default aspect (efficiency_profile) | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1")` | Defaults to efficiency_profile aspect | ⬜ Pending | | |
| TC-SOTD-009 | Verify account-level scope | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="teams")` | Works without org/project identifiers | ⬜ Pending | | |
| TC-SOTD-010 | Missing org_tree_id | `harness_get(resource_type="sei_org_tree_detail", aspect="efficiency_profile")` | Error: org_tree_id is required | ⬜ Pending | | |
| TC-SOTD-011 | Invalid aspect value | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="invalid")` | Falls back to teams or returns error | ⬜ Pending | | |
| TC-SOTD-012 | Non-existent org_tree_id | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="nonexistent", aspect="teams")` | Returns 404 or appropriate error | ⬜ Pending | | |
| TC-SOTD-013 | Verify deep link in response | `harness_get(resource_type="sei_org_tree_detail", org_tree_id="tree-1", aspect="efficiency_profile")` | Response includes deep link to org-trees configuration | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 13 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 12 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
