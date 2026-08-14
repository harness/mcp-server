import { randomUUID } from "node:crypto";
import YAML from "yaml";
import type { ToolsetDefinition, ParamsSchema } from "../types.js";
import {
  passthrough,
  ngExtract,
  chaosPageExtract,
  chaosHeatmapExtract,
  chaosScannedRiskGetExtract,
  chaosExperimentListExtract,
  chaosInputSetListExtract,
  chaosAppMapPageExtract,
  chaosProbeListExtract,
  chaosInfraListExtract,
  chaosK8sInfraListExtract,
  chaosLoadTestListExtract,
  chaosLoadTestExtract,
  chaosServiceListExtract,
  chaosHubListExtract,
  chaosDRTestListExtract,
  sdPageExtract,
  chaosRunTimeInputsExtract,
  chaosActionExtract,
} from "../extractors.js";
import {
  descToolsetChaos,
  // Resource descriptions
  descChaosExperiment, descChaosExperimentRun, descChaosProbe,
  descChaosExperimentTemplate, descChaosExperimentVariable,
  descChaosInfrastructure, descChaosLoadtest, descChaosService, descChaosK8sInfrastructure, descChaosEnabledInfrastructure,
  descChaosHub, descChaosFault, descChaosFaultExperimentRun, descChaosFaultTemplate,
  descChaosProbeTemplate, descChaosActionTemplate,
  descChaosHubFault, descChaosEnvironment,
  descChaosApplicationMap,
  descDiscoveredNetworkMap,
  descChaosGuardCondition, descChaosGuardRule,
  descChaosRecommendation, descChaosRisk,
  descChaosAction, descChaosProbeInRun,
  descChaosDRTest, descChaosComponentVariable,
  // Operation descriptions
  descListExperiments, descGetExperiment,
  descGetExperimentRun,
  descListProbes, descGetProbe, descCreateProbe,
  descListExperimentTemplates, descGetExperimentTemplate, descDeleteExperimentTemplate,
  descListExperimentVariables, descGetComponentVariable, descCreateExperiment,
  descListLinuxInfra,
  descListLoadtests, descGetLoadtest, descCreateLoadtest, descUpdateLoadtest, descDeleteLoadtest,
  descListChaosServices, descGetChaosService, descDeleteChaosService, descCreateChaosService, descUpdateChaosService,
  descChaosServiceEnvironmentIds, descChaosServiceInfrastructureIds,
  descChaosServiceTags, descChaosServiceIncludeAllScope,
  descChaosServiceProbeIds, descChaosServiceOnboardingIdFilter,
  descListChaosServiceExperimentRuns, descListChaosServiceLoadTests,
  descChaosServiceSearch,
  descChaosServiceIdentity,
  descBodyChaosServiceCreate, descBodyChaosServiceUpdate,
  descChaosServiceName, descChaosServiceDescription, descChaosServiceTagsBody,
  descChaosServiceExternalServiceId, descChaosServiceAgentId,
  descChaosServiceEnvironmentId, descChaosServiceInfrastructureId,
  descChaosServiceInfrastructureType, descChaosServiceOnboardingId,
  descChaosServiceProbes,
  descChaosServiceProbesUpdate,
  descListK8sInfra, descGetK8sInfra, descCreateK8sInfra, descListChaosEnabledInfra,
  descBodyK8sInfraCreate, descK8sInfraIdentityCreate, descK8sInfraNameCreate,
  descK8sInfraEnvironmentIdCreate, descK8sInfraInfraIdCreate, descK8sInfraConnectorIdCreate,
  descK8sInfraNamespaceCreate, descK8sInfraServiceAccountCreate, descK8sInfraScopeCreate,
  descK8sInfraTypeCreate, descK8sInfraAiEnabledCreate,
  descListHubs, descGetHub, descCreateHub, descUpdateHub, descDeleteHub,
  descListFaults, descGetFault,
  descListFaultTemplates, descGetFaultTemplate, descDeleteFaultTemplate,
  descListProbeTemplates, descGetProbeTemplate, descDeleteProbeTemplate,
  descListActionTemplates, descGetActionTemplate, descDeleteActionTemplate,
  descListHubFaults, descListChaosEnvironments,
  descListApplicationMaps, descGetApplicationMap,
  descAppMapSearch, descAppMapEnvironmentId, descAppMapInfraId,
  descAppMapAll, descAppMapMinimal,
  descListDiscoveredNetworkMaps, descSDNetworkMapSearch,
  descListGuardConditions, descGetGuardCondition, descDeleteGuardCondition,
  descListGuardRules, descGetGuardRule, descDeleteGuardRule,
  descListRecommendations, descGetRecommendation,
  descListRisks, descGetRisk,
  descListDRTests,
  descDeleteProbe, descGetProbeManifest,
  descListProbesInRun,
  descGetFaultVariables, descGetFaultYaml, descListFaultExperimentRuns, descDeleteFault,
  descListActions, descGetAction, descGetActionManifest, descDeleteAction,
  descCreateAction, descBodyActionCreate, descActionName, descActionIdentityCreate,
  descActionEntityTypeCreate, descActionInfraTypeCreate, descActionPropertiesBody,
  descActionDurationShorthand, descActionDescriptionCreate, descActionTagsCreate,
  descActionVariablesBody, descActionRunPropertiesBody, descActionInputsBody,
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
  descBodyExperimentRun, descBodyNoBody, descBodyExperimentCreate,
  descBodyCreateFromTemplate, descBodyLoadtestDefinition,
  descBodyProbeEnable, descBodyProbeVerify, descBodyProbesInRun, descBodyProbeCreate,
  // Field descriptions
  descInputsetIdentity, descRuntimeInputs,
  descHubIdentity, descInfraType,
  descExperimentName, descExperimentIdentity, descInfraRef,
  descExperimentId, descInfraStatus,
  descLoadtestName, descLoadtestType,
  descLoadtestIdentity, descLoadtestDescription, descLoadtestTags,
  descLoadtestEnvId, descLoadtestInfraId, descLoadtestTargetType,
  descLoadtestTargetUrl, descLoadtestScript, descLoadtestUsers,
  descLoadtestDurationSec, descLoadtestRampUpSec, descLoadtestWorkerCount,
  descLoadtestScriptSource, descLoadtestScriptImage,
  descLoadtestScriptEntrypoint, descLoadtestLoadArgs, descLoadtestImagePullSecret,
  descLoadtestHostUrl, descLoadtestRpsLimit, descLoadtestIterations, descLoadtestEnvVars,
  descLoadtestProperties, descLoadtestThresholds,
  descLoadtestCleanupPolicy, descLoadtestResources,
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
  descChaosEnabledInfraType, descInfraScope, descInfraAiEnabled,
  descSearchTermEnv, descSortEnv, descEnvironmentType,
  descGuardSearch, descGuardInfraType, descGuardTags, descGuardEnabled,
  descExperimentRunIdStop, descNotifyId, descForce,
  descIsEnabledFlag, descIsBulkUpdate, descVerifyFlag,
  descExperimentRunIds, descNotifyIds,
  descFaultIdentityParam, descIsEnterpriseFilter,
  descFaultSearch, descFaultListType, descFaultListInfraType, descFaultListInfrastructure,
  descFaultListTags, descFaultListCategory, descFaultListSortField, descFaultListSortAscending,
  descIsEnterpriseYaml, descIsEnterpriseVars, descIsEnterpriseRuns,
  descActionIdentityParam, descSearchActionsParam, descHubIdentityActions,
  descExperimentVariablesParam, descTasksParam,
  descEnvironmentIdCreate, descInfraIdCreate,
  descAccountIdBody, descOrgIdBody, descProjectIdBody,
  descSearchExperiments, descExperimentInfraId, descExperimentEnvironmentId, descExperimentIds,
  descExperimentStartDate, descExperimentEndDate,
  descExperimentTargetNetworkMapIds, descExperimentMyExperiments, descExperimentExcludeAutomation,
  descSearchProbes, descProbeIds, descProbeSortField,
  descProbeIdField, descProbeNameField, descProbePropertiesField, descRunPropertiesField,
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
  // Component variable descriptions
  descComponentType, descComponentIdentifier, descComponentHubReference,
  // Experiment create field descriptions
  descExperimentManifest, descExperimentInfraType, descExperimentInfraIdCreate, descExperimentCronSyntax,
  descExperimentIdUUID,
  // Service Discovery
  descSDAgentIdentity, descSDEnvironmentId, descSDAgentListEnvironmentId, descSDFetchAll, descSDAgentDiagnostic,
  descDiscoveredAgent, descListDiscoveredAgents, descDiscoveredAgentSearch,
  descDiscoveredNamespace, descListDiscoveredNamespaces, descSDNamespaceNameFilter,
  descDiscoveredService, descListDiscoveredServices, descSDNamespaceFilter, descSDSearchFilter,
  // Scanned Risks / Risk Rules / Risk Scans (chaos-manager v3)
  descScannedRisk, descChaosRiskRule, descChaosRiskScan,
  descListScannedRisks, descGetScannedRisk, descListScannedRiskOccurrences, descSummarizeScannedRisksByService,
  descListRiskRules, descGetRiskRule,
  descListRiskScans, descGetRiskScan, descCreateRiskScan, descUpdateRiskScan, descDeleteRiskScan,
  descRetryRiskScan, descAbortRiskScan,
  descGetRiskScanReport, descGetRiskScanReportDownload, descGetRiskScanHeatmap,
  descBodyRiskScanCreate, descBodyRiskScanUpdate,
  descRiskScanIdentity, descRiskScanName, descRiskScanDescription, descRiskScanTags,
  descRiskScanType, descRiskScanSource,
  descScannedRiskSeverity, descScannedRiskRuleId, descScannedRiskValidationType,
  descScannedRiskServiceIdentity, descScannedRiskScanType,
  descRiskEnvironmentIdentity, descRiskAgentIdentity, descRiskPipelineIdentity, descRiskScanStatus,
  descRiskSearch, descRiskSortField, descRiskSortAscending, descRiskTags, descRiskIncludeAllScope,
  descRiskStartTime, descRiskEndTime,
  descRiskRuleDataSource, descRiskRuleIsSystem, descHeatmapSearch,
} from "./chaos-descriptions.js";

/**
 * Chaos API base path.
 * REST endpoints live under rest/v2/ (experiments, probes) and rest/ (templates).
 * Load test endpoints live under v1/.
 */
const CHAOS = "/chaos/manager/api";

/** Load test API uses a separate service path per v1 Go server. */
const CHAOS_LOADTEST = "/loadTest/manager/api";

/**
 * Service Discovery API base path. SD is a Chaos sub-feature backed by a
 * separate `servicediscovery` service behind the Harness gateway.
 * Endpoints expose Kubernetes inventory + eBPF-derived network edges
 * collected by an SD agent running inside the user's cluster.
 */
const SD = "/gateway/servicediscovery/api/v1";

/** Chaos scope override — Chaos REST API uses organizationIdentifier (not orgIdentifier). */
const CHAOS_SCOPE = { org: "organizationIdentifier" } as const;

/** Unwrap single-item response from get-chaos-component-variable endpoint. */
const chaosComponentVarExtract = (raw: unknown): unknown => {
  const r = raw as { items?: Array<{ name: string; variables: unknown[] }> };
  return r.items?.[0] ?? raw;
};

/** Compact projection for chaos_loadtest list items — keeps cheap discriminator
 * scalars (toolType/targetType/scriptSource/infraType/cleanupPolicy) that the
 * generic compactItems() whitelist in utils/compact.ts would otherwise drop
 * (it only matches the literal key "type", not "toolType"/"targetType"), while
 * still excluding heavy fields (toolConfig, yaml, variables, envVars, recentRuns). */
function compactLoadTest(item: Record<string, unknown>): Record<string, unknown> {
  const slim: Record<string, unknown> = {};
  for (const key of [
    "loadtestId", "uniqueId", "identity", "name", "description", "tags",
    "environmentIdentifier", "infraIdentifier", "infraType", "targetType",
    "toolType", "scriptSource", "cleanupPolicy", "latestRevisionIdentifier",
    "createdAt", "updatedAt", "openInHarness",
  ]) {
    if (item[key] !== undefined) slim[key] = item[key];
  }
  return slim;
}

/** Compact projection for discovered_agent list items — keeps serviceCount/
 * networkMapCount (STEP 1 of chaos_service create shows these) which the
 * generic compactItems() whitelist in utils/compact.ts would otherwise drop. */
function compactDiscoveredAgent(item: Record<string, unknown>): Record<string, unknown> {
  const slim: Record<string, unknown> = {};
  for (const key of [
    "identity", "name", "description", "tags", "environmentIdentifier",
    "serviceCount", "networkMapCount", "installationType",
    "createdAt", "updatedAt", "openInHarness",
  ]) {
    if (item[key] !== undefined) slim[key] = item[key];
  }
  return slim;
}

/**
 * Parse input.body when LLMs double-serialize it as a JSON string instead of an object.
 * Fails loudly on malformed JSON so callers' defaults can never silently produce a
 * phantom write to Harness (see CLAUDE.md "Fail Loudly" rule).
 */
