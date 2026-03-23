# Test Report: Chaos Probe (`chaos_probe`)

| Field | Value |
|-------|-------|
| **Resource Type** | `chaos_probe` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-cp-001 | List chaos probes with defaults | `harness_list(resource_type="chaos_probe")` | Returns paginated list of chaos probes with totalNoOfProbes count | ✅ Passed | Returns empty list; API responds correctly |  |
| TC-cp-002 | List with pagination - page 0 | `harness_list(resource_type="chaos_probe", page=0, limit=5)` | Returns first 5 probes | ⬜ Pending | | |
| TC-cp-003 | List with pagination - page 1 | `harness_list(resource_type="chaos_probe", page=1, limit=5)` | Returns next 5 probes | ⬜ Pending | | |
| TC-cp-004 | List with explicit org and project | `harness_list(resource_type="chaos_probe", org_id="myorg", project_id="myproject")` | Returns probes scoped to specified org/project | ⬜ Pending | | |
| TC-cp-005 | Get probe by ID | `harness_get(resource_type="chaos_probe", probe_id="<valid_id>")` | Returns probe details | ⬜ Pending | | |
| TC-cp-006 | Get probe with invalid ID | `harness_get(resource_type="chaos_probe", probe_id="nonexistent")` | Returns appropriate error | ⬜ Pending | | |
| TC-cp-007 | Get probe missing required ID | `harness_get(resource_type="chaos_probe")` | Returns validation error for missing probe_id | ⬜ Pending | | |
| TC-cp-008 | List with wrong project | `harness_list(resource_type="chaos_probe", project_id="wrongproject")` | Returns empty list or error | ⬜ Pending | | |
| TC-cp-009 | List when no probes exist | `harness_list(resource_type="chaos_probe")` | Returns empty items array with total=0 | ⬜ Pending | | |
| TC-cp-010 | Attempt create (not supported) | `harness_create(resource_type="chaos_probe", body={...})` | Returns error indicating create is not supported | ⬜ Pending | | |

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
