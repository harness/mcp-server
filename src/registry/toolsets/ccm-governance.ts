/**
 * CCM asset governance (Cloud Custodian) resources — `/ccm/api/governance/*` on ce-nextgen.
 *
 * Documented helper file: it exports resource definitions that `ccm.ts` spreads into the `ccm`
 * toolset (so governance ships with the rest of Cloud Cost Management and needs no new toolset).
 *
 * Resource types (all `cost_governance_*`):
 *   rule, rule_set, enforcement, enforcement_recommendation, recommendation,
 *   evaluation, alert, overview.
 *
 * Safety model (see the knowledge-base note "ccm-asset-governance-surface"):
 *  - Policy execution is split into two actions with fixed risk: `dry_run` (medium_write, read-only
 *    evaluation) and `run` (high_write, live — applies the rule's actions). The request always
 *    carries an explicit `isDryRun`: the backend treats a missing value as a LIVE run for
 *    permission purposes, so the value is forced by the action and never taken from the caller.
 *  - Enforcements are scheduled live automation: create/update/enable are high_write, and a new
 *    enforcement defaults to `isDryRun: true`.
 *  - Fields only the platform may set (`isGeneratedByAI`, `ruleEnforcementType`, …) are stripped.
 */
import type { BodySchema, FilterFieldSpec, ParamsSchema, ResourceDefinition } from "../types.js";
import { parseCustomWindow } from "../../utils/ccm-time.js";
import {
  ccmGovernanceAlertGetExtract,
  ccmGovernanceAlertListExtract,
  ccmGovernanceEnforcementListExtract,
  ccmGovernanceEnforcementRecommendationListExtract,
  ccmGovernanceEnqueueExtract,
  ccmGovernanceEvaluationGetExtract,
  ccmGovernanceEvaluationListExtract,
  ccmGovernanceExecutionDetailsExtract,
  ccmGovernanceLastEvaluationExtract,
  ccmGovernanceOverviewSeriesExtract,
  ccmGovernanceOverviewValueExtract,
  ccmGovernancePotentialRulesExtract,
  ccmGovernanceRecommendationGetExtract,
  ccmGovernanceRecommendationListExtract,
  ccmGovernanceRuleListExtract,
  ccmGovernanceRuleSetFirstExtract,
  ccmGovernanceRuleSetListExtract,
  ccmGovernanceStringListExtract,
  ccmGovernanceTargetListExtract,
  ccmGovernanceValidateExtract,
  ccmGovernanceWriteExtract,
  ngExtract,
} from "../extractors.js";

