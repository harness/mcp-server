/**
 * Runtime contract checks for ResourceDefinition and EndpointSpec fields
 * required by docs/coding-standards.md.
 */
import { describe, it, expect, vi } from "vitest";
import {
  Registry,
  ALL_TOOLSET_NAMES,
  DEPRECATED_RESOURCE_TYPE_ALIASES,
  NAV_DOMAIN_RESOURCE_ALIASES,
  PREFERRED_RESOURCE_TYPE_NAMES,
  TOOLSET_ALIASES,
  TOOLSET_GROUP_ALIASES,
} from "../../src/registry/index.js";
import type { ResourceScope, ToolsetDefinition } from "../../src/registry/types.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { AuditEvent } from "../../src/audit/types.js";
import type { AuditManager } from "../../src/audit/manager.js";
import { passthrough } from "../../src/registry/extractors.js";

const VALID_SCOPES = new Set<ResourceScope>(["account", "org", "project"]);

const MINIMAL_CONFIG = {
  HARNESS_API_KEY: "pat.testaccount.testtoken.testsecret",
  HARNESS_BASE_URL: "https://app.harness.io",
  HARNESS_TOOLSETS: ALL_TOOLSET_NAMES.map((name) => `+${name}`).join(","),
} as const;

/**
 * Legacy resource types with a route-version suffix (_v1, _v3).
 * Per docs/coding-standards.md §13, new resource types must not encode backend
 * URL route versions unless a prior resource with the exact same name coexists.
 */
const ALLOWED_VERSION_SUFFIXED_RESOURCES = new Set([
  "pipeline_v1",
  "runtime_input_template_v1",
  "template_v1",
]);

/**
 * Legacy resource types that have 0 CRUD operations and only 1 execute action.
 * Per docs/coding-standards.md §13, new actions must be registered under
 * `executeActions` on their parent resource type instead of as standalone types.
 */
const ALLOWED_SINGLE_ACTION_EXECUTE_ONLY_RESOURCES = new Set([
  "pipeline_dynamic_execution",
  "scs_sbom_drift",
  "database_execute_llm_authoring_pipeline",
  "online_eval",
  "eval_git_registration",
]);

/**
 * Per-toolset ceiling of single-operation (`operations + executeActions <= 1`)
 * resource types. Prevents 1-API-endpoint = 1-resource_type proliferation
 * (docs/coding-standards.md §13): new endpoints must either attach to an
 * existing resource (`operations.get` with `EndpointSpec.scope`, `executeActions`,
 * `pathBuilder`, or `routeResolver`) or belong to a multi-operation entity.
 */
const ALLOWED_SINGLE_OP_COUNTS_BY_TOOLSET: Readonly<Record<string, number>> = {
  pipelines: 6,
  connectors: 2,
  logs: 1,
  registries: 3,
  "registries-v3": 8,
  "registries-firewall": 2,
  dashboards: 2,
  idp: 5,
  "pull-requests": 2,
  "feature-flags": 4,
  gitops: 9,
  chaos: 12,
  ccm: 12,
  sei: 6,
  scs: 15,
  sto: 6,
  dbops: 4,
  autonomous_work: 5,
  access_control: 1,
  settings: 1,
  "ai-evals": 5,
  iacm: 3,
  "knowledge-graph": 2,
  "semantic-layer": 1,
  "unified-search": 1,
  ansible: 1,
  "release-management": 8,
  appsec: 4,
};

/**
 * Legacy static REST endpoints exposed across more than one `resourceType`.
 * Do not register the same static `(method, path)` under multiple resource types.
 */
const ALLOWED_DUPLICATE_STATIC_ENDPOINTS = new Set([
  "GET /pipeline/api/pipelines/{pipelineIdentifier}",
  "GET /ccm/api/budgets/{budgetId}",
  "GET /ssca-manager/v1/orgs/{org}/projects/{project}/artifacts/{artifact}/component/remediation",
]);

