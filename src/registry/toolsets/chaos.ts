import type { ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";

/**
 * Chaos API base path — requires /gateway prefix per Harness API routing.
 * REST endpoints live under rest/v2/ (experiments, probes) and rest/ (templates).
 * Load test endpoints live under v1/.
 */
const CHAOS = "/gateway/chaos/manager/api";

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
  description: "Harness Chaos Engineering — experiments, probes, infrastructure, and load tests",
  resources: [
    // ── Chaos Experiments ──────────────────────────────────────────────
    {
      resourceType: "chaos_experiment",
      displayName: "Chaos Experiment",
      description:
        "Chaos experiment definition. Supports list, get, and run action.",
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
      description: "Chaos resilience probe. Supports list and get.",
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

    // ── Chaos Infrastructure (Linux / Load Runners) ────────────────────
    {
      resourceType: "chaos_infrastructure",
      displayName: "Chaos Infrastructure",
      description: "Linux infrastructure registered for chaos experiments and load testing. Supports list.",
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
    // Note: Load test API uses standard orgIdentifier (no scopeParams override)
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
          path: `${CHAOS}/v1/load-tests`,
          queryParams: {
            page: "page",
            limit: "limit",
          },
          responseExtractor: passthrough,
          description: "List load test instances",
        },
        get: {
          method: "GET",
          path: `${CHAOS}/v1/load-tests/{loadtestId}`,
          pathParams: { loadtest_id: "loadtestId" },
          responseExtractor: passthrough,
          description: "Get load test instance details",
        },
        create: {
          method: "POST",
          path: `${CHAOS}/v1/load-tests`,
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
          path: `${CHAOS}/v1/load-tests/{loadtestId}`,
          pathParams: { loadtest_id: "loadtestId" },
          responseExtractor: passthrough,
          description: "Delete a load test instance",
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: `${CHAOS}/v1/load-tests/{loadtestId}/runs`,
          pathParams: { loadtest_id: "loadtestId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: "Run a load test instance",
          bodySchema: { description: "No body required. Load test is identified by path parameter.", fields: [] },
        },
        stop: {
          method: "POST",
          path: `${CHAOS}/v1/runs/{runId}/stop`,
          pathParams: { run_id: "runId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: "Stop a running load test",
          bodySchema: { description: "No body required. Run is identified by path parameter.", fields: [] },
        },
      },
    },
  ],
};
