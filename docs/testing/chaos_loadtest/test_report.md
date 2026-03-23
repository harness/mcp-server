# Test Report: Chaos Load Test (`chaos_loadtest`)

| Field | Value |
|-------|-------|
| **Resource Type** | `chaos_loadtest` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-clt-001 | List load tests with defaults | `harness_list(resource_type="chaos_loadtest")` | Returns paginated list of load test instances | ✅ Passed | Returns 1 load test (MCP Test Load Test) with environment/infra identifiers |  |
| TC-clt-002 | List with pagination | `harness_list(resource_type="chaos_loadtest", page=0, limit=5)` | Returns first 5 load tests | ⬜ Pending | | |
| TC-clt-003 | List with explicit org/project | `harness_list(resource_type="chaos_loadtest", org_id="myorg", project_id="myproject")` | Returns load tests scoped to specified org/project | ⬜ Pending | | |
| TC-clt-004 | Get load test by ID | `harness_get(resource_type="chaos_loadtest", loadtest_id="<valid_id>")` | Returns load test instance details | ⬜ Pending | | |
| TC-clt-005 | Get load test with invalid ID | `harness_get(resource_type="chaos_loadtest", loadtest_id="nonexistent")` | Returns appropriate error | ⬜ Pending | | |
| TC-clt-006 | Get load test missing ID | `harness_get(resource_type="chaos_loadtest")` | Returns validation error for missing loadtest_id | ⬜ Pending | | |
| TC-clt-007 | Create load test with name | `harness_create(resource_type="chaos_loadtest", body={name: "my-load-test"})` | Creates load test, returns instance details | ⬜ Pending | | |
| TC-clt-008 | Create load test with name and type | `harness_create(resource_type="chaos_loadtest", body={name: "my-load-test", type: "HTTP"})` | Creates load test with specified type | ⬜ Pending | | |
| TC-clt-009 | Create load test missing name | `harness_create(resource_type="chaos_loadtest", body={})` | Returns validation error for missing name | ⬜ Pending | | |
| TC-clt-010 | Delete load test by ID | `harness_delete(resource_type="chaos_loadtest", loadtest_id="<valid_id>")` | Deletes load test, returns success | ⬜ Pending | | |
| TC-clt-011 | Delete load test with invalid ID | `harness_delete(resource_type="chaos_loadtest", loadtest_id="nonexistent")` | Returns appropriate error | ⬜ Pending | | |
| TC-clt-012 | Run a load test | `harness_execute(resource_type="chaos_loadtest", action="run", loadtest_id="<valid_id>")` | Starts load test run, returns run details | ⬜ Pending | | |
| TC-clt-013 | Stop a running load test | `harness_execute(resource_type="chaos_loadtest", action="stop", run_id="<valid_run_id>")` | Stops the running load test | ⬜ Pending | | |
| TC-clt-014 | Stop with invalid run_id | `harness_execute(resource_type="chaos_loadtest", action="stop", run_id="nonexistent")` | Returns appropriate error | ⬜ Pending | | |
| TC-clt-015 | Invalid action name | `harness_execute(resource_type="chaos_loadtest", action="invalid", loadtest_id="<id>")` | Returns error about unsupported action | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 15 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 14 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
