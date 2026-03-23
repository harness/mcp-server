# Test Plan: Pipeline Architecture Diagram (`visual_architecture`)

| Field | Value |
|-------|-------|
| **Resource Type** | `visual_architecture` |
| **Display Name** | Pipeline Architecture Diagram |
| **Toolset** | visualizations |
| **Scope** | project |
| **Operations** | _(none — virtual resource type)_ |
| **Execute Actions** | None |
| **Identifier Fields** | _(none)_ |
| **Filter Fields** | _(none)_ |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-va-001 | Render | Architecture diagram for pipeline | `harness_diagnose(pipeline_id="<valid_id>", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Returns JSON diagnosis data and inline PNG architecture diagram |
| TC-va-002 | Render | Multi-level hierarchy | `harness_diagnose(pipeline_id="<complex_pipeline>", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Shows Pipeline → Stages → Step Groups → Steps hierarchy |
| TC-va-003 | Render | Stage type badges | `harness_diagnose(pipeline_id="<mixed_pipeline>", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Stages show type badges: CI, Deployment, Approval |
| TC-va-004 | Render | Deployment stage details | `harness_diagnose(pipeline_id="<deploy_pipeline>", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Shows strategy (Canary/Rolling/BlueGreen), service ref, environment ref, infrastructure type |
| TC-va-005 | Render | Step details | `harness_diagnose(pipeline_id="<valid_id>", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Steps show type and timeout |
| TC-va-006 | Render | Rollback steps | `harness_diagnose(pipeline_id="<pipeline_with_rollback>", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Rollback steps shown in separate red-highlighted section |
| TC-va-007 | Render | With execution context | `harness_diagnose(execution_id="<valid_id>", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Architecture diagram from execution's pipeline |
| TC-va-008 | Render | Custom visual_width | `harness_diagnose(pipeline_id="<valid_id>", options={include_visual: true, visual_type: "architecture", include_yaml: true, visual_width: 1200})` | Returns wider architecture diagram |
| TC-va-009 | Render | Without include_yaml | `harness_diagnose(pipeline_id="<valid_id>", options={include_visual: true, visual_type: "architecture"})` | May return limited or no diagram (YAML needed for parsing) |
| TC-va-010 | Error | Invalid pipeline_id | `harness_diagnose(pipeline_id="nonexistent", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Returns meaningful error |
| TC-va-011 | Error | Missing pipeline/execution ID | `harness_diagnose(options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Returns error indicating pipeline_id required |
| TC-va-012 | Scope | Custom org and project | `harness_diagnose(pipeline_id="<id>", org_id="custom_org", project_id="custom_project", options={include_visual: true, visual_type: "architecture", include_yaml: true})` | Returns architecture for specified scope |
| TC-va-013 | Describe | Resource metadata | `harness_describe(resource_type="visual_architecture")` | Returns metadata with diagnosticHint explaining usage |

## Notes
- Virtual resource type — no direct API operations; rendered locally from pipeline YAML
- Invoked via `harness_diagnose` with `include_visual: true`, `visual_type: "architecture"`, and `include_yaml: true`
- The `include_yaml: true` option fetches the pipeline YAML which is parsed into the diagram
- Multi-level architecture diagram: Pipeline → Stages (with type badge) → Step Groups → Steps (with type + timeout)
- For Deployment stages: shows strategy, service ref, environment ref, infrastructure type
- Rollback steps shown in separate red-highlighted section
- Failure strategy handling is visualized
- Response includes both JSON diagnosis data and an inline PNG architecture diagram
