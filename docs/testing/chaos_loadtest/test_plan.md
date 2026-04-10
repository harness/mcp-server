# Test Plan: Chaos Load Test (`chaos_loadtest`)

| Field | Value |
|-------|-------|
| **Resource Type** | `chaos_loadtest` |
| **Display Name** | Chaos Load Test |
| **Toolset** | chaos |
| **Scope** | project |
| **Operations** | list, get, create, delete |
| **Execute Actions** | run, stop |
| **Identifier Fields** | loadtest_id |
| **Filter Fields** | None |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-clt-001 | List | List load tests with defaults | `harness_list(resource_type="chaos_loadtest")` | Returns paginated list of load test instances |
| TC-clt-002 | List | List with pagination | `harness_list(resource_type="chaos_loadtest", page=0, limit=5)` | Returns first 5 load tests |
| TC-clt-003 | List | List with explicit org/project | `harness_list(resource_type="chaos_loadtest", org_id="myorg", project_id="myproject")` | Returns load tests scoped to specified org/project |
| TC-clt-004 | Get | Get load test by ID | `harness_get(resource_type="chaos_loadtest", loadtest_id="<valid_id>")` | Returns load test instance details |
| TC-clt-005 | Get | Get load test with invalid ID | `harness_get(resource_type="chaos_loadtest", loadtest_id="nonexistent")` | Returns appropriate error |
| TC-clt-006 | Get | Get load test missing ID | `harness_get(resource_type="chaos_loadtest")` | Returns validation error for missing loadtest_id |
| TC-clt-007 | Create | Create load test with name | `harness_create(resource_type="chaos_loadtest", body={name: "my-load-test"})` | Creates load test, returns instance details |
| TC-clt-008 | Create | Create load test with name and type | `harness_create(resource_type="chaos_loadtest", body={name: "my-load-test", type: "HTTP"})` | Creates load test with specified type |
| TC-clt-009 | Create | Create load test missing name | `harness_create(resource_type="chaos_loadtest", body={})` | Returns validation error for missing name |
| TC-clt-010 | Delete | Delete load test by ID | `harness_delete(resource_type="chaos_loadtest", loadtest_id="<valid_id>")` | Deletes load test, returns success |
| TC-clt-011 | Delete | Delete load test with invalid ID | `harness_delete(resource_type="chaos_loadtest", loadtest_id="nonexistent")` | Returns appropriate error |
| TC-clt-012 | Execute | Run a load test | `harness_execute(resource_type="chaos_loadtest", action="run", loadtest_id="<valid_id>")` | Starts load test run, returns run details |
| TC-clt-013 | Execute | Stop a running load test | `harness_execute(resource_type="chaos_loadtest", action="stop", run_id="<valid_run_id>")` | Stops the running load test |
| TC-clt-014 | Execute | Stop with invalid run_id | `harness_execute(resource_type="chaos_loadtest", action="stop", run_id="nonexistent")` | Returns appropriate error |
| TC-clt-015 | Error | Invalid action name | `harness_execute(resource_type="chaos_loadtest", action="invalid", loadtest_id="<id>")` | Returns error about unsupported action |

## Notes
- Load test API uses standard `orgIdentifier` (no scopeParams override unlike other chaos resources)
- List/Get/Create: `/chaos/manager/api/v1/load-tests`
- Delete: `/chaos/manager/api/v1/load-tests/{loadtestId}`
- Run: POST `/chaos/manager/api/v1/load-tests/{loadtestId}/runs` (no body)
- Stop: POST `/chaos/manager/api/v1/runs/{runId}/stop` (no body)
- The `run` action uses `loadtest_id` path param; the `stop` action uses `run_id` path param