const MAX_RESOURCE_DESCRIPTION_CHARS = 500;

/**
 * Legacy resources whose `description` exceeds MAX_RESOURCE_DESCRIPTION_CHARS.
 * Per docs/coding-standards.md §14, multi-step playbooks belong in `src/prompts/`,
 * and resource descriptions must stay ≤ 500 chars.
 */
const ALLOWED_LONG_RESOURCE_DESCRIPTIONS = new Set([
  "pipeline_dynamic_execution",
  "llm_model",
  "execution_log",
  "fme_feature_flag_definition",
  "fme_experiment_result",
  "fme_event_type",
  "gitops_agent_metrics",
  "gitops_argo_project",
  "gitops_app_project_mapping",
  "gitops_autocreate_log",
  "gitops_cluster",
  "gitops_applicationset",
  "gitops_cluster_link",
  "chaos_experiment",
  "chaos_experiment_run",
  "chaos_probe",
  "chaos_experiment_template",
  "chaos_component_variable",
  "chaos_input_set",
  "chaos_infrastructure",
  "chaos_loadtest",
  "chaos_loadtest_run",
  "chaos_k8s_infrastructure",
  "chaos_enabled_infrastructure",
  "chaos_hub",
  "chaos_fault_template",
  "chaos_probe_template",
  "chaos_action_template",
  "chaos_action",
  "chaos_application_map",
  "chaos_guard_condition",
  "chaos_guard_rule",
  "chaos_dr_test",
  "discovered_service",
  "discovered_network_map",
  "scanned_risk",
  "chaos_risk_rule",
  "chaos_risk_scan",
  "chaos_onboarding",
  "chaos_dashboard",
  "chaos_image_registry",
  "cost_breakdown",
  "cost_timeseries",
  "cost_recommendation",
  "cost_recommendation_stats",
  "unit_metric",
  "scs_artifact_source",
  "artifact_security",
  "scs_artifact_component",
  "scs_component_search",
  "scs_component_dependencies",
  "scs_bom_violation",
  "code_repo_security",
  "scs_component_remediation",
  "scs_remediation_pr",
  "scs_component_enrichment",
  "scs_component_vulnerability",
  "scs_oss_risk_summary",
  "scs_project_security_overview",
  "scs_sbom_drift",
  "scs_component_drift",
  "attestation",
  "pipeline_security_issue",
  "security_exemption",
  "security_exemption_bulk",
  "remediation_diff",
  "database_schema",
  "database_default_authoring_instance",
  "database_execute_llm_authoring_pipeline",
  "policy",
  "policy_set",
  "iacm_workspace",
  "iacm_variable_set",
  "iacm_resource",
  "iacm_module",
  "iacm_provider",
  "kg_queryable_type_summary",
  "unified_search",
  "activity_timeline",
]);
/**
 * Legacy *_detail / *_stats / *_count resource types.
 * Per docs/coding-standards.md §13, single-item detail belongs on `operations.get`
 * (using `EndpointSpec.scope` when scope differs from `list`) and stats/counts
 * belong on the parent entity (`executeActions.stats` or `get`).
 */
const ALLOWED_DETAIL_STATS_COUNT_RESOURCES = new Set([
  "scorecard_stats",
  "scorecard_check_stats",
  "cost_recommendation_count",
  "cost_recommendation_stats",
  "cost_recommendation_detail",
  "sei_team_detail",
  "sei_org_tree_detail",
]);

