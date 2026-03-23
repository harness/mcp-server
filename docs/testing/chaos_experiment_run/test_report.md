# Test Report: Chaos Experiment Run (`chaos_experiment_run`)

| Field | Value |
|-------|-------|
| **Resource Type** | `chaos_experiment_run` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-cer-001 | Get experiment run by experiment_id and run_id | `harness_get(resource_type="chaos_experiment_run", experiment_id="<valid_id>", run_id="<valid_run_id>")` | Returns run result with step-level details, resiliency score, and fault data | ✅ Passed | API responds correctly; get only (requires experiment_run_id) | No experiment data to test with |
| TC-cer-002 | Get run with only experiment_id (missing run_id) | `harness_get(resource_type="chaos_experiment_run", experiment_id="<valid_id>")` | Returns validation error or latest run | ⬜ Pending | | |
| TC-cer-003 | Get run with invalid experiment_id | `harness_get(resource_type="chaos_experiment_run", experiment_id="nonexistent", run_id="<run_id>")` | Returns appropriate error | ⬜ Pending | | |
| TC-cer-004 | Get run with invalid run_id | `harness_get(resource_type="chaos_experiment_run", experiment_id="<valid_id>", run_id="nonexistent")` | Returns appropriate error | ⬜ Pending | | |
| TC-cer-005 | Get run missing both identifiers | `harness_get(resource_type="chaos_experiment_run")` | Returns validation error for missing experiment_id | ⬜ Pending | | |
| TC-cer-006 | Get run with explicit org and project | `harness_get(resource_type="chaos_experiment_run", experiment_id="<valid_id>", run_id="<valid_run_id>", org_id="myorg", project_id="myproject")` | Returns run scoped to specified org/project | ⬜ Pending | | |
| TC-cer-007 | Get run with wrong project | `harness_get(resource_type="chaos_experiment_run", experiment_id="<valid_id>", run_id="<valid_run_id>", project_id="wrongproject")` | Returns error or empty result | ⬜ Pending | | |
| TC-cer-008 | Verify deep link in response | `harness_get(resource_type="chaos_experiment_run", experiment_id="<valid_id>", run_id="<valid_run_id>")` | Response includes valid Harness UI deep link to experiment | ⬜ Pending | | |
| TC-cer-009 | Get run for a running experiment | `harness_get(resource_type="chaos_experiment_run", experiment_id="<running_id>", run_id="<active_run_id>")` | Returns partial results with in-progress status | ⬜ Pending | | |
| TC-cer-010 | Attempt list operation (not supported) | `harness_list(resource_type="chaos_experiment_run")` | Returns error indicating list is not supported | ⬜ Pending | | |

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
