# Test Plan: Chaos Experiment Variable (`chaos_experiment_variable`)

| Field | Value |
|-------|-------|
| **Resource Type** | `chaos_experiment_variable` |
| **Display Name** | Chaos Experiment Variable |
| **Toolset** | chaos |
| **Scope** | project |
| **Operations** | list |
| **Execute Actions** | None |
| **Identifier Fields** | experiment_id |
| **Filter Fields** | None |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-cev-001 | List | List variables for an experiment | `harness_list(resource_type="chaos_experiment_variable", experiment_id="<valid_id>")` | Returns experiment-level and task-level variables |
| TC-cev-002 | List | List variables with explicit org/project | `harness_list(resource_type="chaos_experiment_variable", experiment_id="<valid_id>", org_id="myorg", project_id="myproject")` | Returns variables scoped to specified org/project |
| TC-cev-003 | List | List variables for experiment with no variables | `harness_list(resource_type="chaos_experiment_variable", experiment_id="<no_vars_id>")` | Returns empty variables list |
| TC-cev-004 | List | List variables missing experiment_id | `harness_list(resource_type="chaos_experiment_variable")` | Returns validation error for missing experiment_id |
| TC-cev-005 | List | List variables with invalid experiment_id | `harness_list(resource_type="chaos_experiment_variable", experiment_id="nonexistent")` | Returns appropriate error |
| TC-cev-006 | Scope | List with wrong project | `harness_list(resource_type="chaos_experiment_variable", experiment_id="<valid_id>", project_id="wrongproject")` | Returns error or empty result |
| TC-cev-007 | Deep Link | Verify deep link in response | `harness_list(resource_type="chaos_experiment_variable", experiment_id="<valid_id>")` | Response includes valid Harness UI deep link to experiment |
| TC-cev-008 | Error | Attempt get (not supported) | `harness_get(resource_type="chaos_experiment_variable", experiment_id="<valid_id>")` | Returns error indicating get is not supported |
| TC-cev-009 | Edge | Variables for multi-fault experiment | `harness_list(resource_type="chaos_experiment_variable", experiment_id="<multi_fault_id>")` | Returns both experiment-level and per-task variables |

## Notes
- Chaos API uses `organizationIdentifier` instead of `orgIdentifier` (scopeParams override)
- Endpoint: `/chaos/manager/api/rest/v2/experiments/{experimentId}/variables?isIdentity=false`
- The `isIdentity=false` static query param is always sent
- Variables are used to discover required runtime inputs before running a chaos experiment via `chaos_experiment` run action
- Response structure includes both experiment-level variables and task-level variables organized by task name
