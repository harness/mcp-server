# Test Plan: Chaos Experiment (`chaos_experiment`)

| Field | Value |
|-------|-------|
| **Resource Type** | `chaos_experiment` |
| **Display Name** | Chaos Experiment |
| **Toolset** | chaos |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | run |
| **Identifier Fields** | experiment_id |
| **Filter Fields** | None |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-ce-001 | List | List chaos experiments with defaults | `harness_list(resource_type="chaos_experiment")` | Returns paginated list of chaos experiments with name, id, and status |
| TC-ce-002 | List | List with pagination - page 0 | `harness_list(resource_type="chaos_experiment", page=0, limit=5)` | Returns first 5 experiments |
| TC-ce-003 | List | List with pagination - page 1 | `harness_list(resource_type="chaos_experiment", page=1, limit=5)` | Returns next 5 experiments |
| TC-ce-004 | List | List with explicit org and project | `harness_list(resource_type="chaos_experiment", org_id="myorg", project_id="myproject")` | Returns experiments scoped to specified org/project |
| TC-ce-005 | Get | Get experiment by ID | `harness_get(resource_type="chaos_experiment", experiment_id="<valid_id>")` | Returns experiment details including revisions and recent run details |
| TC-ce-006 | Get | Get experiment with invalid ID | `harness_get(resource_type="chaos_experiment", experiment_id="nonexistent")` | Returns appropriate error message |
| TC-ce-007 | Get | Get experiment missing required ID | `harness_get(resource_type="chaos_experiment")` | Returns validation error for missing experiment_id |
| TC-ce-008 | Execute | Run experiment with no inputs | `harness_execute(resource_type="chaos_experiment", action="run", experiment_id="<valid_id>")` | Triggers experiment run, returns run ID and status |
| TC-ce-009 | Execute | Run experiment with inputset_identity | `harness_execute(resource_type="chaos_experiment", action="run", experiment_id="<valid_id>", body={inputset_identity: "<id>"})` | Triggers experiment with specified inputset |
| TC-ce-010 | Execute | Run experiment with runtime_inputs | `harness_execute(resource_type="chaos_experiment", action="run", experiment_id="<valid_id>", body={runtime_inputs: {experiment: [{name: "var1", value: "val1"}]}})` | Triggers experiment with runtime variables |
| TC-ce-011 | Execute | Run experiment with invalid ID | `harness_execute(resource_type="chaos_experiment", action="run", experiment_id="nonexistent")` | Returns appropriate error |
| TC-ce-012 | Scope | List with wrong org | `harness_list(resource_type="chaos_experiment", org_id="invalidorg")` | Returns empty list or auth error |
| TC-ce-013 | Deep Link | Verify deep link in response | `harness_get(resource_type="chaos_experiment", experiment_id="<valid_id>")` | Response includes valid Harness UI deep link |
| TC-ce-014 | Error | Invalid action name | `harness_execute(resource_type="chaos_experiment", action="invalid_action", experiment_id="<valid_id>")` | Returns error about unsupported action |

## Notes
- Chaos API uses `organizationIdentifier` instead of `orgIdentifier` (scopeParams override)
- The run execute action sends POST to `/gateway/chaos/manager/api/rest/v2/experiments/{experimentId}/run` with `isIdentity=false` query param
- Runtime inputs structure: `{ experiment: [{name, value}], tasks: { taskName: [{name, value}] } }`
- Use `chaos_experiment_variable` list to discover required variables before running
