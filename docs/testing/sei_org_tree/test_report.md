# Test Report: SEI Org Tree (`sei_org_tree`)

| Field | Value |
|-------|-------|
| **Resource Type** | `sei_org_tree` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | default |
| **Project** | SEI_AI_Prod |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-SOT-001 | List all org trees | `harness_list(resource_type="sei_org_tree")` | Returns list of SEI organizational trees | ✅ Passed | Returns org trees (tested on SEI account); database error on px7xd account | Tested on SEI-enabled account |
| TC-SOT-002 | Get a specific org tree | `harness_get(resource_type="sei_org_tree", org_tree_id="tree-1")` | Returns org tree details | ⬜ Pending | | |
| TC-SOT-003 | Verify account-level scope | `harness_list(resource_type="sei_org_tree")` | Works without org/project identifiers | ⬜ Pending | | |
| TC-SOT-004 | Get with non-existent org_tree_id | `harness_get(resource_type="sei_org_tree", org_tree_id="nonexistent")` | Returns 404 or not-found error | ⬜ Pending | | |
| TC-SOT-005 | Get without org_tree_id | `harness_get(resource_type="sei_org_tree")` | Error: missing required identifier org_tree_id | ⬜ Pending | | |
| TC-SOT-006 | Unsupported operation (create) | `harness_create(resource_type="sei_org_tree", name="new-tree")` | Error: create operation not supported | ⬜ Pending | | |
| TC-SOT-007 | Empty account with no org trees | `harness_list(resource_type="sei_org_tree")` | Returns empty items list | ⬜ Pending | | |
| TC-SOT-008 | Verify deep link in list response | `harness_list(resource_type="sei_org_tree")` | Response includes deep link to org-trees configuration | ⬜ Pending | | |
| TC-SOT-009 | Verify deep link in get response | `harness_get(resource_type="sei_org_tree", org_tree_id="tree-1")` | Response includes deep link to org-trees configuration | ⬜ Pending | | |
| TC-SOT-010 | Get org tree and verify structure | `harness_get(resource_type="sei_org_tree", org_tree_id="tree-1")` | Response contains tree structure with teams/nodes | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 10 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 9 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
