# Test Report: Delegate (`delegate`)

| Field | Value |
|-------|-------|
| **Resource Type** | `delegate` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-del-001 | List all delegates with defaults | `harness_list(resource_type="delegate")` | Returns list of delegates in the account | ✅ Passed | Returns empty delegate list for project scope; API responds correctly |  |
| TC-del-002 | List all delegates including inactive | `harness_list(resource_type="delegate", filters={all: true})` | Returns all delegates including disconnected/disabled | ⬜ Pending | | |
| TC-del-003 | List delegates filtered by CONNECTED status | `harness_list(resource_type="delegate", filters={status: "CONNECTED"})` | Returns only connected delegates | ⬜ Pending | | |
| TC-del-004 | List delegates filtered by DISCONNECTED status | `harness_list(resource_type="delegate", filters={status: "DISCONNECTED"})` | Returns only disconnected delegates | ⬜ Pending | | |
| TC-del-005 | List delegates filtered by delegate_name | `harness_list(resource_type="delegate", filters={delegate_name: "k8s-delegate"})` | Returns delegates matching the specified name | ⬜ Pending | | |
| TC-del-006 | List delegates filtered by delegate_type | `harness_list(resource_type="delegate", filters={delegate_type: "KUBERNETES"})` | Returns only Kubernetes delegates | ⬜ Pending | | |
| TC-del-007 | List delegates filtered by host_name | `harness_list(resource_type="delegate", filters={host_name: "worker-node-1"})` | Returns delegates on the specified host | ⬜ Pending | | |
| TC-del-008 | List delegates filtered by delegate_group_identifier | `harness_list(resource_type="delegate", filters={delegate_group_identifier: "my-delegate-group"})` | Returns delegates in the specified group | ⬜ Pending | | |
| TC-del-009 | List delegates filtered by description | `harness_list(resource_type="delegate", filters={description: "production"})` | Returns delegates with "production" in description | ⬜ Pending | | |
| TC-del-010 | List delegates with combined filters | `harness_list(resource_type="delegate", filters={status: "CONNECTED", delegate_name: "prod"})` | Returns connected delegates matching name filter | ⬜ Pending | | |
| TC-del-011 | List delegates with org/project scope | `harness_list(resource_type="delegate", org_id="default", project_id="my_project")` | Returns delegates scoped to the specified org/project | ⬜ Pending | | |
| TC-del-012 | List delegates filtered by auto_upgrade | `harness_list(resource_type="delegate", filters={auto_upgrade: "ON"})` | Returns delegates with auto-upgrade enabled | ⬜ Pending | | |
| TC-del-013 | List delegates filtered by version_status | `harness_list(resource_type="delegate", filters={version_status: "OUTDATED"})` | Returns delegates with outdated versions | ⬜ Pending | | |
| TC-del-014 | List delegates with invalid status | `harness_list(resource_type="delegate", filters={status: "INVALID_STATUS"})` | Error or empty results for invalid status | ⬜ Pending | | |
| TC-del-015 | List delegates with empty results | `harness_list(resource_type="delegate", filters={delegate_name: "zzz_nonexistent_zzz"})` | Returns empty items array | ⬜ Pending | | |
| TC-del-016 | List delegates filtered by ENABLED status | `harness_list(resource_type="delegate", filters={status: "ENABLED"})` | Returns only enabled delegates | ⬜ Pending | | |
| TC-del-017 | List delegates filtered by delegate_instance_filter | `harness_list(resource_type="delegate", filters={delegate_instance_filter: "instance-1"})` | Returns delegates matching instance filter | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 17 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 16 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

_(To be filled during testing)_
