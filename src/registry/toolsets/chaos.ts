import type { ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";

/**
 * Chaos API base path — requires /gateway prefix per Harness API routing.
 * REST endpoints live under rest/v2/ (experiments, probes) and rest/ (templates).
 * Load test endpoints live under v1/.
 */
const CHAOS = "/gateway/chaos/manager/api";

/** Load test API uses a separate service path per v1 Go server. */
const CHAOS_LOADTEST = "/loadTest/manager/api";

/** Chaos scope override — Chaos REST API uses organizationIdentifier (not orgIdentifier). */
const CHAOS_SCOPE = { org: "organizationIdentifier" } as const;

/**
 * Extract chaos paginated list response: { data: [...], pagination: { totalItems } }
 * Used by experiments and templates.
 */
const chaosPageExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: unknown[]; pagination?: { totalItems?: number } };
  return {
    items: r.data ?? [],
    total: r.pagination?.totalItems ?? (Array.isArray(r.data) ? r.data.length : 0),
  };
};

/**
 * Extract chaos probe list response: { totalNoOfProbes, data: [...] }
 */
const chaosProbeListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: unknown[]; totalNoOfProbes?: number };
  return {
    items: r.data ?? [],
    total: r.totalNoOfProbes ?? (Array.isArray(r.data) ? r.data.length : 0),
  };
};

/**
 * Extract chaos infrastructure list response: { totalNoOfInfras, infras: [...] }
 */
const chaosInfraListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { infras?: unknown[]; totalNoOfInfras?: number };
  return {
    items: r.infras ?? [],
    total: r.totalNoOfInfras ?? (Array.isArray(r.infras) ? r.infras.length : 0),
  };
};

