import type { ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";
import {
  descToolsetChaos,
  // Resource descriptions
  descChaosExperiment, descChaosExperimentRun, descChaosProbe,
  descChaosExperimentTemplate, descChaosExperimentVariable,
  descChaosInfrastructure, descChaosLoadtest, descChaosK8sInfrastructure,
  descChaosHub, descChaosFault, descChaosFaultTemplate,
  descChaosProbeTemplate, descChaosActionTemplate,
  descChaosHubFault, descChaosEnvironment,
  descChaosNetworkMap,
  descChaosGuardCondition, descChaosGuardRule,
  descChaosRecommendation, descChaosRisk,
  // Operation descriptions
  descListExperiments, descGetExperiment,
  descGetExperimentRun,
  descListProbes, descGetProbe,
  descListExperimentTemplates, descGetExperimentTemplate, descDeleteExperimentTemplate,
  descListExperimentVariables,
  descListLinuxInfra,
  descListLoadtests, descGetLoadtest, descCreateLoadtest, descDeleteLoadtest,
  descListK8sInfra, descGetK8sInfra,
  descListHubs, descGetHub, descCreateHub, descUpdateHub, descDeleteHub,
  descListFaults, descGetFault,
  descListFaultTemplates, descGetFaultTemplate, descDeleteFaultTemplate,
  descListProbeTemplates, descGetProbeTemplate, descDeleteProbeTemplate,
  descListActionTemplates, descGetActionTemplate, descDeleteActionTemplate,
  descListHubFaults, descListChaosEnvironments,
  descListNetworkMaps, descGetNetworkMap,
  descListGuardConditions, descGetGuardCondition, descDeleteGuardCondition,
  descListGuardRules, descGetGuardRule, descDeleteGuardRule,
  descListRecommendations, descGetRecommendation,
  descListRisks, descGetRisk,
  // Action descriptions
  descRunExperiment, descEnableProbe, descVerifyProbe,
  descCreateFromTemplate,
  descListRevisions, descGetVariables, descGetYaml, descCompareRevisions,
  descRunLoadtest, descStopLoadtest, descCheckK8sHealth,
  descEnableGuardRule,
  descGetProbeTemplateVariables,
  descListActionTemplateRevisions, descGetActionTemplateVariables, descCompareActionTemplateRevisions,
  // Body schema descriptions
  descBodyExperimentRun, descBodyNoBody,
  descBodyCreateFromTemplate, descBodyLoadtestDefinition,
  // Field descriptions
  descInputsetIdentity, descRuntimeInputs,
  descHubIdentity, descInfraType,
  descExperimentName, descExperimentIdentity, descInfraRef,
  descExperimentId, descInfraStatus,
  descLoadtestName, descLoadtestType,
  descHubIdentityExact, descHubName, descHubNameUpdate,
  descHubDescription, descHubDescriptionUpdate,
  descHubTags, descHubTagsReplace,
  descConnectorRef, descRepoName, descRepoBranch,
  descHubSearch, descIncludeAllScope,
  descTemplateSearch, descSortField, descSortAsc,
  descTags, descInfrastructure, descTemplateIdentity,
  descRevision, descRevision1, descRevision2, descRevisionToCompare,
  descFaultType, descFaultCategory, descFaultPermissions, descFaultIsEnterprise,
  descImportType, descExperimentDescription, descExperimentTags,
  descEntityTypeProbe, descEntityTypeAction,
  descEntityTypeFault, descPermissionsRequiredEnum, descOnlyTemplatisedFaults,
  descEnvironmentId, descK8sInfraStatus, descIncludeLegacyInfra, descSearchK8sInfra,
  descSearchTermEnv, descSortEnv, descEnvironmentType,
  descGuardSearch, descGuardInfraType, descGuardTags, descGuardEnabled,
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
  description: descToolsetChaos,
  resources: [
    // ── Chaos Experiments ──────────────────────────────────────────────
    {
      resourceType: "chaos_experiment",
      displayName: "Chaos Experiment",
      description: descChaosExperiment,
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
          description: descListExperiments,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}`,
          pathParams: { experiment_id: "experimentId" },
          responseExtractor: passthrough,
          description: descGetExperiment,
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
          actionDescription: descRunExperiment,
          bodySchema: {
            description: descBodyExperimentRun,
            fields: [
              { name: "inputset_identity", type: "string", required: false, description: descInputsetIdentity },
              { name: "runtime_inputs", type: "object", required: false, description: descRuntimeInputs },
            ],
          },
        },
      },
    },

    // ── Chaos Experiment Run ───────────────────────────────────────────
    {
      resourceType: "chaos_experiment_run",
      displayName: "Chaos Experiment Run",
      description: descChaosExperimentRun,
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
          description: descGetExperimentRun,
        },
      },
    },

    // ── Chaos Probes ───────────────────────────────────────────────────
    {
      resourceType: "chaos_probe",
      displayName: "Chaos Probe",
      description: descChaosProbe,
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
          description: descListProbes,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/probes/{probeId}`,
          pathParams: { probe_id: "probeId" },
          responseExtractor: passthrough,
          description: descGetProbe,
        },
      },
      executeActions: {
        enable: {
          method: "POST",
          path: `${CHAOS}/rest/v2/probes/enable/{probeId}`,
          pathParams: { probe_id: "probeId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: descEnableProbe,
          bodySchema: { description: descBodyNoBody, fields: [] },
        },
        verify: {
          method: "POST",
          path: `${CHAOS}/rest/v2/probes/verify/{probeId}`,
          pathParams: { probe_id: "probeId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: descVerifyProbe,
          bodySchema: { description: descBodyNoBody, fields: [] },
        },
      },
    },

    // ── Chaos Experiment Templates ─────────────────────────────────────
    {
      resourceType: "chaos_experiment_template",
      displayName: "Chaos Experiment Template",
      description: descChaosExperimentTemplate,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["template_id"],
      listFilterFields: [
        { name: "hub_identity", description: descHubIdentity },
        { name: "infrastructure_type", description: descInfraType },
        { name: "search", description: descTemplateSearch },
        { name: "infrastructure", description: descInfrastructure },
        { name: "tags", description: descTags },
        { name: "include_all_scope", description: descIncludeAllScope, type: "boolean" },
        { name: "sort_field", description: descSortField, enum: ["name", "lastUpdated", "experimentName"] },
        { name: "sort_ascending", description: descSortAsc, type: "boolean" },
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
            search: "search",
            infrastructure: "infrastructure",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
            include_all_scope: "includeAllScope",
            tags: "tags",
          },
          responseExtractor: chaosPageExtract,
          description: descListExperimentTemplates,
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
          description: descGetExperimentTemplate,
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/rest/experimenttemplates/{templateId}`,
          pathParams: { template_id: "templateId" },
          queryParams: { hub_identity: "hubIdentity" },
          responseExtractor: passthrough,
          description: descDeleteExperimentTemplate,
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
            ...(input.description ? { description: input.description } : {}),
            ...(input.tags ? { tags: input.tags } : {}),
            ...(input.import_type ? { importType: input.import_type } : {}),
            accountIdentifier: input.account_id,
            organizationIdentifier: input.org_id,
            projectIdentifier: input.project_id,
          }),
          responseExtractor: passthrough,
          actionDescription: descCreateFromTemplate,
          bodySchema: {
            description: descBodyCreateFromTemplate,
            fields: [
              { name: "name", type: "string", required: true, description: descExperimentName },
              { name: "identity", type: "string", required: false, description: descExperimentIdentity },
              { name: "infra_ref", type: "string", required: true, description: descInfraRef },
              { name: "hub_identity", type: "string", required: true, description: descHubIdentity },
              { name: "description", type: "string", required: false, description: descExperimentDescription },
              { name: "tags", type: "array", required: false, description: descExperimentTags },
              { name: "import_type", type: "string", required: false, description: descImportType },
            ],
          },
        },
        list_revisions: {
          method: "GET",
          path: `${CHAOS}/rest/experimenttemplates/{templateId}/revisions`,
          pathParams: { template_id: "templateId" },
          queryParams: {
            hub_identity: "hubIdentity",
            page: "page",
            limit: "limit",
          },
          responseExtractor: passthrough,
          actionDescription: descListRevisions,
          bodySchema: {
            description: "No body required. Template identified by path parameter.",
            fields: [
              { name: "template_id", type: "string", required: true, description: descTemplateIdentity },
              { name: "hub_identity", type: "string", required: true, description: descHubIdentity },
            ],
          },
        },
        get_variables: {
          method: "GET",
          path: `${CHAOS}/rest/experimenttemplates/{templateId}/variables`,
          pathParams: { template_id: "templateId" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision: "revision",
          },
          responseExtractor: passthrough,
          actionDescription: descGetVariables,
          bodySchema: {
            description: "No body required. Template identified by path parameter.",
            fields: [
              { name: "template_id", type: "string", required: true, description: descTemplateIdentity },
              { name: "hub_identity", type: "string", required: true, description: descHubIdentity },
              { name: "revision", type: "string", required: false, description: descRevision },
            ],
          },
        },
        get_yaml: {
          method: "GET",
          path: `${CHAOS}/rest/experimenttemplates/{templateId}/yaml`,
          pathParams: { template_id: "templateId" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision: "revision",
          },
          responseExtractor: passthrough,
          actionDescription: descGetYaml,
          bodySchema: {
            description: "No body required. Template identified by path parameter.",
            fields: [
              { name: "template_id", type: "string", required: true, description: descTemplateIdentity },
              { name: "hub_identity", type: "string", required: true, description: descHubIdentity },
              { name: "revision", type: "string", required: false, description: descRevision },
            ],
          },
        },
        compare_revisions: {
          method: "GET",
          path: `${CHAOS}/rest/experimenttemplates/{templateId}/compare`,
          pathParams: { template_id: "templateId" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision1: "revision1",
            revision2: "revision2",
          },
          responseExtractor: passthrough,
          actionDescription: descCompareRevisions,
          bodySchema: {
            description: "No body required. Template identified by path parameter.",
            fields: [
              { name: "template_id", type: "string", required: true, description: descTemplateIdentity },
              { name: "hub_identity", type: "string", required: true, description: descHubIdentity },
              { name: "revision1", type: "string", required: true, description: descRevision1 },
              { name: "revision2", type: "string", required: true, description: descRevision2 },
            ],
          },
        },
      },
    },

    // ── Chaos Experiment Variables ──────────────────────────────────────
    {
      resourceType: "chaos_experiment_variable",
      displayName: "Chaos Experiment Variable",
      description: descChaosExperimentVariable,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["experiment_id"],
      listFilterFields: [
        { name: "experiment_id", description: descExperimentId, required: true },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/chaos/experiments/{experimentId}",
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}/variables`,
          pathParams: { experiment_id: "experimentId" },
          staticQueryParams: { isIdentity: "false" },
          responseExtractor: passthrough,
          description: descListExperimentVariables,
        },
      },
    },

    // ── Chaos Infrastructure — Linux / Machine ─────────────────────────
    {
      resourceType: "chaos_infrastructure",
      displayName: "Chaos Infrastructure (Linux)",
      description: descChaosInfrastructure,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["infra_id"],
      listFilterFields: [
        { name: "status", description: descInfraStatus, enum: ["Active", "All"] },
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
          description: descListLinuxInfra,
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
      description: descChaosLoadtest,
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
          description: descListLoadtests,
        },
        get: {
          method: "GET",
          path: `${CHAOS_LOADTEST}/v1/load-tests/{loadtestId}`,
          pathParams: { loadtest_id: "loadtestId" },
          responseExtractor: passthrough,
          description: descGetLoadtest,
        },
        create: {
          method: "POST",
          path: `${CHAOS_LOADTEST}/v1/load-tests`,
          bodyBuilder: (input) => input.body ?? {},
          responseExtractor: passthrough,
          description: descCreateLoadtest,
          bodySchema: {
            description: descBodyLoadtestDefinition,
            fields: [
              { name: "name", type: "string", required: true, description: descLoadtestName },
              { name: "type", type: "string", required: false, description: descLoadtestType },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS_LOADTEST}/v1/load-tests/{loadtestId}`,
          pathParams: { loadtest_id: "loadtestId" },
          responseExtractor: passthrough,
          description: descDeleteLoadtest,
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: `${CHAOS_LOADTEST}/v1/load-tests/{loadtestId}/runs`,
          pathParams: { loadtest_id: "loadtestId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: descRunLoadtest,
          bodySchema: { description: descBodyNoBody, fields: [] },
        },
        stop: {
          method: "POST",
          path: `${CHAOS_LOADTEST}/v1/runs/{runId}/stop`,
          pathParams: { run_id: "runId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: descStopLoadtest,
          bodySchema: { description: descBodyNoBody, fields: [] },
        },
      },
    },

    // ── Chaos Kubernetes Infrastructure ──────────────────────────────
    {
      resourceType: "chaos_k8s_infrastructure",
      displayName: "Chaos K8s Infrastructure",
      description: descChaosK8sInfrastructure,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["infra_id"],
      listFilterFields: [
        { name: "environment_id", description: descEnvironmentId },
        { name: "status", description: descK8sInfraStatus, enum: ["ACTIVE", "INACTIVE", "PENDING", "All"] },
        { name: "include_legacy_infra", description: descIncludeLegacyInfra, type: "boolean" },
        { name: "search", description: descSearchK8sInfra },
      ],
      operations: {
        list: {
          method: "POST",
          path: `${CHAOS}/rest/v2/infrastructures`,
          queryParams: {
            page: "page",
            limit: "limit",
            environment_id: "environmentIdentifier",
            search: "search",
            include_legacy_infra: "includeLegacyInfra",
          },
          bodyBuilder: (input) => {
            const filter: Record<string, unknown> = {};
            const statusInput = input.status as string | undefined;
            if (statusInput && statusInput !== "All") {
              filter.status = statusInput;
            } else if (!statusInput) {
              filter.status = "ACTIVE";
            }
            if (input.search) {
              filter.name = input.search;
            }
            return {
              pagination: { page: input.page ?? 0, limit: input.limit ?? 15 },
              sort: { field: "LAST_MODIFIED", ascending: false },
              ...(Object.keys(filter).length > 0 ? { filter } : {}),
            };
          },
          responseExtractor: chaosPageExtract,
          description: descListK8sInfra,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/kubernetes/infra/{infraId}`,
          pathParams: { infra_id: "infraId" },
          responseExtractor: passthrough,
          description: descGetK8sInfra,
        },
      },
      executeActions: {
        check_health: {
          method: "GET",
          path: `${CHAOS}/rest/kubernetes/infra/health/{infraId}`,
          pathParams: { infra_id: "infraId" },
          responseExtractor: passthrough,
          actionDescription: descCheckK8sHealth,
          bodySchema: { description: descBodyNoBody, fields: [] },
        },
      },
    },

    // ── Chaos Hubs ──────────────────────────────────────────────────
    {
      resourceType: "chaos_hub",
      displayName: "Chaos Hub",
      description: descChaosHub, // can also refer to other tools like exp, fault templates, etc
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["hub_id"],
      listFilterFields: [
        { name: "search", description: descHubSearch },
        { name: "include_all_scope", description: descIncludeAllScope, type: "boolean" },
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
          description: descListHubs,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/hubs/{hubId}`,
          pathParams: { hub_id: "hubId" },
          responseExtractor: passthrough,
          description: descGetHub,
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
          description: descCreateHub,
          bodySchema: {
            description: "ChaosHub creation payload",
            fields: [
              { name: "identity", type: "string", required: true, description: descHubIdentityExact },
              { name: "name", type: "string", required: true, description: descHubName },
              { name: "description", type: "string", required: false, description: descHubDescription },
              { name: "tags", type: "string", required: false, description: descHubTags },
              { name: "connector_ref", type: "string", required: false, description: descConnectorRef },
              { name: "repo_name", type: "string", required: false, description: descRepoName },
              { name: "repo_branch", type: "string", required: false, description: descRepoBranch },
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
          description: descUpdateHub,
          bodySchema: {
            description: "ChaosHub update payload (replace-all model)",
            fields: [
              { name: "name", type: "string", required: true, description: descHubNameUpdate },
              { name: "description", type: "string", required: false, description: descHubDescriptionUpdate },
              { name: "tags", type: "string", required: false, description: descHubTagsReplace },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/rest/hubs/{hubId}`,
          pathParams: { hub_id: "hubId" },
          responseExtractor: passthrough,
          description: descDeleteHub,
        },
      },
    },

    // ── Chaos Faults ────────────────────────────────────────────────
    {
      resourceType: "chaos_fault",
      displayName: "Chaos Fault",
      description: descChaosFault,
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
          description: descListFaults,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/faults/{faultId}`,
          pathParams: { fault_id: "faultId" },
          responseExtractor: passthrough,
          description: descGetFault,
        },
      },
    },

    // ── Chaos Fault Templates ───────────────────────────────────────
    {
      resourceType: "chaos_fault_template",
      displayName: "Chaos Fault Template",
      description: descChaosFaultTemplate,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["template_identity"],
      listFilterFields: [
        { name: "hub_identity", description: descHubIdentity },
        { name: "search", description: descTemplateSearch },
        { name: "type", description: descFaultType },
        { name: "infrastructure_type", description: descInfraType },
        { name: "infrastructure", description: descInfrastructure },
        { name: "category", description: descFaultCategory },
        { name: "tags", description: descTags },
        { name: "permissions_required", description: descFaultPermissions },
        { name: "include_all_scope", description: descIncludeAllScope, type: "boolean" },
        { name: "is_enterprise", description: descFaultIsEnterprise, type: "boolean" },
        { name: "sort_field", description: descSortField, enum: ["name", "lastUpdated"] },
        { name: "sort_ascending", description: descSortAsc, type: "boolean" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/faulttemplates`,
          queryParams: {
            page: "page",
            limit: "limit",
            hub_identity: "hubIdentity",
            type: "type",
            infrastructure_type: "infrastructureType",
            infrastructure: "infrastructure",
            search: "search",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
            include_all_scope: "includeAllScope",
            is_enterprise: "isEnterprise",
            tags: "tags",
            category: "category",
            permissions_required: "permissionsRequired",
          },
          responseExtractor: chaosPageExtract,
          description: descListFaultTemplates,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/faulttemplates/{templateIdentity}`,
          pathParams: { template_identity: "templateIdentity" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision: "revision",
          },
          responseExtractor: passthrough,
          description: descGetFaultTemplate,
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/rest/faulttemplates/{templateIdentity}`,
          pathParams: { template_identity: "templateIdentity" },
          queryParams: { hub_identity: "hubIdentity" },
          responseExtractor: passthrough,
          description: descDeleteFaultTemplate,
        },
      },
      executeActions: {
        list_revisions: {
          method: "GET",
          path: `${CHAOS}/rest/faulttemplates/{templateIdentity}/revisions`,
          pathParams: { template_identity: "templateIdentity" },
          queryParams: {
            hub_identity: "hubIdentity",
            page: "page",
            limit: "limit",
          },
          responseExtractor: passthrough,
          actionDescription: descListRevisions,
          bodySchema: {
            description: "No body required. Fault template identified by path parameter.",
            fields: [
              { name: "template_identity", type: "string", required: true, description: descTemplateIdentity },
              { name: "hub_identity", type: "string", required: true, description: descHubIdentity },
            ],
          },
        },
        get_variables: {
          method: "GET",
          path: `${CHAOS}/rest/faulttemplates/{templateIdentity}/variables`,
          pathParams: { template_identity: "templateIdentity" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision: "revision",
          },
          responseExtractor: passthrough,
          actionDescription: descGetVariables,
          bodySchema: {
            description: "No body required. Fault template identified by path parameter.",
            fields: [
              { name: "template_identity", type: "string", required: true, description: descTemplateIdentity },
              { name: "hub_identity", type: "string", required: true, description: descHubIdentity },
              { name: "revision", type: "string", required: false, description: descRevision },
            ],
          },
        },
        get_yaml: {
          method: "GET",
          path: `${CHAOS}/rest/faulttemplates/{templateIdentity}/yaml`,
          pathParams: { template_identity: "templateIdentity" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision: "revision",
          },
          responseExtractor: passthrough,
          actionDescription: descGetYaml,
          bodySchema: {
            description: "No body required. Fault template identified by path parameter.",
            fields: [
              { name: "template_identity", type: "string", required: true, description: descTemplateIdentity },
              { name: "hub_identity", type: "string", required: true, description: descHubIdentity },
              { name: "revision", type: "string", required: false, description: descRevision },
            ],
          },
        },
        compare_revisions: {
          method: "GET",
          path: `${CHAOS}/rest/faulttemplates/{templateIdentity}/compare`,
          pathParams: { template_identity: "templateIdentity" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision1: "revision1",
            revision2: "revision2",
          },
          responseExtractor: passthrough,
          actionDescription: descCompareRevisions,
          bodySchema: {
            description: "No body required. Fault template identified by path parameter.",
            fields: [
              { name: "template_identity", type: "string", required: true, description: descTemplateIdentity },
              { name: "hub_identity", type: "string", required: true, description: descHubIdentity },
              { name: "revision1", type: "string", required: true, description: descRevision1 },
              { name: "revision2", type: "string", required: true, description: descRevision2 },
            ],
          },
        },
      },
    },

    // ── Chaos Probe Templates ────────────────────────────────────────
    {
      resourceType: "chaos_probe_template",
      displayName: "Chaos Probe Template",
      description: descChaosProbeTemplate,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["template_identity"],
      listFilterFields: [
        { name: "hub_identity", description: descHubIdentity },
        { name: "search", description: descTemplateSearch },
        { name: "infra_type", description: descInfraType, enum: ["Kubernetes", "KubernetesV2", "Linux", "Windows", "CloudFoundry", "Container"] },
        { name: "entity_type", description: descEntityTypeProbe, enum: ["httpProbe", "cmdProbe", "promProbe", "k8sProbe", "sloProbe", "datadogProbe", "dynatraceProbe", "containerProbe", "apmProbe"] },
        { name: "include_all_scope", description: descIncludeAllScope, type: "boolean" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/templates/probes`,
          queryParams: {
            page: "page",
            limit: "limit",
            hub_identity: "hubIdentity",
            search: "search",
            infra_type: "infraType",
            entity_type: "entityType",
            include_all_scope: "includeAllScope",
          },
          responseExtractor: chaosPageExtract,
          description: descListProbeTemplates,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/templates/probes/{templateIdentity}`,
          pathParams: { template_identity: "templateIdentity" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision: "revision",
          },
          responseExtractor: passthrough,
          description: descGetProbeTemplate,
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/rest/templates/probes/{templateIdentity}`,
          pathParams: { template_identity: "templateIdentity" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision: "revision",
          },
          responseExtractor: passthrough,
          description: descDeleteProbeTemplate,
        },
      },
      executeActions: {
        get_variables: {
          method: "GET",
          path: `${CHAOS}/rest/templates/probes/{templateIdentity}/variables`,
          pathParams: { template_identity: "templateIdentity" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision: "revision",
          },
          responseExtractor: passthrough,
          actionDescription: descGetProbeTemplateVariables,
          bodySchema: {
            description: "No body required. Probe template identified by path parameter.",
            fields: [
              { name: "template_identity", type: "string", required: true, description: descTemplateIdentity },
              { name: "hub_identity", type: "string", required: false, description: descHubIdentity },
              { name: "revision", type: "string", required: false, description: descRevision },
            ],
          },
        },
      },
    },

    // ── Chaos Action Templates ────────────────────────────────────────
    {
      resourceType: "chaos_action_template",
      displayName: "Chaos Action Template",
      description: descChaosActionTemplate,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["template_identity"],
      listFilterFields: [
        { name: "hub_identity", description: descHubIdentity },
        { name: "search", description: descTemplateSearch },
        { name: "infra_type", description: descInfraType, enum: ["Kubernetes", "KubernetesV2", "Linux", "Windows", "CloudFoundry", "Container"] },
        { name: "entity_type", description: descEntityTypeAction, enum: ["delay", "customScript", "container"] },
        { name: "include_all_scope", description: descIncludeAllScope, type: "boolean" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/templates/actions`,
          queryParams: {
            page: "page",
            limit: "limit",
            hub_identity: "hubIdentity",
            search: "search",
            infra_type: "infraType",
            entity_type: "entityType",
            include_all_scope: "includeAllScope",
          },
          responseExtractor: chaosPageExtract,
          description: descListActionTemplates,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/templates/actions/{templateIdentity}`,
          pathParams: { template_identity: "templateIdentity" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision: "revision",
          },
          responseExtractor: passthrough,
          description: descGetActionTemplate,
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/rest/templates/actions/{templateIdentity}`,
          pathParams: { template_identity: "templateIdentity" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision: "revision",
          },
          responseExtractor: passthrough,
          description: descDeleteActionTemplate,
        },
      },
      executeActions: {
        list_revisions: {
          method: "GET",
          path: `${CHAOS}/rest/templates/actions/{templateIdentity}/revisions`,
          pathParams: { template_identity: "templateIdentity" },
          queryParams: {
            hub_identity: "hubIdentity",
            page: "page",
            limit: "limit",
            search: "search",
            infra_type: "infraType",
            entity_type: "entityType",
            include_all_scope: "includeAllScope",
          },
          responseExtractor: passthrough,
          actionDescription: descListActionTemplateRevisions,
          bodySchema: {
            description: "No body required. Action template identified by path parameter.",
            fields: [
              { name: "template_identity", type: "string", required: true, description: descTemplateIdentity },
              { name: "hub_identity", type: "string", required: false, description: descHubIdentity },
            ],
          },
        },
        get_variables: {
          method: "GET",
          path: `${CHAOS}/rest/templates/actions/{templateIdentity}/variables`,
          pathParams: { template_identity: "templateIdentity" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision: "revision",
          },
          responseExtractor: passthrough,
          actionDescription: descGetActionTemplateVariables,
          bodySchema: {
            description: "No body required. Action template identified by path parameter.",
            fields: [
              { name: "template_identity", type: "string", required: true, description: descTemplateIdentity },
              { name: "hub_identity", type: "string", required: false, description: descHubIdentity },
              { name: "revision", type: "string", required: false, description: descRevision },
            ],
          },
        },
        compare_revisions: {
          method: "GET",
          path: `${CHAOS}/rest/templates/actions/{templateIdentity}/compare`,
          pathParams: { template_identity: "templateIdentity" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision: "revision",
            revision_to_compare: "revisionToCompare",
          },
          responseExtractor: passthrough,
          actionDescription: descCompareActionTemplateRevisions,
          bodySchema: {
            description: "No body required. Action template identified by path parameter.",
            fields: [
              { name: "template_identity", type: "string", required: true, description: descTemplateIdentity },
              { name: "hub_identity", type: "string", required: false, description: descHubIdentity },
              { name: "revision", type: "string", required: true, description: descRevision1 },
              { name: "revision_to_compare", type: "string", required: true, description: descRevisionToCompare },
            ],
          },
        },
      },
    },

    // ── Chaos Hub Faults ──────────────────────────────────────────────
    {
      resourceType: "chaos_hub_fault",
      displayName: "Chaos Hub Fault",
      description: descChaosHubFault,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: [],
      listFilterFields: [
        { name: "hub_identity", description: descHubIdentity },
        { name: "search", description: descTemplateSearch },
        { name: "infra_type", description: descInfraType, enum: ["Kubernetes", "KubernetesV2", "Linux", "Windows", "CloudFoundry", "Container"] },
        { name: "entity_type", description: descEntityTypeFault },
        { name: "permissions_required", description: descPermissionsRequiredEnum, enum: ["Basic", "Advanced"] },
        { name: "include_all_scope", description: descIncludeAllScope, type: "boolean" },
        { name: "only_templatised_faults", description: descOnlyTemplatisedFaults, type: "boolean" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/hubs/faults`,
          queryParams: {
            page: "page",
            limit: "limit",
            hub_identity: "hubIdentity",
            search: "search",
            infra_type: "infraType",
            entity_type: "entityType",
            permissions_required: "permissionsRequired",
            include_all_scope: "includeAllScope",
            only_templatised_faults: "onlyTemplatisedFaults",
          },
          responseExtractor: passthrough,
          description: descListHubFaults,
        },
      },
    },

    // ── Chaos Environments ────────────────────────────────────────────
    {
      resourceType: "chaos_environment",
      displayName: "Chaos Environment",
      description: descChaosEnvironment,
      toolset: "chaos",
      scope: "project",
      identifierFields: ["environment_id"],
      listFilterFields: [
        { name: "search_term", description: descSearchTermEnv },
        { name: "sort", description: descSortEnv },
        { name: "environment_type", description: descEnvironmentType, enum: ["PreProduction", "Production"] },
      ],
      operations: {
        list: {
          method: "POST",
          path: `/ng/api/environmentsV2/listV2`,
          queryParams: {
            page: "page",
            size: "size",
            search_term: "searchTerm",
            sort: "sort",
          },
          defaultQueryParams: { sort: "lastModifiedAt,DESC" },
          bodyBuilder: (input) => ({
            filterType: "Environment",
            ...(input.environment_type ? { environmentTypes: [input.environment_type] } : {}),
          }),
          responseExtractor: (raw: unknown): { items: unknown[]; total: number } => {
            const r = raw as { data?: { content?: unknown[]; totalItems?: number } };
            return {
              items: r.data?.content ?? [],
              total: r.data?.totalItems ?? 0,
            };
          },
          description: descListChaosEnvironments,
        },
      },
    },

    // ── Chaos Network Maps ──────────────────────────────────────────
    {
      resourceType: "chaos_network_map",
      displayName: "Chaos Network Map",
      description: descChaosNetworkMap,
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
          description: descListNetworkMaps,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/applicationmaps/{mapId}`,
          pathParams: { map_id: "mapId" },
          responseExtractor: passthrough,
          description: descGetNetworkMap,
        },
      },
    },

    // ── ChaosGuard Conditions ───────────────────────────────────────
    {
      resourceType: "chaos_guard_condition",
      displayName: "ChaosGuard Condition",
      description: descChaosGuardCondition,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["condition_id"],
      listFilterFields: [
        { name: "search", description: descGuardSearch },
        { name: "sort_field", description: descSortField, enum: ["name", "lastUpdated"] },
        { name: "sort_ascending", description: descSortAsc, type: "boolean" },
        { name: "infrastructure_type", description: descGuardInfraType, enum: ["Kubernetes", "KubernetesV2", "Linux", "Windows"] },
        { name: "tags", description: descGuardTags },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/v3/chaosguard-conditions`,
          queryParams: {
            page: "page",
            limit: "limit",
            search: "search",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
            infrastructure_type: "infrastructureType",
            tags: "tags",
          },
          responseExtractor: chaosPageExtract,
          description: descListGuardConditions,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/v3/chaosguard-conditions/{conditionId}`,
          pathParams: { condition_id: "conditionId" },
          responseExtractor: passthrough,
          description: descGetGuardCondition,
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/v3/chaosguard-conditions/{conditionId}`,
          pathParams: { condition_id: "conditionId" },
          responseExtractor: passthrough,
          description: descDeleteGuardCondition,
        },
      },
    },

    // ── ChaosGuard Rules ────────────────────────────────────────────
    {
      resourceType: "chaos_guard_rule",
      displayName: "ChaosGuard Rule",
      description: descChaosGuardRule,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["rule_id"],
      listFilterFields: [
        { name: "search", description: descGuardSearch },
        { name: "sort_field", description: descSortField, enum: ["name", "lastUpdated"] },
        { name: "sort_ascending", description: descSortAsc, type: "boolean" },
        { name: "infrastructure_type", description: descGuardInfraType, enum: ["Kubernetes", "KubernetesV2", "Linux", "Windows"] },
        { name: "tags", description: descGuardTags },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/v3/chaosguard-rules`,
          queryParams: {
            page: "page",
            limit: "limit",
            search: "search",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
            infrastructure_type: "infrastructureType",
            tags: "tags",
          },
          responseExtractor: chaosPageExtract,
          description: descListGuardRules,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/v3/chaosguard-rules/{ruleId}`,
          pathParams: { rule_id: "ruleId" },
          responseExtractor: passthrough,
          description: descGetGuardRule,
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/v3/chaosguard-rules/{ruleId}`,
          pathParams: { rule_id: "ruleId" },
          responseExtractor: passthrough,
          description: descDeleteGuardRule,
        },
      },
      executeActions: {
        enable: {
          method: "PUT",
          path: `${CHAOS}/v3/chaosguard-rules/{ruleId}/enable`,
          pathParams: { rule_id: "ruleId" },
          queryParams: { enabled: "enabled" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: descEnableGuardRule,
          bodySchema: {
            description: "No body required. Rule identity and enabled flag are passed as path/query parameters.",
            fields: [
              { name: "rule_id", type: "string", required: true, description: `Identifier of the ChaosGuard rule to enable/disable.` },
              { name: "enabled", type: "boolean", required: true, description: descGuardEnabled },
            ],
          },
        },
      },
    },

    // ── Chaos Recommendations ───────────────────────────────────────
    {
      resourceType: "chaos_recommendation",
      displayName: "Chaos Recommendation",
      description: descChaosRecommendation,
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
          description: descListRecommendations,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/recommendations/{recommendationId}`,
          pathParams: { recommendation_id: "recommendationId" },
          responseExtractor: passthrough,
          description: descGetRecommendation,
        },
      },
    },

    // ── Chaos Risks ─────────────────────────────────────────────────
    {
      resourceType: "chaos_risk",
      displayName: "Chaos Risk",
      description: descChaosRisk,
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
          description: descListRisks,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/risks/{riskId}`,
          pathParams: { risk_id: "riskId" },
          responseExtractor: passthrough,
          description: descGetRisk,
        },
      },
    },
  ],
};
