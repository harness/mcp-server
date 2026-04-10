import type { ToolsetDefinition } from "../types.js";
import {
  passthrough,
  ngExtract,
  chaosPageExtract,
  chaosProbeListExtract,
  chaosInfraListExtract,
  chaosK8sInfraListExtract,
  chaosHubListExtract,
  chaosDRTestListExtract,
} from "../extractors.js";
import {
  descToolsetChaos,
  // Resource descriptions
  descChaosExperiment, descChaosExperimentRun, descChaosProbe,
  descChaosExperimentTemplate, descChaosExperimentVariable,
  descChaosInfrastructure, descChaosLoadtest, descChaosK8sInfrastructure,
  descChaosHub, descChaosFault, descChaosFaultExperimentRun, descChaosFaultTemplate,
  descChaosProbeTemplate, descChaosActionTemplate,
  descChaosHubFault, descChaosEnvironment,
  descChaosNetworkMap,
  descChaosGuardCondition, descChaosGuardRule,
  descChaosRecommendation, descChaosRisk,
  descChaosAction, descChaosProbeInRun,
  descChaosDRTest,
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
  descListDRTests,
  descDeleteProbe, descGetProbeManifest,
  descListProbesInRun,
  descGetFaultVariables, descGetFaultYaml, descListFaultExperimentRuns, descDeleteFault,
  descListActions, descGetAction, descGetActionManifest, descDeleteAction,
  // Action descriptions
  descRunExperiment, descStopExperiment, descDeleteExperiment,
  descEnableProbe, descVerifyProbe,
  descCreateFromTemplate,
  descListRevisions, descGetVariables, descGetYaml, descCompareRevisions,
  descRunLoadtest, descStopLoadtest, descCheckK8sHealth,
  descEnableGuardRule,
  descGetProbeTemplateVariables,
  descListActionTemplateRevisions, descGetActionTemplateVariables, descCompareActionTemplateRevisions,
  // Body schema descriptions
  descBodyExperimentRun, descBodyNoBody,
  descBodyCreateFromTemplate, descBodyLoadtestDefinition,
  descBodyProbeEnable, descBodyProbeVerify, descBodyProbesInRun,
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
  descExperimentRunIdStop, descNotifyId, descForce,
  descIsEnabledFlag, descIsBulkUpdate, descVerifyFlag,
  descExperimentRunIds, descNotifyIds,
  descFaultIdentityParam, descIsEnterpriseFilter,
  descIsEnterpriseYaml, descIsEnterpriseVars, descIsEnterpriseRuns,
  descActionIdentityParam, descSearchActionsParam, descHubIdentityActions,
  descExperimentVariablesParam, descTasksParam,
  descEnvironmentIdCreate, descInfraIdCreate,
  descAccountIdBody, descOrgIdBody, descProjectIdBody,
  descSearchExperiments, descExperimentInfraId, descExperimentEnvironmentId, descExperimentIds,
  descExperimentStartDate, descExperimentEndDate,
  descSearchProbes, descProbeIds, descProbeSortField,
  descDRTestSort,
  descCreateDRTest,
  descBodyDRTestCreate,
  descDRTestName,
  descDRTestIdentifier,
  descDRTestDescription,
  descDRTestObjective,
  descDRTestTags,
  // Input set descriptions
  descChaosInputSet, descListInputSets, descGetInputSet,
  descCreateInputSet, descUpdateInputSet, descDeleteInputSet,
  descInputSetIdentityField, descInputSetName, descInputSetDescription,
  descInputSetSpec, descIsIdentity,
} from "./chaos-descriptions.js";

/**
 * Chaos API base path.
 * REST endpoints live under rest/v2/ (experiments, probes) and rest/ (templates).
 * Load test endpoints live under v1/.
 */
const CHAOS = "/chaos/manager/api";

/** Load test API uses a separate service path per v1 Go server. */
const CHAOS_LOADTEST = "/loadTest/manager/api";