export const chaosToolset: ToolsetDefinition = {
  name: "chaos",
  displayName: "Chaos Engineering",
  description: "Harness Chaos Engineering — experiments, probes, hubs, faults, ChaosGuard rules/conditions, Kubernetes and Linux infrastructure, network maps, recommendations, risks, and load tests",
  resources: [
    // ── Chaos Experiments ──────────────────────────────────────────────
    {
      resourceType: "chaos_experiment",
      displayName: "Chaos Experiment",
      description:
        "Chaos experiment definition. Supports list, get, and run action. Use chaos_experiment_variable list to discover required runtime inputs before running.",
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["experiment_id"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/chaos/experiments/{experimentId}",
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/v2/experiment`,
          queryParams: {
            page: "page",
            limit: "limit",
          },
          responseExtractor: chaosPageExtract,
          description: "List chaos experiments",
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}`,
          pathParams: { experiment_id: "experimentId" },
          responseExtractor: passthrough,
          description: "Get chaos experiment details including revisions and recent run details",
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}/run`,
          pathParams: { experiment_id: "experimentId" },
          staticQueryParams: { isIdentity: "false" },
          bodyBuilder: (input) => {
            const body: Record<string, unknown> = {};
            if (input.inputset_identity) {
              body.inputsetIdentity = input.inputset_identity;
            }
            if (input.runtime_inputs) {
              body.runtimeInputs = input.runtime_inputs;
            }
            return Object.keys(body).length > 0 ? body : {};
          },
          responseExtractor: passthrough,
          actionDescription: "Run a chaos experiment",
          bodySchema: {
            description: "Optional runtime inputs for the chaos experiment. Use chaos_experiment_variable list to discover required variables first.",
            fields: [
              { name: "inputset_identity", type: "string", required: false, description: "Optional inputset identity to use for the experiment run" },
              { name: "runtime_inputs", type: "object", required: false, description: "Runtime input variables: { experiment: [{name, value}], tasks: { taskName: [{name, value}] } }" },
            ],
          },
        },
      },
    },

    // ── Chaos Experiment Run ───────────────────────────────────────────
    {
      resourceType: "chaos_experiment_run",
      displayName: "Chaos Experiment Run",
      description: "Result of a chaos experiment run. Supports get.",
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["experiment_id", "run_id"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/chaos/experiments/{experimentId}",
      operations: {
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/chaos-pipeline/{experimentId}`,
          pathParams: { experiment_id: "experimentId" },
          queryParams: { run_id: "experimentRunId" },
          responseExtractor: passthrough,
          description: "Get chaos experiment run result with step-level details, resiliency score, and fault data",
        },
      },
    },

    // ── Chaos Probes ───────────────────────────────────────────────────
    {
      resourceType: "chaos_probe",
      displayName: "Chaos Probe",
      description: "Chaos resilience probe. Supports list, get, enable, and verify actions.",
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["probe_id"],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/v2/probes`,
          queryParams: {
            page: "page",
            limit: "limit",
          },
          responseExtractor: chaosProbeListExtract,
          description: "List chaos probes",
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/probes/{probeId}`,
          pathParams: { probe_id: "probeId" },
          responseExtractor: passthrough,
          description: "Get chaos probe details",
        },
      },
      executeActions: {
        enable: {
          method: "POST",
          path: `${CHAOS}/rest/v2/probes/enable/{probeId}`,
          pathParams: { probe_id: "probeId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: "Enable a chaos probe",
          bodySchema: { description: "No body required. Probe is identified by path parameter.", fields: [] },
        },
        verify: {
          method: "POST",
          path: `${CHAOS}/rest/v2/probes/verify/{probeId}`,
          pathParams: { probe_id: "probeId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: "Verify a chaos probe configuration",
          bodySchema: { description: "No body required. Probe is identified by path parameter.", fields: [] },
        },
      },
    },

    // ── Chaos Experiment Templates ─────────────────────────────────────
    {
      resourceType: "chaos_experiment_template",
      displayName: "Chaos Experiment Template",
      description: "Template for creating chaos experiments. Supports list. Use create_from_template execute action to launch an experiment from a template.",
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["template_id"],
      listFilterFields: [
        { name: "hub_identity", description: "Chaos hub identity (required for listing templates)" },
        { name: "infrastructure_type", description: "Filter by infrastructure type (e.g. Kubernetes, Linux)" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/experimenttemplates`,
          queryParams: {
            page: "page",
            limit: "limit",
            hub_identity: "hubIdentity",
            infrastructure_type: "infrastructureType",
          },
          responseExtractor: chaosPageExtract,
          description: "List chaos experiment templates",
        },
      },
      executeActions: {
        create_from_template: {
          method: "POST",
          path: `${CHAOS}/rest/experimenttemplates/{templateId}/launch`,
          pathParams: { template_id: "templateId" },
          queryParams: { hub_identity: "hubIdentity" },
          bodyBuilder: (input) => ({
            name: input.name,
            identity: input.identity,
            infraRef: input.infra_ref,
            accountIdentifier: input.account_id,
            organizationIdentifier: input.org_id,
            projectIdentifier: input.project_id,
          }),
          responseExtractor: passthrough,
          actionDescription: "Create a chaos experiment from a template",
          bodySchema: {
            description: "Chaos experiment from template",
            fields: [
              { name: "name", type: "string", required: true, description: "Experiment name" },
              { name: "identity", type: "string", required: false, description: "Experiment identity (auto-generated from name if omitted)" },
              { name: "infra_ref", type: "string", required: true, description: "Infrastructure reference in format: environmentId/infraId" },
              { name: "hub_identity", type: "string", required: true, description: "Chaos hub identity" },
            ],
          },
        },
      },
    },

    // ── Chaos Experiment Variables ──────────────────────────────────────
    {
      resourceType: "chaos_experiment_variable",
      displayName: "Chaos Experiment Variable",
      description: "Variables for a chaos experiment. List variables to discover required runtime inputs before running an experiment.",
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["experiment_id"],
      listFilterFields: [
        { name: "experiment_id", description: "Chaos experiment ID to list variables for", required: true },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/chaos/experiments/{experimentId}",
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}/variables`,
          pathParams: { experiment_id: "experimentId" },
          staticQueryParams: { isIdentity: "false" },
          responseExtractor: passthrough,
          description: "List variables for a chaos experiment (experiment-level and task-level)",
        },
      },
    },

    // ── Chaos Infrastructure — Linux / Machine ─────────────────────────
    {
      resourceType: "chaos_infrastructure",
      displayName: "Chaos Infrastructure (Linux)",
      description: "Linux/machine infrastructure registered for chaos experiments and load testing. For Kubernetes infrastructure, use chaos_k8s_infrastructure. Supports list.",
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["infra_id"],
      listFilterFields: [
        { name: "status", description: "Filter by infra status: Active (default) or All", enum: ["Active", "All"] },
      ],
      operations: {
        list: {
          method: "POST",
          path: `${CHAOS}/rest/machine/infras`,
          staticQueryParams: { infraType: "Linux", page: "0", limit: "15" },
          bodyBuilder: (input) => {
            const filter: Record<string, unknown> = {};
            const statusInput = input.status as string | undefined;
            if (statusInput && statusInput !== "All") {
              filter.status = statusInput;
            } else if (!statusInput) {
              filter.status = "Active";
            }
            return {
              filter,
              sort: { field: "NAME", ascending: true },
            };
          },
          responseExtractor: chaosInfraListExtract,
          description: "List chaos Linux infrastructures (load runners)",
        },
      },
    },

    // ── Load Tests ─────────────────────────────────────────────────────
    // Note: Load test API uses a different service path (loadTest/manager/api)
    // than the chaos manager (gateway/chaos/manager/api), per v1 Go code.
    // Also uses standard orgIdentifier (no scopeParams override).
    {
      resourceType: "chaos_loadtest",
      displayName: "Chaos Load Test",
      description: "Load test instance. Supports list, get, create, and delete. Run/stop via execute actions.",
      toolset: "chaos",
      scope: "project",
      identifierFields: ["loadtest_id"],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS_LOADTEST}/v1/load-tests`,
          queryParams: {
            page: "page",
            limit: "limit",
          },
          responseExtractor: passthrough,
          description: "List load test instances",
        },
        get: {
          method: "GET",
          path: `${CHAOS_LOADTEST}/v1/load-tests/{loadtestId}`,
          pathParams: { loadtest_id: "loadtestId" },
          responseExtractor: passthrough,
          description: "Get load test instance details",
        },
        create: {
          method: "POST",
          path: `${CHAOS_LOADTEST}/v1/load-tests`,
          bodyBuilder: (input) => input.body ?? {},
          responseExtractor: passthrough,
          description: "Create a sample load test instance",
          bodySchema: {
            description: "Load test instance definition",
            fields: [
              { name: "name", type: "string", required: true, description: "Load test name" },
              { name: "type", type: "string", required: false, description: "Load test type" },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS_LOADTEST}/v1/load-tests/{loadtestId}`,
          pathParams: { loadtest_id: "loadtestId" },
          responseExtractor: passthrough,
          description: "Delete a load test instance",
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: `${CHAOS_LOADTEST}/v1/load-tests/{loadtestId}/runs`,
          pathParams: { loadtest_id: "loadtestId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: "Run a load test instance",
          bodySchema: { description: "No body required. Load test is identified by path parameter.", fields: [] },
        },
        stop: {
          method: "POST",
          path: `${CHAOS_LOADTEST}/v1/runs/{runId}/stop`,
          pathParams: { run_id: "runId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: "Stop a running load test",
          bodySchema: { description: "No body required. Run is identified by path parameter.", fields: [] },
        },
      },
    },

    // ── Chaos Kubernetes Infrastructure ──────────────────────────────
    {
      resourceType: "chaos_k8s_infrastructure",
      displayName: "Chaos K8s Infrastructure",
      description: "Kubernetes infrastructure registered for chaos experiments. List uses POST with filter/sort body. Supports list, get, and check_health action.",
      toolset: "chaos",
      scope: "project",
      identifierFields: ["infra_id"],
      operations: {
        list: {
          method: "POST",
          path: `${CHAOS}/rest/kubernetes/infras`,
          staticQueryParams: { page: "0", limit: "15" },
          bodyBuilder: (input) => {
            const filter: Record<string, unknown> = {};
            const statusInput = input.status as string | undefined;
            if (statusInput && statusInput !== "All") {
              filter.status = statusInput;
            } else if (!statusInput) {
              filter.status = "Active";
            }
            return {
              filter,
              sort: { field: "NAME", ascending: true },
            };
          },
          responseExtractor: chaosInfraListExtract,
          description: "List Kubernetes chaos infrastructures",
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/kubernetes/infra/{infraId}`,
          pathParams: { infra_id: "infraId" },
          responseExtractor: passthrough,
          description: "Get Kubernetes chaos infrastructure details",
        },
      },
      executeActions: {
        check_health: {
          method: "GET",
          path: `${CHAOS}/rest/kubernetes/infra/health/{infraId}`,
          pathParams: { infra_id: "infraId" },
          responseExtractor: passthrough,
          actionDescription: "Check health of a Kubernetes chaos infrastructure",
          bodySchema: { description: "No body required. Infrastructure is identified by path parameter.", fields: [] },
        },
      },
    },

    // ── Chaos Hubs ──────────────────────────────────────────────────
    {
      resourceType: "chaos_hub",
      displayName: "Chaos Hub",
      description: "Chaos hub for sharing experiment templates and faults. Supports list and get.",
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["hub_id"],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/hubs`,
          queryParams: {
            page: "page",
            limit: "limit",
          },
          responseExtractor: chaosPageExtract,
          description: "List chaos hubs",
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/hubs/{hubId}`,
          pathParams: { hub_id: "hubId" },
          responseExtractor: passthrough,
          description: "Get chaos hub details",
        },
      },
    },

    // ── Chaos Faults ────────────────────────────────────────────────
    {
      resourceType: "chaos_fault",
      displayName: "Chaos Fault",
      description: "Chaos fault definition (e.g. pod-delete, network-loss, CPU stress). Supports list and get.",
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["fault_id"],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/faults`,
          queryParams: {
            page: "page",
            limit: "limit",
          },
          responseExtractor: chaosPageExtract,
          description: "List chaos faults",
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/faults/{faultId}`,
          pathParams: { fault_id: "faultId" },
          responseExtractor: passthrough,
          description: "Get chaos fault details",
        },
      },
    },

    // ── Chaos Network Maps ──────────────────────────────────────────
    {
      resourceType: "chaos_network_map",
      displayName: "Chaos Network Map",
      description: "Network map (application map) for chaos blast radius visualization. Supports list and get.",
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["map_id"],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/v2/applicationmaps`,
          queryParams: {
            page: "page",
            limit: "limit",
          },
          responseExtractor: chaosPageExtract,
          description: "List chaos network maps",
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/applicationmaps/{mapId}`,
          pathParams: { map_id: "mapId" },
          responseExtractor: passthrough,
          description: "Get chaos network map details",
        },
      },
    },

    // ── ChaosGuard Conditions ───────────────────────────────────────
    {
      resourceType: "chaos_guard_condition",
      displayName: "ChaosGuard Condition",
      description: "ChaosGuard condition that defines criteria for experiment execution governance. Supports list and get.",
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["condition_id"],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/v2/conditions`,
          queryParams: {
            page: "page",
            limit: "limit",
          },
          responseExtractor: chaosPageExtract,
          description: "List ChaosGuard conditions",
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/conditions/{conditionId}`,
          pathParams: { condition_id: "conditionId" },
          responseExtractor: passthrough,
          description: "Get ChaosGuard condition details",
        },
      },
    },

    // ── ChaosGuard Rules ────────────────────────────────────────────
    {
      resourceType: "chaos_guard_rule",
      displayName: "ChaosGuard Rule",
      description: "ChaosGuard rule that enforces governance policies on chaos experiment execution. Supports list and get.",
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["rule_id"],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/v2/rules`,
          queryParams: {
            page: "page",
            limit: "limit",
          },
          responseExtractor: chaosPageExtract,
          description: "List ChaosGuard rules",
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/rules/{ruleId}`,
          pathParams: { rule_id: "ruleId" },
          responseExtractor: passthrough,
          description: "Get ChaosGuard rule details",
        },
      },
    },

    // ── Chaos Recommendations ───────────────────────────────────────
    {
      resourceType: "chaos_recommendation",
      displayName: "Chaos Recommendation",
      description: "Chaos resilience recommendation based on experiment results. Supports list and get.",
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["recommendation_id"],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/recommendations`,
          queryParams: {
            page: "page",
            limit: "limit",
          },
          responseExtractor: chaosPageExtract,
          description: "List chaos recommendations",
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/recommendations/{recommendationId}`,
          pathParams: { recommendation_id: "recommendationId" },
          responseExtractor: passthrough,
          description: "Get chaos recommendation details",
        },
      },
    },

    // ── Chaos Risks ─────────────────────────────────────────────────
    {
      resourceType: "chaos_risk",
      displayName: "Chaos Risk",
      description: "Chaos risk assessment for services and infrastructure. Supports list and get.",
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["risk_id"],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/v2/risks`,
          queryParams: {
            page: "page",
            limit: "limit",
          },
          responseExtractor: chaosPageExtract,
          description: "List chaos risks",
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/risks/{riskId}`,
          pathParams: { risk_id: "riskId" },
          responseExtractor: passthrough,
          description: "Get chaos risk details",
        },
      },
    },
  ],
};