describe("Coding standards — registry resource contract", () => {
  const registry = new Registry(MINIMAL_CONFIG);

  it("every resource declares a valid scope", () => {
    const violations: string[] = [];

    for (const resourceType of registry.getAllResourceTypes()) {
      const def = registry.getResource(resourceType);
      if (!VALID_SCOPES.has(def.scope)) {
        violations.push(`${resourceType}: invalid scope "${String(def.scope)}"`);
      }
      for (const [operation, spec] of Object.entries(def.operations)) {
        if (spec.scope !== undefined && !VALID_SCOPES.has(spec.scope)) {
          violations.push(`${resourceType}.${operation}: invalid EndpointSpec.scope "${String(spec.scope)}"`);
        }
      }
      for (const [action, spec] of Object.entries(def.executeActions ?? {})) {
        if (spec.scope !== undefined && !VALID_SCOPES.has(spec.scope)) {
          violations.push(`${resourceType}.${action}: invalid EndpointSpec.scope "${String(spec.scope)}"`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("does not add new route-version-suffixed resource types (_v1, _v2, _v3) without an existing same-name v0/v1 resource", () => {
    const violations: string[] = [];

    for (const resourceType of registry.getAllResourceTypes()) {
      if (/_v\d+$/.test(resourceType) && !ALLOWED_VERSION_SUFFIXED_RESOURCES.has(resourceType)) {
        violations.push(
          `${resourceType}: do not suffix resourceType with backend API version (_v1/_v2/_v3); name after the domain capability (docs/coding-standards.md §13)`,
        );
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("does not add new single-action execute-only resource types (attach to parent executeActions)", () => {
    const violations: string[] = [];

    for (const resourceType of registry.getAllResourceTypes()) {
      const def = registry.getResource(resourceType);
      const opCount = Object.keys(def.operations).length;
      const actionNames = Object.keys(def.executeActions ?? {});
      if (opCount === 0 && actionNames.length === 1 && !ALLOWED_SINGLE_ACTION_EXECUTE_ONLY_RESOURCES.has(resourceType)) {
        violations.push(
          `${resourceType} (only execute:${actionNames[0]}): attach action to parent resource's executeActions instead of creating a single-action resource_type (docs/coding-standards.md §13)`,
        );
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("does not add new *_detail, *_stats, or *_count resource types (use operations.get with EndpointSpec.scope or executeActions.stats)", () => {
    const violations: string[] = [];

    for (const resourceType of registry.getAllResourceTypes()) {
      if (/_(detail|stats|count)(_v\d+)?$/.test(resourceType) && !ALLOWED_DETAIL_STATS_COUNT_RESOURCES.has(resourceType)) {
        violations.push(
          `${resourceType}: fold detail into parent operations.get (using EndpointSpec.scope if scope differs) and stats/count into parent executeActions.stats (docs/coding-standards.md §13)`,
        );
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("does not increase the number of single-operation resource types in any toolset (no 1-endpoint-per-resource sprawl)", () => {
    const violations: string[] = [];

    for (const toolset of registry.getAllToolsets()) {
      const singleOpTypes = toolset.resources
        .filter((r) => Object.keys(r.operations).length + Object.keys(r.executeActions ?? {}).length <= 1)
        .map((r) => r.resourceType);
      const allowed = ALLOWED_SINGLE_OP_COUNTS_BY_TOOLSET[toolset.name] ?? 0;
      if (singleOpTypes.length > allowed) {
        violations.push(
          `toolset "${toolset.name}": ${singleOpTypes.length} single-operation resource(s) [${singleOpTypes.join(", ")}] exceeds ceiling of ${allowed} — consolidate into parent resource operations/executeActions (docs/coding-standards.md §13)`,
        );
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("does not expose the same static REST (method, path) under multiple resourceTypes", () => {
    const byEndpoint = new Map<string, Set<string>>();

    for (const toolset of registry.getAllToolsets()) {
      for (const r of toolset.resources) {
        for (const spec of [...Object.values(r.operations), ...Object.values(r.executeActions ?? {})]) {
          if (!spec.path || spec.pathBuilder || spec.routeResolver || spec.path.endsWith("/graphql")) continue;
          const key = `${spec.method} ${spec.path}`;
          if (!byEndpoint.has(key)) byEndpoint.set(key, new Set());
          byEndpoint.get(key)!.add(r.resourceType);
        }
      }
    }

    const violations: string[] = [];
    for (const [key, rts] of byEndpoint) {
      if (rts.size > 1 && !ALLOWED_DUPLICATE_STATIC_ENDPOINTS.has(key)) {
        violations.push(`${key} is registered on multiple resource types: [${[...rts].join(", ")}]`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("does not define bodyBuilder on GET operations (use inputNormalizer instead — docs/coding-standards.md §14)", () => {
    const violations: string[] = [];

    for (const resourceType of registry.getAllResourceTypes()) {
      const def = registry.getResource(resourceType);
      for (const [op, spec] of [
        ...Object.entries(def.operations),
        ...Object.entries(def.executeActions ?? {}).map(([k, v]) => [`exec:${k}`, v] as const),
      ]) {
        const key = `${resourceType}.${op}`;
        if (spec.method === "GET" && spec.bodyBuilder) {
          violations.push(
            `${key}: GET endpoint must not define bodyBuilder; use inputNormalizer instead (docs/coding-standards.md §14)`,
          );
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("keeps ResourceDefinition.description concise (<= 500 chars; multi-step playbooks belong in src/prompts/)", () => {
    const violations: string[] = [];

    for (const resourceType of registry.getAllResourceTypes()) {
      const def = registry.getResource(resourceType);
      if (
        def.description.length > MAX_RESOURCE_DESCRIPTION_CHARS &&
        !ALLOWED_LONG_RESOURCE_DESCRIPTIONS.has(resourceType)
      ) {
        violations.push(
          `${resourceType}: description is ${def.description.length} chars (max ${MAX_RESOURCE_DESCRIPTION_CHARS}) — move multi-step playbooks to src/prompts/ (docs/coding-standards.md §14)`,
        );
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("forbids adding new legacy module-acronym-prefixed resourceType names (fme_, iacm_, scs_, idp_, sei_, appsec_, chaos_, sto_, ccm_) without a clean harness-nav-config.yaml domain name", () => {
    const LEGACY_PREFIX_RE = /^(?:fme|iacm|scs|idp|sei|appsec|chaos|sto|ccm)_/;
    const unmapped: string[] = [];
    for (const resourceType of registry.getAllResourceTypes()) {
      if (LEGACY_PREFIX_RE.test(resourceType) && !PREFERRED_RESOURCE_TYPE_NAMES[resourceType]) {
        unmapped.push(resourceType);
      }
    }
    expect(
      unmapped,
      `New resources must use clean domain nouns aligned with harness-nav-config.yaml instead of legacy module acronym prefixes: ${unmapped.join(", ")}`,
    ).toEqual([]);
  });

  it("ensures every PREFERRED_RESOURCE_TYPE_NAMES entry has a unique, collision-free NAV_DOMAIN_RESOURCE_ALIASES reverse mapping and valid TOOLSET_ALIASES target", () => {
    const preferredValues = Object.values(PREFERRED_RESOURCE_TYPE_NAMES);
    expect(new Set(preferredValues).size).toBe(preferredValues.length);
    for (const [legacy, preferred] of Object.entries(PREFERRED_RESOURCE_TYPE_NAMES)) {
      expect(NAV_DOMAIN_RESOURCE_ALIASES[preferred]).toBe(legacy);
      expect(registry.getResource(preferred).resourceType).toBe(legacy);
    }
    const allToolsetNames = new Set(ALL_TOOLSET_NAMES);
    for (const [alias, target] of Object.entries(TOOLSET_ALIASES)) {
      expect(allToolsetNames.has(target), `TOOLSET_ALIASES["${alias}"] -> "${target}" is not a registered toolset`).toBe(true);
    }
    for (const [alias, targets] of Object.entries(TOOLSET_GROUP_ALIASES)) {
      for (const target of targets) {
        expect(allToolsetNames.has(target), `TOOLSET_GROUP_ALIASES["${alias}"] -> "${target}" is not a registered toolset`).toBe(true);
      }
    }
    for (const [alias, target] of Object.entries(DEPRECATED_RESOURCE_TYPE_ALIASES)) {
      expect(registry.getResource(alias).resourceType).toBe(target);
    }
  });

  it("expands TOOLSET_GROUP_ALIASES in explicit, additive (+), and subtractive (-) HARNESS_TOOLSETS modes", () => {
    // Explicit group selection: "artifacts" -> registries, registries-v3, registries-firewall
    const explicitReg = new Registry({
      ...MINIMAL_CONFIG,
      HARNESS_TOOLSETS: "artifacts",
    });
    expect(explicitReg.getAllToolsets().map((t) => t.name).sort()).toEqual([
      "registries",
      "registries-firewall",
      "registries-v3",
    ]);

    // Additive group selection: "+artifacts" adds opt-in registries-v3 to defaults
    const additiveReg = new Registry({
      ...MINIMAL_CONFIG,
      HARNESS_TOOLSETS: "+artifacts",
    });
    const additiveNames = additiveReg.getAllToolsets().map((t) => t.name);
    expect(additiveNames).toContain("registries");
    expect(additiveNames).toContain("registries-v3");
    expect(additiveNames).toContain("registries-firewall");
    expect(additiveNames).toContain("pipelines");

    // Subtractive group selection: "-sre" removes incidents, alerts, deploys, runbooks, timelines
    const subtractiveReg = new Registry({
      ...MINIMAL_CONFIG,
      HARNESS_TOOLSETS: "-sre",
    });
    const subtractiveNames = subtractiveReg.getAllToolsets().map((t) => t.name);
    for (const removed of ["incidents", "alerts", "deploys", "runbooks", "timelines"]) {
      expect(subtractiveNames).not.toContain(removed);
    }
    expect(subtractiveNames).toContain("pipelines");
  });

  it("resolves toolset aliases in describeByOperation (e.g. toolset='flags')", () => {
    const res = registry.describeByOperation({ operation: "list", toolset: "flags" }) as {
      error?: string;
      resource_types?: Array<{ type: string; toolset: string }>;
    };
    expect(res.error).toBeUndefined();
    expect(res.resource_types?.length).toBeGreaterThan(0);
    expect(res.resource_types?.every((r) => r.toolset === "feature-flags")).toBe(true);
  });

  it("redirects consolidated legacy single-action execute resource types (work_item_resume, work_item_approve, budget_grant) to their parent resource actions", async () => {
    const client = {
      request: vi.fn().mockResolvedValue({ status: "OK" }),
    } as unknown as HarnessClient;

    await registry.dispatchExecute(client, "work_item_resume", "run", {
      work_item_id: "wi-1",
      org_id: "org1",
      project_id: "proj1",
    });
    expect((client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0].path).toBe("/adlc/api/workitems/wi-1/resume");

    await registry.dispatchExecute(client, "work_item_approve", "run", {
      work_item_id: "wi-1",
      org_id: "org1",
      project_id: "proj1",
      body: { decision: "APPROVE" },
    });
    expect((client.request as ReturnType<typeof vi.fn>).mock.calls[1]![0].path).toBe("/adlc/api/workitems/wi-1/approve");

    await registry.dispatchExecute(client, "budget_grant", "run", {
      budget_id: "b-1",
      org_id: "org1",
      project_id: "proj1",
    });
    expect((client.request as ReturnType<typeof vi.fn>).mock.calls[2]![0].path).toBe("/adlc/api/budgets/b-1/grant");
  });

  it("every resource declares identifierFields (may be empty for metadata-only types)", () => {
    const violations: string[] = [];

    for (const resourceType of registry.getAllResourceTypes()) {
      const def = registry.getResource(resourceType);
      if (!Array.isArray(def.identifierFields)) {
        violations.push(`${resourceType}: identifierFields must be an array`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every endpoint spec declares operationPolicy with risk and retryPolicy", () => {
    const violations: string[] = [];

    for (const resourceType of registry.getAllResourceTypes()) {
      const def = registry.getResource(resourceType);
      for (const [operation, spec] of Object.entries(def.operations)) {
        if (!spec.operationPolicy) {
          violations.push(`${resourceType}.${operation}: missing operationPolicy`);
          continue;
        }
        if (!spec.operationPolicy.risk) {
          violations.push(`${resourceType}.${operation}: missing operationPolicy.risk`);
        }
        if (!spec.operationPolicy.retryPolicy) {
          violations.push(`${resourceType}.${operation}: missing operationPolicy.retryPolicy`);
        }
      }
      for (const [action, spec] of Object.entries(def.executeActions ?? {})) {
        if (!spec.operationPolicy) {
          violations.push(`${resourceType}.${action}: missing operationPolicy`);
          continue;
        }
        if (!spec.operationPolicy.risk) {
          violations.push(`${resourceType}.${action}: missing operationPolicy.risk`);
        }
        if (!spec.operationPolicy.retryPolicy) {
          violations.push(`${resourceType}.${action}: missing operationPolicy.retryPolicy`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("honors EndpointSpec.scope and EndpointSpec.scopeParams overrides per operation", async () => {
    const events: AuditEvent[] = [];
    const auditManager = {
      emit: (e: AuditEvent) => events.push(e),
      close: async () => {},
    } as unknown as AuditManager;

    const syntheticToolset: ToolsetDefinition = {
      name: "pipelines",
      displayName: "Synthetic",
      description: "Synthetic toolset for per-operation scope override tests",
      resources: [
        {
          resourceType: "synthetic_scoped_item",
          displayName: "Synthetic Scoped Item",
          description: "Project-scoped list paired with account-scoped get-by-UUID",
          toolset: "pipelines",
          scope: "project",
          scopeParams: {
            account: "account_identifier",
            org: "org_identifier",
            project: "project_identifier",
          },
          identifierFields: ["item_id"],
          operations: {
            list: {
              method: "GET",
              path: "/api/v3/items",
              operationPolicy: { risk: "read", retryPolicy: "safe" },
              responseExtractor: passthrough,
            },
            get: {
              method: "GET",
              path: "/api/v3/items/{id}",
              pathParams: { item_id: "id" },
              scope: "account",
              scopeParams: {
                account: "custom_account_id",
              },
              operationPolicy: { risk: "read", retryPolicy: "safe" },
              responseExtractor: passthrough,
            },
          },
        },
      ],
    };

    const scopedRegistry = new Registry(
      {
        ...MINIMAL_CONFIG,
        HARNESS_ACCOUNT_ID: "acct123",
        HARNESS_ORG: "PROD",
        HARNESS_PROJECT: "Core",
      },
      { additionalToolsets: [syntheticToolset], auditManager },
    );

    const client = {
      request: vi.fn().mockResolvedValue({ items: [] }),
    } as unknown as HarnessClient;

    await scopedRegistry.dispatch(client, "synthetic_scoped_item", "list", {});
    const listCall = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(listCall.params).toEqual({
      account_identifier: "acct123",
      org_identifier: "PROD",
      project_identifier: "Core",
    });
    expect(events[0]?.org_id).toBe("PROD");
    expect(events[0]?.project_id).toBe("Core");

    await scopedRegistry.dispatch(client, "synthetic_scoped_item", "get", {
      item_id: "uuid-1",
      org_id: "PROD",
      project_id: "Core",
    });
    const getCall = (client.request as ReturnType<typeof vi.fn>).mock.calls[1]![0];
    expect(getCall.path).toBe("/api/v3/items/uuid-1");
    expect(getCall.params).toEqual({
      custom_account_id: "acct123",
    });
    expect(events[1]?.org_id).toBeUndefined();
    expect(events[1]?.project_id).toBeUndefined();
  });
});