function coerceBody(input: Record<string, unknown>): Record<string, unknown> {
  const raw = input.body ?? input;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Invalid JSON in 'body': ${detail}. Pass 'body' as an object or a valid JSON-encoded string.`,
      );
    }
  }
  return raw as Record<string, unknown>;
}

// ── Load test helpers ────────────────────────────────────────────────
// Since the loadTestManager variables migration, all tunables and custom env
// vars live under toolConfig.<tool>.tunables / toolConfig.<tool>.variables. The
// MCP keeps its LLM surface as ergonomic snake_case scalars and translates
// them into the nested toolConfig shape here, so agents never construct the
// nested map, base64, or YAML themselves.

// ── Shared env-var helper (K6 + JMeter) ──────────────────────────────
// Env vars and secret references live in `toolConfig.<tool>.envVars`.

// Reserved env-var names (case-insensitive). Mirrors
// loadTestManager/internal/domain/ReservedEnvVarNames (shared base set, all
// tools) + K6ReservedEnvVarNames (K6-only extras). The frontend list is at
// hce-saas/web/src/services/loadTest/loadTestVariables.ts:337-372.
const BASE_RESERVED_ENV_VAR_NAMES = new Set<string>([
  "RUN_ID", "LOAD_TEST_ID", "TARGET_USERS", "SPAWN_RATE", "SCRIPT_CONTENT_BASE64",
  "TARGET_URL", "ACCOUNT_ID", "ORG_ID", "PROJECT_ID", "ENV_ID", "DURATION_SECONDS",
  "CONTROL_PLANE_URL", "CONTROL_PLANE_TOKEN", "HARNESS_CUSTOM_VAR_NAMES",
  "METRICS_PUSH_INTERVAL", "INFRA_ID", "ACCESS_KEY", "TENANT_ID",
  "PYTHONPATH", "PATH", "HOME", "USER", "SHELL", "LANG", "TERM", "HOSTNAME",
  "PWD", "LD_LIBRARY_PATH", "LD_PRELOAD", "TMPDIR", "TMP", "TEMP",
]);
const K6_EXTRA_RESERVED_ENV_VAR_NAMES = new Set<string>([
  "HOST_URL", "K6_VUS", "K6_DURATION", "K6_ITERATIONS", "K6_STAGES", "K6_RPS",
]);
const ENV_VAR_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

type EnvVarWire = { key: string; value: string; secret?: true };

// Build the HSM secret reference: account → "account.<id>", org → "org.<id>", project → "<id>".
// Matches the Harness UI convention (scope prefix encodes which secret manager the value lives in).
function buildSecretReference(secretId: string, scope: "account" | "org" | "project"): string {
  const prefix = scope === "account" ? "account." : scope === "org" ? "org." : "";
  return `secrets.getValue("${prefix}${secretId}")`;
}

// Validate + project the structured env_vars input into the wire shape K6/JMeter expect.
// Each entry sets exactly one of:
//   - { key, value }                              → literal env var
//   - { key, secret_id, secret_scope?: "..." }    → MCP builds the secrets.getValue(...) string
function buildEnvVars(raw: unknown, tool: "K6" | "JMeter"): EnvVarWire[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new Error("env_vars must be an array of {key, value | secret_id, secret_scope?} entries.");
  }
  const seen = new Set<string>();
  return raw.map((entry, idx) => {
    const ev = entry as Record<string, unknown>;
    const key = ev.key as string | undefined;
    if (!key || typeof key !== "string") {
      throw new Error(`env_vars[${idx}].key is required.`);
    }
    if (!ENV_VAR_KEY_REGEX.test(key)) {
      throw new Error(
        `env_vars[${idx}].key '${key}' is invalid: must match /^[A-Za-z_][A-Za-z0-9_]*$/.`,
      );
    }
    const upper = key.toUpperCase();
    if (BASE_RESERVED_ENV_VAR_NAMES.has(upper) || (tool === "K6" && K6_EXTRA_RESERVED_ENV_VAR_NAMES.has(upper))) {
      throw new Error(
        `env_vars[${idx}].key '${key}' is a reserved name and cannot be used as a custom env var.`,
      );
    }
    if (seen.has(key)) {
      throw new Error(`env_vars[${idx}].key '${key}' is duplicated.`);
    }
    seen.add(key);

    const hasValue = ev.value != null;
    const hasSecretId = ev.secret_id != null;
    if (hasValue === hasSecretId) {
      throw new Error(
        `env_vars[${idx}] must set exactly one of 'value' (literal) or 'secret_id' (with optional secret_scope).`,
      );
    }
    if (hasSecretId) {
      const scopeRaw = (ev.secret_scope as string | undefined) ?? "project";
      if (scopeRaw !== "account" && scopeRaw !== "org" && scopeRaw !== "project") {
        throw new Error(
          `env_vars[${idx}].secret_scope '${scopeRaw}' must be 'account', 'org', or 'project'.`,
        );
      }
      return { key, value: buildSecretReference(ev.secret_id as string, scopeRaw), secret: true };
    }
    return { key, value: String(ev.value) };
  });
}

// Strip path/query/fragment, keep <protocol>//<host>. Mirrors K6LoadTestService's
// resolveBaseHost (web/src/services/loadTest/K6LoadTestService.ts:117-129).
function parseHostOrigin(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const u = new URL(rawUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return rawUrl;
  }
}

// Build the K6 `toolConfig.k6` block for script or image mode (UI mode deferred).
// Matches K6Spec + ScriptSpec in loadTestManager: mode +
// script{content|image|entrypoint|loadArgs|imagePullSecret} +
// tunables{targetUrl, targetUsers, durationSeconds, rampUpTimeSec, workerCount, hostUrl,
// iterations, rpsLimit} + envVars.
function buildK6ToolConfig(
  b: Record<string, unknown>,
  args: { scriptSource: string; script?: string; targetUrl?: string },
): Record<string, unknown> {
  const hostUrl =
    (b.host_url as string | undefined) ??
    (b.hostUrl as string | undefined) ??
    parseHostOrigin(args.targetUrl);
  const rpsLimit = b.rps_limit != null ? (b.rps_limit as number) : undefined;
  const iterations = b.iterations != null ? (b.iterations as number) : undefined;
  const envVars = buildEnvVars(b.env_vars, "K6");

  // Script/image artifact lives under `script`, not `scriptContent`/`customImage`.
  let mode: "script" | "image";
  const script: Record<string, unknown> = {};
  if (args.scriptSource === "image") {
    const scriptImage = (b.script_image ?? b.scriptImage) as string | undefined;
    if (scriptImage == null) {
      throw new Error("K6 image mode requires 'script_image'.");
    }
    mode = "image";
    script.image = scriptImage;
    const entrypoint = (b.script_entrypoint ?? b.scriptEntrypoint) as string | undefined;
    if (entrypoint != null) script.entrypoint = entrypoint;

    const loadArgs = (b.load_args ?? b.loadArgs) as string | undefined;
    if (loadArgs != null && loadArgs !== "") {
      validateLoadArgs(loadArgs);
      script.loadArgs = loadArgs;
    }

    const imagePullSecret = (b.image_pull_secret ?? b.imagePullSecret) as string | undefined;
    if (imagePullSecret != null && imagePullSecret !== "") {
      script.imagePullSecret = imagePullSecret;
    }
  } else {
    if (args.script == null) {
      throw new Error("K6 script mode requires 'script' (the raw JavaScript K6 source).");
    }
    // Mandatory client-side rule (matches Harness UI validateScriptContent).
    if (!args.script.includes("export default")) {
      throw new Error(
        "K6 script must export a default function (export default function ...).",
      );
    }
    mode = "script";
    script.content = Buffer.from(args.script, "utf8").toString("base64");
  }

  // Tunables live under `tunables`, not flat on the toolConfig object.
  const tunables: Record<string, unknown> = {};
  if (args.targetUrl != null) tunables.targetUrl = args.targetUrl;
  if (b.users != null) tunables.targetUsers = b.users;
  if (b.duration_sec != null) tunables.durationSeconds = b.duration_sec;
  if (b.ramp_up_sec != null) tunables.rampUpTimeSec = b.ramp_up_sec;
  if (b.worker_count != null) tunables.workerCount = b.worker_count;
  if (hostUrl) tunables.hostUrl = hostUrl;
  if (iterations != null && iterations > 0) tunables.iterations = iterations;
  // rpsLimit's sole authoring surface is tunables (loadTestManager k6.go);
  // options.rpsLimit is a legacy run-dispatch fallback only, never written here.
  if (rpsLimit != null && rpsLimit > 0) tunables.rpsLimit = rpsLimit;

  const toolConfig: Record<string, unknown> = { mode, script };
  if (Object.keys(tunables).length > 0) toolConfig.tunables = tunables;
  if (envVars.length > 0) toolConfig.envVars = envVars;
  return toolConfig;
}

// Reject known legacy/mistaken field names on chaos_loadtest create/update instead
// of silently ignoring them (Fail Loudly — see coerceBody above). 'scriptContent' /
// 'customImage' are old wire-shape names superseded by 'script' / 'script_image';
// 'inputs' belongs to chaos_probe, not chaos_loadtest.
const LEGACY_LOADTEST_KEYS = ["scriptContent", "customImage", "inputs"] as const;
function rejectLegacyLoadtestFields(b: Record<string, unknown>): void {
  for (const key of LEGACY_LOADTEST_KEYS) {
    if (b[key] !== undefined) {
      throw new Error(
        `'${key}' is not a supported chaos_loadtest field. Use 'script'/'script_image' instead of 'scriptContent'/'customImage'; 'inputs' is a chaos_probe field, not chaos_loadtest.`,
      );
    }
  }
}

// ── JMeter-specific helpers ──────────────────────────────────────────
// Matches JMeterSpec in loadTestManager/internal/domain/jmeter.go.

type JMeterProperty = { key: string; value: string; sendToEngines?: boolean };
type JMeterThreshold = { metric: string; stat?: string; operator: string; value: number; abortOnFail?: boolean };

const JMETER_THRESHOLD_METRICS = new Set(["response_time_ms", "error_rate_pct", "throughput_rps", "latency_ms"]);
const JMETER_THRESHOLD_OPERATORS = new Set(["<", "<=", ">", ">=", "==", "!="]);
const JMETER_STAT_REQUIRED_METRICS = new Set(["response_time_ms", "latency_ms"]);

// Validate + project the structured properties input into toolConfig.jmeter.properties[].
function buildJMeterProperties(raw: unknown): JMeterProperty[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new Error("properties must be an array of {key, value, send_to_engines?} entries.");
  }
  return raw.map((entry, idx) => {
    const p = entry as Record<string, unknown>;
    const key = p.key as string | undefined;
    if (!key) {
      throw new Error(`properties[${idx}].key is required.`);
    }
    const out: JMeterProperty = { key, value: String(p.value ?? "") };
    if (typeof p.send_to_engines === "boolean") out.sendToEngines = p.send_to_engines;
    return out;
  });
}

// Validate + project the structured thresholds input into toolConfig.jmeter.thresholds[].
// Mirrors JMeterThreshold.validate() in loadTestManager/internal/domain/jmeter.go:245-256.
function buildJMeterThresholds(raw: unknown): JMeterThreshold[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new Error("thresholds must be an array of {metric, stat?, operator, value, abort_on_fail?} entries.");
  }
  return raw.map((entry, idx) => {
    const t = entry as Record<string, unknown>;
    const metric = t.metric as string | undefined;
    if (!metric || !JMETER_THRESHOLD_METRICS.has(metric)) {
      throw new Error(`thresholds[${idx}].metric must be one of ${[...JMETER_THRESHOLD_METRICS].join(", ")}.`);
    }
    const operator = t.operator as string | undefined;
    if (!operator || !JMETER_THRESHOLD_OPERATORS.has(operator)) {
      throw new Error(`thresholds[${idx}].operator must be one of ${[...JMETER_THRESHOLD_OPERATORS].join(", ")}.`);
    }
    const stat = t.stat as string | undefined;
    if (JMETER_STAT_REQUIRED_METRICS.has(metric) && !stat) {
      throw new Error(`thresholds[${idx}]: metric '${metric}' requires 'stat' (e.g. p95, p99, avg, median, max).`);
    }
    if (t.value == null) {
      throw new Error(`thresholds[${idx}].value is required.`);
    }
    const out: JMeterThreshold = { metric, operator, value: t.value as number };
    if (stat) out.stat = stat;
    if (typeof t.abort_on_fail === "boolean") out.abortOnFail = t.abort_on_fail;
    return out;
  });
}

// Build the JMeter `toolConfig.jmeter` block for script or image mode.
// Matches JMeterSpec in loadTestManager/internal/domain/jmeter.go: mode + script{content|image|entrypoint}
// + tunables{workerCount} + properties[] + envVars[] + thresholds[].
function buildJMeterToolConfig(
  b: Record<string, unknown>,
  args: { scriptSource: string; script?: string },
): Record<string, unknown> {
  let mode: "script" | "image";
  const script: Record<string, unknown> = {};
  if (args.scriptSource === "image") {
    const scriptImage = (b.script_image ?? b.scriptImage) as string | undefined;
    if (scriptImage == null) {
      throw new Error("JMeter image mode requires 'script_image'.");
    }
    mode = "image";
    script.image = scriptImage;
    const entrypoint = (b.script_entrypoint ?? b.scriptEntrypoint) as string | undefined;
    if (entrypoint != null) script.entrypoint = entrypoint;

    const loadArgs = (b.load_args ?? b.loadArgs) as string | undefined;
    if (loadArgs != null && loadArgs !== "") {
      validateLoadArgs(loadArgs);
      script.loadArgs = loadArgs;
    }

    const imagePullSecret = (b.image_pull_secret ?? b.imagePullSecret) as string | undefined;
    if (imagePullSecret != null && imagePullSecret !== "") {
      script.imagePullSecret = imagePullSecret;
    }
  } else {
    if (args.script == null) {
      throw new Error("JMeter script mode requires 'script' (the raw .jmx/.xml plan text).");
    }
    mode = "script";
    script.content = Buffer.from(args.script, "utf8").toString("base64");
  }

  const toolConfig: Record<string, unknown> = { mode, script };

  if (b.worker_count != null) toolConfig.tunables = { workerCount: b.worker_count };

  const properties = buildJMeterProperties(b.properties);
  if (properties.length > 0) toolConfig.properties = properties;

  const envVars = buildEnvVars(b.env_vars, "JMeter");
  if (envVars.length > 0) toolConfig.envVars = envVars;

  const thresholds = buildJMeterThresholds(b.thresholds);
  if (thresholds.length > 0) toolConfig.thresholds = thresholds;

  return toolConfig;
}

// Validate the Locust/K6/JMeter load_args string. Mirrors ValidateLoadArgs in
// loadTestManager/internal/api/dto.go: semicolon-separated k=v pairs; keys
// must be non-empty, contain no whitespace, and not start with '-'.
function validateLoadArgs(loadArgs: string): void {
  for (const raw of loadArgs.split(";")) {
    const pair = raw.trim();
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const key = (eq >= 0 ? pair.slice(0, eq) : pair).trim();
    if (!key) throw new Error(`load_args: empty key in pair ${JSON.stringify(pair)}`);
    if (/[ \t]/.test(key)) {
      throw new Error(`load_args: key ${JSON.stringify(key)} must not contain spaces`);
    }
    if (key.startsWith("-")) {
      throw new Error(`load_args: key ${JSON.stringify(key)} must not start with '-'`);
    }
  }
}

// Build the Locust `toolConfig.locust` block for script or image mode. Matches
// LocustSpec + ScriptSpec in loadTestManager: mode +
// script{content|image|entrypoint|loadArgs|imagePullSecret} +
// tunables{targetUrl, targetUsers, spawnRate, rampUpTimeSec, durationSeconds, workerCount}.
// NOTE: Locust intentionally has no target_type guard (unlike K6/JMeter) —
// loadTestManager supports Locust script AND image mode on both Linux VM and
// Kubernetes infra (loadtest_handlers.go has no Locust kubernetes-only check).
// Do not add one here.
function buildLocustToolConfig(
  b: Record<string, unknown>,
  args: { scriptSource: string; script?: string; targetUrl?: string },
): Record<string, unknown> {
  let mode: "script" | "image";
  const script: Record<string, unknown> = {};
  if (args.scriptSource === "image") {
    const scriptImage = (b.script_image ?? b.scriptImage) as string | undefined;
    if (scriptImage == null) {
      throw new Error("Locust image mode requires 'script_image'.");
    }
    mode = "image";
    script.image = scriptImage;
    const entrypoint = (b.script_entrypoint ?? b.scriptEntrypoint) as string | undefined;
    if (entrypoint != null) script.entrypoint = entrypoint;

    const loadArgs = (b.load_args ?? b.loadArgs) as string | undefined;
    if (loadArgs != null && loadArgs !== "") {
      validateLoadArgs(loadArgs);
      script.loadArgs = loadArgs;
    }

    const imagePullSecret = (b.image_pull_secret ?? b.imagePullSecret) as string | undefined;
    if (imagePullSecret != null && imagePullSecret !== "") {
      script.imagePullSecret = imagePullSecret;
    }
  } else {
    if (args.script == null) {
      throw new Error("Locust script mode requires 'script' (the raw Python locustfile).");
    }
    mode = "script";
    script.content = Buffer.from(args.script, "utf8").toString("base64");
  }

  const tunables: Record<string, unknown> = {};
  if (args.targetUrl != null) tunables.targetUrl = args.targetUrl;
  if (b.users != null) tunables.targetUsers = b.users;
  if (b.spawn_rate != null) tunables.spawnRate = b.spawn_rate;
  if (b.duration_sec != null) tunables.durationSeconds = b.duration_sec;
  if (b.ramp_up_sec != null) tunables.rampUpTimeSec = b.ramp_up_sec;
  if (b.worker_count != null) tunables.workerCount = b.worker_count;

  const toolConfig: Record<string, unknown> = { mode, script };
  if (Object.keys(tunables).length > 0) toolConfig.tunables = tunables;
  return toolConfig;
}

/**
 * Build the canonical LoadTest YAML manifest. Mirrors the studio's
 * formDataToManifest shape (kind: LoadTest, apiVersion: v1alpha1, spec.{...}).
 *
 * The wire toolBlock carries base64 script.content; for readability the YAML
 * view carries plain-text script.content instead. Caller base64-encodes the
 * returned string into the `yaml` request field.
 */
function buildLoadtestYamlManifest(args: {
  name: string;
  description?: string;
  tags?: string[];
  serviceReferences?: string[];
  identity: string;
  toolType: "Locust" | "K6" | "JMeter";
  targetType: string;
  toolBlock: Record<string, unknown>;
  environmentIdentifier: string;
  infraIdentifier: string;
  cleanupPolicy?: string;
  resources?: Record<string, unknown>;
}): string {
  const infraType = args.targetType === "kubernetes" ? "kubernetes" : "linux";

  const metadata: Record<string, unknown> = { name: args.name };
  if (args.description) metadata.description = args.description;
  if (args.tags && args.tags.length) metadata.tags = args.tags;
  if (args.serviceReferences && args.serviceReferences.length) {
    metadata.serviceReferences = args.serviceReferences;
  }

  const manifest: Record<string, unknown> = {
    kind: "LoadTest",
    apiVersion: "v1alpha1",
    metadata,
  };

  // In the YAML view we want plain-text script content for readability; the
  // wire toolConfig carries it base64. Decode a copy for the manifest.
  const yamlToolBlock: Record<string, unknown> = { ...args.toolBlock };
  const s = yamlToolBlock.script as Record<string, unknown> | undefined;
  if (s?.content && typeof s.content === "string") {
    try {
      yamlToolBlock.script = {
        ...s,
        content: Buffer.from(s.content, "base64").toString("utf8"),
      };
    } catch {
      // If the content isn't valid base64 for any reason, keep as-is.
    }
  }

  const spec: Record<string, unknown> = {
    identity: args.identity,
    toolType: args.toolType,
    infraType,
    targetType: args.targetType,
    cleanupPolicy: args.cleanupPolicy ?? "delete",
  };
  if (args.resources != null) spec.resources = args.resources;
  spec.infraId = args.infraIdentifier;
  spec.envId = args.environmentIdentifier;
  spec.toolConfig = { [args.toolType.toLowerCase()]: yamlToolBlock };
  manifest.spec = spec;

  return YAML.stringify(manifest);
}

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
      deepLinkTemplate: "/ng/account/{accountId}/module/chaos/orgs/{orgIdentifier}/projects/{projectIdentifier}/experiments/{experimentId}/chaos-studio",
      searchAliases: [
        "chaos test", "fault injection", "fault injection experiment",
        "blast radius experiment", "resilience test", "chaos engineering test",
      ],
      // NOTE: hce-saas backend limitations for ListChaosV2Experiments
      // (verified by reading repository.go ListChaosV2Experiments aggregation):
      // 1. infraName, status, infraActive: parsed into ExperimentFilterInput
      //    but NEVER applied in the Mongo aggregation (repository.go:684-770).
      //    Do NOT expose them — agents would think they work and silently get
      //    unfiltered results.
      // 2. infra_id + environment_id ONLY work when BOTH are provided
      //    (repository.go:712-714); either alone is silently dropped.
      // 3. tags filter is AND substring match across the experiment's tag array
      //    (substring per tag — tags=fault=gcp matches fault=gcp-vm-kill etc.).
      listFilterFields: [
        { name: "experiment_name", description: descSearchExperiments },
        { name: "infra_id", description: descExperimentInfraId },
        { name: "tags", description: descTags },
        { name: "experiment_ids", description: descExperimentIds },
        { name: "environment_id", description: descExperimentEnvironmentId },
        { name: "start_date", description: descExperimentStartDate },
        { name: "end_date", description: descExperimentEndDate },
        { name: "target_network_map_ids", description: descExperimentTargetNetworkMapIds },
        { name: "my_experiments", description: descExperimentMyExperiments, type: "boolean" },
        { name: "exclude_automation", description: descExperimentExcludeAutomation, type: "boolean" },
      ],
      relatedResources: [
        { resourceType: "chaos_experiment_variable", relationship: "child", description: "Runtime variables for the experiment. List these to discover required inputs before running." },
        { resourceType: "chaos_input_set", relationship: "child", description: "Saved collections of variable overrides. Create input sets to reuse runtime configurations across runs." },
        { resourceType: "chaos_application_map", relationship: "scoped_by", description: "When an experiment is bound to a chaos_application_map, the backend auto-emits workload=<name> AND service=<name> system tags. To find every experiment that targets a workload/service inside a given app map, either filter chaos_experiment with target_network_map_ids=<map> (returns ALL experiments on that map) or list services via chaos_application_map.get and use tags=workload=<name> / tags=service=<name>." },
        { resourceType: "chaos_fault", relationship: "uses", description: "Each fault step in the experiment manifest emits a fault=<faultName> system tag. Use chaos_fault to discover available fault identities, then filter chaos_experiment with tags=fault=<name>." },
        { resourceType: "chaos_probe", relationship: "uses", description: "Each probe reference in the experiment manifest emits a probe=<probeID> system tag. Use chaos_probe to discover probe identities, then filter chaos_experiment with tags=probe=<probeID>." },
        { resourceType: "chaos_k8s_infrastructure", relationship: "scoped_by", description: "Experiments execute on a chaos infrastructure (the chaos agent installed in a Kubernetes cluster). Filter list with infra_id + environment_id (BOTH required together — backend ignores either alone)." },
        { resourceType: "discovered_network_map", relationship: "discovery_source", description: "When the user gives a high-level target (e.g. 'experiments for the payments app') without an app-map ID, the discovery path is: discovered_network_map → enumerate services/workloads → tags=workload=<name> on chaos_experiment. See descToolsetChaos REASONING PLAYBOOK for the full step-by-step." },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/v2/experiment`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
            target_network_map_ids: "targetNetworkMapIds",
            my_experiments: "myExperiments",
            exclude_automation: "excludeAutomation",
          },
          responseExtractor: chaosExperimentListExtract,
          description: descListExperiments,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { experiment_id: "experimentId" },
          responseExtractor: passthrough,
          description: descGetExperiment,
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/rest/v2/experiment/{experimentId}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { experiment_id: "experimentId" },
          responseExtractor: passthrough,
          description: descDeleteExperiment,
        },
        create: {
          method: "POST",
          path: `${CHAOS}/rest/v2/experiment`,
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => {
            const b = coerceBody(input);
            // Accept both snake_case (MCP convention) and camelCase (Harness API / manifest convention)
            const infraId = b.infra_id ?? b.infraId;
            const infraType = b.infra_type ?? b.infraType;
            const cronSyntax = b.cron_syntax ?? b.cronSyntax;
            const isSingleRunCron = b.is_single_run_cron ?? b.isSingleRunCronEnabled;
            const experimentType = b.experiment_type ?? b.experimentType;
            const tags = b.tags;
            return {
              id: (b.id as string) || randomUUID(),
              ...(b.identity ? { identity: b.identity } : {}),
              name: b.name,
              ...(b.manifest ? { manifest: b.manifest } : {}),
              ...(infraId ? { infraId, infra_id: infraId } : {}),
              ...(infraType ? { infraType, infra_type: infraType } : {}),
              ...(b.description ? { description: b.description } : {}),
              ...(tags ? { tags: Array.isArray(tags) ? tags : (tags as string).split(",").map((t: string) => t.trim()).filter(Boolean) } : {}),
              ...(cronSyntax !== undefined ? { cronSyntax } : {}),
              ...(isSingleRunCron !== undefined ? { isSingleRunCronEnabled: isSingleRunCron } : {}),
              ...(experimentType ? { experimentType } : {}),
            };
          },
          responseExtractor: passthrough,
          description: descCreateExperiment,
          bodySchema: {
            description: descBodyExperimentCreate,
            fields: [
              { name: "id", type: "string", required: false, description: descExperimentIdUUID },
              { name: "name", type: "string", required: true, description: descExperimentName },
              { name: "manifest", type: "string", required: true, description: descExperimentManifest },
              { name: "infra_id", type: "string", required: true, description: descExperimentInfraIdCreate },
              { name: "infra_type", type: "string", required: true, description: descExperimentInfraType },
              { name: "identity", type: "string", required: false, description: descExperimentIdentity },
              { name: "description", type: "string", required: false, description: descExperimentDescription },
              { name: "tags", type: "array", required: false, description: descExperimentTags },
              { name: "cron_syntax", type: "string", required: false, description: descExperimentCronSyntax },
              { name: "is_single_run_cron", type: "boolean", required: false, description: "When true and cron_syntax is set, the cron job runs only once (LimitRunsTo(1)). Default: false (unlimited runs)." },
              { name: "experiment_type", type: "string", required: false, description: "Experiment workflow type. Valid: Workflow, CronWorkflow, ChaosEngine, ChaosSchedule, GamedayWorkflow. Usually auto-determined — only GamedayWorkflow is special-cased. Default: NonCronExperimentV2 (or CronExperimentV2 if cron_syntax is set)." },
            ],
          },
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}/run`,
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { experiment_id: "experimentId" },
          queryParams: { is_identity: "isIdentity" },
          defaultQueryParams: { isIdentity: "true" },
          bodyBuilder: (input) => {
            // Unwrap input.body (object or JSON string) so the documented
            // harness_execute(body={runtime_inputs|experiment_variables|tasks: ...})
            // path flows through. coerceBody throws on malformed JSON (fail-loud).
            const b = coerceBody(input);
            const body: Record<string, unknown> = {};

            // is_identity is declared in BOTH queryParams (URL) and bodySchema.fields
            // (so LLMs reasonably nest it inside `body`). The Registry's queryParam
            // resolver only reads top-level input — see index.ts:633-652 — so we
            // hoist body-nested is_identity back onto input here. The dispatcher
            // builds the body BEFORE resolving queryParams (see index.ts:628-631),
            // making this the sanctioned point to hoist. Top-level input wins on
            // conflict; we only hoist when top-level is unset.
            if (input.is_identity === undefined && b.is_identity !== undefined) {
              (input as Record<string, unknown>).is_identity = b.is_identity;
            }

            if (b.inputset_identity) {
              body.inputsetIdentity = b.inputset_identity;
            }

            // Seed runtimeInputs from caller's raw runtime_inputs so we never
            // silently drop it when experiment_variables / tasks are also passed.
            // Defensive shallow clone — do not mutate the caller's input.
            const seed = (b.runtime_inputs as Record<string, unknown>) ?? {};
            const runtimeInputs: Record<string, unknown> = { ...seed };

            const expVars = b.experiment_variables as Array<{ name: string; value?: unknown }> | undefined;
            if (expVars && expVars.length > 0) {
              const existing = (runtimeInputs.experiment as Array<{ name: string; value: unknown }>) ?? [];
              // Top-level experiment_variables override runtime_inputs.experiment on name conflict.
              const byName = new Map(existing.map(v => [v.name, v]));
              for (const v of expVars) byName.set(v.name, { name: v.name, value: v.value });
              runtimeInputs.experiment = Array.from(byName.values());
            }

            const taskVars = b.tasks as Record<string, Record<string, unknown>> | undefined;
            if (taskVars && Object.keys(taskVars).length > 0) {
              const existing = (runtimeInputs.tasks as Record<string, Array<{ name: string; value: unknown }>>) ?? {};
              for (const [taskName, vars] of Object.entries(taskVars)) {
                // Top-level tasks override runtime_inputs.tasks on (taskName, varName) conflict.
                const byName = new Map((existing[taskName] ?? []).map(v => [v.name, v]));
                for (const [n, v] of Object.entries(vars as Record<string, unknown>)) {
                  byName.set(n, { name: n, value: v });
                }
                existing[taskName] = Array.from(byName.values());
              }
              runtimeInputs.tasks = existing;
            }

            if (Object.keys(runtimeInputs).length > 0) {
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
              { name: "is_identity", type: "boolean", required: false, description: descIsIdentity },
            ],
          },
        },
        stop: {
          method: "POST",
          path: `${CHAOS}/rest/v2/experiment/{experimentId}/stop`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
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
      deepLinkTemplate: "/ng/account/{accountId}/module/chaos/orgs/{orgIdentifier}/projects/{projectIdentifier}/experiments/{experimentId}/runs",
      operations: {
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/chaos-pipeline/{experimentId}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
      deepLinkTemplate: "/ng/account/{accountId}/module/chaos/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/chaos/probes/{probeId}",
      listFilterFields: [
        { name: "search", description: descSearchProbes },
        { name: "tags", description: descTags },
        { name: "start_date", description: descExperimentStartDate },
        { name: "end_date", description: descExperimentEndDate },
        { name: "probe_ids", description: descProbeIds },
        { name: "infra_type", description: descInfraType, enum: ["Kubernetes", "KubernetesV2", "Linux", "Windows", "CloudFoundry", "Container"] },
        { name: "sort_field", description: descProbeSortField, enum: ["NAME", "TIME", "ENABLED"] },
        { name: "sort_ascending", description: descSortAsc, type: "boolean" as const },
        { name: "entity_type", description: descEntityTypeProbe },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/v2/probes`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { probe_id: "probeId" },
          responseExtractor: passthrough,
          description: descGetProbe,
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/rest/v2/probes/{probeId}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { probe_id: "probeId" },
          responseExtractor: passthrough,
          description: descDeleteProbe,
        },
        create: {
          method: "POST",
          path: `${CHAOS}/rest/v2/probes`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => {
            const b = coerceBody(input);
            const probeId = b.probe_id ?? b.probeId ?? b.identity;
            const tags = b.tags;
            const isEnabled = b.is_enabled ?? b.isEnabled;
            const infrastructureType =
              b.infrastructure_type ?? b.infrastructureType ?? "Kubernetes";
            const type = b.type ?? "httpProbe";
            const probeProperties = b.probe_properties ?? b.probeProperties;
            const runProperties = b.run_properties ?? b.runProperties;
            return {
              probeId,
              ...(probeId !== undefined ? { probe_id: probeId } : {}),
              name: b.name ?? probeId,
              ...(b.description ? { description: b.description } : {}),
              ...(tags
                ? {
                    tags: Array.isArray(tags)
                      ? tags
                      : (tags as string).split(",").map((t: string) => t.trim()).filter(Boolean),
                  }
                : {}),
              type,
              infrastructureType,
              infrastructure_type: infrastructureType,
              ...(isEnabled !== undefined ? { isEnabled } : {}),
              ...(probeProperties ? { probeProperties, probe_properties: probeProperties } : {}),
              ...(runProperties ? { runProperties } : {}),
              ...(b.variables ? { variables: b.variables } : {}),
              ...(b.inputs ? { inputs: b.inputs } : {}),
            };
          },
          responseExtractor: passthrough,
          description: descCreateProbe,
          bodySchema: {
            description: descBodyProbeCreate,
            fields: [
              { name: "probe_id", type: "string", required: true, description: descProbeIdField },
              { name: "name", type: "string", required: true, description: descProbeNameField },
              {
                name: "type",
                type: "string",
                required: true,
                description: "Probe type discriminator: httpProbe | cmdProbe | promProbe | k8sProbe | sloProbe | datadogProbe | dynatraceProbe | apmProbe | containerProbe. NOTE: promProbe and apmProbe are DIFFERENT — promProbe queries a Prometheus endpoint URL directly (no connector); apmProbe.type=Prometheus uses a managed Harness Prometheus connector by ID. Pick promProbe for a raw URL; pick apmProbe (sub-type Prometheus) when you have a Harness Prometheus connector. httpProbe, cmdProbe, promProbe, k8sProbe, datadogProbe, dynatraceProbe, and apmProbe (Prometheus sub-type only) are fully documented below; sloProbe, containerProbe, and the other apmProbe sub-types pass through to the Harness API.",
              },
              {
                name: "infrastructure_type",
                type: "string",
                required: true,
                description: "Kubernetes | Linux | Windows. Default Kubernetes.",
              },
              { name: "description", type: "string", required: false, description: "Free-form probe description." },
              { name: "tags", type: "array", required: false, description: "Tags array or comma-separated string. Each tag follows the 'key:value' convention." },
              { name: "is_enabled", type: "boolean", required: false, description: "Whether the probe is enabled. Defaults to true server-side." },
              {
                name: "probe_properties",
                type: "object",
                required: true,
                description: descProbePropertiesField,
                fields: [
                  {
                    name: "httpProbe",
                    type: "object",
                    required: false,
                    description: "Required when type=httpProbe. Defines URL, method, optional auth/tlsConfig/headers.",
                    fields: [
                      { name: "url", type: "string", required: true, description: "Target HTTP/HTTPS endpoint the probe sends requests to." },
                      {
                        name: "method",
                        type: "object",
                        required: true,
                        description: "HTTP method. Set exactly one of: get (GET) | post (POST).",
                        fields: [
                          {
                            name: "get",
                            type: "object",
                            required: false,
                            description: "GET request method. Use either get OR post, not both.",
                            fields: [
                              { name: "criteria", type: "string", required: true, description: "Comparator. For responseCode (numeric): == | != | >= | <= | > | < | oneOf | between. For responseBody (string): contains | equal | notEqual | matches | notMatches | oneOf." },
                              { name: "responseCode", type: "string", required: false, description: "Numeric response code as string, e.g. \"200\". Set this XOR responseBody." },
                              { name: "responseBody", type: "string", required: false, description: "Expected substring/regex in response body. Set this XOR responseCode." },
                            ],
                          },
                          {
                            name: "post",
                            type: "object",
                            required: false,
                            description: "POST request method. Use either get OR post, not both.",
                            fields: [
                              { name: "contentType", type: "string", required: false, description: "HTTP Content-Type header for the request body, e.g. \"application/json\"." },
                              { name: "body", type: "string", required: false, description: "Inline request body. Set this XOR bodyPath." },
                              { name: "bodyPath", type: "string", required: false, description: "Path to a file containing the request body. Set this XOR body." },
                              { name: "criteria", type: "string", required: true, description: "Comparator. For responseCode (numeric): == | != | >= | <= | > | < | oneOf | between. For responseBody (string): contains | equal | notEqual | matches | notMatches | oneOf." },
                              { name: "responseCode", type: "string", required: false, description: "Numeric response code as string, e.g. \"200\". Set this XOR responseBody." },
                              { name: "responseBody", type: "string", required: false, description: "Expected substring/regex in response body. Set this XOR responseCode." },
                            ],
                          },
                        ],
                      },
                      {
                        name: "auth",
                        type: "object",
                        required: false,
                        description: "Optional HTTP authorization (Bearer, Basic, etc.).",
                        fields: [
                          { name: "type", type: "string", required: false, description: "Auth scheme: Basic | Bearer. Omit auth entirely for no-auth." },
                          { name: "credentials", type: "string", required: false, description: "Authentication credentials (base64-encoded username=password) required to access the URL. Plain text or secret reference." },
                        ],
                      },
                      {
                        name: "tlsConfig",
                        type: "object",
                        required: false,
                        description: "Optional TLS configuration for mTLS / custom CA.",
                        fields: [
                          { name: "caFile", type: "string", required: false, description: "CA certificate file or file path used to validate the target's TLS certificate." },
                          { name: "certFile", type: "string", required: false, description: "Client certificate file or file path required for mTLS." },
                          { name: "keyFile", type: "string", required: false, description: "Client key file or file path required for mTLS." },
                          { name: "insecureSkipVerify", type: "boolean", required: false, description: "If true, bypass SSL/TLS certificate verification (allows invalid/self-signed certs). Dev only." },
                        ],
                      },
                      {
                        name: "headers",
                        type: "array",
                        required: false,
                        itemType: "object",
                        description: "Extra request headers. Each item: { key, value }.",
                      },
                    ],
                  },
                  {
                    name: "cmdProbe",
                    type: "object",
                    required: false,
                    description: "Required when type=cmdProbe. Runs a shell command (sh -c) and asserts on its stdout via comparator.",
                    fields: [
                      { name: "command", type: "string", required: true, description: "Shell command to execute (sh -c). Pipes, redirects, &&, etc. supported. Example: \"redis-cli -h redis ping\"." },
                      {
                        name: "comparator",
                        type: "object",
                        required: true,
                        description: "Stdout assertion. The runner casts stdout to `type` and compares against `value` using `criteria`.",
                        fields: [
                          { name: "type", type: "string", required: true, description: "Data type for comparison: int | float | string." },
                          { name: "criteria", type: "string", required: true, description: "Operator. For type=int|float: == | != | >= | <= | > | <. For type=string: equal | notEqual | contains." },
                          { name: "value", type: "string", required: true, description: "Expected value (always a string; cast to `type` before comparing)." },
                        ],
                      },
                      {
                        name: "source",
                        type: "string",
                        required: false,
                        description: "Execution mode. OMIT for inline mode (command runs in the chaos runner pod). For source mode, provide a JSON-ENCODED STRING (NOT a structured object) — the Harness backend persists source as an opaque string and returns 'failed to convert cmd probe source to string' if passed as a JSON object. Build the spec object then JSON.stringify() it before assigning. Inner JSON shape is documented in `fields` below for reference (image required; optionally command, args, env, inheritInputs, hostNetwork, privileged, imagePullPolicy, imagePullSecrets, nodeSelector, tolerations, volumes, volumeMount, labels, annotations). Example: source: \"{\\\"image\\\":\\\"redis:7-alpine\\\",\\\"inheritInputs\\\":true}\". When source is set, top-level cmdProbe.env is ignored — put env vars in source.env (inside the JSON string).",
                        fields: [
                          { name: "image", type: "string", required: true, description: "Container image for the source pod, e.g. \"redis:7-alpine\". The only required field inside source." },
                          { name: "command", type: "array", required: false, itemType: "string", description: "Override the image's ENTRYPOINT, e.g. [\"sh\", \"-c\"]." },
                          { name: "args", type: "array", required: false, itemType: "string", description: "Override the image's CMD, e.g. [\"redis-cli -h redis ping\"]." },
                          { name: "env", type: "array", required: false, itemType: "object", description: "Source-pod env vars. Each item is a Kubernetes corev1.EnvVar — supports {name, value} or {name, valueFrom: {secretKeyRef: {name, key}}} or {name, valueFrom: {configMapKeyRef: {name, key}}}." },
                          { name: "inheritInputs", type: "boolean", required: false, description: "If true, source pod inherits experiment pod's env, volumes, and volumeMounts. Default false." },
                          { name: "hostNetwork", type: "boolean", required: false, description: "Run source pod with hostNetwork: true. Required for node-level network probes. Default false." },
                          { name: "privileged", type: "boolean", required: false, description: "Run source container as privileged. Default false. Use sparingly." },
                          { name: "imagePullPolicy", type: "string", required: false, description: "IfNotPresent | Always | Never." },
                          { name: "imagePullSecrets", type: "array", required: false, itemType: "object", description: "List of {name} for private-registry image pull, e.g. [{\"name\": \"regcred\"}]." },
                          { name: "nodeSelector", type: "object", required: false, description: "Map of node-label selectors, e.g. {\"kubernetes.io/os\": \"linux\"}." },
                          { name: "tolerations", type: "array", required: false, itemType: "object", description: "Kubernetes Toleration objects to schedule onto tainted nodes." },
                          { name: "volumes", type: "array", required: false, itemType: "object", description: "Kubernetes Volume objects (configMap, secret, emptyDir, hostPath, persistentVolumeClaim, etc.)." },
                          { name: "volumeMount", type: "array", required: false, itemType: "object", description: "Kubernetes VolumeMount objects. NOTE: JSON key is `volumeMount` (singular), not `volumeMounts`." },
                          { name: "labels", type: "object", required: false, description: "Map of labels for the source pod." },
                          { name: "annotations", type: "object", required: false, description: "Map of annotations for the source pod, e.g. {\"sidecar.istio.io/inject\": \"false\"}." },
                        ],
                      },
                      { name: "env", type: "array", required: false, itemType: "object", description: "Inline-mode env vars (each {name, value}). IGNORED when `source` is set — put env vars in source.env instead." },
                    ],
                  },
                  {
                    name: "promProbe",
                    type: "object",
                    required: false,
                    description: "Required when type=promProbe. Asserts a PromQL scalar result against a numeric comparator. Common pattern: bound a golden signal (error rate, latency, saturation) during chaos.",
                    fields: [
                      { name: "endpoint", type: "string", required: true, description: "Prometheus base URL. The probe appends /api/v1/query. In-cluster example: \"http://prometheus-server.monitoring.svc:9090\". Use a runtime expression (\"<+input>\") to parameterise per-env." },
                      { name: "query", type: "string", required: false, description: "Inline PromQL. The first scalar of the result vector is compared via comparator. Set this XOR queryPath. Example: \"sum(rate(http_requests_total{status=~\\\"5..\\\"}[1m])) / sum(rate(http_requests_total[1m]))\"." },
                      { name: "queryPath", type: "string", required: false, description: "Filesystem path inside the probe container that holds the PromQL query. Use for long queries managed via ConfigMap/volume. Set this XOR query." },
                      {
                        name: "comparator",
                        type: "object",
                        required: true,
                        description: "Scalar assertion on the PromQL result. type MUST be \"float\" (Prometheus always returns numerics).",
                        fields: [
                          { name: "type", type: "string", required: true, description: "MUST be \"float\". The Harness UI enforces float-only for promProbe." },
                          { name: "criteria", type: "string", required: true, description: "Numeric operator: == | != | >= | <= | > | <. String operators (equal/contains/...) are NOT supported for promProbe." },
                          { name: "value", type: "string", required: true, description: "Threshold as a numeric string, e.g. \"0.05\" (5% error budget), \"500\" (latency ms), \"1\" (boolean up/down)." },
                        ],
                      },
                      {
                        name: "auth",
                        type: "object",
                        required: false,
                        description: "Optional Prometheus authorization. Omit for unauthenticated in-cluster Prometheus.",
                        fields: [
                          { name: "type", type: "string", required: false, description: "Auth scheme: Basic | Bearer. Omit auth entirely for no-auth." },
                          { name: "credentials", type: "string", required: false, description: "Plain credentials or a Harness secret reference (<+secrets.getValue('promToken')>)." },
                        ],
                      },
                      {
                        name: "tlsConfig",
                        type: "object",
                        required: false,
                        description: "Optional TLS configuration for HTTPS Prometheus endpoints / mTLS / custom CA.",
                        fields: [
                          { name: "caFile", type: "string", required: false, description: "CA certificate file or path used to validate the Prometheus TLS cert." },
                          { name: "certFile", type: "string", required: false, description: "Client certificate file or path for mTLS." },
                          { name: "keyFile", type: "string", required: false, description: "Client key file or path for mTLS." },
                          { name: "insecureSkipVerify", type: "boolean", required: false, description: "If true, skip TLS verification. Dev only." },
                        ],
                      },
                    ],
                  },
                  {
                    name: "k8sProbe",
                    type: "object",
                    required: false,
                    description: "Required when type=k8sProbe. Performs a Kubernetes API operation against a resource (or selector) and asserts on its lifecycle/existence. Kubernetes-infra ONLY (not Linux/Windows — the (infra, type) matrix enforces this). Common patterns: assert a Deployment/Pod/CR is `present` (or `absent`) during a chaos fault; verify an operator recreated a deleted ConfigMap.",
                    fields: [
                      { name: "group", type: "string", required: false, description: "Kubernetes API group of the resource. Examples: \"apps\" for Deployments/StatefulSets/DaemonSets, \"batch\" for Jobs/CronJobs, \"networking.k8s.io\" for Ingress, \"\" (empty) or omit for core resources like Pods/ConfigMaps/Services." },
                      { name: "version", type: "string", required: true, description: "apiVersion of the resource (e.g. \"v1\", \"v1beta1\", \"v1alpha1\"). Combined with `group` and `resource` to form the GVR (Group/Version/Resource) for the Kubernetes API call." },
                      { name: "resource", type: "string", required: true, description: "Plural resource name (lowercase). Examples: \"pods\", \"deployments\", \"configmaps\", \"services\", \"<crd-plural>\"." },
                      { name: "operation", type: "string", required: true, description: "Operation to perform on the resource. One of: \"create\" | \"delete\" | \"present\" | \"absent\". Use \"present\"/\"absent\" for read-only liveness assertions during steady-state. Use \"create\"/\"delete\" only for action probes (rare — most chaos hypotheses are about steady state)." },
                      { name: "namespace", type: "string", required: false, description: "Namespace scope, e.g. \"boutique\". Omit for cluster-scoped resources (e.g. Nodes, Namespaces themselves) or to operate cluster-wide on a namespaced resource." },
                      { name: "resourceNames", type: "string", required: false, description: "Comma-separated list of specific resource names to target (e.g. \"checkout,payment\"). Omit to operate on all resources matching the selectors. Mutually compatible with fieldSelector and labelSelector — all provided constraints are AND-combined by the Kubernetes API." },
                      { name: "fieldSelector", type: "string", required: false, description: "Kubernetes field selector to derive the target resource(s). Examples: \"metadata.name=checkout\", \"status.phase=Running\", \"spec.nodeName=node-1\"." },
                      { name: "labelSelector", type: "string", required: false, description: "Kubernetes label selector. Examples: \"app=checkout\", \"app in (checkout,payment)\", \"tier=frontend,env=prod\"." },
                    ],
                  },
                  {
                    name: "datadogProbe",
                    type: "object",
                    required: false,
                    description: "Required when type=datadogProbe. Queries Datadog (metrics or synthetics) and asserts on the result during chaos. Common patterns: bound a Datadog metric (CPU, latency, error rate) during a fault; ensure a Datadog synthetic API/browser test still passes during chaos. Mutually exclusive sub-selectors: set EXACTLY ONE of `metrics` XOR `syntheticsTest`.",
                    fields: [
                      { name: "datadogSite", type: "string", required: true, description: "Datadog site/region identifier. Valid values (per https://docs.datadoghq.com/getting_started/site/): \"datadoghq.com\" (US1), \"us3.datadoghq.com\" (US3), \"us5.datadoghq.com\" (US5), \"datadoghq.eu\" (EU1), \"ap1.datadoghq.com\" (AP1, Japan), \"ap2.datadoghq.com\" (AP2, Australia), \"ddog-gov.com\" (US1-FED), \"us2.ddog-gov.com\" (US2-FED). Pass just the host, NOT the full URL." },
                      { name: "datadogCredentialsSecretName", type: "string", required: false, description: "Name of the Kubernetes secret in the chaos-runner namespace holding the Datadog API key and application key (keys: `dd-api-key`, `dd-app-key`). REQUIRED when infrastructure_type=Kubernetes; ignored on Linux (set blank or omit on Linux infra)." },
                      {
                        name: "syntheticsTest",
                        type: "object",
                        required: false,
                        description: "Datadog synthetics-test assertion. Set this XOR `metrics`. The probe polls the test's most-recent result and passes iff the synthetic test passed.",
                        fields: [
                          { name: "testType", type: "string", required: true, description: "Synthetic-test kind. EXACTLY one of: \"api\" | \"browser\". Any other value is rejected." },
                          { name: "publicId", type: "string", required: true, description: "Datadog synthetic-test Public ID (e.g. \"abc-123-xyz\"). Find under Datadog UI → Synthetics → <test> → Settings → Public ID." },
                        ],
                      },
                      {
                        name: "metrics",
                        type: "object",
                        required: false,
                        description: "Datadog metrics assertion. Set this XOR `syntheticsTest`. The probe runs the Datadog metrics query over `timeFrame` and applies `comparator` to the scalar result.",
                        fields: [
                          { name: "query", type: "string", required: true, description: "Datadog metrics query string. Example: \"avg:system.cpu.user{service:checkout}\" or \"avg:trace.http.request.duration{service:checkout}.rollup(avg, 60)\". Use the same syntax as Datadog Metrics Explorer." },
                          { name: "timeFrame", type: "string", required: true, description: "Relative time-range expression. MUST match the regex /^now-\\d+[smh]$/ — e.g. \"now-1m\", \"now-5m\", \"now-1h\". Plain \"now\" and absolute timestamps are NOT supported." },
                          {
                            name: "comparator",
                            type: "object",
                            required: true,
                            description: "Scalar assertion on the Datadog metrics result. type MUST be \"float\" (Datadog metrics are numeric).",
                            fields: [
                              { name: "type", type: "string", required: true, description: "MUST be \"float\". The Harness UI enforces float-only for datadogProbe metrics." },
                              { name: "criteria", type: "string", required: true, description: "Numeric operator: == | != | >= | <= | > | <. String operators (equal/contains/...) are NOT supported." },
                              { name: "value", type: "string", required: true, description: "Threshold as a numeric string, e.g. \"80\" (CPU %), \"500\" (latency ms), \"0.05\" (error budget)." },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    name: "dynatraceProbe",
                    type: "object",
                    required: false,
                    description: "Required when type=dynatraceProbe. Queries the Dynatrace API for a metric over a timeframe and asserts on the numeric result. Supported on Kubernetes and Linux infra (NOT Windows — the (infra, type) matrix enforces this). Common pattern: bound a SaaS observability metric (CPU, latency, error count) during chaos.",
                    fields: [
                      { name: "endpoint", type: "string", required: true, description: "Dynatrace tenant endpoint URL. Examples: \"https://abc.live.dynatrace.com\" (SaaS), \"https://abc.dynatrace-managed.com/e/<env-id>\" (Managed). Use a runtime expression (\"<+input>\") to parameterise per-env." },
                      { name: "timeFrame", type: "string", required: true, description: "Aggregation window in Dynatrace expression syntax: \"now-1m\" (last minute), \"now-5m\" (last 5 minutes), \"now-1h\", etc. The probe queries Dynatrace over this window and feeds the avg/min/max scalar to the comparator." },
                      { name: "apiTokenSecretName", type: "string", required: false, description: "Kubernetes secret holding the Dynatrace API token. The probe runner reads the token from this secret to authenticate API calls. Omit only if your tenant doesn't require auth (rare)." },
                      {
                        name: "metrics",
                        type: "object",
                        required: true,
                        description: "Dynatrace metric query. Selects which metric series to evaluate and which entities to scope. Both selectors are required.",
                        fields: [
                          { name: "metricsSelector", type: "string", required: true, description: "Dynatrace metric selector. Examples: \"builtin:host.cpu.usage\", \"builtin:service.errors.total.rate\", \"builtin:service.response.time:avg\"." },
                          { name: "entitySelector", type: "string", required: true, description: "Dynatrace entity selector that scopes the metric to specific hosts/services/pods. Examples: \"type(HOST)\", \"type(SERVICE),tag(\\\"env:prod\\\")\", \"entityName(\\\"checkout\\\")\"." },
                        ],
                      },
                      {
                        name: "comparator",
                        type: "object",
                        required: true,
                        description: "Numeric assertion on the Dynatrace metric result. Dynatrace metrics are numeric — comparator.type MUST be \"float\". String comparators are NOT supported for dynatraceProbe.",
                        fields: [
                          { name: "type", type: "string", required: true, description: "MUST be \"float\". The Harness UI enforces float-only for dynatraceProbe metrics." },
                          { name: "criteria", type: "string", required: true, description: "Numeric operator: == | != | >= | <= | > | <. String operators (equal/contains/...) are NOT supported." },
                          { name: "value", type: "string", required: true, description: "Threshold as a numeric string, e.g. \"80\" (CPU% upper bound), \"500\" (latency ms), \"0.05\" (error rate)." },
                        ],
                      },
                    ],
                  },
                  {
                    name: "apmProbe",
                    type: "object",
                    required: false,
                    description: "Required when type=apmProbe. Wraps an APM/observability backend via a managed Harness connector (Prometheus, AppDynamics, SplunkObservability, Dynatrace, NewRelic, GcpCloudMonitoring, Datadog APM, SplunkEnterprise) and asserts on a metric/query result. apmProbe.type discriminates the sub-type; the matching <type>ProbeInputs object holds the connectorID (a Harness connector identifier) and per-backend inputs. NOT the same as promProbe — promProbe queries a Prometheus URL directly; apmProbe.type=Prometheus uses a Harness Prometheus connector. Phase 1: Prometheus sub-type is fully documented; the other 7 sub-types pass through.",
                    fields: [
                      {
                        name: "comparator",
                        type: "object",
                        required: true,
                        description: "Numeric assertion on the APM metric result. type MUST be \"float\" — the Harness UI enforces float-only for apmProbe.",
                        fields: [
                          { name: "type", type: "string", required: true, description: "MUST be \"float\". apmProbe metrics are numeric." },
                          { name: "criteria", type: "string", required: true, description: "Numeric operator: == | != | >= | <= | > | <." },
                          { name: "value", type: "string", required: true, description: "Threshold as a numeric string, e.g. \"90\", \"0.05\", \"500\"." },
                        ],
                      },
                      {
                        name: "type",
                        type: "string",
                        required: true,
                        description: "APM backend discriminator. EXACTLY one of: Prometheus | AppDynamics | SplunkObservability | Dynatrace | NewRelic | GcpCloudMonitoring | Datadog | SplunkEnterprise. The matching <type>ProbeInputs object must be set.",
                      },
                      {
                        name: "prometheusProbeInputs",
                        type: "object",
                        required: false,
                        description: "Required when apmProbe.type=Prometheus. Holds the Harness Prometheus connector reference and the PromQL query/TLS config. The Prometheus URL/auth lives on the connector — do NOT pass an endpoint URL here (that's the promProbe shape, a different probe).",
                        fields: [
                          { name: "connectorID", type: "string", required: true, description: "Harness Prometheus connector identifier (NOT a connectorRef expression, NOT a URL — just the bare identifier, e.g. \"gcpmgrpromconnector\"). Discover via harness_list resource_type=connector with type=Prometheus and include_all_connectors_available_at_scope=true. Distinct from promProbe.endpoint, which is a raw Prometheus URL." },
                          { name: "query", type: "string", required: true, description: "PromQL query whose scalar result is compared via comparator (e.g. \"sum(rate(http_requests_total[1m]))\"). Same query language as promProbe.query, but executed against the Prometheus endpoint resolved from the connectorID rather than a raw URL." },
                          {
                            name: "tlsConfig",
                            type: "object",
                            required: false,
                            description: "Optional TLS config for the Prometheus endpoint. Shape DIFFERS from promProbe.tlsConfig (which uses caFile/certFile/keyFile string paths). Here each cert field is an object { identifier: \"secrets.getValue(\\\"<secretId>\\\")\" } pointing to a Harness secret — discover secrets via harness_list resource_type=secret type=SecretText include_all_secrets_accessible_at_scope=true.",
                            fields: [
                              {
                                name: "caCrt",
                                type: "object",
                                required: false,
                                description: "CA certificate secret reference. Shape: { identifier: \"secrets.getValue(\\\"<secretId>\\\")\" }.",
                                fields: [{ name: "identifier", type: "string", required: true, description: "Wrapped secret expression: secrets.getValue(\"<secretId>\")." }],
                              },
                              {
                                name: "clientCrt",
                                type: "object",
                                required: false,
                                description: "Client certificate secret reference. Shape: { identifier: \"secrets.getValue(\\\"<secretId>\\\")\" }.",
                                fields: [{ name: "identifier", type: "string", required: true, description: "Wrapped secret expression: secrets.getValue(\"<secretId>\")." }],
                              },
                              {
                                name: "key",
                                type: "object",
                                required: false,
                                description: "Client key secret reference. Shape: { identifier: \"secrets.getValue(\\\"<secretId>\\\")\" }.",
                                fields: [{ name: "identifier", type: "string", required: true, description: "Wrapped secret expression: secrets.getValue(\"<secretId>\")." }],
                              },
                              { name: "insecureSkipVerify", type: "boolean", required: false, description: "If true, skip TLS verification (allows invalid/self-signed certs). Dev only." },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                name: "run_properties",
                type: "object",
                required: false,
                description: descRunPropertiesField,
                fields: [
                  { name: "timeout", type: "string", required: false, description: "Time limit for the probe to execute the check and return output, e.g. \"10s\"." },
                  { name: "interval", type: "string", required: false, description: "Duration the probe waits between subsequent attempts, e.g. \"2s\"." },
                  { name: "attempt", type: "number", required: false, description: "Number of times the check is retried upon failure before declaring FAILED." },
                  { name: "pollingInterval", type: "string", required: false, description: "Wait time between iterations for Continuous / OnChaos probe modes, e.g. \"30s\"." },
                  { name: "initialDelay", type: "string", required: false, description: "Duration to wait before the probe begins execution, e.g. \"5s\"." },
                  { name: "stopOnFailure", type: "boolean", required: false, description: "If true, stop experiment execution when the probe fails. Default false (continue)." },
                  { name: "verbosity", type: "string", required: false, description: "Log level: info | debug. Default info." },
                ],
              },
              {
                name: "variables",
                type: "array",
                required: false,
                itemType: "object",
                description: "Probe-level template variables. Each item: { name, type, value, required, description }.",
              },
              {
                name: "inputs",
                type: "array",
                required: false,
                itemType: "object",
                description: "Optional template inputs (advanced). Usually [].",
              },
            ],
          },
        },
      },
      executeActions: {
        enable: {
          method: "POST",
          path: `${CHAOS}/rest/v2/probes/{probeId}/enable`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { probe_id: "probeId" },
          bodyBuilder: (input) => {
            const b = coerceBody(input);
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
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { probe_id: "probeId" },
          bodyBuilder: (input) => {
            const b = coerceBody(input);
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
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
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { template_id: "templateId" },
          queryParams: { hub_identity: "hubIdentity", revision: "revision" },
          bodyBuilder: (input) => {
            const b = coerceBody(input);
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { template_id: "templateId" },
          queryParams: {
            hub_identity: "hubIdentity",
            page: "page",
            limit: "limit",
          },
          responseExtractor: passthrough,
          actionDescription: descListRevisions,
        },
        get_variables: {
          method: "GET",
          path: `${CHAOS}/rest/experimenttemplates/{templateId}/variables`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { template_id: "templateId" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision: "revision",
          },
          responseExtractor: passthrough,
          actionDescription: descGetVariables,
        },
        get_yaml: {
          method: "GET",
          path: `${CHAOS}/rest/experimenttemplates/{templateId}/yaml`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { template_id: "templateId" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision: "revision",
          },
          responseExtractor: passthrough,
          actionDescription: descGetYaml,
        },
        compare_revisions: {
          method: "GET",
          path: `${CHAOS}/rest/experimenttemplates/{templateId}/compare`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { template_id: "templateId" },
          queryParams: {
            hub_identity: "hubIdentity",
            revision1: "revision1",
            revision2: "revision2",
          },
          responseExtractor: passthrough,
          actionDescription: descCompareRevisions,
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
        { name: "is_identity", description: descIsIdentity, type: "boolean" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}/variables`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { experiment_id: "experimentId" },
          queryParams: { is_identity: "isIdentity" },
          defaultQueryParams: { isIdentity: "true" },
          responseExtractor: chaosRunTimeInputsExtract,
          description: descListExperimentVariables,
        },
      },
    },

    // ── Chaos Component Variables (unified v3) ─────────────────────────
    {
      resourceType: "chaos_component_variable",
      displayName: "Chaos Component Variable",
      description: descChaosComponentVariable,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["identifier"],
      relatedResources: [
        { resourceType: "chaos_probe", relationship: "parent", description: "The probe whose variables are being retrieved. Use harness_get with resource_type=chaos_probe to fetch the full probe definition." },
        { resourceType: "chaos_fault", relationship: "parent", description: "The fault whose variables are being retrieved. Use harness_get with resource_type=chaos_fault to fetch the full fault definition." },
        { resourceType: "chaos_action", relationship: "parent", description: "The action whose variables are being retrieved. Use harness_get with resource_type=chaos_action to fetch the full action definition." },
      ],
      operations: {
        get: {
          method: "GET",
          path: `${CHAOS}/v3/integrations/get-chaos-component-variable`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            type: "type",
            identifier: "identifier",
            hub_reference: "hubReference",
          },
          // Registry only enforces listFilterFields.required for operation==="list"
          // and this resource has only `get`, so we validate locally via preflight.
          paramsSchema: {
            fields: [
              { name: "type", required: true, description: `${descComponentType} (Fault | Probe | Action)` },
              { name: "identifier", required: true, description: descComponentIdentifier },
              { name: "hub_reference", required: false, description: descComponentHubReference },
            ],
          } satisfies ParamsSchema,
          preflight: async ({ input }) => {
            const missing: string[] = [];
            if (input.type === undefined || input.type === "") missing.push("type");
            if (input.identifier === undefined || input.identifier === "") missing.push("identifier");
            if (missing.length > 0) {
              throw new Error(
                `Missing required field(s) for get on chaos_component_variable: ${missing.join(", ")}. ` +
                `Both 'type' (Fault | Probe | Action) and 'identifier' must be provided.`,
              );
            }
          },
          responseExtractor: chaosComponentVarExtract,
          description: descGetComponentVariable,
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
      deepLinkTemplate: "/ng/account/{accountId}/module/chaos/orgs/{orgIdentifier}/projects/{projectIdentifier}/experiments/{experimentId}/inputsets",
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { experiment_id: "experimentId" },
          queryParams: { page: "page", limit: "limit", size: "limit", is_identity: "isIdentity" },
          defaultQueryParams: { isIdentity: "false" },
          responseExtractor: chaosInputSetListExtract,
          description: descListInputSets,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}/inputsets/{inputsetId}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { experiment_id: "experimentId", inputset_id: "inputsetId" },
          queryParams: { is_identity: "isIdentity" },
          defaultQueryParams: { isIdentity: "false" },
          responseExtractor: ngExtract,
          description: descGetInputSet,
        },
        create: {
          method: "POST",
          path: `${CHAOS}/rest/v2/experiments/{experimentId}/inputsets`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { experiment_id: "experimentId" },
          queryParams: { is_identity: "isIdentity" },
          defaultQueryParams: { isIdentity: "false" },
          bodyBuilder: (input) => {
            const b = coerceBody(input);
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
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { experiment_id: "experimentId", inputset_id: "inputsetId" },
          queryParams: { is_identity: "isIdentity" },
          defaultQueryParams: { isIdentity: "false" },
          bodyBuilder: (input) => {
            const b = coerceBody(input);
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
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
    // Like the chaos REST API, it scopes via organizationIdentifier (CHAOS_SCOPE).
    {
      resourceType: "chaos_loadtest",
      displayName: "Chaos Load Test",
      description: descChaosLoadtest,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["loadtest_id"],
      compactItem: compactLoadTest,
      deepLinkTemplate: "/ng/account/{accountId}/module/chaos/orgs/{orgIdentifier}/projects/{projectIdentifier}/load-tests/{loadtestId}",
      listFilterFields: [
        { name: "environment_id", description: descEnvironmentId },
        { name: "tool_type", description: descLoadtestType, enum: ["Locust", "K6", "JMeter"] },
        { name: "tags", description: descLoadtestTags },
        { name: "search", description: "Free-text search. NOTE: backend currently matches only the load test's display name (substring, case-insensitive) -- it does not match identity/slug and is not fuzzy or prefix-tolerant." },
        { name: "sort_field", description: "Field to sort by (e.g. createdAt, updatedAt, name)." },
        { name: "sort_ascending", description: "Sort ascending when true, descending when false.", type: "boolean" },
      ],
      diagnosticHint: "Load tests are looked up by their identity slug (e.g. 'mcplocustscript001'), not the uniqueId UUID. If you only have a uniqueId, call harness_list resource_type=chaos_loadtest (optionally with search_term) and use the matching item's 'identity'/'loadtestId' field instead.",
      relatedResources: [
        {
          resourceType: "chaos_infrastructure",
          relationship: "prerequisite",
          description:
            "Linux VM load-runner infrastructure. When the load test targets Linux VM (target_type='machine-chaos-linux', the default), its 'environmentID' supplies environment_id and its 'infraID' supplies infra_id. Only loadEnabled + ACTIVE infras are usable. In MCP, Linux VM supports tool_type Locust only -- K6 (a genuine backend restriction) and JMeter (an MCP/UI-parity restriction; the backend itself allows Linux JMeter) with a Linux target_type are rejected by MCP.",
        },
        {
          resourceType: "chaos_enabled_infrastructure",
          relationship: "prerequisite",
          description:
            "Kubernetes load-runner infrastructure. When the load test targets Kubernetes, filter this list by infra_type='KubernetesV2'; its 'environmentID' supplies environment_id and its 'infraID' supplies infra_id. Kubernetes infra supports tool_type Locust, K6, or JMeter. IMPORTANT: target_type MUST be explicitly set to 'kubernetes' -- it is not auto-derived from which infra list you picked from; omitting it defaults to Linux naming and dispatches wrong.",
        },
        {
          resourceType: "chaos_service",
          relationship: "prerequisite",
          description:
            "Resilience Testing Services attached to a load test. List with infrastructure_ids='<environment_id>/<infra_id>' to see services already onboarded on the chosen load-runner infra. A user may pick one or more identities from the list, OR onboard a brand-new service via chaos_service's create flow (see chaos_service.relatedResources for the discovered_agent/discovered_service chain) regardless of whether the list is empty -- creating a new service is a user-intent decision, not gated on list length. The chosen identity/identities are passed on the load test as service_references (required when the account has CHAOS_RISK_SERVICES_ENABLED on).",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS_LOADTEST}/v1/load-tests`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            page: "page",
            limit: "limit",
            size: "limit",
            search: "search",
            search_term: "search",
            environment_id: "environmentIdentifier",
            tool_type: "toolType",
            tags: "tags",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
          },
          responseExtractor: chaosLoadTestListExtract,
          description: descListLoadtests,
        },
        get: {
          method: "GET",
          path: `${CHAOS_LOADTEST}/v1/load-tests/{loadtestId}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { loadtest_id: "loadtestId" },
          responseExtractor: chaosLoadTestExtract,
          description: descGetLoadtest,
        },
        create: {
          method: "POST",
          path: `${CHAOS_LOADTEST}/v1/load-tests`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => {
            const b = coerceBody(input);
            rejectLegacyLoadtestFields(b);
            const name = (b.name as string) ?? "";
            if (!name) {
              throw new Error("name is required.");
            }

            // identity is the slug-constrained key; auto-derive from name when omitted.
            const slug = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "");
            const identity = (b.identity as string) || slug(name) || randomUUID();
            if (!/^[a-zA-Z0-9_]+$/.test(identity)) {
              throw new Error(
                `Invalid identity '${identity}': only letters, numbers and underscores are allowed (derived from name when omitted).`,
              );
            }

            // Tool type: Locust (default), K6, or JMeter. Gatling/Custom are deprecated
            // and the backend now rejects them with a 400.
            const toolType = ((b.tool_type as string) ?? "Locust") as
              | "Locust"
              | "K6"
              | "JMeter";
            if (toolType !== "Locust" && toolType !== "K6" && toolType !== "JMeter") {
              throw new Error(`tool_type '${toolType}' must be 'Locust', 'K6', or 'JMeter'.`);
            }

            const targetType = (b.target_type as string) ?? "machine-chaos-linux";
            if ((toolType === "K6" || toolType === "JMeter") && targetType !== "kubernetes") {
              throw new Error(`${toolType} load tests require target_type='kubernetes'.`);
            }

            const environmentIdentifier = (b.environment_id ?? b.environmentIdentifier) as
              | string
              | undefined;
            const infraIdentifier = (b.infra_id ?? b.infraIdentifier) as string | undefined;
            const targetUrl = (b.target_url ?? b.targetUrl) as string | undefined;
            const script = b.script as string | undefined;
            const scriptImage = (b.script_image ?? b.scriptImage) as string | undefined;
            const scriptSource =
              (b.script_source as string) ?? (scriptImage != null ? "image" : "inline");

            // Normalise tags (accept array or comma-separated string; default []).
            const rawTags = b.tags;
            const tags: string[] = Array.isArray(rawTags)
              ? (rawTags as string[])
              : typeof rawTags === "string"
                ? (rawTags as string).split(",").map((t) => t.trim()).filter(Boolean)
                : [];

            // Build toolConfig.<tool>. JMeter builds from scalars by default;
            // 'tool_config' remains an escape hatch for advanced/back-compat callers
            // (e.g. .zip bundles) who want to hand-construct the object.
            let toolBlock: Record<string, unknown>;
            if (toolType === "K6") {
              toolBlock = buildK6ToolConfig(b, { scriptSource, script, targetUrl });
            } else if (toolType === "Locust") {
              toolBlock = buildLocustToolConfig(b, { scriptSource, script, targetUrl });
            } else {
              const supplied = b.tool_config as Record<string, unknown> | undefined;
              toolBlock = supplied != null
                ? ((supplied.jmeter as Record<string, unknown>) ?? supplied)
                : buildJMeterToolConfig(b, { scriptSource, script });
            }
            const toolKey = toolType.toLowerCase();
            const toolConfig: Record<string, unknown> = { [toolKey]: toolBlock };

            // Variables live under toolConfig.<tool>.variables.
            if (Array.isArray(b.variables)) {
              (toolBlock as Record<string, unknown>).variables = b.variables;
            }

            const body: Record<string, unknown> = {
              identity,
              name,
              description: (b.description as string) ?? "",
              tags,
              environmentIdentifier,
              infraIdentifier,
              targetType,
              toolType,
              toolConfig,
            };

            // Optional pass-through fields.
            if (b.service_references != null) body.serviceReferences = b.service_references;
            if (b.cleanup_policy != null) body.cleanupPolicy = b.cleanup_policy;
            if (b.max_duration_sec != null) body.maxDurationSec = b.max_duration_sec;
            if (b.resources != null) body.resources = b.resources;

            // Optional canonical YAML manifest (backend accepts it as an alternative
            // source; MCP still sends toolConfig authoritatively).
            const yamlManifest = buildLoadtestYamlManifest({
              name,
              description: b.description as string | undefined,
              tags,
              serviceReferences: body.serviceReferences as string[] | undefined,
              identity,
              toolType,
              targetType,
              toolBlock,
              environmentIdentifier: environmentIdentifier as string,
              infraIdentifier: infraIdentifier as string,
              cleanupPolicy: body.cleanupPolicy as string | undefined,
              resources: body.resources as Record<string, unknown> | undefined,
            });
            body.yaml = Buffer.from(yamlManifest, "utf8").toString("base64");

            // Snake-case aliases for the registry's required-field validator (which
            // checks the built body against the snake_case bodySchema field names).
            if (environmentIdentifier != null) body.environment_id = environmentIdentifier;
            if (infraIdentifier != null) body.infra_id = infraIdentifier;

            return body;
          },
          responseExtractor: chaosLoadTestExtract,
          description: descCreateLoadtest,
          bodySchema: {
            description: descBodyLoadtestDefinition,
            fields: [
              { name: "name", type: "string", required: true, description: descLoadtestName },
              { name: "environment_id", type: "string", required: true, description: descLoadtestEnvId },
              { name: "infra_id", type: "string", required: true, description: descLoadtestInfraId },
              { name: "identity", type: "string", required: false, description: descLoadtestIdentity },
              { name: "description", type: "string", required: false, description: descLoadtestDescription },
              { name: "tags", type: "array", required: false, description: descLoadtestTags },
              { name: "target_type", type: "string", required: false, description: descLoadtestTargetType },
              { name: "tool_type", type: "string", required: false, description: descLoadtestType },
              { name: "target_url", type: "string", required: false, description: descLoadtestTargetUrl },
              { name: "script_source", type: "string", required: false, description: descLoadtestScriptSource },
              { name: "script", type: "string", required: false, description: descLoadtestScript },
              { name: "script_image", type: "string", required: false, description: descLoadtestScriptImage },
              { name: "script_entrypoint", type: "string", required: false, description: descLoadtestScriptEntrypoint },
              { name: "load_args", type: "string", required: false, description: descLoadtestLoadArgs },
              { name: "image_pull_secret", type: "string", required: false, description: descLoadtestImagePullSecret },
              { name: "users", type: "number", required: false, description: descLoadtestUsers },
              { name: "spawn_rate", type: "number", required: false, description: "Locust spawn rate (users/sec)." },
              { name: "duration_sec", type: "number", required: false, description: descLoadtestDurationSec },
              { name: "ramp_up_sec", type: "number", required: false, description: descLoadtestRampUpSec },
              { name: "worker_count", type: "number", required: false, description: descLoadtestWorkerCount },
              { name: "host_url", type: "string", required: false, description: descLoadtestHostUrl },
              { name: "rps_limit", type: "number", required: false, description: descLoadtestRpsLimit },
              { name: "iterations", type: "number", required: false, description: descLoadtestIterations },
              { name: "env_vars", type: "array", required: false, description: descLoadtestEnvVars },
              { name: "properties", type: "array", required: false, description: descLoadtestProperties },
              { name: "thresholds", type: "array", required: false, description: descLoadtestThresholds },
              { name: "variables", type: "array", required: false, description: "Custom template.Variable entries stored under toolConfig.<tool>.variables." },
              { name: "tool_config", type: "object", required: false, description: "JMeter-only pass-through toolConfig.jmeter object -- escape hatch for advanced/back-compat use (e.g. .zip test-plan bundles). Ignored for K6/Locust on create (use the scalar fields for those); not required for JMeter either -- prefer script/script_image/properties/env_vars/thresholds/worker_count unless you need this override." },
              { name: "service_references", type: "array", required: false, description: "chaosService identity strings; required when CHAOS_RISK_SERVICES_ENABLED is on." },
              { name: "cleanup_policy", type: "string", required: false, description: descLoadtestCleanupPolicy },
              { name: "max_duration_sec", type: "number", required: false, description: "Per-load-test hard cap on any run." },
              { name: "resources", type: "object", required: false, description: descLoadtestResources },
            ],
          },
        },
        update: {
          method: "PUT",
          path: `${CHAOS_LOADTEST}/v1/load-tests/{loadtestId}`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { loadtest_id: "loadtestId" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => {
            const b = coerceBody(input);
            rejectLegacyLoadtestFields(b);
            const body: Record<string, unknown> = {};
            if (b.name != null) body.name = b.name;
            if (b.description != null) body.description = b.description;
            if (b.tags != null) body.tags = b.tags;
            if (b.service_references != null) body.serviceReferences = b.service_references;
            if (b.environment_id != null) body.environmentIdentifier = b.environment_id;
            if (b.infra_id != null) body.infraIdentifier = b.infra_id;
            if (b.target_type != null) body.targetType = b.target_type;
            if (b.max_duration_sec != null) body.maxDurationSec = b.max_duration_sec;
            if (b.cleanup_policy != null) body.cleanupPolicy = b.cleanup_policy;
            if (b.resources != null) body.resources = b.resources;

            // tool_type is never sent to the API (immutable after creation) --
            // used only internally to pick the right scalar builder / wrap key.
            const toolType = b.tool_type as "Locust" | "K6" | "JMeter" | undefined;
            const toolConfigEscapeHatch = b.tool_config as Record<string, unknown> | undefined;

            // Same scalar surface as create -- if any of these are present,
            // toolConfig.<tool> must be rebuilt wholesale (server does a full
            // overwrite; see UpdateLoadTestRequest.ToolConfig in loadTestManager).
            const SCALAR_TOOL_FIELDS = [
              "target_url", "script_source", "script", "script_image", "script_entrypoint",
              "load_args", "image_pull_secret", "users", "spawn_rate", "duration_sec",
              "ramp_up_sec", "worker_count", "host_url", "rps_limit", "iterations",
              "env_vars", "properties", "thresholds",
            ] as const;
            const hasScalarToolField = SCALAR_TOOL_FIELDS.some((f) => b[f] != null);

            if (hasScalarToolField) {
              if (toolType == null) {
                throw new Error(
                  "tool_type is required to edit script/tunables/properties/thresholds/env_vars on update -- call harness_get first if you don't know the existing tool_type.",
                );
              }
              if (toolType !== "Locust" && toolType !== "K6" && toolType !== "JMeter") {
                throw new Error(`tool_type '${toolType}' must be 'Locust', 'K6', or 'JMeter'.`);
              }
              const targetUrl = (b.target_url ?? b.targetUrl) as string | undefined;
              const script = b.script as string | undefined;
              const scriptImage = (b.script_image ?? b.scriptImage) as string | undefined;
              const scriptSource =
                (b.script_source as string) ?? (scriptImage != null ? "image" : "inline");

              let toolBlock: Record<string, unknown>;
              if (toolType === "K6") {
                toolBlock = buildK6ToolConfig(b, { scriptSource, script, targetUrl });
              } else if (toolType === "Locust") {
                toolBlock = buildLocustToolConfig(b, { scriptSource, script, targetUrl });
              } else {
                toolBlock = buildJMeterToolConfig(b, { scriptSource, script });
              }
              // Mirrors create: variables live under toolConfig.<tool>.variables,
              // which ReconcileToolConfigVariables prefers over the top-level
              // field -- do not also set body.variables to avoid two sources.
              if (Array.isArray(b.variables)) {
                toolBlock.variables = b.variables;
              }
              body.toolConfig = { [toolType.toLowerCase()]: toolBlock };
            } else if (toolConfigEscapeHatch != null) {
              if (toolType != null) {
                const toolKey = toolType.toLowerCase();
                const inner =
                  (toolConfigEscapeHatch[toolKey] as Record<string, unknown> | undefined) ??
                  toolConfigEscapeHatch;
                body.toolConfig = { [toolKey]: inner };
              } else {
                // Back-compat: caller already sends the fully-wired { <tool>: {...} } shape.
                body.toolConfig = toolConfigEscapeHatch;
              }
              if (b.variables != null) body.variables = b.variables;
            } else if (b.variables != null) {
              // No toolConfig rebuild in this call -- variables-only update,
              // top-level field (server falls back to it when
              // toolConfig.<tool>.variables is empty).
              body.variables = b.variables;
            }

            return body;
          },
          responseExtractor: chaosLoadTestExtract,
          description: descUpdateLoadtest,
          bodySchema: {
            description: descUpdateLoadtest,
            fields: [
              { name: "name", type: "string", required: false, description: descLoadtestName },
              { name: "description", type: "string", required: false, description: descLoadtestDescription },
              { name: "tags", type: "array", required: false, description: descLoadtestTags },
              { name: "service_references", type: "array", required: false, description: "chaosService identity strings; a non-null slice must be non-empty." },
              { name: "environment_id", type: "string", required: false, description: descLoadtestEnvId },
              { name: "infra_id", type: "string", required: false, description: descLoadtestInfraId },
              { name: "target_type", type: "string", required: false, description: descLoadtestTargetType },
              { name: "max_duration_sec", type: "number", required: false, description: "Per-load-test hard cap on any run." },
              { name: "cleanup_policy", type: "string", required: false, description: descLoadtestCleanupPolicy },
              { name: "resources", type: "object", required: false, description: descLoadtestResources },
              { name: "tool_type", type: "string", required: false, description: descLoadtestType },
              { name: "target_url", type: "string", required: false, description: descLoadtestTargetUrl },
              { name: "script_source", type: "string", required: false, description: descLoadtestScriptSource },
              { name: "script", type: "string", required: false, description: descLoadtestScript },
              { name: "script_image", type: "string", required: false, description: descLoadtestScriptImage },
              { name: "script_entrypoint", type: "string", required: false, description: descLoadtestScriptEntrypoint },
              { name: "load_args", type: "string", required: false, description: descLoadtestLoadArgs },
              { name: "image_pull_secret", type: "string", required: false, description: descLoadtestImagePullSecret },
              { name: "users", type: "number", required: false, description: descLoadtestUsers },
              { name: "spawn_rate", type: "number", required: false, description: "Locust spawn rate (users/sec)." },
              { name: "duration_sec", type: "number", required: false, description: descLoadtestDurationSec },
              { name: "ramp_up_sec", type: "number", required: false, description: descLoadtestRampUpSec },
              { name: "worker_count", type: "number", required: false, description: descLoadtestWorkerCount },
              { name: "host_url", type: "string", required: false, description: descLoadtestHostUrl },
              { name: "rps_limit", type: "number", required: false, description: descLoadtestRpsLimit },
              { name: "iterations", type: "number", required: false, description: descLoadtestIterations },
              { name: "env_vars", type: "array", required: false, description: descLoadtestEnvVars },
              { name: "properties", type: "array", required: false, description: descLoadtestProperties },
              { name: "thresholds", type: "array", required: false, description: descLoadtestThresholds },
              { name: "tool_config", type: "object", required: false, description: "Advanced escape hatch to hand-construct toolConfig.<tool> directly (e.g. JMeter .zip bundles) instead of the scalar fields above. Pass 'tool_type' alongside it so MCP wraps/unwraps it consistently with create; without 'tool_type' it is sent to the API exactly as given (must already be the full '{ <tool>: {...} }' wire shape). Full replacement of toolConfig.<tool> either way -- null/omit to keep existing." },
              { name: "variables", type: "array", required: false, description: "Full replacement variables list; null to keep existing. When also editing script/tunables via the scalar fields above, this is nested into toolConfig.<tool>.variables instead of sent top-level (mirrors create)." },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS_LOADTEST}/v1/load-tests/{loadtestId}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { loadtest_id: "loadtestId" },
          responseExtractor: passthrough,
          description: descDeleteLoadtest,
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: `${CHAOS_LOADTEST}/v1/load-tests/{loadtestId}/runs`,
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { loadtest_id: "loadtestId" },
          // CreateLoadTestRunRequest.Identity is binding:"required" — send a UUID
          // when the caller doesn't supply one so ShouldBindJSON succeeds.
          bodyBuilder: (input) => {
            const b = coerceBody(input);
            const body: Record<string, unknown> = {
              identity: (b.run_identity as string) ?? randomUUID(),
            };
            if (b.run_name != null) body.name = b.run_name;
            if (b.values != null) body.values = b.values;
            if (b.runtime_values != null) body.runtimeValues = b.runtime_values;
            return body;
          },
          responseExtractor: passthrough,
          actionDescription: descRunLoadtest,
          bodySchema: {
            description: "Run parameters (all optional).",
            fields: [
              { name: "run_identity", type: "string", required: false, description: "Client-supplied identity for the run; a UUID is generated when omitted." },
              { name: "run_name", type: "string", required: false, description: "Optional display name for the run." },
              { name: "values", type: "array", required: false, description: "Runtime override values for load-test Variables (template.InputMinimum entries)." },
              { name: "runtime_values", type: "object", required: false, description: "Path-keyed runtime overrides for toolConfig '<+input>' leaves." },
            ],
          },
        },
        stop: {
          method: "POST",
          path: `${CHAOS_LOADTEST}/v1/runs/{runId}/stop`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { run_id: "runId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: descStopLoadtest,
          bodySchema: { description: descBodyNoBody, fields: [] },
        },
      },
    },

    // ── Chaos Service (Service Management) ────────────────────────────
    // v3 REST endpoints under the chaos manager:
    //   GET    /v3/chaos-services
    //   GET    /v3/chaos-services/{identity}
    //   POST   /v3/chaos-services
    //   PUT    /v3/chaos-services/{identity}
    //   DELETE /v3/chaos-services/{identity}
    // List response envelope is
    //   { data: [...], correlationID, pagination: { totalItems, ... } }
    // (distinct from the load-test v1 envelope of { items, pagination }).
    // Create and update return the full ChaosServiceResponse. Update is a
    // full-replace on mutable fields plus desired-state reconcile of probes.
    // Delete soft-deletes the service and purges its probe mappings, returning
    //   { success, correlationID }.
    {
      resourceType: "chaos_service",
      displayName: "Chaos Service",
      description: descChaosService,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["identity"],
      deepLinkTemplate: "/ng/account/{accountId}/module/chaos/orgs/{orgIdentifier}/projects/{projectIdentifier}/risks/services/{identity}",
      listFilterFields: [
        { name: "environment_ids", description: descChaosServiceEnvironmentIds },
        { name: "infrastructure_ids", description: descChaosServiceInfrastructureIds },
        { name: "tags", description: descChaosServiceTags },
        { name: "include_all_scope", description: descChaosServiceIncludeAllScope, type: "boolean" },
        { name: "search", description: descChaosServiceSearch },
        { name: "probe_ids", description: descChaosServiceProbeIds },
        { name: "onboarding_id", description: descChaosServiceOnboardingIdFilter },
      ],
      relatedResources: [
        { resourceType: "discovered_agent", relationship: "prerequisite", description: "STEP 1 of create: pick the Service Discovery agent. Its 'identity' becomes agent_id, its environmentIdentifier becomes environment_id, and (for SD K8s) its identity is also the bare infrastructure_id." },
        { resourceType: "discovered_namespace", relationship: "filters", description: "Optional STEP 2a: list namespaces for the chosen agent to narrow the discovered_service list before picking a service." },
        { resourceType: "discovered_service", relationship: "prerequisite", description: "STEP 2b of create: pick the service to onboard. Its 'id' becomes external_service_id (the server derives serviceType/namespace from it)." },
        { resourceType: "chaos_probe", relationship: "associates", description: "STEP 4 of create: optional health-check probes to attach. Source probe identities and their inputs[] schema here; fill each input value before adding to the create body's probes array." },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/v3/chaos-services`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            page: "page",
            limit: "limit",
            size: "limit",
            search: "search",
            search_term: "search",
            environment_ids: "environmentIds",
            infrastructure_ids: "infrastructureIds",
            tags: "tags",
            include_all_scope: "includeAllScope",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
            probe_ids: "probeIds",
            onboarding_id: "onboardingId",
          },
          responseExtractor: chaosServiceListExtract,
          description: descListChaosServices,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/v3/chaos-services/{identity}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { identity: "identity" },
          responseExtractor: passthrough,
          description: descGetChaosService,
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/v3/chaos-services/{identity}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { identity: "identity" },
          responseExtractor: passthrough,
          description: descDeleteChaosService,
        },
        create: {
          method: "POST",
          path: `${CHAOS}/v3/chaos-services`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => {
            const b = coerceBody(input);
            const externalServiceId = b.external_service_id ?? b.externalServiceId;
            const agentId = b.agent_id ?? b.agentId;
            const environmentId = b.environment_id ?? b.environmentId;
            const infrastructureId = b.infrastructure_id ?? b.infrastructureId;
            const infrastructureType = b.infrastructure_type ?? b.infrastructureType;
            const onboardingId = b.onboarding_id ?? b.onboardingId;
            const tags = b.tags;
            const probes = (b.probes as Array<Record<string, unknown>> | undefined)?.map((p) => ({
              probeId: p.probeId ?? p.probe_id,
              ...(p.inputs ? { inputs: p.inputs } : {}),
            }));
            return {
              identity: b.identity,
              name: b.name,
              ...(b.description ? { description: b.description } : {}),
              ...(tags
                ? {
                    tags: Array.isArray(tags)
                      ? tags
                      : String(tags)
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                  }
                : {}),
              externalServiceId,
              agentId,
              environmentId,
              infrastructureId,
              // Dual-write snake_case keys so registry required-field validation
              // (which checks bodySchema.fields names against this transformed
              // payload) sees the fields it expects. See getBodySchemaValidationPayload
              // in registry/index.ts.
              external_service_id: externalServiceId,
              agent_id: agentId,
              environment_id: environmentId,
              infrastructure_id: infrastructureId,
              ...(infrastructureType ? { infrastructureType } : {}),
              ...(onboardingId ? { onboardingId } : {}),
              ...(probes && probes.length > 0 ? { probes } : {}),
            };
          },
          responseExtractor: passthrough,
          description: descCreateChaosService,
          bodySchema: {
            description: descBodyChaosServiceCreate,
            fields: [
              { name: "identity", type: "string", required: true, description: descChaosServiceIdentity },
              { name: "name", type: "string", required: true, description: descChaosServiceName },
              { name: "external_service_id", type: "string", required: true, description: descChaosServiceExternalServiceId },
              { name: "agent_id", type: "string", required: true, description: descChaosServiceAgentId },
              { name: "environment_id", type: "string", required: true, description: descChaosServiceEnvironmentId },
              { name: "infrastructure_id", type: "string", required: true, description: descChaosServiceInfrastructureId },
              { name: "infrastructure_type", type: "string", required: false, description: descChaosServiceInfrastructureType },
              { name: "description", type: "string", required: false, description: descChaosServiceDescription },
              { name: "tags", type: "array", required: false, description: descChaosServiceTagsBody },
              { name: "onboarding_id", type: "string", required: false, description: descChaosServiceOnboardingId },
              { name: "probes", type: "array", required: false, description: descChaosServiceProbes },
            ],
          },
        },
        update: {
          method: "PUT",
          path: `${CHAOS}/v3/chaos-services/{identity}`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          pathParams: { identity: "identity" },
          bodyBuilder: (input) => {
            const b = coerceBody(input);
            const externalServiceId = b.external_service_id ?? b.externalServiceId;
            const agentId = b.agent_id ?? b.agentId;
            const environmentId = b.environment_id ?? b.environmentId;
            const infrastructureId = b.infrastructure_id ?? b.infrastructureId;
            const tags = b.tags;
            const probes = (b.probes as Array<Record<string, unknown>> | undefined)?.map((p) => ({
              probeId: p.probeId ?? p.probe_id,
              ...(p.inputs ? { inputs: p.inputs } : {}),
            }));
            return {
              name: b.name,
              ...(b.description !== undefined ? { description: b.description } : {}),
              ...(tags
                ? {
                    tags: Array.isArray(tags)
                      ? tags
                      : String(tags)
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                  }
                : {}),
              externalServiceId,
              agentId,
              environmentId,
              infrastructureId,
              // Dual-write snake_case keys — see comment in create bodyBuilder above.
              external_service_id: externalServiceId,
              agent_id: agentId,
              environment_id: environmentId,
              infrastructure_id: infrastructureId,
              // Full desired-state replace (hce-saas reconcileProbeMappings):
              // pass an explicit [] straight through (detach all) rather than
              // dropping it, but leave the key absent when the caller omitted it
              // so the required-field validation below rejects the request
              // instead of silently clearing every probe.
              ...(probes !== undefined ? { probes } : {}),
            };
          },
          responseExtractor: passthrough,
          description: descUpdateChaosService,
          bodySchema: {
            description: descBodyChaosServiceUpdate,
            fields: [
              { name: "name", type: "string", required: true, description: descChaosServiceName },
              { name: "external_service_id", type: "string", required: true, description: descChaosServiceExternalServiceId },
              { name: "agent_id", type: "string", required: true, description: descChaosServiceAgentId },
              { name: "environment_id", type: "string", required: true, description: descChaosServiceEnvironmentId },
              { name: "infrastructure_id", type: "string", required: true, description: descChaosServiceInfrastructureId },
              { name: "description", type: "string", required: false, description: descChaosServiceDescription },
              { name: "tags", type: "array", required: false, description: descChaosServiceTagsBody },
              { name: "probes", type: "array", required: true, description: descChaosServiceProbesUpdate },
            ],
          },
        },
      },
      executeActions: {
        list_experiment_runs: {
          method: "GET",
          path: `${CHAOS}/v3/chaos-services/{identity}/experiment-runs`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { identity: "identity" },
          queryParams: {
            page: "page",
            limit: "limit",
            size: "limit",
            search: "search",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
            include_all_scope: "includeAllScope",
            infra_ids: "infraIds",
            statuses: "statuses",
            step_types: "stepTypes",
          },
          responseExtractor: passthrough,
          actionDescription: descListChaosServiceExperimentRuns,
          bodySchema: { description: descBodyNoBody, fields: [] },
        },
        list_load_tests: {
          method: "GET",
          path: `${CHAOS}/v3/chaos-services/{identity}/load-tests`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { identity: "identity" },
          queryParams: {
            page: "page",
            limit: "limit",
            size: "limit",
            search: "search",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
            include_all_scope: "includeAllScope",
            tool_type: "toolType",
            environment_ids: "environmentIds",
            infra_ids: "infraIds",
            tags: "tags",
          },
          responseExtractor: passthrough,
          actionDescription: descListChaosServiceLoadTests,
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
      deepLinkTemplate: "/ng/account/{accountId}/module/chaos/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/chaos/infrastructures/{infraId}",
      diagnosticHint: "An infrastructure can only create chaos experiments when status is ACTIVE and isChaosEnabled is true. Filter out any infrastructure that does not meet both conditions.",
      relatedResources: [
        { resourceType: "chaos_environment", relationship: "scoped_by", description: "STEP 1 of create: pick the Harness environment. Its identifier becomes environment_id." },
        { resourceType: "infrastructure", relationship: "prerequisite", description: "STEP 2 of create: pick the backing CD Kubernetes infrastructure definition in that environment. Its identifier becomes infra_id (defaults to chaos identity when omitted)." },
        { resourceType: "chaos_enabled_infrastructure", relationship: "child", description: "After install completes, the registered infra appears here once status=ACTIVE and isChaosEnabled=true." },
      ],
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { infra_id: "infraId" },
          responseExtractor: passthrough,
          description: descGetK8sInfra,
        },
        create: {
          method: "POST",
          path: `${CHAOS}/rest/v2/infrastructure`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => {
            const b = coerceBody(input);
            const identity = b.identity as string | undefined;
            const name = b.name as string | undefined;
            const environmentId = (b.environment_id ?? b.environmentId) as string | undefined;
            if (!identity) throw new Error("identity is required.");
            if (!name) throw new Error("name is required.");
            if (!environmentId) throw new Error("environment_id is required.");

            const infraId = (b.infra_id ?? b.infraId ?? identity) as string;
            const infraNamespace = (b.infra_namespace ?? b.infraNamespace ?? "hce") as string;
            const serviceAccount = (b.service_account ?? b.serviceAccount ?? "litmus") as string;
            const infraScope = ((b.infra_scope ?? b.infraScope ?? "CLUSTER") as string).toUpperCase();
            const infraType = ((b.infra_type ?? b.infraType ?? "KUBERNETES") as string).toUpperCase();
            const k8sConnectorId = (b.k8s_connector_id ?? b.k8sConnectorID ?? b.k8sConnectorId) as string | undefined;
            const discoveryAgentId = (b.discovery_agent_id ?? b.discoveryAgentID ?? b.discoveryAgentId) as string | undefined;
            const aiEnabled = Boolean(b.ai_enabled ?? b.aiEnabled ?? false);
            const rawTags = b.tags;
            const tags: string[] = Array.isArray(rawTags)
              ? (rawTags as string[])
              : typeof rawTags === "string"
                ? rawTags.split(",").map((t) => t.trim()).filter(Boolean)
                : [];

            return {
              identity,
              name,
              environmentID: environmentId,
              infraID: infraId,
              infraNamespace,
              serviceAccount,
              infraScope,
              infraType,
              ...(b.description ? { description: b.description } : {}),
              ...(tags.length > 0 ? { tags } : {}),
              ...(k8sConnectorId ? { k8sConnectorID: k8sConnectorId } : {}),
              ...(discoveryAgentId ? { discoveryAgentID: discoveryAgentId } : {}),
              aiEnabled,
              insecureSkipVerify: Boolean(b.insecure_skip_verify ?? b.insecureSkipVerify ?? false),
            };
          },
          responseExtractor: passthrough,
          description: descCreateK8sInfra,
          bodySchema: {
            description: descBodyK8sInfraCreate,
            fields: [
              { name: "identity", type: "string", required: true, description: descK8sInfraIdentityCreate },
              { name: "name", type: "string", required: true, description: descK8sInfraNameCreate },
              { name: "environment_id", type: "string", required: true, description: descK8sInfraEnvironmentIdCreate },
              { name: "infra_id", type: "string", required: false, description: descK8sInfraInfraIdCreate },
              { name: "k8s_connector_id", type: "string", required: false, description: descK8sInfraConnectorIdCreate },
              { name: "infra_namespace", type: "string", required: false, description: descK8sInfraNamespaceCreate },
              { name: "service_account", type: "string", required: false, description: descK8sInfraServiceAccountCreate },
              { name: "infra_scope", type: "string", required: false, description: descK8sInfraScopeCreate },
              { name: "infra_type", type: "string", required: false, description: descK8sInfraTypeCreate },
              { name: "description", type: "string", required: false, description: "Optional description for the chaos server." },
              { name: "tags", type: "array", required: false, description: "Optional tags (array of strings or comma-separated string)." },
              { name: "ai_enabled", type: "boolean", required: false, description: descK8sInfraAiEnabledCreate },
            ],
          },
        },
      },
      executeActions: {
        check_health: {
          method: "GET",
          path: `${CHAOS}/rest/kubernetes/infra/{infraId}/health`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { infra_id: "infraId" },
          responseExtractor: passthrough,
          actionDescription: descCheckK8sHealth,
          bodySchema: { description: descBodyNoBody, fields: [] },
        },
      },
    },

    // ── Chaos-Enabled Infrastructure (ready to run experiments) ──────
    {
      resourceType: "chaos_enabled_infrastructure",
      displayName: "Chaos-Enabled Infrastructure",
      description: descChaosEnabledInfrastructure,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["infra_id"],
      diagnosticHint:
        "Returns only infrastructures that are ready to run chaos experiments (chaos-enabled AND ACTIVE). " +
        "Empty result usually means no chaos infrastructure is installed/connected for this project/environment yet — " +
        "register/connect one, or use chaos_k8s_infrastructure to see infra that exist but are not chaos-enabled.",
      relatedResources: [
        {
          resourceType: "chaos_k8s_infrastructure",
          relationship: "alternative",
          description:
            "Full K8s infra inventory (all statuses, chaos-enabled or not) plus get + check_health. Use chaos_enabled_infrastructure only to pick a ready-to-use infra.",
        },
        {
          resourceType: "chaos_experiment",
          relationship: "used_by",
          description:
            "The infraID/identity returned here is the infra_ref/infra selector when creating or running an experiment.",
        },
      ],
      listFilterFields: [
        { name: "environment_id", description: descEnvironmentId },
        { name: "infra_type", description: descChaosEnabledInfraType, enum: ["Kubernetes", "KubernetesV2", "All"] },
        { name: "infra_scope", description: descInfraScope, enum: ["NAMESPACE", "CLUSTER"] },
        { name: "is_ai_enabled", description: descInfraAiEnabled, type: "boolean" },
        { name: "search", description: descSearchK8sInfra },
      ],
      operations: {
        list: {
          method: "POST",
          path: `${CHAOS}/rest/v2/infrastructures/chaos-enabled`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            page: "page",
            limit: "limit",
            size: "limit",
            environment_id: "environmentIdentifier",
            search: "search",
            search_term: "search",
          },
          bodyBuilder: (input) => {
            const filter: Record<string, unknown> = {};
            if (input.infra_type) {
              filter.infraTypeFilter = String(input.infra_type).toUpperCase();
            }
            if (input.infra_scope) {
              filter.infraScope = input.infra_scope;
            }
            if (input.is_ai_enabled != null) {
              filter.isAIEnabled = input.is_ai_enabled;
            }
            return Object.keys(filter).length > 0 ? { filter } : {};
          },
          responseExtractor: chaosK8sInfraListExtract,
          description: descListChaosEnabledInfra,
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { hub_id: "hubId" },
          responseExtractor: passthrough,
          description: descGetHub,
        },
        create: {
          method: "POST",
          path: `${CHAOS}/rest/hubs`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => {
            const b = coerceBody(input);
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
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { hub_id: "hubId" },
          bodyBuilder: (input) => {
            const b = coerceBody(input);
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
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
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
      deepLinkTemplate: "/ng/account/{accountId}/module/chaos/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/chaos/faults/{identity}",
      listFilterFields: [
        { name: "search", description: descFaultSearch },
        { name: "type", description: descFaultListType },
        { name: "infrastructure_type", description: descFaultListInfraType },
        { name: "infrastructure", description: descFaultListInfrastructure },
        { name: "tags", description: descFaultListTags },
        { name: "category", description: descFaultListCategory },
        { name: "is_enterprise", description: descIsEnterpriseFilter, type: "boolean" },
        { name: "sort_field", description: descFaultListSortField, enum: ["name", "lastUpdated"] },
        { name: "sort_ascending", description: descFaultListSortAscending, type: "boolean" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/faults`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            page: "page",
            limit: "limit",
            size: "limit",
            search: "search",
            search_term: "search",
            is_enterprise: "isEnterprise",
            type: "type",
            infrastructure_type: "infrastructureType",
            infrastructure: "infrastructure",
            tags: "tags",
            category: "category",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
          },
          responseExtractor: chaosPageExtract,
          description: descListFaults,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/faults/{faultId}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { fault_id: "faultId" },
          responseExtractor: passthrough,
          description: descDeleteFault,
        },
      },
      executeActions: {
        get_variables: {
          method: "GET",
          path: `${CHAOS}/rest/faults/{faultId}/variables`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
      deepLinkTemplate: "/ng/account/{accountId}/module/chaos/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/chaos/faults/{faultId}?tab=execution-history",
      listFilterFields: [
        { name: "fault_id", description: descFaultIdentityParam, required: true },
        { name: "is_enterprise", description: descIsEnterpriseRuns, type: "boolean" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/rest/faults/{faultId}/experimentruns`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
      deepLinkTemplate: "/ng/account/{accountId}/module/chaos/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/chaos/hubs/{hubRef}?tab=FAULTS",
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
      deepLinkTemplate: "/ng/account/{accountId}/module/chaos/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/chaos/hubs/{hubRef}?tab=PROBES",
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
      deepLinkTemplate: "/ng/account/{accountId}/module/chaos/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/chaos/hubs/{hubRef}?tab=ACTIONS",
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
      deepLinkTemplate: "/ng/account/{accountId}/module/chaos/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/chaos/actions/{identity}",
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { action_id: "actionId" },
          responseExtractor: passthrough,
          description: descGetAction,
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/rest/actions/{actionId}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { action_id: "actionId" },
          responseExtractor: passthrough,
          description: descDeleteAction,
        },
        create: {
          method: "POST",
          path: `${CHAOS}/rest/actions`,
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => {
            const b = coerceBody(input);
            const name = b.name;
            // UI derives identity from name; backend does NOT auto-generate it.
            const identity = b.identity ?? name;
            const type = b.type ?? b.action_type ?? b.actionType;
            const infrastructureType = b.infrastructure_type ?? b.infrastructureType ?? b.infra_type;
            const tags = b.tags;
            // delay shorthand: build delayAction from `duration` when action_properties absent
            let actionProperties = b.action_properties ?? b.actionProperties;
            const duration = b.duration;
            if (actionProperties == null && type === "delay" && duration != null) {
              actionProperties = { delayAction: { duration } };
            }
            const runProperties = b.run_properties ?? b.runProperties;
            return {
              ...(identity != null ? { identity } : {}),
              ...(name != null ? { name } : {}),
              ...(b.description != null ? { description: b.description } : {}),
              ...(tags != null
                ? { tags: Array.isArray(tags) ? tags : String(tags).split(",").map((t: string) => t.trim()).filter(Boolean) }
                : {}),
              // Emit snake_case alias too so the registry's required-field
              // validator (which checks the built body against bodySchema field
              // names) sees `infrastructure_type`; the backend reads the
              // camelCase `infrastructureType` and ignores the extra key.
              ...(infrastructureType != null ? { infrastructureType, infrastructure_type: infrastructureType } : {}),
              ...(type != null ? { type } : {}),
              ...(b.variables != null ? { variables: b.variables } : {}),
              ...(actionProperties != null ? { actionProperties } : {}),
              ...(runProperties != null ? { runProperties } : {}),
              inputs: Array.isArray(b.inputs) ? b.inputs : [],
            };
          },
          responseExtractor: chaosActionExtract,
          description: descCreateAction,
          bodySchema: {
            description: descBodyActionCreate,
            fields: [
              { name: "name", type: "string", required: true, description: descActionName },
              { name: "type", type: "string", required: true, description: descActionEntityTypeCreate },
              { name: "infrastructure_type", type: "string", required: true, description: descActionInfraTypeCreate },
              { name: "action_properties", type: "object", required: false, description: descActionPropertiesBody },
              { name: "duration", type: "string", required: false, description: descActionDurationShorthand },
              { name: "identity", type: "string", required: false, description: descActionIdentityCreate },
              { name: "description", type: "string", required: false, description: descActionDescriptionCreate },
              { name: "tags", type: "array", required: false, description: descActionTagsCreate },
              { name: "variables", type: "array", required: false, description: descActionVariablesBody },
              { name: "run_properties", type: "object", required: false, description: descActionRunPropertiesBody },
              { name: "inputs", type: "array", required: false, description: descActionInputsBody },
            ],
          },
        },
      },
      executeActions: {
        get_manifest: {
          method: "GET",
          path: `${CHAOS}/rest/actions/manifest/{actionId}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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

    // ── Chaos Application Maps ──────────────────────────────────────
    {
      resourceType: "chaos_application_map",
      displayName: "Chaos Application Map",
      description: descChaosApplicationMap,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["map_id"],
      searchAliases: [
        "chaos_network_map",
        "application map", "app map",
        "network map", "chaos network map",
        "blast radius",
      ],
      listFilterFields: [
        { name: "search",         description: descAppMapSearch },
        { name: "environment_id", description: descAppMapEnvironmentId },
        { name: "infra_id",       description: descAppMapInfraId },
        { name: "all",            description: descAppMapAll,     type: "boolean" },
        { name: "minimal",        description: descAppMapMinimal, type: "boolean" },
      ],
      relatedResources: [
        { resourceType: "chaos_k8s_infrastructure", relationship: "scoped_by", description: "Application maps are scoped by (environment, infrastructure). Use chaos_k8s_infrastructure to discover valid infra_id values." },
        { resourceType: "chaos_environment",        relationship: "scoped_by", description: "Application maps are scoped by environment. Use chaos_environment to discover valid environment_id values." },
        { resourceType: "discovered_network_map",   relationship: "backed-by", description: "The chaos application map wraps an underlying service-discovery network map. Use discovered_network_map to inspect the raw per-agent inventory." },
        { resourceType: "chaos_experiment",         relationship: "scopes",    description: "Experiments bound to this application map auto-emit workload=<name> AND service=<name> system tags (one per workload/service in the manifest). Find them via chaos_experiment list with target_network_map_ids=<this map's identity> (broadest) or tags=workload=<name> / tags=service=<name> (narrower)." },
      ],
      operations: {
        list: {
          method: "POST",
          path: `${CHAOS}/rest/v2/applicationmaps`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            page: "page",
            limit: "limit",
            size: "limit",
            search: "search",
            search_term: "search",
            environment_id: "environmentIdentifier",
            infra_id: "infraId",
            all: "all",
            minimal: "minimal",
          },
          bodyBuilder: () => ({}),
          responseExtractor: chaosAppMapPageExtract,
          description: descListApplicationMaps,
          bodySchema: { description: descBodyNoBody, fields: [] },
        },
        get: {
          method: "GET",
          path: `${CHAOS}/rest/v2/applicationmaps/{mapId}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { map_id: "mapId" },
          queryParams: {
            environment_id: "environmentIdentifier",
            infra_id: "infraId",
          },
          // The backend composes its Mongo lookup as {identity, infra_id,
          // environment_ref} (composite key). Missing environment_id or
          // infra_id yields HTTP 500 ("mongo: no documents in result")
          // instead of a clean 404. Validate locally so the agent gets a
          // clear, actionable error per the repo's fail-loud rule.
          // Mirrors the preflight on chaos_component_variable.get.
          preflight: async ({ input }) => {
            const missing: string[] = [];
            if (input.environment_id === undefined || input.environment_id === "") missing.push("environment_id");
            if (input.infra_id === undefined || input.infra_id === "") missing.push("infra_id");
            if (missing.length > 0) {
              throw new Error(
                `Missing required field(s) for get on chaos_application_map: ${missing.join(", ")}. ` +
                `Both 'environment_id' (Harness environment identifier) and 'infra_id' ` +
                `(chaos_k8s_infrastructure.identity) must be passed so the backend can resolve ` +
                `the composite {identity, infra_id, environment_ref} key.`,
              );
            }
          },
          responseExtractor: passthrough,
          description: descGetApplicationMap,
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { condition_id: "conditionId" },
          responseExtractor: passthrough,
          description: descGetGuardCondition,
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/v3/chaosguard-conditions/{conditionId}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { rule_id: "ruleId" },
          responseExtractor: passthrough,
          description: descGetGuardRule,
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/v3/chaosguard-rules/{ruleId}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { rule_id: "ruleId" },
          responseExtractor: passthrough,
          description: descDeleteGuardRule,
        },
      },
      executeActions: {
        enable: {
          method: "PUT",
          path: `${CHAOS}/v3/chaosguard-rules/{ruleId}/enable`,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => {
            const b = coerceBody(input);
            return {
              name: b.name,
              identifier: b.identifier,
              ...(b.description ? { description: b.description } : {}),
              ...(b.objective ? { objective: b.objective } : {}),
              tags: (b.tags as Record<string, string>) ?? {},
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

    // ── Service Discovery: Agents ──────────────────────────────────────
    // GET /gateway/servicediscovery/api/v1/agents (service-discovery repo).
    // Envelope matches the other SD list endpoints:
    //   { items, page: { totalItems, ... }, correlationID }
    // so we reuse sdPageExtract. The Go handler treats environmentIdentifier
    // as an optional narrowing filter even though swagger marks it required —
    // omit to enumerate agents across every environment in the current scope.
    {
      resourceType: "discovered_agent",
      displayName: "Discovered Agent",
      description: descDiscoveredAgent,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["identity"],
      compactItem: compactDiscoveredAgent,
      searchAliases: [
        "service discovery agent", "sd agent", "discovery agent",
        "chaos discovery agent",
      ],
      listFilterFields: [
        { name: "environment_id", description: descSDAgentListEnvironmentId },
        { name: "search", description: descDiscoveredAgentSearch },
        { name: "all", type: "boolean", description: descSDFetchAll },
      ],
      relatedResources: [
        {
          resourceType: "discovered_namespace",
          relationship: "produces",
          description: "The 'identity' field returned here is the value discovered_namespace / discovered_service / discovered_network_map take as agent_identity.",
        },
        {
          resourceType: "chaos_service",
          relationship: "referenced_by",
          description: "Use an agent's 'identity' as the agent_id field when creating or updating a chaos_service.",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${SD}/agents`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            environment_id: "environmentIdentifier",
            search: "search",
            page: "page",
            size: "limit",   // SD uses `limit`, not `size`
            all: "all",
          },
          responseExtractor: sdPageExtract,
          description: descListDiscoveredAgents,
        },
      },
    },

    // ── Service Discovery: Namespaces ──────────────────────────────────
    {
      resourceType: "discovered_namespace",
      displayName: "Discovered Namespace",
      description: descDiscoveredNamespace,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["agent_identity"],
      searchAliases: ["namespace", "k8s namespace", "kubernetes namespace", "service discovery namespace"],
      listFilterFields: [
        { name: "agent_identity", description: descSDAgentIdentity, required: true },
        { name: "environment_id", description: descSDEnvironmentId, required: true },
        { name: "name", description: descSDNamespaceNameFilter },
        { name: "all", type: "boolean", description: descSDFetchAll },
      ],
      diagnosticHint: descSDAgentDiagnostic,
      relatedResources: [
        {
          resourceType: "discovered_service",
          relationship: "scopes",
          description: "Discovered services can be filtered by namespace; use this list to find valid namespace values for that filter.",
        },
        {
          resourceType: "discovered_network_map",
          relationship: "selected_by",
          description: "Network maps select a subset of discovered services from one or more namespaces. Use this resource as the next step after picking which namespaces to chaos-test.",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${SD}/agents/{agentIdentity}/namespaces`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { agent_identity: "agentIdentity" },
          queryParams: {
            environment_id: "environmentIdentifier",
            name: "name",
            page: "page",
            size: "limit",       // SD uses `limit`, not `size`
            all: "all",
          },
          responseExtractor: sdPageExtract,
          description: descListDiscoveredNamespaces,
        },
      },
    },

    // ── Service Discovery: Services ────────────────────────────────────
    {
      resourceType: "discovered_service",
      displayName: "Discovered Service",
      description: descDiscoveredService,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["agent_identity"],
      searchAliases: [
        "service discovery", "discovered service", "k8s service", "kubernetes service",
        "workload", "service map", "topology", "service relationship",
        "lambda", "ec2", "rds", "load balancer",
      ],
      listFilterFields: [
        { name: "agent_identity", description: descSDAgentIdentity, required: true },
        { name: "environment_id", description: descSDEnvironmentId, required: true },
        { name: "namespace", description: descSDNamespaceFilter },
        { name: "search", description: descSDSearchFilter },
        { name: "all", type: "boolean", description: descSDFetchAll },
      ],
      diagnosticHint: descSDAgentDiagnostic,
      relatedResources: [
        {
          resourceType: "discovered_namespace",
          relationship: "scoped_by",
          description: "Use discovered_namespace to discover valid namespace values before filtering services.",
        },
        {
          resourceType: "discovered_network_map",
          relationship: "selected_by",
          description: "Network maps reference discovered services as their resources. Inspect a network map to see which of these services are in scope for chaos.",
        },
        {
          resourceType: "chaos_application_map",
          relationship: "promoted_to",
          description: "Once selected into a network map and promoted to a chaos application map, the workloads behind these services become chaos targets and emit workload=<name> tags on experiments.",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${SD}/agents/{agentIdentity}/discoveredservices`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { agent_identity: "agentIdentity" },
          queryParams: {
            environment_id: "environmentIdentifier",
            namespace: "namespace",
            search: "search",
            page: "page",
            size: "limit",
            all: "all",
          },
          responseExtractor: sdPageExtract,
          description: descListDiscoveredServices,
        },
      },
    },

    // ── Service Discovery: Network Maps ────────────────────────────────
    {
      resourceType: "discovered_network_map",
      displayName: "Discovered Network Map",
      description: descDiscoveredNetworkMap,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["agent_identity"],
      searchAliases: [
        "service discovery network map", "sd network map", "raw network map",
        "agent network map",
      ],
      listFilterFields: [
        { name: "agent_identity", description: descSDAgentIdentity, required: true },
        { name: "environment_id", description: descSDEnvironmentId, required: true },
        { name: "search",         description: descSDNetworkMapSearch },
        { name: "all", type: "boolean", description: descSDFetchAll },
      ],
      diagnosticHint: descSDAgentDiagnostic,
      relatedResources: [
        { resourceType: "chaos_application_map",  relationship: "promoted_to", description: "The chaos application map (chaos_application_map) is the project-scoped, chaos-augmented view of a discovered network map. Use chaos_application_map for blast-radius / experiment context." },
        { resourceType: "discovered_service",     relationship: "contains",    description: "Network maps reference discovered services as their resources. Use discovered_service to inspect each entry." },
        { resourceType: "discovered_namespace",   relationship: "scoped_by",   description: "Use discovered_namespace to discover valid namespace context for the agent." },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${SD}/agents/{agentIdentity}/networkmaps`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { agent_identity: "agentIdentity" },
          queryParams: {
            environment_id: "environmentIdentifier",
            search: "search",
            page: "page",
            size: "limit",       // SD uses `limit`, not `size`
            all: "all",
          },
          responseExtractor: sdPageExtract,
          description: descListDiscoveredNetworkMaps,
        },
      },
    },

    // ── Scanned Risks (chaos-manager v3) ───────────────────────────────
    {
      resourceType: "scanned_risk",
      displayName: "Scanned Risk",
      description: descScannedRisk,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["identity"],
      searchAliases: ["risk finding", "detected risk", "scan finding", "scanned risk"],
      listFilterFields: [
        { name: "search", description: descRiskSearch },
        { name: "sort_field", description: descRiskSortField },
        { name: "sort_ascending", description: descRiskSortAscending, type: "boolean" },
        { name: "tags", description: descRiskTags },
        { name: "severity", description: descScannedRiskSeverity },
        { name: "risk_rule_id", description: descScannedRiskRuleId },
        { name: "validation_type", description: descScannedRiskValidationType, enum: ["Confirmed", "Passive"] },
        { name: "service_identity", description: descScannedRiskServiceIdentity },
        { name: "environment_identity", description: descRiskEnvironmentIdentity },
        { name: "agent_identity", description: descRiskAgentIdentity },
        { name: "start_time", description: descRiskStartTime, type: "number" },
        { name: "end_time", description: descRiskEndTime, type: "number" },
        { name: "include_all_scope", description: descRiskIncludeAllScope, type: "boolean" },
      ],
      relatedResources: [
        { resourceType: "chaos_risk_rule", relationship: "flagged_by", description: "Each scanned risk is flagged by a risk rule. Use chaos_risk_rule with the finding's riskRuleId to inspect the rule (severity, category, prompt)." },
        { resourceType: "chaos_risk_scan", relationship: "produced_by", description: "Scanned risks are produced by a risk scan. Use chaos_risk_scan to list scans and their status, or to fetch a full report of all findings." },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/v3/scanned-risks`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            page: "page",
            limit: "limit",
            search: "search",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
            tags: "tags",
            severity: "severity",
            risk_rule_id: "riskRuleId",
            validation_type: "validationType",
            service_identity: "serviceIdentity",
            environment_identity: "environmentIdentity",
            agent_identity: "agentIdentity",
            start_time: "startTime",
            end_time: "endTime",
            include_all_scope: "includeAllScope",
          },
          defaultQueryParams: { page: "0", limit: "15" },
          responseExtractor: chaosPageExtract,
          description: descListScannedRisks,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/v3/scanned-risks/{identity}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { identity: "identity" },
          responseExtractor: chaosScannedRiskGetExtract,
          description: descGetScannedRisk,
        },
      },
      executeActions: {
        occurrences: {
          method: "GET",
          path: `${CHAOS}/v3/scanned-risks/{identity}/occurrences`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { identity: "identity" },
          queryParams: {
            page: "page",
            limit: "limit",
            search: "search",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
            scan_type: "scanType",
            start_time: "startTime",
            end_time: "endTime",
          },
          defaultQueryParams: { page: "0", limit: "15" },
          responseExtractor: chaosPageExtract,
          actionDescription: descListScannedRiskOccurrences,
          bodySchema: { description: descBodyNoBody, fields: [] },
          paramsSchema: {
            fields: [
              { name: "identity", required: true, description: "Identity of the scanned risk to list occurrences for." },
              { name: "page", required: false, description: "Page number (0-indexed). Default 0." },
              { name: "limit", required: false, description: "Page size. Default 15." },
              { name: "search", required: false, description: descRiskSearch },
              { name: "sort_field", required: false, description: descRiskSortField },
              { name: "sort_ascending", required: false, description: descRiskSortAscending },
              { name: "scan_type", required: false, description: descScannedRiskScanType },
              { name: "start_time", required: false, description: descRiskStartTime },
              { name: "end_time", required: false, description: descRiskEndTime },
            ],
          } satisfies ParamsSchema,
        },
        summary_by_service: {
          method: "POST",
          path: `${CHAOS}/v3/scanned-risks/summary`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            page: "page",
            limit: "limit",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
            service_type: "serviceType",
            environment_identity: "environmentIdentity",
            agent_identity: "agentIdentity",
            start_time: "startTime",
            end_time: "endTime",
          },
          bodyBuilder: () => ({}),
          responseExtractor: chaosPageExtract,
          actionDescription: descSummarizeScannedRisksByService,
          bodySchema: { description: descBodyNoBody, fields: [] },
          paramsSchema: {
            fields: [
              { name: "page", required: false, description: "Page number (0-indexed). Default 0." },
              { name: "limit", required: false, description: "Page size. Default 15." },
              { name: "sort_field", required: false, description: descRiskSortField },
              { name: "sort_ascending", required: false, description: descRiskSortAscending },
              { name: "service_type", required: false, description: "Filter by service type (e.g. Kubernetes)." },
              { name: "environment_identity", required: false, description: descRiskEnvironmentIdentity },
              { name: "agent_identity", required: false, description: descRiskAgentIdentity },
              { name: "start_time", required: false, description: descRiskStartTime },
              { name: "end_time", required: false, description: descRiskEndTime },
            ],
          } satisfies ParamsSchema,
        },
      },
    },

    // ── Chaos Risk Rules (chaos-manager v3) ────────────────────────────
    {
      resourceType: "chaos_risk_rule",
      displayName: "Chaos Risk Rule",
      description: descChaosRiskRule,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["identity"],
      searchAliases: ["risk rule", "risk check", "manifest risk rule"],
      listFilterFields: [
        { name: "search", description: descRiskSearch },
        { name: "sort_field", description: descRiskSortField },
        { name: "sort_ascending", description: descRiskSortAscending, type: "boolean" },
        { name: "tags", description: descRiskTags },
        { name: "is_system", description: descRiskRuleIsSystem, type: "boolean" },
        { name: "data_source", description: descRiskRuleDataSource },
        { name: "include_all_scope", description: descRiskIncludeAllScope, type: "boolean" },
      ],
      relatedResources: [
        { resourceType: "scanned_risk", relationship: "flags", description: "Risk rules flag scanned risks during a scan. Use scanned_risk with risk_rule_id=<this rule's identity> to find findings produced by this rule." },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/v3/risk-rules`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            page: "page",
            limit: "limit",
            search: "search",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
            tags: "tags",
            is_system: "isSystem",
            data_source: "dataSource",
            include_all_scope: "includeAllScope",
          },
          defaultQueryParams: { page: "0", limit: "15" },
          responseExtractor: chaosPageExtract,
          description: descListRiskRules,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/v3/risk-rules/{identity}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { identity: "identity" },
          responseExtractor: passthrough,
          description: descGetRiskRule,
        },
      },
    },

    // ── Chaos Risk Scans (chaos-manager v3) ────────────────────────────
    {
      resourceType: "chaos_risk_scan",
      displayName: "Chaos Risk Scan",
      description: descChaosRiskScan,
      toolset: "chaos",
      scope: "project",
      scopeParams: CHAOS_SCOPE,
      identifierFields: ["identity"],
      searchAliases: ["risk scan", "resilience risk scan", "manifest scan"],
      listFilterFields: [
        { name: "search", description: descRiskSearch },
        { name: "sort_field", description: descRiskSortField },
        { name: "sort_ascending", description: descRiskSortAscending, type: "boolean" },
        { name: "tags", description: descRiskTags },
        { name: "scan_type", description: descScannedRiskScanType, enum: ["PipelineExecution", "DiscoveryAgent"] },
        { name: "status", description: descRiskScanStatus, enum: ["PENDING", "COLLECTING", "ANALYSING", "REPORTING", "COMPLETED", "ERRORED", "ABORTED"] },
        { name: "pipeline_identity", description: descRiskPipelineIdentity },
        { name: "agent_identity", description: descRiskAgentIdentity },
        { name: "environment_identity", description: descRiskEnvironmentIdentity },
        { name: "start_time", description: descRiskStartTime, type: "number" },
        { name: "end_time", description: descRiskEndTime, type: "number" },
      ],
      relatedResources: [
        { resourceType: "scanned_risk", relationship: "produces", description: "A risk scan produces scanned risks. Use scanned_risk to list the findings, or the scan's 'report' execute action for the full findings report." },
        { resourceType: "chaos_risk_rule", relationship: "applies", description: "A risk scan applies risk rules to service manifests. Use chaos_risk_rule to inspect which rules can be applied." },
        { resourceType: "pipeline", relationship: "triggered_by", description: "PipelineExecution scans are triggered by a pipeline. Use resource_type=pipeline with the scan's source.pipeline.pipelineIdentity to inspect the pipeline." },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${CHAOS}/v3/risk-scans`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            page: "page",
            limit: "limit",
            search: "search",
            sort_field: "sortField",
            sort_ascending: "sortAscending",
            tags: "tags",
            scan_type: "scanType",
            status: "status",
            pipeline_identity: "pipelineIdentity",
            agent_identity: "agentIdentity",
            environment_identity: "environmentIdentity",
            start_time: "startTime",
            end_time: "endTime",
          },
          defaultQueryParams: { page: "0", limit: "15" },
          responseExtractor: chaosPageExtract,
          description: descListRiskScans,
        },
        get: {
          method: "GET",
          path: `${CHAOS}/v3/risk-scans/{identity}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { identity: "identity" },
          responseExtractor: passthrough,
          description: descGetRiskScan,
        },
        create: {
          method: "POST",
          path: `${CHAOS}/v3/risk-scans`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => {
            const b = coerceBody(input);
            const missing: string[] = [];
            if (!b.identity) missing.push("identity");
            if (!b.name) missing.push("name");
            const scanType = b.scanType ?? b.scan_type;
            if (!scanType) missing.push("scanType");
            if (!b.source) missing.push("source");
            if (missing.length > 0) {
              throw new Error(`Missing required field(s): ${missing.join(", ")}. All are required to create a risk scan.`);
            }
            return {
              identity: b.identity,
              name: b.name,
              ...(b.description != null ? { description: b.description } : {}),
              ...(b.tags != null ? { tags: b.tags } : {}),
              scanType,
              source: b.source,
            };
          },
          responseExtractor: passthrough,
          description: descCreateRiskScan,
          bodySchema: {
            description: descBodyRiskScanCreate,
            fields: [
              { name: "identity", type: "string", required: true, description: descRiskScanIdentity },
              { name: "name", type: "string", required: true, description: descRiskScanName },
              { name: "description", type: "string", required: false, description: descRiskScanDescription },
              { name: "tags", type: "array", required: false, itemType: "string", description: descRiskScanTags },
              { name: "scanType", type: "string", required: true, description: descRiskScanType },
              { name: "source", type: "object", required: true, description: descRiskScanSource },
            ],
          },
        },
        update: {
          method: "PUT",
          path: `${CHAOS}/v3/risk-scans/{identity}`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { identity: "identity" },
          bodyBuilder: (input) => {
            const b = coerceBody(input);
            return {
              ...(b.name !== undefined ? { name: b.name } : {}),
              ...(b.description !== undefined ? { description: b.description } : {}),
              ...(b.tags !== undefined ? { tags: b.tags } : {}),
            };
          },
          responseExtractor: passthrough,
          description: descUpdateRiskScan,
          bodySchema: {
            description: descBodyRiskScanUpdate,
            fields: [
              { name: "name", type: "string", required: false, description: descRiskScanName },
              { name: "description", type: "string", required: false, description: descRiskScanDescription },
              { name: "tags", type: "array", required: false, itemType: "string", description: descRiskScanTags },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: `${CHAOS}/v3/risk-scans/{identity}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { identity: "identity" },
          responseExtractor: passthrough,
          description: descDeleteRiskScan,
        },
      },
      executeActions: {
        retry: {
          method: "POST",
          path: `${CHAOS}/v3/risk-scans/{identity}/retry`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { identity: "identity" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: descRetryRiskScan,
          bodySchema: { description: descBodyNoBody, fields: [] },
        },
        abort: {
          method: "POST",
          path: `${CHAOS}/v3/risk-scans/{identity}/abort`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { identity: "identity" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: descAbortRiskScan,
          bodySchema: { description: descBodyNoBody, fields: [] },
        },
        report: {
          method: "GET",
          path: `${CHAOS}/v3/risk-scans/{identity}/report`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { identity: "identity" },
          responseExtractor: passthrough,
          actionDescription: descGetRiskScanReport,
          bodySchema: { description: descBodyNoBody, fields: [] },
        },
        report_download: {
          method: "GET",
          path: `${CHAOS}/v3/risk-scans/{identity}/report/download`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { identity: "identity" },
          responseExtractor: passthrough,
          actionDescription: descGetRiskScanReportDownload,
          bodySchema: { description: descBodyNoBody, fields: [] },
        },
        heatmap: {
          method: "GET",
          path: `${CHAOS}/v3/risk-scans/{identity}/heatmap`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { identity: "identity" },
          queryParams: {
            page: "page",
            limit: "limit",
            search: "search",
          },
          defaultQueryParams: { page: "0", limit: "15" },
          responseExtractor: chaosHeatmapExtract,
          actionDescription: descGetRiskScanHeatmap,
          bodySchema: { description: descBodyNoBody, fields: [] },
          paramsSchema: {
            fields: [
              { name: "identity", required: true, description: "Identity of the risk scan to get heatmap for." },
              { name: "page", required: false, description: "Page number (0-indexed). Default 0." },
              { name: "limit", required: false, description: "Page size. Default 15." },
              { name: "search", required: false, description: descHeatmapSearch },
            ],
          } satisfies ParamsSchema,
        },
      },
    },
  ],
};
