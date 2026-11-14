# Issue 003: `harness_delete` OperationPolicy Risk Bypass & `README.md` Toolset Coverage Drift

**Status:** In Progress (`fix/registry-taxonomy-and-dispatch-guardrails`)
**Date:** 2026-11-13
**Related:** `src/tools/harness-delete.ts`, `scripts/generate-docs.js`, `README.md`

---

## 1. Problem Statement

### 1.1 `harness_delete` Hardcodes `risk: "destructive"` Instead of Reading `operationPolicy.risk`

In `src/tools/harness-create.ts:65`, `src/tools/harness-update.ts:87`, and `src/tools/harness-execute.ts:232`, the tool handler reads the endpoint's declared `operationPolicy.risk`:

```ts
const risk = def.operations.create!.operationPolicy.risk;
```

In `src/tools/harness-delete.ts:96-103`, however, `confirmViaElicitation` was called with a hardcoded `risk: "destructive"`:

```ts
const elicit = await confirmViaElicitation({
  server,
  toolName: "harness_delete",
  message: `Delete ${args.resource_type} "${resolvedResourceId}"?\n\nThis is destructive and cannot be undone.`,
  risk: "destructive", // <-- ignores def.operations.delete!.operationPolicy.risk
  autoApproveRisk: config.HARNESS_AUTO_APPROVE_RISK,
  callerConfirmed: args.confirm === true,
});
```

Meanwhile, `Registry.emitAuditEvent` (`src/registry/index.ts:692`) records `spec.operationPolicy?.risk ?? "read"`, creating a discrepancy between the risk level enforced at elicitation time (`HARNESS_AUTO_APPROVE_RISK` comparison) and the risk level declared on `def.operations.delete.operationPolicy.risk` (and emitted to audit logs).

### 1.2 `README.md` Toolset Filtering Table Drift (15 of 50 Toolsets Out of Sync)

`scripts/generate-docs.js` (`README_COVERAGE_TOOLSETS`) previously only validated `README.md` table rows for **6 of the 50 toolsets** (`connectors`, `feature-flags`, `file_store`, `chaos`, `release-management`, `vibe`).

Auditing all 50 toolsets in `ALL_TOOLSETS` against the `Toolset Filtering` table in `README.md` found **15 toolsets out of sync** on `main`:

- **5 toolsets completely missing from the `README.md` Toolset Filtering table:**
  - `registries-firewall` (`artifact_scan_v3, bulk_scan_evaluation_v3, firewall_exception_v3, firewall_exception_version_v3`)
  - `incidents` (`incident`)
  - `alerts` (`alert`)
  - `deploys` (`deploy`)
  - `runbooks` (`runbook, runbook_execution`)
- **10 toolsets with stale or missing resource types in `README.md`:**
  - `registries-v3`: still listed `artifact_scan_v3, bulk_scan_evaluation_v3, firewall_exception_v3, firewall_exception_version_v3` (which moved to `registries-firewall` in #1590)
  - `agents`: listed non-existent `agent_run`
  - `pipelines`: missing `runtime_input_template, pipeline_resolved_yaml, runtime_input_template_v1`
  - `registries`: missing `quarantine`
  - `templates`: missing `template_v1`
  - `idp`: missing `idp_score_summary`
  - `ccm`: missing 12 resource types (`cost_perspective_folder`, `cost_anomaly_drilldown`, `cost_budget`, `cost_budget_variance`, `cost_budget_group`, `cost_recommendation_filter`, `cost_recommendation_count`, `unit_metric`, `ai_budget`, `ai_budget_overview`, `ai_budget_consumption`, `ai_budget_override_request`)
  - `scs`: missing 12 resource types (`scs_component_search`, `scs_component_dependencies`, `scs_bom_violation`, `scs_component_remediation`, `scs_remediation_pr`, `scs_auto_pr_config`, `scs_component_enrichment`, `scs_component_vulnerability`, `scs_oss_risk_summary`, `scs_project_security_overview`, `scs_sbom_drift`, `scs_component_drift`)
  - `sto`: missing `pipeline_security_issue, pipeline_security_step, security_exemption_bulk`
  - `dbops`: missing `database_changeset_existence, database_default_authoring_instance, database_execute_llm_authoring_pipeline`

---

## 2. Solution Implemented in This Branch

1. **`src/tools/harness-delete.ts`:** Read `const risk = def.operations.delete!.operationPolicy.risk;` and pass `risk` to `confirmViaElicitation`, matching `harness_create`, `harness_update`, and `harness_execute`.
2. **`scripts/generate-docs.js` & `README.md`:**
   - Validate the `Toolset Filtering` table row in `README.md` for **every** toolset in `ALL_TOOLSETS` (both default and opt-in), not just the 6 matrix-covered toolsets.
   - Sync all 50 toolset rows in `README.md` so `pnpm docs:check` enforces 100% toolset-to-resource accuracy in CI.
