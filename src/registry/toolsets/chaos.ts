import type { ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";
import {
  DESC_TOOLSET_CHAOS,
  DESC_CHAOS_EXPERIMENT, DESC_CHAOS_EXPERIMENT_RUN, DESC_CHAOS_PROBE,
  DESC_CHAOS_EXPERIMENT_TEMPLATE, DESC_CHAOS_EXPERIMENT_VARIABLE,
  DESC_CHAOS_INFRASTRUCTURE, DESC_CHAOS_LOADTEST, DESC_CHAOS_K8S_INFRASTRUCTURE,
  DESC_CHAOS_HUB, DESC_CHAOS_FAULT,
  DESC_CHAOS_NETWORK_MAP,
  DESC_CHAOS_GUARD_CONDITION, DESC_CHAOS_GUARD_RULE,
  DESC_CHAOS_RECOMMENDATION, DESC_CHAOS_RISK,
  DESC_OP_LIST_EXPERIMENTS, DESC_OP_GET_EXPERIMENT,
  DESC_OP_GET_EXPERIMENT_RUN,
  DESC_OP_LIST_PROBES, DESC_OP_GET_PROBE,
  DESC_OP_LIST_EXPERIMENT_TEMPLATES, DESC_OP_GET_EXPERIMENT_TEMPLATE,
  DESC_OP_LIST_EXPERIMENT_VARIABLES,
  DESC_OP_LIST_LINUX_INFRA,
  DESC_OP_LIST_LOADTESTS, DESC_OP_GET_LOADTEST, DESC_OP_CREATE_LOADTEST, DESC_OP_DELETE_LOADTEST,
  DESC_OP_LIST_K8S_INFRA, DESC_OP_GET_K8S_INFRA,
  DESC_OP_LIST_HUBS, DESC_OP_GET_HUB,
  DESC_OP_CREATE_HUB, DESC_OP_UPDATE_HUB, DESC_OP_DELETE_HUB,
  DESC_OP_LIST_FAULTS, DESC_OP_GET_FAULT,
  DESC_OP_LIST_NETWORK_MAPS, DESC_OP_GET_NETWORK_MAP,
  DESC_OP_LIST_GUARD_CONDITIONS, DESC_OP_GET_GUARD_CONDITION,
  DESC_OP_LIST_GUARD_RULES, DESC_OP_GET_GUARD_RULE,
  DESC_OP_LIST_RECOMMENDATIONS, DESC_OP_GET_RECOMMENDATION,
  DESC_OP_LIST_RISKS, DESC_OP_GET_RISK,
  DESC_ACTION_RUN_EXPERIMENT, DESC_ACTION_ENABLE_PROBE, DESC_ACTION_VERIFY_PROBE,
  DESC_ACTION_CREATE_FROM_TEMPLATE,
  DESC_ACTION_RUN_LOADTEST, DESC_ACTION_STOP_LOADTEST, DESC_ACTION_CHECK_K8S_HEALTH,
  DESC_BODY_EXPERIMENT_RUN, DESC_BODY_NO_BODY_PROBE,
  DESC_BODY_CREATE_FROM_TEMPLATE, DESC_BODY_LOADTEST_DEFINITION,
  DESC_BODY_NO_BODY_LOADTEST, DESC_BODY_NO_BODY_RUN, DESC_BODY_NO_BODY_INFRA,
  DESC_FIELD_INPUTSET_IDENTITY, DESC_FIELD_RUNTIME_INPUTS,
  DESC_FIELD_HUB_IDENTITY_LIST, DESC_FIELD_HUB_IDENTITY, DESC_FIELD_INFRASTRUCTURE_TYPE,
  DESC_FIELD_EXPERIMENT_NAME, DESC_FIELD_EXPERIMENT_IDENTITY, DESC_FIELD_INFRA_REF,
  DESC_FIELD_EXPERIMENT_ID, DESC_FIELD_INFRA_STATUS,
  DESC_FIELD_LOADTEST_NAME, DESC_FIELD_LOADTEST_TYPE,
  DESC_FIELD_HUB_IDENTITY_EXACT, DESC_FIELD_HUB_NAME, DESC_FIELD_HUB_NAME_UPDATE,
  DESC_FIELD_HUB_DESCRIPTION, DESC_FIELD_HUB_DESCRIPTION_UPDATE,
  DESC_FIELD_HUB_TAGS, DESC_FIELD_HUB_TAGS_REPLACE,
  DESC_FIELD_CONNECTOR_REF, DESC_FIELD_REPO_NAME, DESC_FIELD_REPO_BRANCH,
  DESC_FIELD_SEARCH_HUBS, DESC_FIELD_INCLUDE_ALL_SCOPE_HUBS,
} from "./chaos-descriptions.js";

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
  description: DESC_TOOLSET_CHAOS,
  resources: [
    // ── Chaos Experiments ──────────────────────────────────────────────
    {
      resourceType: "chaos_experiment",
      displayName: "Chaos Experiment",
      description: DESC_CHAOS_EXPERIMENT,
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
          description: DESC_OP_LIST_EXPERIMENTS,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}`,
          pathParams: { experiment_id: "experimentId" },
          responseExtractor: passthrough,
          description: DESC_OP_GET_EXPERIMENT,
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
          actionDescription: DESC_ACTION_RUN_EXPERIMENT,
          bodySchema: {
            description: DESC_BODY_EXPERIMENT_RUN,
            fields: [
              { name: "inputset_identity", type: "string", required: false, description: DESC_FIELD_INPUTSET_IDENTITY },
              { name: "runtime_inputs", type: "object", required: false, description: DESC_FIELD_RUNTIME_INPUTS },
            ],
          },
        },
      },
    },

    // ── Chaos Experiment Run ───────────────────────────────────────────
    {
      resourceType: "chaos_experiment_run",
      displayName: "Chaos Experiment Run",
      description: DESC_CHAOS_EXPERIMENT_RUN,
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
          description: DESC_OP_GET_EXPERIMENT_RUN,
        },
      },
    },

    // ── Chaos Probes ───────────────────────────────────────────────────
    {
      resourceType: "chaos_probe",
      displayName: "Chaos Probe",
      description: DESC_CHAOS_PROBE,
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
          description: DESC_OP_LIST_PROBES,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/probes/{probeId}`,
          pathParams: { probe_id: "probeId" },
          responseExtractor: passthrough,
          description: DESC_OP_GET_PROBE,
        },
      },
      executeActions: {
        enable: {
          method: "POST",
          path: `${CHAOS}/rest/v2/probes/enable/{probeId}`,
          pathParams: { probe_id: "probeId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: DESC_ACTION_ENABLE_PROBE,
          bodySchema: { description: DESC_BODY_NO_BODY_PROBE, fields: [] },
        },
        verify: {
          method: "POST",
          path: `${CHAOS}/rest/v2/probes/verify/{probeId}`,
          pathParams: { probe_id: "probeId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: DESC_ACTION_VERIFY_PROBE,
          bodySchema: { description: DESC_BODY_NO_BODY_PROBE, fields: [] },
        },
      },
    },

    // ── Chaos Experiment Templates ─────────────────────────────────────
    {
      resourceType: "chaos_experiment_template",
      displayName: "Chaos Experiment Template",
      description: DESC_CHAOS_EXPERIMENT_TEMPLATE,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["template_id"],
      listFilterFields: [
        { name: "hub_identity", description: DESC_FIELD_HUB_IDENTITY_LIST },
        { name: "infrastructure_type", description: DESC_FIELD_INFRASTRUCTURE_TYPE },
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
          description: DESC_OP_LIST_EXPERIMENT_TEMPLATES,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/experimenttemplates/{templateId}`,
          pathParams: { template_id: "templateId" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision: "revision",
          },
          responseExtractor: passthrough,
          description: DESC_OP_GET_EXPERIMENT_TEMPLATE,
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
          actionDescription: DESC_ACTION_CREATE_FROM_TEMPLATE,
          bodySchema: {
            description: DESC_BODY_CREATE_FROM_TEMPLATE,
            fields: [
              { name: "name", type: "string", required: true, description: DESC_FIELD_EXPERIMENT_NAME },
              { name: "identity", type: "string", required: false, description: DESC_FIELD_EXPERIMENT_IDENTITY },
              { name: "infra_ref", type: "string", required: true, description: DESC_FIELD_INFRA_REF },
              { name: "hub_identity", type: "string", required: true, description: DESC_FIELD_HUB_IDENTITY },
            ],
          },
        },
      },
    },

    // ── Chaos Experiment Variables ──────────────────────────────────────
    {
      resourceType: "chaos_experiment_variable",
      displayName: "Chaos Experiment Variable",
      description: DESC_CHAOS_EXPERIMENT_VARIABLE,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["experiment_id"],
      listFilterFields: [
        { name: "experiment_id", description: DESC_FIELD_EXPERIMENT_ID, required: true },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/chaos/experiments/{experimentId}",
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}/variables`,
          pathParams: { experiment_id: "experimentId" },
          staticQueryParams: { isIdentity: "false" },
          responseExtractor: passthrough,
          description: DESC_OP_LIST_EXPERIMENT_VARIABLES,
        },
      },
    },

    // ── Chaos Infrastructure — Linux / Machine ─────────────────────────
    {
      resourceType: "chaos_infrastructure",
      displayName: "Chaos Infrastructure (Linux)",
      description: DESC_CHAOS_INFRASTRUCTURE,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["infra_id"],
      listFilterFields: [
        { name: "status", description: DESC_FIELD_INFRA_STATUS, enum: ["Active", "All"] },
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
          description: DESC_OP_LIST_LINUX_INFRA,
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
      description: DESC_CHAOS_LOADTEST,
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
          description: DESC_OP_LIST_LOADTESTS,
        },
        get: {
          method: "GET",
          path: `${CHAOS_LOADTEST}/v1/load-tests/{loadtestId}`,
          pathParams: { loadtest_id: "loadtestId" },
          responseExtractor: passthrough,
          description: DESC_OP_GET_LOADTEST,
        },
        create: {
          method: "POST",
          path: `${CHAOS_LOADTEST}/v1/load-tests`,
          bodyBuilder: (input) => input.body ?? {},
          responseExtractor: passthrough,
          description: DESC_OP_CREATE_LOADTEST,
          bodySchema: {
            description: DESC_BODY_LOADTEST_DEFINITION,
            fields: [
              { name: "name", type: "string", required: true, description: DESC_FIELD_LOADTEST_NAME },
              { name: "type", type: "string", required: false, description: DESC_FIELD_LOADTEST_TYPE },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS_LOADTEST}/v1/load-tests/{loadtestId}`,
          pathParams: { loadtest_id: "loadtestId" },
          responseExtractor: passthrough,
          description: DESC_OP_DELETE_LOADTEST,
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: `${CHAOS_LOADTEST}/v1/load-tests/{loadtestId}/runs`,
          pathParams: { loadtest_id: "loadtestId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: DESC_ACTION_RUN_LOADTEST,
          bodySchema: { description: DESC_BODY_NO_BODY_LOADTEST, fields: [] },
        },
        stop: {
          method: "POST",
          path: `${CHAOS_LOADTEST}/v1/runs/{runId}/stop`,
          pathParams: { run_id: "runId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: DESC_ACTION_STOP_LOADTEST,
          bodySchema: { description: DESC_BODY_NO_BODY_RUN, fields: [] },
        },
      },
    },

    // ── Chaos Kubernetes Infrastructure ──────────────────────────────
    {
      resourceType: "chaos_k8s_infrastructure",
      displayName: "Chaos K8s Infrastructure",
      description: DESC_CHAOS_K8S_INFRASTRUCTURE,
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
          description: DESC_OP_LIST_K8S_INFRA,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/kubernetes/infra/{infraId}`,
          pathParams: { infra_id: "infraId" },
          responseExtractor: passthrough,
          description: DESC_OP_GET_K8S_INFRA,
        },
      },
      executeActions: {
        check_health: {
          method: "GET",
          path: `${CHAOS}/rest/kubernetes/infra/health/{infraId}`,
          pathParams: { infra_id: "infraId" },
          responseExtractor: passthrough,
          actionDescription: DESC_ACTION_CHECK_K8S_HEALTH,
          bodySchema: { description: DESC_BODY_NO_BODY_INFRA, fields: [] },
        },
      },
    },

    // ── Chaos Hubs ──────────────────────────────────────────────────
    {
      resourceType: "chaos_hub",
      displayName: "Chaos Hub",
      description: DESC_CHAOS_HUB, // can also refer to other tools like exp, fault templates, etc
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["hub_id"],
      listFilterFields: [
        { name: "search", description: DESC_FIELD_SEARCH_HUBS },
        { name: "include_all_scope", description: DESC_FIELD_INCLUDE_ALL_SCOPE_HUBS, type: "boolean" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/hubs`,
          queryParams: {
            page: "page",
            limit: "limit",
            search: "search",
            include_all_scope: "includeAllScope",
          },
          responseExtractor: chaosPageExtract,
          description: DESC_OP_LIST_HUBS,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/hubs/{hubId}`,
          pathParams: { hub_id: "hubId" },
          responseExtractor: passthrough,
          description: DESC_OP_GET_HUB,
        },
        create: {
          method: "POST",
          path: `${CHAOS}/rest/hubs`,
          bodyBuilder: (input) => ({
            identity: input.identity,
            name: input.name,
            ...(input.description ? { description: input.description } : {}),
            ...(input.tags ? { tags: (input.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean) } : {}),
            ...(input.connector_ref ? { connectorRef: input.connector_ref } : {}),
            ...(input.repo_name ? { repoName: input.repo_name } : {}),
            ...(input.repo_branch ? { repoBranch: input.repo_branch } : {}),
          }),
          responseExtractor: passthrough,
          description: DESC_OP_CREATE_HUB,
          bodySchema: {
            description: "ChaosHub creation payload",
            fields: [
              { name: "identity", type: "string", required: true, description: DESC_FIELD_HUB_IDENTITY_EXACT },
              { name: "name", type: "string", required: true, description: DESC_FIELD_HUB_NAME },
              { name: "description", type: "string", required: false, description: DESC_FIELD_HUB_DESCRIPTION },
              { name: "tags", type: "string", required: false, description: DESC_FIELD_HUB_TAGS },
              { name: "connector_ref", type: "string", required: false, description: DESC_FIELD_CONNECTOR_REF },
              { name: "repo_name", type: "string", required: false, description: DESC_FIELD_REPO_NAME },
              { name: "repo_branch", type: "string", required: false, description: DESC_FIELD_REPO_BRANCH },
            ],
          },
        },
        update: {
          method: "PUT",
          path: `${CHAOS}/rest/hubs/{hubId}`,
          pathParams: { hub_id: "hubId" },
          bodyBuilder: (input) => ({
            name: input.name,
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.tags ? { tags: (input.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean) } : {}),
          }),
          responseExtractor: passthrough,
          description: DESC_OP_UPDATE_HUB,
          bodySchema: {
            description: "ChaosHub update payload (replace-all model)",
            fields: [
              { name: "name", type: "string", required: true, description: DESC_FIELD_HUB_NAME_UPDATE },
              { name: "description", type: "string", required: false, description: DESC_FIELD_HUB_DESCRIPTION_UPDATE },
              { name: "tags", type: "string", required: false, description: DESC_FIELD_HUB_TAGS_REPLACE },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/rest/hubs/{hubId}`,
          pathParams: { hub_id: "hubId" },
          responseExtractor: passthrough,
          description: DESC_OP_DELETE_HUB,
        },
      },
    },

    // ── Chaos Faults ────────────────────────────────────────────────
    {
      resourceType: "chaos_fault",
      displayName: "Chaos Fault",
      description: DESC_CHAOS_FAULT,
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
          description: DESC_OP_LIST_FAULTS,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/faults/{faultId}`,
          pathParams: { fault_id: "faultId" },
          responseExtractor: passthrough,
          description: DESC_OP_GET_FAULT,
        },
      },
    },

    // ── Chaos Network Maps ──────────────────────────────────────────
    {
      resourceType: "chaos_network_map",
      displayName: "Chaos Network Map",
      description: DESC_CHAOS_NETWORK_MAP,
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
          description: DESC_OP_LIST_NETWORK_MAPS,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/applicationmaps/{mapId}`,
          pathParams: { map_id: "mapId" },
          responseExtractor: passthrough,
          description: DESC_OP_GET_NETWORK_MAP,
        },
      },
    },

    // ── ChaosGuard Conditions ───────────────────────────────────────
    {
      resourceType: "chaos_guard_condition",
      displayName: "ChaosGuard Condition",
      description: DESC_CHAOS_GUARD_CONDITION,
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
          description: DESC_OP_LIST_GUARD_CONDITIONS,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/conditions/{conditionId}`,
          pathParams: { condition_id: "conditionId" },
          responseExtractor: passthrough,
          description: DESC_OP_GET_GUARD_CONDITION,
        },
      },
    },

    // ── ChaosGuard Rules ────────────────────────────────────────────
    {
      resourceType: "chaos_guard_rule",
      displayName: "ChaosGuard Rule",
      description: DESC_CHAOS_GUARD_RULE,
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
          description: DESC_OP_LIST_GUARD_RULES,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/rules/{ruleId}`,
          pathParams: { rule_id: "ruleId" },
          responseExtractor: passthrough,
          description: DESC_OP_GET_GUARD_RULE,
        },
      },
    },

    // ── Chaos Recommendations ───────────────────────────────────────
    {
      resourceType: "chaos_recommendation",
      displayName: "Chaos Recommendation",
      description: DESC_CHAOS_RECOMMENDATION,
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
          description: DESC_OP_LIST_RECOMMENDATIONS,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/recommendations/{recommendationId}`,
          pathParams: { recommendation_id: "recommendationId" },
          responseExtractor: passthrough,
          description: DESC_OP_GET_RECOMMENDATION,
        },
      },
    },

    // ── Chaos Risks ─────────────────────────────────────────────────
    {
      resourceType: "chaos_risk",
      displayName: "Chaos Risk",
      description: DESC_CHAOS_RISK,
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
          description: DESC_OP_LIST_RISKS,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/risks/{riskId}`,
          pathParams: { risk_id: "riskId" },
          responseExtractor: passthrough,
          description: DESC_OP_GET_RISK,
        },
      },
    },
  ],
};
