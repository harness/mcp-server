# Test Report: Chaos Experiment Template (`chaos_experiment_template`)

| Field | Value |
|-------|-------|
| **Resource Type** | `chaos_experiment_template` |
| **Date** | 2026-03-23 |
| **Tester** | MCP Automated Test |
| **Account ID** | px7xd_BFRCi-pfWPYXVjvw |
| **Org** | AI_Devops |
| **Project** | Sanity |

## Test Results

| Test ID | Description | Prompt | Expected Result | Status | Actual Result | Notes |
|---------|-------------|--------|-----------------|--------|---------------|-------|
| TC-cet-001 | List templates with hub_identity | `harness_list(resource_type="chaos_experiment_template", hub_identity="<hub_id>")` | Returns paginated list of experiment templates for the specified hub | ✅ Passed | Returns empty list; API responds correctly |  |
| TC-cet-002 | List with pagination | `harness_list(resource_type="chaos_experiment_template", hub_identity="<hub_id>", page=0, limit=5)` | Returns first 5 templates | ⬜ Pending | | |
| TC-cet-003 | List with infrastructure_type=Kubernetes | `harness_list(resource_type="chaos_experiment_template", hub_identity="<hub_id>", infrastructure_type="Kubernetes")` | Returns only Kubernetes templates | ⬜ Pending | | |
| TC-cet-004 | List with infrastructure_type=Linux | `harness_list(resource_type="chaos_experiment_template", hub_identity="<hub_id>", infrastructure_type="Linux")` | Returns only Linux templates | ⬜ Pending | | |
| TC-cet-005 | List with combined filters | `harness_list(resource_type="chaos_experiment_template", hub_identity="<hub_id>", infrastructure_type="Kubernetes", page=0, limit=10)` | Returns filtered and paginated templates | ⬜ Pending | | |
| TC-cet-006 | List without hub_identity | `harness_list(resource_type="chaos_experiment_template")` | Returns error or empty — hub_identity is required | ⬜ Pending | | |
| TC-cet-007 | Create experiment from template | `harness_execute(resource_type="chaos_experiment_template", action="create_from_template", template_id="<id>", body={name: "my-experiment", infra_ref: "envId/infraId", hub_identity: "<hub_id>"})` | Creates experiment from template, returns experiment details | ⬜ Pending | | |
| TC-cet-008 | Create from template with identity | `harness_execute(resource_type="chaos_experiment_template", action="create_from_template", template_id="<id>", body={name: "my-experiment", identity: "my-exp-identity", infra_ref: "envId/infraId", hub_identity: "<hub_id>"})` | Creates experiment with custom identity | ⬜ Pending | | |
| TC-cet-009 | Create from template missing name | `harness_execute(resource_type="chaos_experiment_template", action="create_from_template", template_id="<id>", body={infra_ref: "envId/infraId", hub_identity: "<hub_id>"})` | Returns validation error for missing name | ⬜ Pending | | |
| TC-cet-010 | Create from template missing infra_ref | `harness_execute(resource_type="chaos_experiment_template", action="create_from_template", template_id="<id>", body={name: "test", hub_identity: "<hub_id>"})` | Returns validation error for missing infra_ref | ⬜ Pending | | |
| TC-cet-011 | Create from template missing hub_identity | `harness_execute(resource_type="chaos_experiment_template", action="create_from_template", template_id="<id>", body={name: "test", infra_ref: "envId/infraId"})` | Returns validation error for missing hub_identity | ⬜ Pending | | |
| TC-cet-012 | List with explicit org and project | `harness_list(resource_type="chaos_experiment_template", hub_identity="<hub_id>", org_id="myorg", project_id="myproject")` | Returns templates scoped to specified org/project | ⬜ Pending | | |
| TC-cet-013 | Attempt get (not supported) | `harness_get(resource_type="chaos_experiment_template", template_id="<id>")` | Returns error indicating get is not supported | ⬜ Pending | | |
| TC-cet-014 | Invalid action name | `harness_execute(resource_type="chaos_experiment_template", action="invalid", template_id="<id>")` | Returns error about unsupported action | ⬜ Pending | | |

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 14 |
| ✅ Passed | 1 |
| ❌ Failed | 0 |
| ⚠️ Blocked | 0 |
| ⬜ Not Run | 13 |

## Issues Found

| Issue ID | Severity | Description | Test ID | Status |
|----------|----------|-------------|---------|--------|

## Sample Responses
_(To be filled during testing)_
