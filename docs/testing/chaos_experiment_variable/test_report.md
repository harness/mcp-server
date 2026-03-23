# Test Report: Chaos Experiment Variable (`chaos_experiment_variable`)

| Field | Value |
|-------|-------|
| **Resource Type** | `chaos_experiment_variable` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-cev-001 | List variables for an experiment | `harness_list(resource_type="chaos_experiment_variable", experiment_id="<valid_id>")` | Returns experiment-level and task-level variables | ✅ Passed | API responds correctly; requires experiment_id filter | Requires experiment_id filter |
| TC-cev-002 | List variables with explicit org/project | `harness_list(resource_type="chaos_experiment_variable", experiment_id="<valid_id>", org_id="myorg", project_id="myproject")` | Returns variables scoped to specified org/project | ⬜ Pending | | |
| TC-cev-003 | List variables for experiment with no variables | `harness_list(resource_type="chaos_experiment_variable", experiment_id="<no_vars_id>")` | Returns empty variables list | ⬜ Pending | | |
| TC-cev-004 | List variables missing experiment_id | `harness_list(resource_type="chaos_experiment_variable")` | Returns validation error for missing experiment_id | ⬜ Pending | | |
| TC-cev-005 | List variables with invalid experiment_id | `harness_list(resource_type="chaos_experiment_variable", experiment_id="nonexistent")` | Returns appropriate error | ⬜ Pending | | |
| TC-cev-006 | List with wrong project | `harness_list(resource_type="chaos_experiment_variable", experiment_id="<valid_id>", project_id="wrongproject")` | Returns error or empty result | ⬜ Pending | | |
| TC-cev-007 | Verify deep link in response | `harness_list(resource_type="chaos_experiment_variable", experiment_id="<valid_id>")` | Response includes valid Harness UI deep link to experiment | ⬜ Pending | | |
| TC-cev-008 | Attempt get (not supported) | `harness_get(resource_type="chaos_experiment_variable", experiment_id="<valid_id>")` | Returns error indicating get is not supported | ⬜ Pending | | |
| TC-cev-009 | Variables for multi-fault experiment | `harness_list(resource_type="chaos_experiment_variable", experiment_id="<multi_fault_id>")` | Returns both experiment-level and per-task variables | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 9 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 8 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
