# Test Plan: Chaos Experiment Template (`chaos_experiment_template`)

| Field | Value |
|-------|-------|
| **Resource Type** | `chaos_experiment_template` |
| **Display Name** | Chaos Experiment Template |
| **Toolset** | chaos |
| **Scope** | project |
| **Operations** | list |
| **Execute Actions** | create_from_template |
| **Identifier Fields** | template_id |
| **Filter Fields** | hub_identity, infrastructure_type |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-cet-001 | List | List templates with hub_identity | `harness_list(resource_type="chaos_experiment_template", hub_identity="<hub_id>")` | Returns paginated list of experiment templates for the specified hub |
| TC-cet-002 | List | List with pagination | `harness_list(resource_type="chaos_experiment_template", hub_identity="<hub_id>", page=0, limit=5)` | Returns first 5 templates |
| TC-cet-003 | List | List with infrastructure_type filter | `harness_list(resource_type="chaos_experiment_template", hub_identity="<hub_id>", infrastructure_type="Kubernetes")` | Returns only Kubernetes templates |
| TC-cet-004 | List | List with infrastructure_type=Linux | `harness_list(resource_type="chaos_experiment_template", hub_identity="<hub_id>", infrastructure_type="Linux")` | Returns only Linux templates |
| TC-cet-005 | List | List with combined filters | `harness_list(resource_type="chaos_experiment_template", hub_identity="<hub_id>", infrastructure_type="Kubernetes", page=0, limit=10)` | Returns filtered and paginated templates |
| TC-cet-006 | List | List without hub_identity | `harness_list(resource_type="chaos_experiment_template")` | Returns error or empty — hub_identity is required |
| TC-cet-007 | Execute | Create experiment from template | `harness_execute(resource_type="chaos_experiment_template", action="create_from_template", template_id="<id>", body={name: "my-experiment", infra_ref: "envId/infraId", hub_identity: "<hub_id>"})` | Creates experiment from template, returns experiment details |
| TC-cet-008 | Execute | Create from template with identity | `harness_execute(resource_type="chaos_experiment_template", action="create_from_template", template_id="<id>", body={name: "my-experiment", identity: "my-exp-identity", infra_ref: "envId/infraId", hub_identity: "<hub_id>"})` | Creates experiment with custom identity |
| TC-cet-009 | Execute | Create from template missing name | `harness_execute(resource_type="chaos_experiment_template", action="create_from_template", template_id="<id>", body={infra_ref: "envId/infraId", hub_identity: "<hub_id>"})` | Returns validation error for missing name |
| TC-cet-010 | Execute | Create from template missing infra_ref | `harness_execute(resource_type="chaos_experiment_template", action="create_from_template", template_id="<id>", body={name: "test", hub_identity: "<hub_id>"})` | Returns validation error for missing infra_ref |
| TC-cet-011 | Execute | Create from template missing hub_identity | `harness_execute(resource_type="chaos_experiment_template", action="create_from_template", template_id="<id>", body={name: "test", infra_ref: "envId/infraId"})` | Returns validation error for missing hub_identity |
| TC-cet-012 | Scope | List with explicit org and project | `harness_list(resource_type="chaos_experiment_template", hub_identity="<hub_id>", org_id="myorg", project_id="myproject")` | Returns templates scoped to specified org/project |
| TC-cet-013 | Error | Attempt get (not supported) | `harness_get(resource_type="chaos_experiment_template", template_id="<id>")` | Returns error indicating get is not supported |
| TC-cet-014 | Error | Invalid action name | `harness_execute(resource_type="chaos_experiment_template", action="invalid", template_id="<id>")` | Returns error about unsupported action |

## Notes
- Chaos API uses `organizationIdentifier` instead of `orgIdentifier` (scopeParams override)
- `hub_identity` is effectively required for listing templates
- `infra_ref` must be in format `environmentId/infraId`
- List endpoint: `/gateway/chaos/manager/api/rest/experimenttemplates`
- Create endpoint: `/gateway/chaos/manager/api/rest/experimenttemplates/{templateId}/launch`
- The `hub_identity` query parameter maps to `hubIdentity` in the API
