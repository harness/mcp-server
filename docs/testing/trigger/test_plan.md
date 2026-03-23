# Test Plan: Pipeline Trigger (`trigger`)

| Field | Value |
|-------|-------|
| **Resource Type** | `trigger` |
| **Display Name** | Pipeline Trigger |
| **Toolset** | pipelines |
| **Scope** | project |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | None |
| **Identifier Fields** | pipeline_id, trigger_id |
| **Filter Fields** | pipeline_id, search_term |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-trig-001 | List | List all triggers with defaults | `harness_list(resource_type="trigger")` | Returns paginated list of pipeline triggers |
| TC-trig-002 | List | List triggers with pagination | `harness_list(resource_type="trigger", page=1, size=5)` | Returns page 1 with up to 5 triggers |
| TC-trig-003 | List | List triggers filtered by pipeline_id | `harness_list(resource_type="trigger", filters={pipeline_id: "my_pipeline"})` | Returns triggers only for the specified pipeline |
| TC-trig-004 | List | List triggers filtered by search_term | `harness_list(resource_type="trigger", filters={search_term: "webhook"})` | Returns triggers matching "webhook" keyword |
| TC-trig-005 | List | List triggers with combined filters | `harness_list(resource_type="trigger", filters={pipeline_id: "my_pipeline", search_term: "cron"}, page=0, size=10)` | Returns cron triggers for the specified pipeline |
| TC-trig-006 | List | List triggers with scope override | `harness_list(resource_type="trigger", org_id="custom_org", project_id="custom_project")` | Returns triggers from specified org/project |
| TC-trig-007 | Get | Get trigger by identifier | `harness_get(resource_type="trigger", resource_id="my_trigger", params={pipeline_id: "my_pipeline"})` | Returns full trigger details |
| TC-trig-008 | Get | Get trigger with scope override | `harness_get(resource_type="trigger", resource_id="my_trigger", params={pipeline_id: "my_pipeline"}, org_id="other_org", project_id="other_project")` | Returns trigger from specified org/project |
| TC-trig-009 | Create | Create a webhook trigger | `harness_create(resource_type="trigger", params={pipeline_id: "my_pipeline"}, body={trigger: {name: "My Webhook", identifier: "my_webhook", enabled: true, pipelineIdentifier: "my_pipeline", type: "Webhook", source: {type: "Webhook", spec: {type: "Github", spec: {type: "Push"}}}}})` | Trigger created successfully |
| TC-trig-010 | Create | Create a scheduled (cron) trigger | `harness_create(resource_type="trigger", params={pipeline_id: "my_pipeline"}, body={trigger: {name: "Nightly Build", identifier: "nightly_build", enabled: true, pipelineIdentifier: "my_pipeline", type: "Scheduled", source: {type: "Scheduled", spec: {type: "Cron", spec: {expression: "0 0 * * *"}}}}})` | Scheduled trigger created |
| TC-trig-011 | Create | Create trigger with auto-wrap (no trigger envelope) | `harness_create(resource_type="trigger", params={pipeline_id: "my_pipeline"}, body={name: "AutoWrap", identifier: "auto_wrap", enabled: true, pipelineIdentifier: "my_pipeline", type: "Webhook", source: {type: "Webhook", spec: {type: "Github", spec: {type: "Push"}}}})` | Trigger created with auto-wrapped body |
| TC-trig-012 | Create | Create trigger with inputYaml | `harness_create(resource_type="trigger", params={pipeline_id: "my_pipeline"}, body={trigger: {name: "WithInputs", identifier: "with_inputs", enabled: true, pipelineIdentifier: "my_pipeline", type: "Webhook", source: {type: "Webhook", spec: {type: "Github", spec: {type: "Push"}}}, inputYaml: "pipeline:\n  variables:\n    - name: env\n      value: prod"}})` | Trigger created with runtime input YAML |
| TC-trig-013 | Update | Update trigger configuration | `harness_update(resource_type="trigger", resource_id="my_trigger", params={pipeline_id: "my_pipeline"}, body={trigger: {name: "Updated Trigger", identifier: "my_trigger", enabled: false, pipelineIdentifier: "my_pipeline", type: "Webhook", source: {type: "Webhook", spec: {type: "Github", spec: {type: "Push"}}}}})` | Trigger updated successfully |
| TC-trig-014 | Update | Disable a trigger | `harness_update(resource_type="trigger", resource_id="my_trigger", params={pipeline_id: "my_pipeline"}, body={trigger: {name: "My Trigger", identifier: "my_trigger", enabled: false, pipelineIdentifier: "my_pipeline", type: "Webhook", source: {type: "Webhook", spec: {type: "Github", spec: {type: "Push"}}}}})` | Trigger disabled (enabled=false) |
| TC-trig-015 | Delete | Delete trigger by identifier | `harness_delete(resource_type="trigger", resource_id="my_trigger")` | Trigger deleted successfully |
| TC-trig-016 | Delete | Delete trigger with scope override | `harness_delete(resource_type="trigger", resource_id="my_trigger", org_id="other_org", project_id="other_project")` | Trigger deleted from specified org/project |
| TC-trig-017 | Error | Get trigger with invalid identifier | `harness_get(resource_type="trigger", resource_id="nonexistent_trigger", params={pipeline_id: "my_pipeline"})` | Error: Trigger not found (404) |
| TC-trig-018 | Error | Create trigger with missing pipeline_id | `harness_create(resource_type="trigger", body={trigger: {name: "No Pipeline", identifier: "no_pipeline", type: "Webhook"}})` | Error: pipeline_id is required |
| TC-trig-019 | Error | Create trigger in unauthorized project | `harness_create(resource_type="trigger", org_id="no_access_org", project_id="no_access_project", params={pipeline_id: "p"}, body={trigger: {name: "X", identifier: "x", pipelineIdentifier: "p", type: "Webhook", source: {}}})` | Error: Unauthorized (401/403) |
| TC-trig-020 | Edge | List triggers with empty results | `harness_list(resource_type="trigger", filters={pipeline_id: "pipeline_with_no_triggers"})` | Returns empty items array with total=0 |
| TC-trig-021 | Edge | List triggers with max pagination | `harness_list(resource_type="trigger", page=0, size=100)` | Returns up to 100 triggers |

## Notes
- Trigger CRUD requires `pipeline_id` to identify the target pipeline
- The body is auto-wrapped in `{ trigger: { ... } }` if the `trigger` key is not present
- `pipelineIdentifier` in the body is auto-extracted and mapped to the `targetIdentifier` query param
- Supported trigger types: Webhook, Scheduled, Artifact, Manifest
- The `inputYaml` field provides runtime inputs for triggered executions
