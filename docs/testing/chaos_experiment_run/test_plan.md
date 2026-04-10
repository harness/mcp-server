# Test Plan: Chaos Experiment Run (`chaos_experiment_run`)

| Field | Value |
|-------|-------|
| **Resource Type** | `chaos_experiment_run` |
| **Display Name** | Chaos Experiment Run |
| **Toolset** | chaos |
| **Scope** | project |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | experiment_id, run_id |
| **Filter Fields** | None |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-cer-001 | Get | Get experiment run by experiment_id and run_id | `harness_get(resource_type="chaos_experiment_run", experiment_id="<valid_id>", run_id="<valid_run_id>")` | Returns run result with step-level details, resiliency score, and fault data |
| TC-cer-002 | Get | Get run with only experiment_id (missing run_id) | `harness_get(resource_type="chaos_experiment_run", experiment_id="<valid_id>")` | Returns validation error or latest run |
| TC-cer-003 | Get | Get run with invalid experiment_id | `harness_get(resource_type="chaos_experiment_run", experiment_id="nonexistent", run_id="<run_id>")` | Returns appropriate error |
| TC-cer-004 | Get | Get run with invalid run_id | `harness_get(resource_type="chaos_experiment_run", experiment_id="<valid_id>", run_id="nonexistent")` | Returns appropriate error |
| TC-cer-005 | Get | Get run missing both identifiers | `harness_get(resource_type="chaos_experiment_run")` | Returns validation error for missing experiment_id |
| TC-cer-006 | Scope | Get run with explicit org and project | `harness_get(resource_type="chaos_experiment_run", experiment_id="<valid_id>", run_id="<valid_run_id>", org_id="myorg", project_id="myproject")` | Returns run scoped to specified org/project |
| TC-cer-007 | Scope | Get run with wrong project | `harness_get(resource_type="chaos_experiment_run", experiment_id="<valid_id>", run_id="<valid_run_id>", project_id="wrongproject")` | Returns error or empty result |
| TC-cer-008 | Deep Link | Verify deep link in response | `harness_get(resource_type="chaos_experiment_run", experiment_id="<valid_id>", run_id="<valid_run_id>")` | Response includes valid Harness UI deep link to experiment |
| TC-cer-009 | Edge | Get run for a running experiment | `harness_get(resource_type="chaos_experiment_run", experiment_id="<running_id>", run_id="<active_run_id>")` | Returns partial results with in-progress status |
| TC-cer-010 | Error | Attempt list operation (not supported) | `harness_list(resource_type="chaos_experiment_run")` | Returns error indicating list is not supported |

## Notes
- Uses `organizationIdentifier` instead of `orgIdentifier` (chaos scope override)
- GET endpoint: `/chaos/manager/api/rest/v2/chaos-pipeline/{experimentId}?experimentRunId={runId}`
- The `run_id` maps to `experimentRunId` query parameter
- Response includes resiliency score, step-level fault data, and execution timeline