/** Chaos scope override — Chaos REST API uses organizationIdentifier (not orgIdentifier). */
const CHAOS_SCOPE = { org: "organizationIdentifier" } as const;

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
      // NOTE: hce-saas backend limitations for ListChaosV2Experiments:
      // 1. infraName, status, infraActive are parsed but never applied in the MongoDB aggregation.
      // 2. infra_id and environment_id ONLY work when BOTH are provided (composite match: "envId/infraId").
      //    Sending just one is silently ignored by the repository layer.
      listFilterFields: [
        { name: "experiment_name", description: descSearchExperiments },
        { name: "infra_id", description: descExperimentInfraId },
        { name: "tags", description: descTags },
        { name: "experiment_ids", description: descExperimentIds },
        { name: "environment_id", description: descExperimentEnvironmentId },
        { name: "start_date", description: descExperimentStartDate },
        { name: "end_date", description: descExperimentEndDate },
      ],
      relatedResources: [
        { resourceType: "chaos_experiment_variable", relationship: "child", description: "Runtime variables for the experiment. List these to discover required inputs before running." },
        { resourceType: "chaos_input_set", relationship: "child", description: "Saved collections of variable overrides. Create input sets to reuse runtime configurations across runs." },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/v2/experiment`,
          queryParams: {
            page: "page",
            limit: "limit",
            size: "limit",
            experiment_name: "experimentName",
            search_term: "experimentName",
            infra_id: "infraId",
            tags: "tags",
            experiment_ids: "experimentIds",
            environment_id: "environmentIdentifier",
            start_date: "startDate",
            end_date: "endDate",
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
        delete: {
          method: "DELETE",
          path: `${CHAOS}/rest/v2/experiment/{experimentId}`,
          pathParams: { experiment_id: "experimentId" },
          responseExtractor: passthrough,
          description: descDeleteExperiment,
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
            // Build runtimeInputs from experiment_variables and tasks if provided
            const expVars = input.experiment_variables as Array<{ name: string; value?: unknown }> | undefined;
            const taskVars = input.tasks as Record<string, Record<string, unknown>> | undefined;
            if ((expVars && expVars.length > 0) || (taskVars && Object.keys(taskVars).length > 0)) {
              const runtimeInputs: Record<string, unknown> = {};
              if (expVars && expVars.length > 0) {
                runtimeInputs.experiment = expVars.map(v => ({ name: v.name, value: v.value }));
              }
              if (taskVars && Object.keys(taskVars).length > 0) {
                const tasks: Record<string, Array<{ name: string; value: unknown }>> = {};
                for (const [taskName, vars] of Object.entries(taskVars)) {
                  tasks[taskName] = Object.entries(vars as Record<string, unknown>).map(([n, v]) => ({ name: n, value: v }));
                }
                runtimeInputs.tasks = tasks;
              }
              body.runtimeInputs = runtimeInputs;
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
              { name: "experiment_variables", type: "array", required: false, description: descExperimentVariablesParam },
              { name: "tasks", type: "object", required: false, description: descTasksParam },
            ],
          },
        },
        stop: {
          method: "POST",
          path: `${CHAOS}/rest/v2/experiment/{experimentId}/stop`,
          pathParams: { experiment_id: "experimentId" },
          queryParams: {
            experiment_run_id: "experimentRunId",
            notify_id: "notifyId",
            force: "force",
          },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: descStopExperiment,
          bodySchema: {
            description: "No body required. Stop parameters are passed as query parameters & don't pass anything to request body.",
            fields: [
              { name: "experiment_run_id", type: "string", required: false, description: descExperimentRunIdStop },
              { name: "notify_id", type: "string", required: false, description: descNotifyId },
              { name: "force", type: "boolean", required: false, description: descForce },
            ],
          },
        },
      },
    },

    // ── Chaos Experiment Run - Gives the status of an experiment run. (It doesn't start a run) ───────────────────────────────────────────
    {
      resourceType: "chaos_experiment_run",
      displayName: "Chaos Experiment Run",
      description: descChaosExperimentRun,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["experiment_id"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/chaos/experiments/{experimentId}",
      operations: {
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/chaos-pipeline/{experimentId}`,
          pathParams: { experiment_id: "experimentId" },
          queryParams: { run_id: "experimentRunId", notify_id: "notifyId" },
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
      listFilterFields: [
        { name: "search", description: descSearchProbes },
        { name: "tags", description: descTags },
        { name: "start_date", description: descExperimentStartDate },
        { name: "end_date", description: descExperimentEndDate },
        { name: "probe_ids", description: descProbeIds },
        { name: "infra_type", description: descInfraType },
        { name: "sort_field", description: descProbeSortField },
        { name: "sort_ascending", description: descSortAsc, type: "boolean" as const },
        { name: "entity_type", description: descEntityTypeProbe },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/v2/probes`,
          queryParams: {
            page: "page",
            limit: "limit",
            size: "limit",
            search: "search",
            search_term: "search",
            tags: "tags",
            start_date: "startDate",
            end_date: "endDate",
            probe_ids: "probeIDs",
            infra_type: "infraType",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
            entity_type: "entityType",
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
        delete: {
          method: "DELETE",
          path: `${CHAOS}/rest/v2/probes/{probeId}`,
          pathParams: { probe_id: "probeId" },
          responseExtractor: passthrough,
          description: descDeleteProbe,
        },
      },
      executeActions: {
        enable: {
          method: "POST",
          path: `${CHAOS}/rest/v2/probes/{probeId}/enable`,
          pathParams: { probe_id: "probeId" },
          bodyBuilder: (input) => {
            const b = (input.body ?? input) as Record<string, unknown>;
            return {
              isEnabled: b.is_enabled ?? true,
              ...(b.is_bulk_update !== undefined ? { isBulkUpdate: b.is_bulk_update } : {}),
            };
          },
          responseExtractor: passthrough,
          actionDescription: descEnableProbe,
          bodySchema: {
            description: descBodyProbeEnable,
            fields: [
              { name: "is_enabled", type: "boolean", required: false, description: descIsEnabledFlag },
              { name: "is_bulk_update", type: "boolean", required: false, description: descIsBulkUpdate },
            ],
          },
        },
        verify: {
          method: "POST",
          path: `${CHAOS}/rest/v2/probes/{probeId}/verify`,
          pathParams: { probe_id: "probeId" },
          bodyBuilder: (input) => {
            const b = (input.body ?? input) as Record<string, unknown>;
            return { verify: b.verify ?? true };
          },
          responseExtractor: passthrough,
          actionDescription: descVerifyProbe,
          bodySchema: {
            description: descBodyProbeVerify,
            fields: [
              { name: "verify", type: "boolean", required: true, description: descVerifyFlag },
            ],
          },
        },
        get_manifest: {
          method: "GET",
          path: `${CHAOS}/rest/v2/probes/manifest/{probeId}`,
          pathParams: { probe_id: "probeId" },
          responseExtractor: passthrough,
          actionDescription: descGetProbeManifest,
          bodySchema: { description: descBodyNoBody, fields: [] },
        },
      },
    },

    // ── Chaos Probes in Experiment Run ─────────────────────────────────
    {
      resourceType: "chaos_probe_in_run",
      displayName: "Chaos Probe in Experiment Run",
      description: descChaosProbeInRun,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: [],
      listFilterFields: [
        { name: "experiment_run_ids", description: descExperimentRunIds },
        { name: "notify_ids", description: descNotifyIds },
      ],
      operations: {
        list: {
          method: "POST",
          path: `${CHAOS}/rest/v2/probes/experiment-run`,
          bodyBuilder: (input) => {
            const body: Record<string, unknown> = {};
            if (input.experiment_run_ids) {
              body.experimentRunIds = Array.isArray(input.experiment_run_ids)
                ? input.experiment_run_ids
                : (input.experiment_run_ids as string).split(",").map((s: string) => s.trim());
            }
            if (input.notify_ids) {
              body.notifyIds = Array.isArray(input.notify_ids)
                ? input.notify_ids
                : (input.notify_ids as string).split(",").map((s: string) => s.trim());
            }
            return body;
          },
          responseExtractor: (raw: unknown): { items: unknown[]; total: number } => {
            const r = raw as { data?: unknown[] };
            return {
              items: r.data ?? (Array.isArray(raw) ? raw : []),
              total: Array.isArray(r.data) ? r.data.length : (Array.isArray(raw) ? (raw as unknown[]).length : 0),
            };
          },
          description: descListProbesInRun,
          bodySchema: {
            description: descBodyProbesInRun,
            fields: [
              { name: "experiment_run_ids", type: "array", required: false, description: descExperimentRunIds },
              { name: "notify_ids", type: "array", required: false, description: descNotifyIds },
            ],
          },
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
            size: "limit",
            hub_identity: "hubIdentity",
            infrastructure_type: "infrastructureType",
            search: "search",
            infrastructure: "infrastructure",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
            include_all_scope: "includeAllScope",
            tags: "tags",
          },
          defaultQueryParams: { includeAllScope: "false" },
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
          queryParams: { hub_identity: "hubIdentity", revision: "revision" },
          bodyBuilder: (input) => {
            const b = (input.body ?? input) as Record<string, unknown>;
            let infraRef = b.infra_ref as string | undefined;
            if (!infraRef && b.infra_id) {
              const envId = b.environment_id as string | undefined;
              const infraId = b.infra_id as string;
              if (envId && !infraId.startsWith(`${envId}/`)) {
                infraRef = `${envId}/${infraId}`;
              } else {
                infraRef = infraId;
              }
            }
            return {
              name: b.name,
              identity: b.identity,
              infraRef,
              importType: (b.import_type as string) ?? "LOCAL",
              ...(b.description ? { description: b.description } : {}),
              ...(b.tags ? { tags: b.tags } : {}),
              accountIdentifier: b.account_id ?? input.account_id,
              organizationIdentifier: b.org_id ?? input.org_id,
              projectIdentifier: b.project_id ?? input.project_id,
            };
          },
          responseExtractor: passthrough,
          actionDescription: descCreateFromTemplate,
          bodySchema: {
            description: descBodyCreateFromTemplate,
            fields: [
              { name: "account_id", type: "string", required: false, description: descAccountIdBody },
              { name: "org_id", type: "string", required: false, description: descOrgIdBody },
              { name: "project_id", type: "string", required: false, description: descProjectIdBody },
              { name: "name", type: "string", required: true, description: descExperimentName },
              { name: "identity", type: "string", required: true, description: descExperimentIdentity },
              { name: "infra_ref", type: "string", required: false, description: descInfraRef },
              { name: "infra_id", type: "string", required: false, description: descInfraIdCreate },
              { name: "environment_id", type: "string", required: false, description: descEnvironmentIdCreate },
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

    // ── Chaos Experiment Input Sets ──────────────────────────────────
    {
      resourceType: "chaos_input_set",
      displayName: "Chaos Experiment Input Set",
      description: descChaosInputSet,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["experiment_id", "inputset_id"],
      listFilterFields: [
        { name: "experiment_id", description: descExperimentId, required: true },
        { name: "is_identity", description: descIsIdentity, type: "boolean" },
      ],
      relatedResources: [
        { resourceType: "chaos_experiment", relationship: "parent", description: "The experiment this input set belongs to." },
        { resourceType: "chaos_experiment_variable", relationship: "related", description: "Variables that can be overridden via the input set spec." },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}/inputsets`,
          pathParams: { experiment_id: "experimentId" },
          queryParams: { page: "page", limit: "limit", size: "limit", is_identity: "isIdentity" },
          defaultQueryParams: { isIdentity: "false" },
          responseExtractor: chaosPageExtract,
          description: descListInputSets,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}/inputsets/{inputsetId}`,
          pathParams: { experiment_id: "experimentId", inputset_id: "inputsetId" },
          queryParams: { is_identity: "isIdentity" },
          defaultQueryParams: { isIdentity: "false" },
          responseExtractor: ngExtract,
          description: descGetInputSet,
        },
        create: {
          method: "POST",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}/inputsets`,
          pathParams: { experiment_id: "experimentId" },
          queryParams: { is_identity: "isIdentity" },
          defaultQueryParams: { isIdentity: "false" },
          bodyBuilder: (input) => {
            const b = (input.body ?? input) as Record<string, unknown>;
            return {
              identity: b.identity,
              name: b.name,
              description: b.description,
              spec: b.spec,
            };
          },
          responseExtractor: ngExtract,
          description: descCreateInputSet,
          bodySchema: {
            description: "Create a new input set with variable overrides for a chaos experiment.",
            fields: [
              { name: "identity", type: "string", required: true, description: descInputSetIdentityField },
              { name: "name", type: "string", required: false, description: descInputSetName },
              { name: "description", type: "string", required: false, description: descInputSetDescription },
              { name: "spec", type: "string", required: true, description: descInputSetSpec },
            ],
          },
        },
        update: {
          method: "PUT",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}/inputsets/{inputsetId}`,
          pathParams: { experiment_id: "experimentId", inputset_id: "inputsetId" },
          queryParams: { is_identity: "isIdentity" },
          defaultQueryParams: { isIdentity: "false" },
          bodyBuilder: (input) => {
            const b = (input.body ?? input) as Record<string, unknown>;
            return {
              name: b.name,
              description: b.description,
              spec: b.spec,
            };
          },
          responseExtractor: ngExtract,
          description: descUpdateInputSet,
          bodySchema: {
            description: "Update an existing input set. Spec is required; name and description are optional.",
            fields: [
              { name: "name", type: "string", required: false, description: descInputSetName },
              { name: "description", type: "string", required: false, description: descInputSetDescription },
              { name: "spec", type: "string", required: true, description: descInputSetSpec },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}/inputsets/{inputsetId}`,
          pathParams: { experiment_id: "experimentId", inputset_id: "inputsetId" },
          queryParams: { is_identity: "isIdentity" },
          defaultQueryParams: { isIdentity: "false" },
          responseExtractor: passthrough,
          description: descDeleteInputSet,
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
          staticQueryParams: { infraType: "Linux" },
          queryParams: {
            page: "page",
            limit: "limit",
            size: "limit",
            search: "search",
            search_term: "search",
          },
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
    // than the chaos manager (chaos/manager/api), per v1 Go code.
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
      diagnosticHint: "An infrastructure can only create chaos experiments when status is ACTIVE and isChaosEnabled is true. Filter out any infrastructure that does not meet both conditions.",
      listFilterFields: [
        { name: "environment_id", description: descEnvironmentId },
        { name: "status", description: descK8sInfraStatus, enum: ["ACTIVE", "INACTIVE", "PENDING", "All"] },
        { name: "infra_type", description: descInfraType, enum: ["Kubernetes", "KubernetesV2", "Linux", "Windows", "CloudFoundry", "Container"] },
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
            size: "limit",
            environment_id: "environmentIdentifier",
            search: "search",
            search_term: "search",
            include_legacy_infra: "includeLegacyInfra",
          },
          bodyBuilder: (input) => {
            const filter: Record<string, unknown> = {};
            if (input.status && input.status !== "All") {
              filter.status = input.status;
            }
            if (input.infra_type) {
              filter.infraTypeFilter = input.infra_type;
            }
            return Object.keys(filter).length > 0 ? { filter } : {};
          },
          responseExtractor: chaosK8sInfraListExtract,
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
          path: `${CHAOS}/rest/kubernetes/infra/{infraId}/health`,
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
      description: descChaosHub,
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
            size: "limit",
            search: "search",
            search_term: "search",
            include_all_scope: "includeAllScope",
          },
          defaultQueryParams: { includeAllScope: "false" },
          responseExtractor: chaosHubListExtract,
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
          bodyBuilder: (input) => {
            const b = (input.body ?? input) as Record<string, unknown>;
            return {
              identity: b.identity,
              name: b.name,
              ...(b.description ? { description: b.description } : {}),
              ...(b.tags ? { tags: (b.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean) } : {}),
              ...(b.connector_ref ? { connectorRef: b.connector_ref } : {}),
              ...(b.repo_name ? { repoName: b.repo_name } : {}),
              ...(b.repo_branch ? { repoBranch: b.repo_branch } : {}),
            };
          },
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
          bodyBuilder: (input) => {
            const b = (input.body ?? input) as Record<string, unknown>;
            return {
              name: b.name,
              ...(b.description !== undefined ? { description: b.description } : {}),
              ...(b.tags ? { tags: (b.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean) } : {}),
            };
          },
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
      listFilterFields: [
        { name: "is_enterprise", description: descIsEnterpriseFilter, type: "boolean" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/faults`,
          queryParams: {
            page: "page",
            limit: "limit",
            size: "limit",
            search: "search",
            search_term: "search",
            is_enterprise: "isEnterprise",
          },
          responseExtractor: chaosPageExtract,
          description: descListFaults,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/faults/{faultId}`,
          pathParams: { fault_id: "faultId" },
          queryParams: {
            is_enterprise: "isEnterprise",
          },
          responseExtractor: passthrough,
          description: descGetFault,
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/rest/faults/{faultId}`,
          pathParams: { fault_id: "faultId" },
          responseExtractor: passthrough,
          description: descDeleteFault,
        },
      },
      executeActions: {
        get_variables: {
          method: "GET",
          path: `${CHAOS}/rest/faults/{faultId}/variables`,
          pathParams: { fault_id: "faultId" },
          queryParams: {
            is_enterprise: "isEnterprise",
          },
          responseExtractor: passthrough,
          actionDescription: descGetFaultVariables,
          bodySchema: {
            description: "No body required. fault_id is the path identifier (pass as resource_id). is_enterprise is a query parameter (pass via params, not body).",
            fields: [
              { name: "fault_id", type: "string", required: true, description: descFaultIdentityParam },
              { name: "is_enterprise", type: "boolean", required: false, description: descIsEnterpriseVars },
            ],
          },
        },
        get_yaml: {
          method: "GET",
          path: `${CHAOS}/rest/faults/{faultId}/yaml`,
          pathParams: { fault_id: "faultId" },
          queryParams: {
            is_enterprise: "isEnterprise",
          },
          responseExtractor: passthrough,
          actionDescription: descGetFaultYaml,
          bodySchema: {
            description: "No body required. fault_id is the path identifier (pass as resource_id). is_enterprise is a query parameter (pass via params, not body).",
            fields: [
              { name: "fault_id", type: "string", required: true, description: descFaultIdentityParam },
              { name: "is_enterprise", type: "boolean", required: false, description: descIsEnterpriseYaml },
            ],
          },
        },
      },
    },

    // ── Chaos Fault Experiment Runs ──────────────────────────────────
    // NOTE: hce-saas backend bug: GetFaultIDsFromIdentity returns [] (not error)
    // when fault identity doesn't match, causing the runs query to match ALL runs.
    // An invalid/nonexistent fault_id will return the entire runs dataset.
    {
      resourceType: "chaos_fault_experiment_run",
      displayName: "Chaos Fault Experiment Run",
      description: descChaosFaultExperimentRun,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["fault_id"],
      listFilterFields: [
        { name: "fault_id", description: descFaultIdentityParam, required: true },
        { name: "is_enterprise", description: descIsEnterpriseRuns, type: "boolean" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/faults/{faultId}/experimentruns`,
          pathParams: { fault_id: "faultId" },
          queryParams: {
            page: "page",
            limit: "limit",
            size: "limit",
            is_enterprise: "isEnterprise",
          },
          responseExtractor: chaosPageExtract,
          description: descListFaultExperimentRuns,
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
          // Backend limitations:
          // - is_enterprise: accepted but never used in List() query filter
          // - sort_field/sort_ascending: accepted but $sort stage missing from aggregation pipeline
          // - infrastructure_type: filters on infra_type field (expects "Kubernetes"), not infras array
          queryParams: {
            page: "page",
            limit: "limit",
            size: "limit",
            hub_identity: "hubIdentity",
            type: "type",
            infrastructure_type: "infrastructureType",
            infrastructure: "infrastructure",
            search: "search",
            search_term: "search",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
            include_all_scope: "includeAllScope",
            is_enterprise: "isEnterprise",
            tags: "tags",
            category: "category",
            permissions_required: "permissionsRequired",
          },
          defaultQueryParams: { includeAllScope: "false" },
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
            size: "limit",
            hub_identity: "hubIdentity",
            search: "search",
            infra_type: "infraType",
            entity_type: "entityType",
            include_all_scope: "includeAllScope",
          },
          defaultQueryParams: { includeAllScope: "false" },
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
            size: "limit",
            hub_identity: "hubIdentity",
            search: "search",
            infra_type: "infraType",
            entity_type: "entityType",
            include_all_scope: "includeAllScope",
          },
          defaultQueryParams: { includeAllScope: "false" },
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
          defaultQueryParams: { includeAllScope: "false" },
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

    // ── Chaos Actions ─────────────────────────────────────────────────
    {
      resourceType: "chaos_action",
      displayName: "Chaos Action",
      description: descChaosAction,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["action_id"],
      listFilterFields: [
        { name: "hub_identity", description: descHubIdentityActions },
        { name: "search", description: descSearchActionsParam },
        { name: "infra_type", description: descInfraType, enum: ["Kubernetes", "KubernetesV2", "Linux", "Windows", "CloudFoundry", "Container"] },
        { name: "entity_type", description: descEntityTypeAction, enum: ["delay", "customScript", "container"] },
        { name: "include_all_scope", description: descIncludeAllScope, type: "boolean" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/actions`,
          queryParams: {
            page: "page",
            limit: "limit",
            hub_identity: "hubIdentity",
            search: "search",
            infra_type: "infraType",
            entity_type: "entityType",
            include_all_scope: "includeAllScope",
          },
          defaultQueryParams: { includeAllScope: "false" },
          responseExtractor: chaosPageExtract,
          description: descListActions,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/actions/{actionId}`,
          pathParams: { action_id: "actionId" },
          responseExtractor: passthrough,
          description: descGetAction,
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/rest/actions/{actionId}`,
          pathParams: { action_id: "actionId" },
          responseExtractor: passthrough,
          description: descDeleteAction,
        },
      },
      executeActions: {
        get_manifest: {
          method: "GET",
          path: `${CHAOS}/rest/actions/manifest/{actionId}`,
          pathParams: { action_id: "actionId" },
          responseExtractor: passthrough,
          actionDescription: descGetActionManifest,
          bodySchema: {
            description: "No body required. Action identified by path parameter.",
            fields: [
              { name: "action_id", type: "string", required: true, description: descActionIdentityParam },
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
          defaultQueryParams: { includeAllScope: "false" },
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
      identifierFields: [],
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

    // ── Chaos DR Tests ────────────────────────────────────────────────
    {
      resourceType: "chaos_dr_test",
      displayName: "Chaos DR Test",
      description: descChaosDRTest,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["dr_test_id"],
      listFilterFields: [
        { name: "sort", description: descDRTestSort },
      ],
      diagnosticHint: "If the list returns empty, verify that: (1) pipelines exist in the project with tag module=drtest, (2) those pipelines contain at least one stage of type DRTest, and (3) the org/project identifiers are correct.",
      relatedResources: [
        {
          resourceType: "pipeline_summary",
          relationship: "backed-by",
          description: "Each DR test is backed by a Harness pipeline. Use harness_get with resource_type=pipeline_summary and pipeline_id=spec.pipeline.identity (from the DR test response) to fetch lightweight pipeline metadata (name, status, tags) — useful to verify the pipeline exists and is correctly tagged. For the full YAML definition, use resource_type=pipeline instead.",
        },
        {
          resourceType: "pipeline",
          relationship: "backed-by",
          description: "Each DR test is backed by a Harness pipeline. Use harness_get with resource_type=pipeline and pipeline_id=spec.pipeline.identity (from the DR test response) to fetch the full pipeline YAML definition — useful to inspect stages, chaos fault steps, or pipeline configuration.",
        },
        {
          resourceType: "pipeline",
          relationship: "backed-by",
          description: "To modify the pipeline backing a DR test: (1) fetch the current YAML with harness_get resource_type=pipeline, pipeline_id=spec.pipeline.identity; (2) apply only the user-requested changes to the fetched YAML — do NOT omit any existing fields since this is a full-replace PUT that will overwrite the entire pipeline; (3) call harness_execute resource_type=pipeline, action=update, pipeline_id=spec.pipeline.identity, store_type=INLINE (or REMOTE for Git-backed pipelines), body.yamlPipeline=<full updated YAML string>.",
        },
        {
          resourceType: "pipeline",
          relationship: "backed-by",
          description: "To run/execute the pipeline backing a DR test, use harness_execute with resource_type=pipeline, action=run, pipeline_id=spec.pipeline.identity (from the DR test response). Check required runtime inputs first with harness_get resource_type=runtime_input_template, resource_id=spec.pipeline.identity. Pass inputs as key-value pairs (e.g. {branch: 'main'}) or reference saved input sets via input_set_ids.",
        },
        {
          resourceType: "execution",
          relationship: "backed-by",
          description: "To interrupt (abort/pause) a running DR test execution, use harness_execute with resource_type=execution, action=interrupt, execution_id=<planExecutionId from spec.pipeline.recentRuns>, interrupt_type=AbortAll (or Pause, Resume, StageRollback, Abort, ExpireAll, Retry). The active execution ID is available in spec.pipeline.recentRuns from the DR test response.",
        },
        {
          resourceType: "pipeline",
          relationship: "backed-by",
          description: "To delete the pipeline backing a DR test (which permanently removes the DR test), use harness_execute with resource_type=pipeline, action=delete, pipeline_id=spec.pipeline.identity (from the DR test response). This is irreversible — confirm with the user before proceeding.",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/v3/dr-tests`,
          queryParams: {
            page: "page",
            limit: "limit",
            size: "limit",
            sort: "sort",
          },
          defaultQueryParams: {
            sort: "lastModified,DESC",
            limit: "15",
            page: "0",
          },
          responseExtractor: chaosDRTestListExtract,
          description: descListDRTests,
        },
        create: {
          method: "POST",
          path: `${CHAOS}/v3/dr-tests`,
          bodyBuilder: (input) => {
            const b = (input.body ?? input) as Record<string, unknown>;
            return {
              name: b.name,
              identifier: b.identifier,
              ...(b.description ? { description: b.description } : {}),
              ...(b.objective ? { objective: b.objective } : {}),
              ...(b.tags ? { tags: b.tags } : {}),
            };
          },
          responseExtractor: passthrough,
          description: descCreateDRTest,
          bodySchema: {
            description: descBodyDRTestCreate,
            fields: [
              { name: "name", type: "string", required: true, description: descDRTestName },
              { name: "identifier", type: "string", required: true, description: descDRTestIdentifier },
              { name: "description", type: "string", required: false, description: descDRTestDescription },
              { name: "objective", type: "string", required: false, description: descDRTestObjective },
              { name: "tags", type: "object", required: false, description: descDRTestTags },
            ],
          },
        },
      },
    },
  ],
};
