# Test Report: Pipeline (`pipeline`)

| Field | Value |
|-------|-------|
| **Resource Type** | `pipeline` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-pipeline-001 | List all pipelines with defaults | `harness_list(resource_type="pipeline")` | Returns paginated list of pipelines with items array and total count | ✅ Passed | Returns paginated list of 262 pipelines with name, identifier, tags, deep links |  |
| TC-pipeline-002 | List pipelines with pagination | `harness_list(resource_type="pipeline", page=1, size=5)` | Returns page 1 with up to 5 pipelines | ⬜ Pending | | |
| TC-pipeline-003 | List pipelines filtered by search_term | `harness_list(resource_type="pipeline", filters={search_term: "deploy"})` | Returns only pipelines matching "deploy" keyword | ⬜ Pending | | |
| TC-pipeline-004 | List pipelines filtered by module CD | `harness_list(resource_type="pipeline", filters={module: "CD"})` | Returns only CD module pipelines | ⬜ Pending | | |
| TC-pipeline-005 | List pipelines filtered by module CI | `harness_list(resource_type="pipeline", filters={module: "CI"})` | Returns only CI module pipelines | ⬜ Pending | | |
| TC-pipeline-006 | List pipelines with filter_type | `harness_list(resource_type="pipeline", filters={filter_type: "PipelineSetup"})` | Returns pipelines with PipelineSetup filter type | ⬜ Pending | | |
| TC-pipeline-007 | List pipelines with combined filters | `harness_list(resource_type="pipeline", filters={search_term: "build", module: "CI"}, page=0, size=10)` | Returns CI pipelines matching "build" with pagination | ⬜ Pending | | |
| TC-pipeline-008 | List pipelines with scope override | `harness_list(resource_type="pipeline", org_id="custom_org", project_id="custom_project")` | Returns pipelines from the specified org/project | ⬜ Pending | | |
| TC-pipeline-009 | Get pipeline by identifier | `harness_get(resource_type="pipeline", resource_id="my_pipeline")` | Returns full pipeline details including YAML definition | ⬜ Pending | | |
| TC-pipeline-010 | Get pipeline with branch parameter | `harness_get(resource_type="pipeline", resource_id="my_pipeline", params={branch: "develop"})` | Returns pipeline YAML from the develop branch | ⬜ Pending | | |
| TC-pipeline-011 | Get pipeline with scope override | `harness_get(resource_type="pipeline", resource_id="my_pipeline", org_id="other_org", project_id="other_project")` | Returns pipeline from specified org/project | ⬜ Pending | | |
| TC-pipeline-012 | Create pipeline with YAML string | `harness_create(resource_type="pipeline", body={yamlPipeline: "pipeline:\n  name: Test\n  identifier: test_pipeline\n  stages: []"})` | Pipeline created successfully, returns pipeline identifier | ⬜ Pending | | |
| TC-pipeline-013 | Create pipeline with JSON object | `harness_create(resource_type="pipeline", body={pipeline: {name: "Test Pipeline", identifier: "test_pipeline", stages: []}})` | Pipeline created successfully with JSON body | ⬜ Pending | | |
| TC-pipeline-014 | Create pipeline stored in remote Git | `harness_create(resource_type="pipeline", body={yamlPipeline: "pipeline:\n  name: Test\n  identifier: test_remote"}, params={store_type: "REMOTE", connector_ref: "git_conn", repo_name: "my-repo", branch: "main", file_path: ".harness/test.yaml"})` | Pipeline created and stored in remote Git repo | ⬜ Pending | | |
| TC-pipeline-015 | Create pipeline in Harness Code repo | `harness_create(resource_type="pipeline", body={yamlPipeline: "pipeline:\n  name: Test\n  identifier: test_hc"}, params={store_type: "REMOTE", is_harness_code_repo: true, repo_name: "my-repo", branch: "main", file_path: ".harness/test.yaml"})` | Pipeline created in Harness Code repo | ⬜ Pending | | |
| TC-pipeline-016 | Create pipeline with missing body | `harness_create(resource_type="pipeline", body={})` | Error: body must include either yamlPipeline or pipeline | ⬜ Pending | | |
| TC-pipeline-017 | Update pipeline with YAML string | `harness_update(resource_type="pipeline", resource_id="my_pipeline", body={yamlPipeline: "pipeline:\n  name: Updated\n  identifier: my_pipeline\n  stages: []"})` | Pipeline updated successfully | ⬜ Pending | | |
| TC-pipeline-018 | Update pipeline with conflict detection params | `harness_update(resource_type="pipeline", resource_id="my_pipeline", body={yamlPipeline: "pipeline:\n  name: Updated\n  identifier: my_pipeline"}, params={last_object_id: "abc123", last_commit_id: "def456"})` | Pipeline updated with conflict detection | ⬜ Pending | | |
| TC-pipeline-019 | Update remote pipeline | `harness_update(resource_type="pipeline", resource_id="my_pipeline", body={yamlPipeline: "..."}, params={store_type: "REMOTE", connector_ref: "git_conn", repo_name: "repo", branch: "main", file_path: ".harness/p.yaml", commit_msg: "update pipeline"})` | Remote pipeline updated with git commit | ⬜ Pending | | |
| TC-pipeline-020 | Update pipeline with invalid body | `harness_update(resource_type="pipeline", resource_id="my_pipeline", body={})` | Error: body must include either pipeline or yamlPipeline | ⬜ Pending | | |
| TC-pipeline-021 | Delete pipeline by identifier | `harness_delete(resource_type="pipeline", resource_id="my_pipeline")` | Pipeline deleted successfully | ⬜ Pending | | |
| TC-pipeline-022 | Delete pipeline with scope override | `harness_delete(resource_type="pipeline", resource_id="my_pipeline", org_id="other_org", project_id="other_project")` | Pipeline deleted from specified org/project | ⬜ Pending | | |
| TC-pipeline-023 | Run pipeline with no inputs | `harness_execute(resource_type="pipeline", action="run", pipeline_id="my_pipeline")` | Pipeline execution started, returns executionId and status | ⬜ Pending | | |
| TC-pipeline-024 | Run pipeline with simple key-value inputs | `harness_execute(resource_type="pipeline", action="run", pipeline_id="my_pipeline", body={inputs: {branch: "main", env: "prod"}})` | Pipeline execution started with resolved runtime inputs | ⬜ Pending | | |
| TC-pipeline-025 | Run pipeline with input_set_ids | `harness_execute(resource_type="pipeline", action="run", pipeline_id="my_pipeline", body={input_set_ids: ["input_set_1", "input_set_2"]})` | Pipeline execution started using input sets | ⬜ Pending | | |
| TC-pipeline-026 | Run pipeline with module param | `harness_execute(resource_type="pipeline", action="run", pipeline_id="my_pipeline", params={module: "CD"})` | Pipeline execution started with CD module context | ⬜ Pending | | |
| TC-pipeline-027 | Run pipeline with branch param | `harness_execute(resource_type="pipeline", action="run", pipeline_id="my_pipeline", params={branch: "develop"})` | Pipeline execution started from develop branch | ⬜ Pending | | |
| TC-pipeline-028 | Retry a failed execution | `harness_execute(resource_type="pipeline", action="retry", execution_id="exec_abc123")` | Failed execution retried, returns new executionId | ⬜ Pending | | |
| TC-pipeline-029 | Import pipeline from external Git | `harness_execute(resource_type="pipeline", action="import", body={pipelineName: "Imported Pipeline", pipelineDescription: "From Git"}, params={connector_ref: "git_conn", repo_name: "my-repo", branch: "main", file_path: ".harness/pipeline.yaml"})` | Pipeline imported from Git repo | ⬜ Pending | | |
| TC-pipeline-030 | Import pipeline from Harness Code | `harness_execute(resource_type="pipeline", action="import", body={pipelineName: "HC Pipeline"}, params={is_harness_code_repo: true, repo_name: "my-repo", branch: "main", file_path: ".harness/pipeline.yaml"})` | Pipeline imported from Harness Code repo | ⬜ Pending | | |
| TC-pipeline-031 | Force import pipeline | `harness_execute(resource_type="pipeline", action="import", body={pipelineName: "Force Import"}, params={connector_ref: "git_conn", repo_name: "repo", branch: "main", file_path: "p.yaml", is_force_import: true})` | Pipeline force-imported, overwriting existing | ⬜ Pending | | |
| TC-pipeline-032 | Get pipeline with invalid identifier | `harness_get(resource_type="pipeline", resource_id="nonexistent_pipeline_xyz")` | Error: Pipeline not found (404) | ⬜ Pending | | |
| TC-pipeline-033 | List pipelines with invalid module | `harness_list(resource_type="pipeline", filters={module: "INVALID"})` | Error or empty results for invalid module | ⬜ Pending | | |
| TC-pipeline-034 | Create pipeline in unauthorized project | `harness_create(resource_type="pipeline", org_id="no_access_org", project_id="no_access_project", body={yamlPipeline: "pipeline:\n  name: X\n  identifier: x"})` | Error: Unauthorized or forbidden (401/403) | ⬜ Pending | | |
| TC-pipeline-035 | List pipelines with empty results | `harness_list(resource_type="pipeline", org_id="empty_org", project_id="empty_project")` | Returns empty items array with total=0 | ⬜ Pending | | |
| TC-pipeline-036 | List pipelines with max pagination | `harness_list(resource_type="pipeline", page=0, size=100)` | Returns up to 100 pipelines in single page | ⬜ Pending | | |
| TC-pipeline-037 | Get pipeline with special characters in params | `harness_get(resource_type="pipeline", resource_id="pipeline-with-dashes_and_underscores")` | Returns pipeline with special characters in identifier | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 37 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 36 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

_(To be filled during testing)_
