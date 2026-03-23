# Test Plan: Input Set (`input_set`)

| Field | Value |
|-------|-------|
| **Resource Type** | `input_set` |
| **Display Name** | Input Set |
| **Toolset** | pipelines |
| **Scope** | project |
| **Operations** | list, get |
| **Execute Actions** | None |
| **Identifier Fields** | pipeline_id, input_set_id |
| **Filter Fields** | pipeline_id |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-iset-001 | List | List all input sets with defaults | `harness_list(resource_type="input_set")` | Returns paginated list of input sets |
| TC-iset-002 | List | List input sets with pagination | `harness_list(resource_type="input_set", page=1, size=5)` | Returns page 1 with up to 5 input sets |
| TC-iset-003 | List | List input sets filtered by pipeline_id | `harness_list(resource_type="input_set", filters={pipeline_id: "my_pipeline"})` | Returns input sets only for the specified pipeline |
| TC-iset-004 | List | List input sets with scope override | `harness_list(resource_type="input_set", org_id="custom_org", project_id="custom_project")` | Returns input sets from specified org/project |
| TC-iset-005 | List | List input sets with pipeline_id and pagination | `harness_list(resource_type="input_set", filters={pipeline_id: "my_pipeline"}, page=0, size=10)` | Returns paginated input sets for specified pipeline |
| TC-iset-006 | Get | Get input set by identifier | `harness_get(resource_type="input_set", resource_id="my_input_set", params={pipeline_id: "my_pipeline"})` | Returns full input set details |
| TC-iset-007 | Get | Get input set with scope override | `harness_get(resource_type="input_set", resource_id="my_input_set", params={pipeline_id: "my_pipeline"}, org_id="other_org", project_id="other_project")` | Returns input set from specified org/project |
| TC-iset-008 | Error | Get input set with invalid identifier | `harness_get(resource_type="input_set", resource_id="nonexistent_input_set", params={pipeline_id: "my_pipeline"})` | Error: Input set not found (404) |
| TC-iset-009 | Error | List input sets with invalid pipeline_id | `harness_list(resource_type="input_set", filters={pipeline_id: "nonexistent_pipeline"})` | Error or empty results |
| TC-iset-010 | Error | Get input set from unauthorized project | `harness_get(resource_type="input_set", resource_id="my_input_set", params={pipeline_id: "my_pipeline"}, org_id="no_access_org", project_id="no_access_project")` | Error: Unauthorized (401/403) |
| TC-iset-011 | Edge | List input sets with empty results | `harness_list(resource_type="input_set", filters={pipeline_id: "pipeline_with_no_input_sets"})` | Returns empty items array with total=0 |
| TC-iset-012 | Edge | List input sets with max pagination | `harness_list(resource_type="input_set", page=0, size=100)` | Returns up to 100 input sets |

## Notes
- Input sets are scoped to a specific pipeline — `pipeline_id` is a key filter/param
- Both `list` and `get` require `pipeline_id` (as filter for list, as query param for get)
- Input sets contain reusable runtime input values for pipeline executions
- Referenced when executing pipelines via `input_set_ids` parameter