const GOV = "/ccm/api/governance";
const CLOUD_PROVIDERS = ["AWS", "AZURE", "GCP"];
const DAY_MS = 86_400_000;
const TIME_FILTER_DAYS: Readonly<Record<string, number>> = { LAST_7_DAYS: 7, LAST_30_DAYS: 30, LAST_90_DAYS: 90 };
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type Input = Record<string, unknown>;
type Body = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Body {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The caller's `body` argument as an object (never undefined). */
function bodyOf(input: Input): Body {
  return isObject(input.body) ? input.body : {};
}

/** Accepts `["a","b"]` or `"a, b"`; returns undefined when nothing usable. */
function toList(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const out = raw.map((v) => String(v).trim()).filter((v) => v.length > 0);
  return out.length > 0 ? out : undefined;
}

function toBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function toText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toInt(value: unknown): number | undefined {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function dropUndefined(obj: Body): Body {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function omitKeys(obj: Body, keys: readonly string[]): Body {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
}

/**
 * `limit`/`size` (default 20, max 100) and `offset` (or `page` × limit). Out-of-range values fail loudly
 * rather than being clamped, so a caller never receives fewer rows than it asked for without knowing.
 */
function paging(input: Input): { limit: number; offset: number } {
  const limit = toInt(input.limit ?? input.size) ?? DEFAULT_PAGE_SIZE;
  if (limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new Error(`limit must be between 1 and ${MAX_PAGE_SIZE} (got ${limit}). Use offset or page to read further rows.`);
  }
  const offset = toInt(input.offset) ?? (toInt(input.page) ?? 0) * limit;
  if (offset < 0) throw new Error(`offset must be 0 or greater (got ${offset}).`);
  return { limit, offset };
}

/**
 * 0-based page number for endpoints that page by `pageNumber` + `pageSize` rather than offset.
 * An offset that does not fall on a page boundary cannot be expressed, so it is rejected instead of rounded.
 */
function pageNumberFor(limit: number, offset: number): number {
  if (offset % limit !== 0) {
    throw new Error(
      `offset (${offset}) must be a multiple of limit (${limit}) for this list; use page=<n> (0-based) or an aligned offset.`,
    );
  }
  return offset / limit;
}

/** Time window as the `List<CCMTimeFilter>` the backend expects. Explicit start/end win over `time_filter`. */
function timeFilters(input: Input): Array<{ operator: "AFTER" | "BEFORE"; timestamp: number }> {
  const custom = parseCustomWindow(input);
  let { startMs, endMs } = custom;
  if (startMs === undefined || endMs === undefined) {
    const key = (toText(input.time_filter) ?? "LAST_30_DAYS").toUpperCase();
    const days = TIME_FILTER_DAYS[key];
    if (days === undefined) {
      throw new Error(`Invalid time_filter "${key}". Use ${Object.keys(TIME_FILTER_DAYS).join(", ")}, or start_time + end_time.`);
    }
    endMs = Date.now();
    startMs = endMs - days * DAY_MS;
  }
  return [
    { operator: "AFTER", timestamp: startMs },
    { operator: "BEFORE", timestamp: endMs },
  ];
}

/** Body object for a create/update whose DTO wraps the entity (`{ rule: {...} }`); tolerates a caller that already wrapped it. */
function wrappedEntity(input: Input, wrapperKey: string): Body {
  const body = bodyOf(input);
  return isObject(body[wrapperKey]) ? (body[wrapperKey] as Body) : body;
}

/** Comma-separated `cloud_provider` → repeated query values. */
function normalizeCloudProviders(input: Input): void {
  const list = toList(input.cloud_provider);
  if (list) input.cloud_provider = list.map((v) => v.toUpperCase());
}

/** Hoist a single `<name>` into `<name>s` for endpoints that take a repeated query param. */
function hoistIds(single: string, plural: string) {
  return (input: Input): void => {
    if (input[plural] === undefined && input[single] !== undefined) input[plural] = input[single];
    const list = toList(input[plural]);
    if (list) input[plural] = list;
  };
}

/** Fields the caller must never set on a rule (identity, ownership, platform flags, audit). */
const RULE_OMIT = ["accountId", "isOOTB", "deleted", "forRecommendation", "orgIdentifier", "projectIdentifier", "createdAt", "createdBy", "lastUpdatedAt", "lastUpdatedBy"];
const RULE_SET_OMIT = ["accountId", "isOOTB", "orgIdentifier", "projectIdentifier", "createdAt", "createdBy", "lastUpdatedAt", "lastUpdatedBy"];
/** Includes the platform-only fields that mark an enforcement as AI-generated or recommendation-derived. */
const ENFORCEMENT_OMIT = [
  "accountId", "deleted", "orgIdentifier", "projectIdentifier", "runCount", "savings",
  "isGeneratedByAI", "ruleEnforcementType", "ruleEnforcementRecommendationIdentifier",
  "createdAt", "createdBy", "lastUpdatedAt", "lastUpdatedBy",
];
const ALERT_OMIT = ["accountId", "createdAt", "createdBy", "lastUpdatedAt", "lastUpdatedBy"];

function requireText(value: unknown, message: string): string {
  const text = toText(value);
  if (!text) throw new Error(message);
  return text;
}

// ---------------------------------------------------------------------------
// Policy execution (dry_run / run) — isDryRun is forced by the action, never caller-supplied
// ---------------------------------------------------------------------------

function adhocTargets(input: Input): { ruleId?: string; targetAccounts?: string[]; targetRegions?: string[] } {
  const body = bodyOf(input);
  return {
    ruleId: toText(input.rule_id ?? body.ruleId),
    targetAccounts: toList(input.target_accounts ?? body.targetAccounts),
    targetRegions: toList(input.target_regions ?? body.targetRegions),
  };
}

function buildAdhocBody(isDryRun: boolean) {
  return (input: Input): Body => {
    const { ruleId, targetAccounts, targetRegions } = adhocTargets(input);
    if (!ruleId) throw new Error("rule_id is required (pass it as resource_id).");
    if (!targetAccounts) {
      throw new Error(
        "target_accounts is required: the cloud account / subscription / project ids to evaluate. " +
          "List the valid ones with harness_execute(resource_type='cost_governance_rule', action='targets', params={cloud_provider}).",
      );
    }
    return dropUndefined({ ruleId, targetAccounts, targetRegions, isDryRun });
  };
}

function describeTargets(input: Input): string {
  const { targetAccounts, targetRegions } = adhocTargets(input);
  const accounts = targetAccounts?.join(", ") ?? "(none given)";
  return targetRegions ? `account(s) ${accounts}, region(s) ${targetRegions.join(", ")}` : `account(s) ${accounts}`;
}

const ADHOC_BODY_SCHEMA: BodySchema = {
  description:
    "Evaluate one rule against cloud accounts. isDryRun is NOT accepted: dry_run always sends true and run always sends false. " +
    "Fields can also be passed as top-level params (rule_id via resource_id, target_accounts, target_regions).",
  fields: [
    { name: "ruleId", type: "string", required: false, description: "Rule id (or pass resource_id)" },
    { name: "targetAccounts", type: "array", required: false, description: "Cloud account / subscription / project ids to evaluate (required). Get them from the `targets` action.", itemType: "string" },
    { name: "targetRegions", type: "array", required: false, description: "Regions to evaluate (required for AWS and Azure). Get them from the `regions` action.", itemType: "string" },
  ],
};

// ---------------------------------------------------------------------------
// Shared filter / body schema fragments
// ---------------------------------------------------------------------------

const PAGE_FILTERS: FilterFieldSpec[] = [
  { name: "limit", description: `Page size (default ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE})`, type: "number" },
  { name: "offset", description: "Rows to skip (default 0); or use page. Must be a multiple of limit for enforcement and enforcement_recommendation lists", type: "number" },
];

const CLOUD_PROVIDER_FILTER: FilterFieldSpec = { name: "cloud_provider", description: "Cloud provider", enum: CLOUD_PROVIDERS };

const CLOUD_PROVIDER_PARAM: ParamsSchema = {
  fields: [{ name: "cloud_provider", required: true, description: "AWS, AZURE or GCP" }],
};

/** Window over unpaged policy output (the backend returns every entry at once). */
const POLICY_OUTPUT_PARAMS: ParamsSchema["fields"] = [
  { name: "offset", required: false, description: "First entry to return (default 0); continue from the result's nextOffset" },
  { name: "limit", required: false, description: "Entries per call (default 25, max 50)" },
  { name: "response_offset", required: false, description: "Character offset into each entry's response text (default 0); continue from responseNextOffset. Use with limit=1 to read one long entry" },
];

const EXECUTION_TYPE_PARAM: ParamsSchema["fields"][number] = {
  name: "execution_type",
  required: false,
  description: "EXTERNAL (default: ad hoc and scheduled runs), INTERNAL (recommendation runs) or INVENTORY_INTERNAL",
};

/** For actions parameterised only by resource_id / params. */
const NO_BODY_SCHEMA: BodySchema = {
  description: "No body needed: the target is resource_id (and params where the action description says so).",
  fields: [],
};

const RULE_FIELDS: BodySchema["fields"] = [
  { name: "name", type: "string", required: true, description: "Rule name (unique in the account)" },
  { name: "cloudProvider", type: "string", required: true, description: "AWS | AZURE | GCP (cannot be changed after creation)" },
  { name: "rulesYaml", type: "yaml", required: true, description: "Cloud Custodian policy YAML (`policies:` list). Validate with the `validate` action before saving." },
  { name: "description", type: "string", required: false, description: "Description (derived from the YAML when omitted)" },
  { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
  { name: "resourceType", type: "string", required: false, description: "Primary resource type, e.g. aws.ec2" },
  { name: "isMultiPolicyRule", type: "boolean", required: false, description: "True when the YAML holds several policies" },
  { name: "forInventory", type: "boolean", required: false, description: "Rule is an inventory rule" },
  { name: "savings", type: "number", required: false, description: "Expected savings as a PERCENT of resource cost (0-100), not a currency amount" },
];

const ENFORCEMENT_FIELDS: BodySchema["fields"] = [
  { name: "name", type: "string", required: true, description: "Enforcement name" },
  { name: "cloudProvider", type: "string", required: true, description: "AWS | AZURE | GCP" },
  { name: "ruleIds", type: "array", required: false, description: "Rule ids to run (at least one of ruleIds / ruleSetIDs)", itemType: "string" },
  { name: "ruleSetIDs", type: "array", required: false, description: "Rule set ids to run (note the capital ID)", itemType: "string" },
  { name: "executionSchedule", type: "string", required: true, description: "Cron expression for when the enforcement runs" },
  { name: "executionTimezone", type: "string", required: false, description: "IANA timezone for the schedule, e.g. UTC" },
  { name: "targetAccounts", type: "array", required: true, description: "Cloud account / subscription / project ids", itemType: "string" },
  { name: "targetRegions", type: "array", required: false, description: "Regions (required for AWS and Azure)", itemType: "string" },
  { name: "isDryRun", type: "boolean", required: false, description: "true = evaluate only; false = LIVE, actions change resources. Defaults to true on create; required on update." },
  { name: "isEnabled", type: "boolean", required: false, description: "Whether the schedule is active" },
  { name: "description", type: "string", required: false, description: "Description" },
  { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
];

const ALERT_FIELDS: BodySchema["fields"] = [
  { name: "name", type: "string", required: true, description: "Alert name" },
  { name: "cloudProvider", type: "string", required: true, description: "AWS | AZURE | GCP" },
  { name: "resourceTypes", type: "array", required: true, description: "Resource types to alert on (see the `resource_types` action on cost_governance_rule)", itemType: "string" },
  { name: "emailIds", type: "array", required: true, description: "Recipient email addresses", itemType: "string" },
  { name: "cloudAccountIds", type: "array", required: false, description: "Limit to these cloud accounts", itemType: "string" },
  { name: "isAttachmentRequired", type: "boolean", required: false, description: "Attach the resource list to the email" },
  { name: "isEnabled", type: "boolean", required: false, description: "Whether the alert is active" },
];

function withRequired(fields: BodySchema["fields"], extra: BodySchema["fields"]): BodySchema["fields"] {
  return [...extra, ...fields];
}

function enforcementNote(input: Input): string | undefined {
  const entity = wrappedEntity(input, "ruleEnforcement");
  const accounts = toList(entity.targetAccounts)?.join(", ") ?? "the target accounts";
  if (entity.isDryRun === false) {
    return `LIVE enforcement (isDryRun=false): on schedule ${String(entity.executionSchedule ?? "?")} its rules will APPLY actions (e.g. stop/terminate/delete) to matching resources in ${accounts}.`;
  }
  return "Dry-run enforcement: evaluates on a schedule and reports; it does not change resources.";
}

// ---------------------------------------------------------------------------
// Overview metric dispatch
// ---------------------------------------------------------------------------

interface OverviewMetric {
  path: string;
  method: "GET" | "POST";
}

const OVERVIEW_VALUE_METRICS: Readonly<Record<string, OverviewMetric>> = {
  total_evaluations: { path: "overview/totalEvaluations", method: "GET" },
  total_active_enforcements: { path: "overview/totalActiveEnforcements", method: "GET" },
  total_new_enforcement_recommendations: { path: "overview/totalNewEnforcementRecommendations", method: "GET" },
  total_realised_savings: { path: "overview/totalRealisedSavingsV2", method: "POST" },
};

const OVERVIEW_SERIES_METRICS: Readonly<Record<string, OverviewMetric>> = {
  savings_grouped: { path: "overview/totalRealisedSavingsGrouped", method: "GET" },
  savings_time_series: { path: "overview/totalRealisedSavingsTimeSeries", method: "POST" },
  top_cloud_accounts: { path: "overview/topCloudAccountGovernanceSavings", method: "POST" },
  daily_evaluations: { path: "overview/dayWiseTotalEvaluations", method: "POST" },
};

/** Metrics served by a GET endpoint take no time window (they are all-time / current); only POST metrics are windowed. */
function rejectWindowForUnwindowed(metricName: string, input: Input): void {
  const supplied = ["time_filter", "start_time", "end_time"].filter((k) => toText(input[k]) !== undefined);
  if (supplied.length > 0) {
    throw new Error(
      `${metricName} is not time-windowed (it reports all-time or current values), so ${supplied.join(", ")} cannot be applied. ` +
        "Remove it, or use a windowed metric (total_realised_savings, savings_time_series, top_cloud_accounts, daily_evaluations).",
    );
  }
}

function resolveMetric(table: Readonly<Record<string, OverviewMetric>>, input: Input): OverviewMetric {
  const name = toText(input.metric ?? input.resource_id);
  const metric = name ? table[name] : undefined;
  if (!metric) {
    throw new Error(`metric is required. Use one of: ${Object.keys(table).join(", ")}.`);
  }
  return metric;
}

const OVERVIEW_PARAMS_SCHEMA: ParamsSchema = {
  fields: [
    { name: "cloud_provider", required: false, description: "AWS, AZURE, GCP (comma-separated for several); default all" },
    { name: "time_filter", required: false, description: "LAST_7_DAYS | LAST_30_DAYS (default) | LAST_90_DAYS — windowed metrics only (total_realised_savings, savings_time_series, top_cloud_accounts, daily_evaluations); rejected for the all-time/current metrics" },
    { name: "start_time", required: false, description: "Custom window start (YYYY-MM-DD, ISO 8601 or epoch ms); pair with end_time" },
    { name: "end_time", required: false, description: "Custom window end; pair with start_time" },
  ],
};

function overviewSpec(table: Readonly<Record<string, OverviewMetric>>) {
  return {
    method: "POST" as const,
    path: `${GOV}/overview`,
    pathBuilder: (input: Input) => `${GOV}/${resolveMetric(table, input).path}`,
    methodBuilder: (input: Input) => resolveMetric(table, input).method,
    inputNormalizer: normalizeCloudProviders,
    queryParams: { cloud_provider: "cloudProvider" },
    // GET metrics have no request body and no window: fail loudly rather than silently dropping a window the caller asked for.
    bodyBuilder: (input: Input) => {
      const metric = resolveMetric(table, input);
      if (metric.method === "POST") return timeFilters(input);
      rejectWindowForUnwindowed(toText(input.metric ?? input.resource_id) ?? "this metric", input);
      return undefined;
    },
    paramsSchema: OVERVIEW_PARAMS_SCHEMA,
    operationPolicy: { risk: "read" as const, retryPolicy: "safe" as const },
  };
}

// ---------------------------------------------------------------------------
// Resource definitions
// ---------------------------------------------------------------------------

export const ccmGovernanceResources: ResourceDefinition[] = [
  // ------------------------------------------------------------------
  // cost_governance_rule — Cloud Custodian policies; also where evaluations are started
  // ------------------------------------------------------------------
  {
    resourceType: "cost_governance_rule",
    displayName: "Cost Governance Rule",
    description:
      "Cloud asset governance rule (Cloud Custodian policy) for AWS/Azure/GCP: finds and optionally acts on wasteful resources. List/get/create/update/delete rules; actions: validate, dry_run (safe evaluation), run (LIVE — changes resources), clone, targets, regions, resource_types, last_evaluation. Not OPA policies (that is the `governance` toolset).",
    toolset: "ccm",
    scope: "account",
    identifierFields: ["rule_id"],
    deepLinkTemplate: "/ng/account/{accountId}/ce/governance/rules",
    searchAliases: ["asset governance", "cloud custodian", "custodian policy", "governance rule", "ccm rule", "cost governance"],
    diagnosticHint:
      "Rule not doing anything? validate the YAML, dry_run it on one account, then inspect cost_governance_evaluation (resources / logs). " +
      "A rule that matches nothing returns resourceCount 0 — that is not a failure.",
    executeHint:
      "Authoring flow: validate -> create -> dry_run on one account -> poll cost_governance_evaluation -> review resources/logs -> only then run, or schedule via cost_governance_enforcement. " +
      "dry_run and run return evaluation ids immediately; the work is asynchronous, so poll until executionStatus is SUCCESS, PARTIAL_SUCCESS or FAILED.",
    relatedResources: [
      { resourceType: "cost_governance_evaluation", relationship: "child", description: "Results of dry_run / run / scheduled enforcement" },
      { resourceType: "cost_governance_rule_set", relationship: "parent", description: "Named bundles of rules" },
      { resourceType: "cost_governance_enforcement", relationship: "parent", description: "Schedules that run rules automatically" },
      { resourceType: "cost_governance_recommendation", relationship: "child", description: "Recommendation health per rule" },
    ],
    listFilterFields: [
      { name: "search_term", description: "Match rule name (case-insensitive substring)" },
      CLOUD_PROVIDER_FILTER,
      { name: "resource_type", description: "Filter by resource type, e.g. aws.ec2" },
      { name: "is_ootb", description: "true = Harness out-of-the-box rules only, false = your custom rules only", type: "boolean" },
      { name: "for_recommendation", description: "true = rules that feed recommendations", type: "boolean" },
      { name: "rule_ids", description: "Only these rule ids (comma-separated)" },
      ...PAGE_FILTERS,
    ],
    operations: {
      list: {
        method: "POST",
        path: `${GOV}/rule/list`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        skipCompact: true,
        bodyBuilder: (input) => {
          const { limit, offset } = paging(input);
          return {
            query: dropUndefined({
              cloudProvider: toText(input.cloud_provider)?.toUpperCase(),
              search: toText(input.search_term ?? input.search),
              resourceType: toText(input.resource_type),
              isOOTB: toBool(input.is_ootb),
              forRecommendation: toBool(input.for_recommendation),
              policyIds: toList(input.rule_ids),
              limit,
              offset,
            }),
          };
        },
        responseExtractor: ccmGovernanceRuleListExtract,
        description:
          "List governance rules (custom and out-of-the-box). Returns id, name, cloudProvider, resourceType, isOOTB and savingsPercent (a PERCENT, 0-100). The YAML is omitted — use harness_get for it.",
      },
      get: {
        method: "GET",
        path: `${GOV}/rule/{ruleId}`,
        pathParams: { rule_id: "ruleId" },
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        responseExtractor: ngExtract,
        description: "Get one rule including its Cloud Custodian YAML (`rulesYaml`).",
      },
      create: {
        method: "POST",
        path: `${GOV}/rule`,
        operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
        bodyWrapperKey: "rule",
        bodyBuilder: (input) => ({ rule: omitKeys(wrappedEntity(input, "rule"), [...RULE_OMIT, "uuid"]) }),
        bodySchema: { description: "Rule definition. accountId, isOOTB and recommendation flags are set by the server. The YAML is validated before saving.", fields: RULE_FIELDS },
        responseExtractor: ccmGovernanceWriteExtract,
        description: "Create a custom governance rule. Validate the YAML first with the `validate` action.",
      },
      update: {
        method: "PUT",
        path: `${GOV}/rule`,
        operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
        bodyWrapperKey: "rule",
        bodyBuilder: (input) => {
          const entity = omitKeys(wrappedEntity(input, "rule"), RULE_OMIT);
          if (!toText(entity.uuid)) entity.uuid = toText(input.rule_id);
          return { rule: entity };
        },
        bodySchema: {
          description: "Full rule object to replace the existing one: harness_get it, change fields, send the whole object back. cloudProvider cannot change.",
          fields: withRequired(RULE_FIELDS, [{ name: "uuid", type: "string", required: true, description: "Rule id (defaults to resource_id)" }]),
        },
        responseExtractor: ccmGovernanceWriteExtract,
        description: "Update a custom rule (full replacement). Out-of-the-box rules cannot be changed.",
      },
      delete: {
        method: "DELETE",
        path: `${GOV}/rule/{ruleId}`,
        pathParams: { rule_id: "ruleId" },
        operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
        responseExtractor: ccmGovernanceWriteExtract,
        description: "Delete a custom rule. Fails or orphans references if enforcements still use it — check cost_governance_enforcement first.",
      },
    },
    executeActions: {
      validate: {
        method: "POST",
        path: `${GOV}/ruleValidate`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        bodyWrapperKey: "rule",
        bodyBuilder: (input) => ({ rule: omitKeys(wrappedEntity(input, "rule"), [...RULE_OMIT, "uuid"]) }),
        bodySchema: {
          description: "Rule to check (only rulesYaml and cloudProvider matter). Nothing is saved.",
          fields: [
            { name: "rulesYaml", type: "yaml", required: true, description: "Cloud Custodian policy YAML" },
            { name: "cloudProvider", type: "string", required: false, description: "AWS | AZURE | GCP" },
          ],
        },
        responseExtractor: ccmGovernanceValidateExtract,
        actionDescription: "Validate rule YAML without saving. Returns { valid: true }; a problem comes back as an error naming the offending line.",
      },
      dry_run: {
        method: "POST",
        path: `${GOV}/enqueueAdhocV2`,
        operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
        bodyBuilder: buildAdhocBody(true),
        bodySchema: ADHOC_BODY_SCHEMA,
        confirmNote: (input) => `DRY RUN: evaluates the rule on ${describeTargets(input)}. Read-only — no resources are changed.`,
        responseExtractor: ccmGovernanceEnqueueExtract,
        actionDescription:
          "Dry-run a rule against cloud accounts (read-only, safe). Needs resource_id=rule id, target_accounts and (AWS/Azure) target_regions. Returns evaluation ids to poll with cost_governance_evaluation.",
      },
      run: {
        method: "POST",
        path: `${GOV}/enqueueAdhocV2`,
        operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
        bodyBuilder: buildAdhocBody(false),
        bodySchema: ADHOC_BODY_SCHEMA,
        confirmNote: (input) =>
          `LIVE RUN (not a dry run): the rule's actions (e.g. stop / terminate / delete / tag) will be APPLIED to matching resources in ${describeTargets(input)}. This cannot be undone.`,
        responseExtractor: ccmGovernanceEnqueueExtract,
        actionDescription:
          "LIVE-run a rule: its actions change real cloud resources. Always dry_run first and review the matched resources. Same params as dry_run. Do not set HARNESS_AUTO_APPROVE_RISK to high_write/all if you want a prompt before live runs.",
      },
      clone: {
        method: "POST",
        path: `${GOV}/ruleClone`,
        operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
        bodyBuilder: (input) => ({ ruleClone: { uuid: requireText(input.rule_id ?? bodyOf(input).uuid, "rule_id is required (pass it as resource_id).") } }),
        bodySchema: { description: "No body needed; pass the source rule as resource_id.", fields: [] },
        responseExtractor: ccmGovernanceWriteExtract,
        actionDescription: "Clone a rule into a new custom rule (the clone gets a generated name).",
      },
      enable_recommendation: {
        method: "PUT",
        path: `${GOV}/rule/toggleForRecommendation`,
        operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
        queryParams: { rule_id: "ruleId" },
        staticQueryParams: { enableRuleForRecommendation: "true" },
        bodyBuilder: (input) =>
          dropUndefined({
            cloudAccountIds: toList(input.cloud_account_ids ?? bodyOf(input).cloudAccountIds),
            enableGranularRecommendation: toBool(input.enable_granular_recommendation ?? bodyOf(input).enableGranularRecommendation),
          }),
        bodySchema: {
          description: "Which cloud accounts the rule should generate recommendations for.",
          fields: [
            { name: "cloudAccountIds", type: "array", required: false, description: "Cloud accounts to associate (also as top-level cloud_account_ids)", itemType: "string" },
            { name: "enableGranularRecommendation", type: "boolean", required: false, description: "Per-resource recommendations" },
          ],
        },
        responseExtractor: ccmGovernanceWriteExtract,
        actionDescription: "Let a custom rule feed cost recommendations. The rule must target a supported resource type.",
      },
      disable_recommendation: {
        method: "PUT",
        path: `${GOV}/rule/toggleForRecommendation`,
        operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
        queryParams: { rule_id: "ruleId" },
        staticQueryParams: { enableRuleForRecommendation: "false" },
        bodyBuilder: () => ({}),
        bodySchema: NO_BODY_SCHEMA,
        responseExtractor: ccmGovernanceWriteExtract,
        actionDescription: "Stop a custom rule from feeding cost recommendations.",
      },
      last_evaluation: {
        method: "POST",
        path: `${GOV}/execution/ruleLastExecution`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        bodyBuilder: (input) => {
          const ids = toList(input.rule_ids) ?? toList(input.rule_id) ?? toList(bodyOf(input).ruleIds);
          if (!ids) throw new Error("rule_id (resource_id) or rule_ids is required.");
          return ids;
        },
        bodySchema: {
          description: "No body needed: pass resource_id (one rule) or params.rule_ids (comma-separated). Sent to the API as a list of rule ids.",
          fields: [],
        },
        responseExtractor: ccmGovernanceLastEvaluationExtract,
        actionDescription: "Latest evaluation for one rule (resource_id) or several (params.rule_ids, comma-separated).",
      },
      targets: {
        method: "GET",
        path: `${GOV}/governanceTargetList`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        inputNormalizer: normalizeCloudProviders,
        queryParams: { cloud_provider: "cloudProvider", is_dry_run: "isDryRun" },
        defaultQueryParams: { isDryRun: "true" },
        paramsSchema: {
          fields: [
            ...CLOUD_PROVIDER_PARAM.fields,
            { name: "is_dry_run", required: false, description: "true (default) = accounts you may dry-run on; false = accounts you may LIVE-run on" },
          ],
        },
        responseExtractor: ccmGovernanceTargetListExtract,
        actionDescription: "List cloud accounts / subscriptions / projects with governance enabled that you may evaluate on. Use these ids as target_accounts.",
      },
      regions: {
        method: "GET",
        path: `${GOV}/regions`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        queryParams: { cloud_provider: "cloudProvider" },
        paramsSchema: CLOUD_PROVIDER_PARAM,
        responseExtractor: ccmGovernanceStringListExtract,
        actionDescription: "List regions for AWS or Azure. Use these as target_regions.",
      },
      resource_types: {
        method: "GET",
        path: `${GOV}/alert/resourceTypes`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        queryParams: { cloud_provider: "cloudProvider" },
        paramsSchema: CLOUD_PROVIDER_PARAM,
        responseExtractor: ccmGovernanceStringListExtract,
        actionDescription: "List the resource types governance supports for a cloud provider (e.g. aws.ec2) — valid for rules and alerts.",
      },
      potential_recommendation_rules: {
        method: "GET",
        path: `${GOV}/rule/potentialRulesForRecommendation`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        responseExtractor: ccmGovernancePotentialRulesExtract,
        actionDescription: "Custom rules that could be enabled to feed recommendations (see enable_recommendation).",
      },
    },
  },

  // ------------------------------------------------------------------
  // cost_governance_rule_set
  // ------------------------------------------------------------------
  {
    resourceType: "cost_governance_rule_set",
    displayName: "Cost Governance Rule Set",
    description:
      "A named bundle of governance rules for one cloud provider (e.g. an out-of-the-box 'EC2 cost savings' pack). Enforcements can schedule a whole rule set. List/get/create/update/delete.",
    toolset: "ccm",
    scope: "account",
    identifierFields: ["rule_set_id"],
    deepLinkTemplate: "/ng/account/{accountId}/ce/governance/rules",
    searchAliases: ["rule pack", "governance rule set", "policy pack"],
    relatedResources: [{ resourceType: "cost_governance_rule", relationship: "child", description: "Rules inside the set (rulesIdentifier)" }],
    listFilterFields: [
      { name: "search_term", description: "Match rule set name" },
      CLOUD_PROVIDER_FILTER,
      { name: "is_ootb", description: "true = out-of-the-box sets only, false = custom only", type: "boolean" },
      { name: "rule_id", description: "Only sets containing these rule ids (comma-separated)" },
      ...PAGE_FILTERS,
    ],
    operations: {
      list: {
        method: "POST",
        path: `${GOV}/ruleSet/list`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        skipCompact: true,
        bodyBuilder: (input) => {
          const { limit, offset } = paging(input);
          return {
            ruleSet: dropUndefined({
              cloudProvider: toText(input.cloud_provider)?.toUpperCase(),
              search: toText(input.search_term ?? input.search),
              isOOTB: toBool(input.is_ootb),
              ruleIds: toList(input.rule_id),
              limit,
              offset,
            }),
          };
        },
        responseExtractor: ccmGovernanceRuleSetListExtract,
        description: "List rule sets with ruleCount. Use harness_get for the full rule id list.",
      },
      get: {
        method: "POST",
        path: `${GOV}/ruleSet/list`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        bodyBuilder: (input) => ({
          ruleSet: { ruleSetIds: [requireText(input.rule_set_id, "rule_set_id is required.")], limit: 1, offset: 0 },
        }),
        responseExtractor: ccmGovernanceRuleSetFirstExtract,
        description: "Get one rule set including its rule ids (`rulesIdentifier`). There is no get-by-id endpoint; this filters the list.",
      },
      create: {
        method: "POST",
        path: `${GOV}/ruleSet`,
        operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
        bodyWrapperKey: "ruleSet",
        bodyBuilder: (input) => ({ ruleSet: omitKeys(wrappedEntity(input, "ruleSet"), [...RULE_SET_OMIT, "uuid"]) }),
        bodySchema: {
          description: "Rule set definition. All rules must be for the same cloud provider.",
          fields: [
            { name: "name", type: "string", required: true, description: "Rule set name" },
            { name: "cloudProvider", type: "string", required: true, description: "AWS | AZURE | GCP" },
            { name: "rulesIdentifier", type: "array", required: true, description: "Rule ids in the set", itemType: "string" },
            { name: "description", type: "string", required: false, description: "Description" },
            { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
          ],
        },
        responseExtractor: ccmGovernanceWriteExtract,
        description: "Create a custom rule set.",
      },
      update: {
        method: "PUT",
        path: `${GOV}/ruleSet`,
        operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
        bodyWrapperKey: "ruleSet",
        bodyBuilder: (input) => {
          const entity = omitKeys(wrappedEntity(input, "ruleSet"), RULE_SET_OMIT);
          if (!toText(entity.uuid)) entity.uuid = toText(input.rule_set_id);
          return { ruleSet: entity };
        },
        bodySchema: {
          description: "Full rule set to replace the existing one: harness_get it, change fields, send it all back.",
          fields: [
            { name: "uuid", type: "string", required: true, description: "Rule set id (defaults to resource_id)" },
            { name: "name", type: "string", required: true, description: "Rule set name" },
            { name: "rulesIdentifier", type: "array", required: true, description: "Rule ids in the set", itemType: "string" },
            { name: "cloudProvider", type: "string", required: false, description: "AWS | AZURE | GCP" },
            { name: "description", type: "string", required: false, description: "Description" },
            { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
          ],
        },
        responseExtractor: ccmGovernanceWriteExtract,
        description: "Update a custom rule set (full replacement).",
      },
      delete: {
        method: "DELETE",
        path: `${GOV}/ruleSet/{ruleSetId}`,
        pathParams: { rule_set_id: "ruleSetId" },
        operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
        responseExtractor: ccmGovernanceWriteExtract,
        description: "Delete a custom rule set. Enforcements referencing it must be updated first.",
      },
    },
  },

  // ------------------------------------------------------------------
  // cost_governance_enforcement — scheduled rule execution (live automation when isDryRun=false)
  // ------------------------------------------------------------------
  {
    resourceType: "cost_governance_enforcement",
    displayName: "Cost Governance Enforcement",
    description:
      "A schedule that runs rules/rule sets automatically against cloud accounts and regions. isDryRun=true only reports; isDryRun=false APPLIES the rules' actions on a schedule. Create, update and enable need approval; disable is a lighter action. Also: savings (realised over a window).",
    toolset: "ccm",
    scope: "account",
    identifierFields: ["enforcement_id"],
    deepLinkTemplate: "/ng/account/{accountId}/ce/governance/enforcements",
    searchAliases: ["governance schedule", "rule enforcement", "governance enforcement", "scheduled governance"],
    diagnosticHint: "To see what an enforcement did, list cost_governance_evaluation with filters.enforcement_id.",
    relatedResources: [
      { resourceType: "cost_governance_rule", relationship: "child", description: "Rules the enforcement runs (ruleIds)" },
      { resourceType: "cost_governance_rule_set", relationship: "child", description: "Rule sets the enforcement runs (ruleSetIDs)" },
      { resourceType: "cost_governance_evaluation", relationship: "child", description: "Runs produced by the schedule" },
    ],
    reviewCard: {
      version: 1,
      label: "Enforcement",
      fields: [
        { label: "Name", path: "name" },
        { label: "Cloud", path: "cloudProvider", default: "—" },
        { label: "Schedule", path: "executionSchedule", default: "—" },
        { label: "Timezone", path: "executionTimezone", default: "UTC" },
        { label: "Accounts", path: "targetAccounts", default: "—" },
        { label: "Regions", path: "targetRegions", default: "—" },
        { label: "Dry run", path: "isDryRun", default: "true (default)" },
      ],
    },
    listFilterFields: [
      { name: "search_term", description: "Match enforcement name" },
      { name: "rule_ids", description: "Enforcements running these rule ids (comma-separated)" },
      { name: "target_accounts", description: "Enforcements targeting these accounts (comma-separated)" },
      { name: "is_enabled", description: "Only enabled / disabled", type: "boolean" },
      { name: "is_dry_run", description: "true = dry-run enforcements only, false = LIVE ones only", type: "boolean" },
      { name: "sort_by", description: "Sort field", enum: ["NAME", "LAST_UPDATED_AT"] },
      { name: "sort_order", description: "Sort direction", enum: ["ASCENDING", "DESCENDING"] },
      ...PAGE_FILTERS,
    ],
    operations: {
      list: {
        method: "POST",
        path: `${GOV}/enforcement/list`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        skipCompact: true,
        bodyBuilder: (input) => {
          const { limit, offset } = paging(input);
          return dropUndefined({
            searchKey: toText(input.search_term ?? input.search),
            ruleIds: toList(input.rule_ids),
            targetAccounts: toList(input.target_accounts),
            isEnabled: toBool(input.is_enabled),
            isDryRun: toBool(input.is_dry_run),
            sortType: toText(input.sort_by)?.toUpperCase(),
            sortOrder: toText(input.sort_order)?.toUpperCase(),
            pageNumber: pageNumberFor(limit, offset),
            pageSize: limit,
          });
        },
        responseExtractor: ccmGovernanceEnforcementListExtract,
        description: "List enforcements with schedule, targets, isDryRun and isEnabled — complete enough to feed an update.",
      },
      get: {
        method: "GET",
        path: `${GOV}/enforcement/details`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        queryParams: { enforcement_id: "enforcementId" },
        responseExtractor: ngExtract,
        description: "Enforcement details with rule / rule set / account names resolved. Use list for the raw definition to edit.",
      },
      create: {
        method: "POST",
        path: `${GOV}/enforcement`,
        operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
        bodyWrapperKey: "ruleEnforcement",
        bodyBuilder: (input) => {
          const entity = omitKeys(wrappedEntity(input, "ruleEnforcement"), [...ENFORCEMENT_OMIT, "uuid"]);
          // Safe default: an enforcement that was not explicitly made live only reports.
          return { ruleEnforcement: { ...entity, isDryRun: entity.isDryRun === false ? false : true } };
        },
        bodySchema: {
          description: "Enforcement definition. isDryRun defaults to TRUE; set false only to make the schedule act on resources.",
          fields: ENFORCEMENT_FIELDS,
        },
        confirmNote: enforcementNote,
        responseExtractor: ccmGovernanceWriteExtract,
        description: "Create a scheduled enforcement. Defaults to dry-run; isDryRun=false makes it LIVE.",
      },
      update: {
        method: "PUT",
        path: `${GOV}/enforcement`,
        operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
        bodyWrapperKey: "ruleEnforcement",
        bodyBuilder: (input) => {
          const entity = omitKeys(wrappedEntity(input, "ruleEnforcement"), ENFORCEMENT_OMIT);
          if (!toText(entity.uuid)) entity.uuid = toText(input.enforcement_id);
          if (typeof entity.isDryRun !== "boolean") {
            throw new Error("isDryRun is required on update (true = report only, false = LIVE). List the enforcement, change fields, send the whole definition back.");
          }
          return { ruleEnforcement: entity };
        },
        bodySchema: {
          description: "Full enforcement to replace the existing one: take it from list, change fields, send it all back (uuid = enforcement id).",
          fields: withRequired(ENFORCEMENT_FIELDS, [{ name: "uuid", type: "string", required: true, description: "Enforcement id (defaults to resource_id)" }]),
        },
        confirmNote: enforcementNote,
        responseExtractor: ccmGovernanceWriteExtract,
        description: "Update an enforcement (full replacement). isDryRun must be stated explicitly.",
      },
      delete: {
        method: "DELETE",
        path: `${GOV}/enforcement/{enforcementId}`,
        pathParams: { enforcement_id: "enforcementId" },
        operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
        responseExtractor: ccmGovernanceWriteExtract,
        description: "Delete an enforcement and its schedule.",
      },
    },
    executeActions: {
      enable: {
        method: "PUT",
        path: `${GOV}/enforcement/toggle`,
        operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
        queryParams: { enforcement_id: "enforcementId" },
        staticQueryParams: { enableEnforcement: "true" },
        bodyBuilder: () => ({}),
        bodySchema: NO_BODY_SCHEMA,
        confirmNote: "Turns the schedule ON. If the enforcement is not a dry run, its rules will start APPLYING actions to resources on schedule.",
        responseExtractor: ccmGovernanceWriteExtract,
        actionDescription: "Enable an enforcement's schedule (resource_id = enforcement id). Check isDryRun first with list.",
      },
      disable: {
        method: "PUT",
        path: `${GOV}/enforcement/toggle`,
        operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
        queryParams: { enforcement_id: "enforcementId" },
        staticQueryParams: { enableEnforcement: "false" },
        bodyBuilder: () => ({}),
        bodySchema: NO_BODY_SCHEMA,
        responseExtractor: ccmGovernanceWriteExtract,
        actionDescription: "Disable an enforcement's schedule (resource_id = enforcement id). Stops future runs; does not undo past actions.",
      },
      savings: {
        method: "POST",
        path: `${GOV}/enforcement/savings`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        queryParams: { enforcement_id: "enforcementId" },
        bodyBuilder: (input) => timeFilters(input),
        bodySchema: {
          description: "No body needed: the window comes from params (time_filter or start_time + end_time). Sent to the API as a list of time filters.",
          fields: [],
        },
        paramsSchema: {
          fields: [
            { name: "time_filter", required: false, description: "LAST_7_DAYS | LAST_30_DAYS (default) | LAST_90_DAYS" },
            { name: "start_time", required: false, description: "Custom window start; pair with end_time" },
            { name: "end_time", required: false, description: "Custom window end; pair with start_time" },
          ],
        },
        responseExtractor: ccmGovernanceWriteExtract,
        actionDescription: "Savings an enforcement realised in a window (resource_id = enforcement id).",
      },
    },
  },

  // ------------------------------------------------------------------
  // cost_governance_enforcement_recommendation — AI-suggested enforcements
  // ------------------------------------------------------------------
  {
    resourceType: "cost_governance_enforcement_recommendation",
    displayName: "Cost Governance Enforcement Recommendation",
    description:
      "Enforcements suggested for you by CCM. Review with list/get, then accept (creates the enforcement), dismiss, or update. Accepting creates scheduled automation, so it needs approval.",
    toolset: "ccm",
    scope: "account",
    identifierFields: ["enforcement_recommendation_id"],
    deepLinkTemplate: "/ng/account/{accountId}/ce/governance/enforcements",
    searchAliases: ["suggested enforcement", "governance suggestion"],
    relatedResources: [{ resourceType: "cost_governance_enforcement", relationship: "child", description: "Created when a recommendation is accepted" }],
    listFilterFields: [
      { name: "search_term", description: "Match recommendation name" },
      { name: "rule_ids", description: "Recommendations using these rule ids (comma-separated)" },
      { name: "target_accounts", description: "Recommendations for these accounts (comma-separated)" },
      ...PAGE_FILTERS,
    ],
    operations: {
      list: {
        method: "POST",
        path: `${GOV}/enforcementRecommendation/list`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        skipCompact: true,
        bodyBuilder: (input) => {
          const { limit, offset } = paging(input);
          return dropUndefined({
            searchKey: toText(input.search_term ?? input.search),
            ruleIds: toList(input.rule_ids),
            targetAccounts: toList(input.target_accounts),
            pageNumber: pageNumberFor(limit, offset),
            pageSize: limit,
          });
        },
        responseExtractor: ccmGovernanceEnforcementRecommendationListExtract,
        description: "List suggested enforcements with their proposed schedule, targets and status.",
      },
      get: {
        method: "GET",
        path: `${GOV}/enforcementRecommendation/details`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        queryParams: { enforcement_recommendation_id: "enforcementRecommendationId" },
        responseExtractor: ngExtract,
        description: "Details of one suggested enforcement with rule and account names resolved.",
      },
      update: {
        method: "PUT",
        path: `${GOV}/enforcementRecommendation/update`,
        operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
        bodyBuilder: (input) => {
          const entity = omitKeys(bodyOf(input), ["accountId", "createdAt", "createdBy", "lastUpdatedAt", "lastUpdatedBy"]);
          if (!toText(entity.uuid)) entity.uuid = toText(input.enforcement_recommendation_id);
          return entity;
        },
        bodySchema: {
          description: "Full recommendation object (uuid = recommendation id). Adjust schedule, targets or isDryRun before accepting.",
          fields: [
            { name: "uuid", type: "string", required: true, description: "Recommendation id (defaults to resource_id)" },
            { name: "name", type: "string", required: true, description: "Name" },
            { name: "executionSchedule", type: "string", required: false, description: "Cron expression" },
            { name: "executionTimezone", type: "string", required: false, description: "IANA timezone" },
            { name: "targetAccounts", type: "array", required: false, description: "Cloud accounts", itemType: "string" },
            { name: "targetRegions", type: "array", required: false, description: "Regions", itemType: "string" },
            { name: "isDryRun", type: "boolean", required: false, description: "true = report only" },
            { name: "ruleIds", type: "array", required: false, description: "Rule ids", itemType: "string" },
            { name: "ruleSetIDs", type: "array", required: false, description: "Rule set ids", itemType: "string" },
          ],
        },
        responseExtractor: ccmGovernanceWriteExtract,
        description: "Edit a suggested enforcement before accepting it.",
      },
    },
    executeActions: {
      accept: {
        method: "PUT",
        path: `${GOV}/enforcementRecommendation/accept`,
        operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
        inputNormalizer: hoistIds("enforcement_recommendation_id", "enforcement_recommendation_ids"),
        queryParams: { enforcement_recommendation_ids: "enforcementRecommendationIds" },
        bodyBuilder: () => ({}),
        bodySchema: NO_BODY_SCHEMA,
        confirmNote: "Creates real scheduled enforcement(s) from the recommendation. If it is not a dry run, they will APPLY actions to resources on schedule.",
        responseExtractor: ccmGovernanceWriteExtract,
        actionDescription: "Accept suggested enforcement(s) (resource_id, or params.enforcement_recommendation_ids comma-separated). Returns the created enforcement ids.",
      },
      dismiss: {
        method: "PUT",
        path: `${GOV}/enforcementRecommendation/dismiss`,
        operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
        inputNormalizer: hoistIds("enforcement_recommendation_id", "enforcement_recommendation_ids"),
        queryParams: { enforcement_recommendation_ids: "enforcementRecommendationIds" },
        bodyBuilder: () => ({}),
        bodySchema: NO_BODY_SCHEMA,
        responseExtractor: ccmGovernanceWriteExtract,
        actionDescription: "Dismiss suggested enforcement(s) (resource_id, or params.enforcement_recommendation_ids comma-separated).",
      },
    },
  },

  // ------------------------------------------------------------------
  // cost_governance_recommendation — rule recommendation health (read-only)
  // ------------------------------------------------------------------
  {
    resourceType: "cost_governance_recommendation",
    displayName: "Cost Governance Recommendation Health",
    description:
      "Read-only health of governance rules that generate cost recommendations: potential savings, recommendation count and run success per rule. For the recommendations themselves use cost_recommendation (filter governanceRuleNames).",
    toolset: "ccm",
    scope: "account",
    identifierFields: ["rule_id"],
    deepLinkTemplate: "/ng/account/{accountId}/ce/governance/rules-generating-recommendations",
    searchAliases: ["recommendation health", "governance recommendation"],
    relatedResources: [{ resourceType: "cost_governance_rule", relationship: "parent", description: "The rule being summarised" }],
    listFilterFields: [
      { name: "search_term", description: "Match rule name" },
      CLOUD_PROVIDER_FILTER,
      { name: "health_status", description: "Latest run status", enum: ["SUCCESS", "PARTIAL_SUCCESS", "FAILED", "IN_PROGRESS", "IGNORED"] },
      { name: "is_ootb", description: "true = out-of-the-box rules only", type: "boolean" },
      ...PAGE_FILTERS,
    ],
    operations: {
      list: {
        method: "POST",
        path: `${GOV}/recommendationHealth/list`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        skipCompact: true,
        bodyBuilder: (input) => {
          const { limit, offset } = paging(input);
          return dropUndefined({
            cloudProvider: toText(input.cloud_provider)?.toUpperCase(),
            healthStatus: toText(input.health_status)?.toUpperCase(),
            isOOTB: toBool(input.is_ootb),
            search: toText(input.search_term ?? input.search),
            limit,
            offset,
          });
        },
        responseExtractor: ccmGovernanceRecommendationListExtract,
        description: "Per-rule recommendation health: potentialSavings (currency), totalRecommendations, status, lastEvaluatedAt.",
      },
      get: {
        method: "GET",
        path: `${GOV}/recommendationHealth`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        queryParams: { rule_id: "ruleId" },
        responseExtractor: ccmGovernanceRecommendationGetExtract,
        description: "Recommendation health of one rule (resource_id = rule id).",
      },
    },
  },

  // ------------------------------------------------------------------
  // cost_governance_evaluation — results of dry runs, live runs and scheduled runs
  // ------------------------------------------------------------------
  {
    resourceType: "cost_governance_evaluation",
    displayName: "Cost Governance Evaluation",
    description:
      "One rule evaluated on one cloud account (a dry run, live run or scheduled run): status, matched resource count, cost and savings. List by rule/enforcement/status; get one; actions fetch matched resources, logs, actioned resources and the YAML used.",
    toolset: "ccm",
    scope: "account",
    identifierFields: ["evaluation_id"],
    deepLinkTemplate: "/ng/account/{accountId}/ce/governance/evaluations/{evaluationId}",
    searchAliases: ["governance execution", "rule execution", "policy run", "custodian run", "dry run result"],
    diagnosticHint:
      "executionStatus ENQUEUED means the worker has not finished — poll again. FAILED: read errorMessage, then the logs action. " +
      "SUCCESS with resourceCount 0 means the rule matched nothing. cost/savings are currency amounts; they are filled in after the run (refresh_cost recomputes).",
    relatedResources: [
      { resourceType: "cost_governance_rule", relationship: "parent", description: "The rule that was evaluated" },
      { resourceType: "cost_governance_enforcement", relationship: "parent", description: "The schedule that triggered scheduled evaluations" },
    ],
    listFilterFields: [
      { name: "rule_id", description: "Only these rule ids (comma-separated)" },
      { name: "enforcement_id", description: "Only runs of these enforcements (comma-separated)" },
      { name: "execution_ids", description: "Only these evaluation ids (comma-separated)" },
      { name: "execution_status", description: "Run status", enum: ["ENQUEUED", "SUCCESS", "PARTIAL_SUCCESS", "FAILED"] },
      CLOUD_PROVIDER_FILTER,
      { name: "target_account", description: "Cloud account / subscription / project ids (comma-separated)" },
      { name: "region", description: "Regions (comma-separated)" },
      { name: "is_dry_run", description: "true = dry runs only, false = LIVE runs only", type: "boolean" },
      { name: "cost_type", description: "POTENTIAL (dry run) or REALIZED (live) cost", enum: ["POTENTIAL", "REALIZED"] },
      { name: "has_resources", description: "true = only evaluations that matched at least one resource", type: "boolean" },
      { name: "sort_by", description: "Sort field (default LAST_UPDATED_AT)", enum: ["COST", "LAST_UPDATED_AT", "RESOURCE_COUNT"] },
      { name: "sort_order", description: "Sort direction (default DESCENDING)", enum: ["ASCENDING", "DESCENDING"] },
      { name: "time_filter", description: "Window (default LAST_30_DAYS)", enum: Object.keys(TIME_FILTER_DAYS) },
      { name: "start_time", description: "Custom window start (YYYY-MM-DD, ISO 8601 or epoch ms); pair with end_time" },
      { name: "end_time", description: "Custom window end; pair with start_time" },
      ...PAGE_FILTERS,
    ],
    operations: {
      list: {
        method: "POST",
        path: `${GOV}/execution/list`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        skipCompact: true,
        bodyBuilder: (input) => {
          const { limit, offset } = paging(input);
          const provider = toText(input.cloud_provider)?.toUpperCase();
          return {
            policyExecutionFilter: dropUndefined({
              ruleIds: toList(input.rule_id ?? input.rule_ids),
              ruleEnforcementId: toList(input.enforcement_id),
              executionIds: toList(input.execution_ids),
              executionStatus: toText(input.execution_status)?.toUpperCase(),
              cloudProviders: provider ? [provider] : undefined,
              targetAccount: toList(input.target_account),
              region: toList(input.region),
              isDryRun: toBool(input.is_dry_run),
              costType: toText(input.cost_type)?.toUpperCase(),
              resourceCountGreaterThanZero: toBool(input.has_resources),
              ruleExecutionSortType: toText(input.sort_by)?.toUpperCase() ?? "LAST_UPDATED_AT",
              sortOrder: toText(input.sort_order)?.toUpperCase() ?? "DESCENDING",
              time: timeFilters(input),
              limit,
              offset,
            }),
          };
        },
        responseExtractor: ccmGovernanceEvaluationListExtract,
        description: "List evaluations (newest first, last 30 days unless time_filter/start_time+end_time is given). Per-resource breakdowns are omitted — harness_get one for detail.",
      },
      get: {
        method: "GET",
        path: `${GOV}/execution/{evaluationId}`,
        pathParams: { evaluation_id: "evaluationId" },
        queryParams: { execution_type: "executionType" },
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        paramsSchema: {
          fields: [
            EXECUTION_TYPE_PARAM,
            { name: "offset", required: false, description: "First per-resource / sub-rule row to return (default 0); continue from nextOffset" },
            { name: "limit", required: false, description: "Rows per array per call (default 25, max 50)" },
          ],
        },
        responseExtractor: ccmGovernanceEvaluationGetExtract,
        description: "One evaluation: status, counts, cost/savings (currency), error. Per-resource and sub-rule arrays are paged: see *Total and nextOffset, then pass offset/limit.",
      },
    },
    executeActions: {
      resources: {
        method: "GET",
        path: `${GOV}/status/{evaluationId}`,
        pathParams: { evaluation_id: "evaluationId" },
        queryParams: { execution_type: "executionType" },
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        paramsSchema: { fields: [EXECUTION_TYPE_PARAM, ...POLICY_OUTPUT_PARAMS] },
        responseExtractor: ccmGovernanceExecutionDetailsExtract,
        actionDescription: "Resources the rule matched, per policy (resource_id = evaluation id). Output is windowed: truncated=true means more exists, so continue with offset=nextOffset and/or response_offset=responseNextOffset.",
      },
      logs: {
        method: "GET",
        path: `${GOV}/logs/{evaluationId}`,
        pathParams: { evaluation_id: "evaluationId" },
        queryParams: { execution_type: "executionType" },
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        paramsSchema: { fields: [EXECUTION_TYPE_PARAM, ...POLICY_OUTPUT_PARAMS] },
        responseExtractor: ccmGovernanceExecutionDetailsExtract,
        actionDescription: "Cloud Custodian logs per policy for an evaluation; use for FAILED runs. Windowed (offset/limit/response_offset) — see truncated, nextOffset, responseNextOffset.",
      },
      actioned_resources: {
        method: "GET",
        path: `${GOV}/actionedResources/{evaluationId}`,
        pathParams: { evaluation_id: "evaluationId" },
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        paramsSchema: { fields: [...POLICY_OUTPUT_PARAMS] },
        responseExtractor: ccmGovernanceExecutionDetailsExtract,
        actionDescription: "Resources a LIVE run actually acted on (empty for dry runs). Windowed (offset/limit/response_offset): check truncated and continue from nextOffset / responseNextOffset so no acted-on resource is missed.",
      },
      rule_yaml: {
        method: "GET",
        path: `${GOV}/ruleYaml/{evaluationId}`,
        pathParams: { evaluation_id: "evaluationId" },
        queryParams: { execution_type: "executionType" },
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        paramsSchema: { fields: [EXECUTION_TYPE_PARAM, ...POLICY_OUTPUT_PARAMS] },
        responseExtractor: ccmGovernanceExecutionDetailsExtract,
        actionDescription: "The rule YAML as it was when this evaluation ran (the rule may have changed since).",
      },
      refresh_cost: {
        method: "GET",
        path: `${GOV}/execution/refreshCost/{evaluationId}`,
        pathParams: { evaluation_id: "evaluationId" },
        queryParams: { execution_type: "executionType" },
        operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
        responseExtractor: ccmGovernanceWriteExtract,
        actionDescription: "Recompute cost and savings for an evaluation (e.g. when costComputed is false).",
      },
    },
  },

  // ------------------------------------------------------------------
  // cost_governance_alert — email alerts for matched resources
  // ------------------------------------------------------------------
  {
    resourceType: "cost_governance_alert",
    displayName: "Cost Governance Alert",
    description:
      "Email alert that notifies recipients about resources governance has found for chosen resource types and cloud accounts. List/get/create/update/delete; actions: enable, disable, clone.",
    toolset: "ccm",
    scope: "account",
    identifierFields: ["alert_id"],
    searchAliases: ["governance notification", "governance alert rule"],
    relatedResources: [{ resourceType: "cost_governance_rule", relationship: "parent", description: "resource_types action lists valid resource types" }],
    operations: {
      list: {
        method: "GET",
        path: `${GOV}/alert/list`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        skipCompact: true,
        responseExtractor: ccmGovernanceAlertListExtract,
        description: "List all governance alerts (not paged).",
      },
      get: {
        method: "GET",
        path: `${GOV}/alert/list`,
        operationPolicy: { risk: "read", retryPolicy: "safe" },
        responseExtractor: ccmGovernanceAlertGetExtract,
        description: "Get one alert. There is no get-by-id endpoint; this filters the list.",
      },
      create: {
        method: "POST",
        path: `${GOV}/alert`,
        operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
        bodyBuilder: (input) => omitKeys(bodyOf(input), [...ALERT_OMIT, "uuid"]),
        bodySchema: { description: "Alert definition.", fields: ALERT_FIELDS },
        responseExtractor: ccmGovernanceWriteExtract,
        description: "Create a governance alert.",
      },
      update: {
        method: "PUT",
        path: `${GOV}/alert`,
        queryParams: { alert_id: "id" },
        operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
        bodyBuilder: (input) => omitKeys(bodyOf(input), ALERT_OMIT),
        bodySchema: { description: "Full alert to replace the existing one (resource_id = alert id): harness_get it, change fields, send it all back.", fields: ALERT_FIELDS },
        responseExtractor: ccmGovernanceWriteExtract,
        description: "Update a governance alert (full replacement).",
      },
      delete: {
        method: "DELETE",
        path: `${GOV}/alert/{alertId}`,
        pathParams: { alert_id: "alertId" },
        operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
        responseExtractor: ccmGovernanceWriteExtract,
        description: "Delete a governance alert.",
      },
    },
    executeActions: {
      enable: {
        method: "PUT",
        path: `${GOV}/alert/toggle`,
        operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
        queryParams: { alert_id: "id" },
        staticQueryParams: { enableGovernanceAlertRule: "true" },
        bodyBuilder: () => ({}),
        bodySchema: NO_BODY_SCHEMA,
        responseExtractor: ccmGovernanceWriteExtract,
        actionDescription: "Enable an alert (resource_id = alert id).",
      },
      disable: {
        method: "PUT",
        path: `${GOV}/alert/toggle`,
        operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
        queryParams: { alert_id: "id" },
        staticQueryParams: { enableGovernanceAlertRule: "false" },
        bodyBuilder: () => ({}),
        bodySchema: NO_BODY_SCHEMA,
        responseExtractor: ccmGovernanceWriteExtract,
        actionDescription: "Disable an alert (resource_id = alert id).",
      },
      clone: {
        method: "POST",
        path: `${GOV}/alert/clone`,
        operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
        queryParams: { alert_id: "id" },
        bodyBuilder: () => ({}),
        bodySchema: NO_BODY_SCHEMA,
        responseExtractor: ccmGovernanceWriteExtract,
        actionDescription: "Clone an alert (resource_id = alert id).",
      },
    },
  },

  // ------------------------------------------------------------------
  // cost_governance_overview — dashboard metrics (read-only)
  // ------------------------------------------------------------------
  {
    resourceType: "cost_governance_overview",
    displayName: "Cost Governance Overview",
    description:
      "Read-only governance dashboard metrics. get (resource_id = metric): total_evaluations, total_active_enforcements, total_new_enforcement_recommendations, total_realised_savings. list (filters.metric): savings_grouped (all-time), savings_time_series, top_cloud_accounts, daily_evaluations. total_realised_savings and the windowed series accept time_filter or start_time+end_time; the counts and savings_grouped are all-time/current and reject a window. Needs the governance overview view permission.",
    toolset: "ccm",
    scope: "account",
    identifierFields: ["metric"],
    searchAliases: ["governance dashboard", "realised savings", "governance savings"],
    listFilterFields: [
      { name: "metric", description: "Breakdown to return", enum: Object.keys(OVERVIEW_SERIES_METRICS), required: true },
      { name: "cloud_provider", description: "AWS, AZURE, GCP (comma-separated for several); default all" },
      { name: "time_filter", description: "LAST_7_DAYS | LAST_30_DAYS (default) | LAST_90_DAYS. Not valid for savings_grouped, which is all-time", enum: Object.keys(TIME_FILTER_DAYS) },
      { name: "start_time", description: "Custom window start; pair with end_time. Not valid for savings_grouped" },
      { name: "end_time", description: "Custom window end; pair with start_time. Not valid for savings_grouped" },
    ],
    operations: {
      get: {
        ...overviewSpec(OVERVIEW_VALUE_METRICS),
        responseExtractor: ccmGovernanceOverviewValueExtract,
        description:
          `One headline number. resource_id is the metric: ${Object.keys(OVERVIEW_VALUE_METRICS).join(", ")}. Savings are currency amounts over the window.`,
      },
      list: {
        ...overviewSpec(OVERVIEW_SERIES_METRICS),
        skipCompact: true,
        responseExtractor: ccmGovernanceOverviewSeriesExtract,
        description: `A breakdown. filters.metric is one of: ${Object.keys(OVERVIEW_SERIES_METRICS).join(", ")}.`,
      },
    },
  },
];
