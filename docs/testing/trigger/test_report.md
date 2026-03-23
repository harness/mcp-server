# Test Report: Pipeline Trigger (`trigger`)

| Field | Value |
|-------|-------|
| **Resource Type** | `trigger` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-trig-001 | List all triggers with defaults | `harness_list(resource_type="trigger")` | Returns paginated list of pipeline triggers | ✅ Passed | Returns empty list (requires pipeline_id filter); API responds correctly with {items:[], total:0} | Requires pipeline_id filter |
| TC-trig-002 | List triggers with pagination | `harness_list(resource_type="trigger", page=1, size=5)` | Returns page 1 with up to 5 triggers | ⬜ Pending | | |
| TC-trig-003 | List triggers filtered by pipeline_id | `harness_list(resource_type="trigger", filters={pipeline_id: "my_pipeline"})` | Returns triggers only for the specified pipeline | ⬜ Pending | | |
| TC-trig-004 | List triggers filtered by search_term | `harness_list(resource_type="trigger", filters={search_term: "webhook"})` | Returns triggers matching "webhook" keyword | ⬜ Pending | | |
| TC-trig-005 | List triggers with combined filters | `harness_list(resource_type="trigger", filters={pipeline_id: "my_pipeline", search_term: "cron"}, page=0, size=10)` | Returns cron triggers for the specified pipeline | ⬜ Pending | | |
| TC-trig-006 | List triggers with scope override | `harness_list(resource_type="trigger", org_id="custom_org", project_id="custom_project")` | Returns triggers from specified org/project | ⬜ Pending | | |
| TC-trig-007 | Get trigger by identifier | `harness_get(resource_type="trigger", resource_id="my_trigger", params={pipeline_id: "my_pipeline"})` | Returns full trigger details | ⬜ Pending | | |
| TC-trig-008 | Get trigger with scope override | `harness_get(resource_type="trigger", resource_id="my_trigger", params={pipeline_id: "my_pipeline"}, org_id="other_org", project_id="other_project")` | Returns trigger from specified org/project | ⬜ Pending | | |
| TC-trig-009 | Create a webhook trigger | `harness_create(resource_type="trigger", params={pipeline_id: "my_pipeline"}, body={trigger: {name: "My Webhook", identifier: "my_webhook", enabled: true, pipelineIdentifier: "my_pipeline", type: "Webhook", source: {type: "Webhook", spec: {type: "Github", spec: {type: "Push"}}}}})` | Trigger created successfully | ⬜ Pending | | |
| TC-trig-010 | Create a scheduled (cron) trigger | `harness_create(resource_type="trigger", params={pipeline_id: "my_pipeline"}, body={trigger: {name: "Nightly Build", identifier: "nightly_build", enabled: true, pipelineIdentifier: "my_pipeline", type: "Scheduled", source: {type: "Scheduled", spec: {type: "Cron", spec: {expression: "0 0 * * *"}}}}})` | Scheduled trigger created | ⬜ Pending | | |
| TC-trig-011 | Create trigger with auto-wrap (no trigger envelope) | `harness_create(resource_type="trigger", params={pipeline_id: "my_pipeline"}, body={name: "AutoWrap", identifier: "auto_wrap", enabled: true, pipelineIdentifier: "my_pipeline", type: "Webhook", source: {type: "Webhook", spec: {type: "Github", spec: {type: "Push"}}}})` | Trigger created with auto-wrapped body | ⬜ Pending | | |
| TC-trig-012 | Create trigger with inputYaml | `harness_create(resource_type="trigger", params={pipeline_id: "my_pipeline"}, body={trigger: {name: "WithInputs", identifier: "with_inputs", enabled: true, pipelineIdentifier: "my_pipeline", type: "Webhook", source: {type: "Webhook", spec: {type: "Github", spec: {type: "Push"}}}, inputYaml: "pipeline:\n  variables:\n    - name: env\n      value: prod"}})` | Trigger created with runtime input YAML | ⬜ Pending | | |
| TC-trig-013 | Update trigger configuration | `harness_update(resource_type="trigger", resource_id="my_trigger", params={pipeline_id: "my_pipeline"}, body={trigger: {name: "Updated Trigger", identifier: "my_trigger", enabled: false, pipelineIdentifier: "my_pipeline", type: "Webhook", source: {type: "Webhook", spec: {type: "Github", spec: {type: "Push"}}}}})` | Trigger updated successfully | ⬜ Pending | | |
| TC-trig-014 | Disable a trigger | `harness_update(resource_type="trigger", resource_id="my_trigger", params={pipeline_id: "my_pipeline"}, body={trigger: {name: "My Trigger", identifier: "my_trigger", enabled: false, pipelineIdentifier: "my_pipeline", type: "Webhook", source: {type: "Webhook", spec: {type: "Github", spec: {type: "Push"}}}}})` | Trigger disabled (enabled=false) | ⬜ Pending | | |
| TC-trig-015 | Delete trigger by identifier | `harness_delete(resource_type="trigger", resource_id="my_trigger")` | Trigger deleted successfully | ⬜ Pending | | |
| TC-trig-016 | Delete trigger with scope override | `harness_delete(resource_type="trigger", resource_id="my_trigger", org_id="other_org", project_id="other_project")` | Trigger deleted from specified org/project | ⬜ Pending | | |
| TC-trig-017 | Get trigger with invalid identifier | `harness_get(resource_type="trigger", resource_id="nonexistent_trigger", params={pipeline_id: "my_pipeline"})` | Error: Trigger not found (404) | ⬜ Pending | | |
| TC-trig-018 | Create trigger with missing pipeline_id | `harness_create(resource_type="trigger", body={trigger: {name: "No Pipeline", identifier: "no_pipeline", type: "Webhook"}})` | Error: pipeline_id is required | ⬜ Pending | | |
| TC-trig-019 | Create trigger in unauthorized project | `harness_create(resource_type="trigger", org_id="no_access_org", project_id="no_access_project", params={pipeline_id: "p"}, body={trigger: {name: "X", identifier: "x", pipelineIdentifier: "p", type: "Webhook", source: {}}})` | Error: Unauthorized (401/403) | ⬜ Pending | | |
| TC-trig-020 | List triggers with empty results | `harness_list(resource_type="trigger", filters={pipeline_id: "pipeline_with_no_triggers"})` | Returns empty items array with total=0 | ⬜ Pending | | |
| TC-trig-021 | List triggers with max pagination | `harness_list(resource_type="trigger", page=0, size=100)` | Returns up to 100 triggers | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 21 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 20 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses

_(To be filled during testing)_
