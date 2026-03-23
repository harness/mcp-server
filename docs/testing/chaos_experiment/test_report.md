# Test Report: Chaos Experiment (`chaos_experiment`)

| Field | Value |
|-------|-------|
| **Resource Type** | `chaos_experiment` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-ce-001 | List chaos experiments with defaults | `harness_list(resource_type="chaos_experiment")` | Returns paginated list of chaos experiments with name, id, and status | ✅ Passed | Returns empty list (no chaos experiments); API responds correctly |  |
| TC-ce-002 | List with pagination - page 0 | `harness_list(resource_type="chaos_experiment", page=0, limit=5)` | Returns first 5 experiments | ⬜ Pending | | |
| TC-ce-003 | List with pagination - page 1 | `harness_list(resource_type="chaos_experiment", page=1, limit=5)` | Returns next 5 experiments | ⬜ Pending | | |
| TC-ce-004 | List with explicit org and project | `harness_list(resource_type="chaos_experiment", org_id="myorg", project_id="myproject")` | Returns experiments scoped to specified org/project | ⬜ Pending | | |
| TC-ce-005 | Get experiment by ID | `harness_get(resource_type="chaos_experiment", experiment_id="<valid_id>")` | Returns experiment details including revisions and recent run details | ⬜ Pending | | |
| TC-ce-006 | Get experiment with invalid ID | `harness_get(resource_type="chaos_experiment", experiment_id="nonexistent")` | Returns appropriate error message | ⬜ Pending | | |
| TC-ce-007 | Get experiment missing required ID | `harness_get(resource_type="chaos_experiment")` | Returns validation error for missing experiment_id | ⬜ Pending | | |
| TC-ce-008 | Run experiment with no inputs | `harness_execute(resource_type="chaos_experiment", action="run", experiment_id="<valid_id>")` | Triggers experiment run, returns run ID and status | ⬜ Pending | | |
| TC-ce-009 | Run experiment with inputset_identity | `harness_execute(resource_type="chaos_experiment", action="run", experiment_id="<valid_id>", body={inputset_identity: "<id>"})` | Triggers experiment with specified inputset | ⬜ Pending | | |
| TC-ce-010 | Run experiment with runtime_inputs | `harness_execute(resource_type="chaos_experiment", action="run", experiment_id="<valid_id>", body={runtime_inputs: {experiment: [{name: "var1", value: "val1"}]}})` | Triggers experiment with runtime variables | ⬜ Pending | | |
| TC-ce-011 | Run experiment with invalid ID | `harness_execute(resource_type="chaos_experiment", action="run", experiment_id="nonexistent")` | Returns appropriate error | ⬜ Pending | | |
| TC-ce-012 | List with wrong org | `harness_list(resource_type="chaos_experiment", org_id="invalidorg")` | Returns empty list or auth error | ⬜ Pending | | |
| TC-ce-013 | Verify deep link in response | `harness_get(resource_type="chaos_experiment", experiment_id="<valid_id>")` | Response includes valid Harness UI deep link | ⬜ Pending | | |
| TC-ce-014 | Invalid action name | `harness_execute(resource_type="chaos_experiment", action="invalid_action", experiment_id="<valid_id>")` | Returns error about unsupported action | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 14 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 13 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
