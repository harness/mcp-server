/**
 * Response extractors for CCM asset governance (Cloud Custodian) — `/ccm/api/governance/*`.
 *
 * All endpoints wrap their payload as `{ status, data }` (NG `ResponseDTO`). List endpoints put
 * the page under a named key (`rules`, `ruleSet`, `ruleEnforcements`, …) next to `totalItems`.
 *
 * Projection rules:
 *  - List rows keep what an agent needs to pick an entity or build an update, and drop the heavy
 *    parts (rule YAML, per-resource breakdowns, sub-rule details).
 *  - Output of policy runs (`status` / `logs` / `actioned_resources`) can be very large, so it is
 *    capped per entry and in entry count, and the result says so (`truncated: true`).
 *  - Write endpoints return a bare boolean/string/list; the write tools need an object, so
 *    those are wrapped.
 */
import { HarnessApiError } from "../../utils/errors.js";
import { asRecord, isRecord } from "../../utils/type-guards.js";

type Row = Record<string, unknown>;

/** Max rows of policy output returned from one status/logs/actioned_resources call. */
const MAX_POLICY_ENTRIES = 25;
/** Max characters of one policy `response` string (resource JSON or log text). */
const MAX_POLICY_RESPONSE_CHARS = 6_000;
/** Max sub-rule / per-resource rows kept on an evaluation detail. */
const MAX_EVALUATION_SUBROWS = 25;
const MAX_DESCRIPTION_CHARS = 300;
const MAX_ERROR_CHARS = 500;

function dataOf(raw: unknown): unknown {
  if (raw === null || raw === undefined) return raw;
  return isRecord(raw) && "data" in raw ? raw.data : raw;
}

function compactRow(entries: Record<string, unknown>): Row {
  return Object.fromEntries(Object.entries(entries).filter(([, v]) => v !== undefined && v !== null));
}

function truncateText(value: unknown, max: number): unknown {
  return typeof value === "string" && value.length > max ? `${value.slice(0, max)}…` : value;
}

/** `{ <listKey>: [...], totalItems }` (or a bare array) → `{ items, total }`. */
function pagedList(raw: unknown, listKey: string): { items: unknown[]; total: number } {
  const data = dataOf(raw);
  const record = asRecord(data);
  const fromKey = record?.[listKey];
  const items = Array.isArray(fromKey) ? fromKey : Array.isArray(data) ? data : [];
  const total = typeof record?.totalItems === "number" ? record.totalItems : items.length;
  return { items, total };
}

function mapItems(
  list: { items: unknown[]; total: number },
  project: (item: Row) => Row,
): { items: unknown[]; total: number } {
  return {
    items: list.items.map((item) => (isRecord(item) ? project(item) : item)),
    total: list.total,
  };
}

// ── Projections ──────────────────────────────────────────────────────────────

function projectRule(item: Row): Row {
  return compactRow({
    id: item.uuid ?? item.id,
    name: item.name,
    description: truncateText(item.description, MAX_DESCRIPTION_CHARS),
    cloudProvider: item.cloudProvider,
    resourceType: item.resourceType,
    isOOTB: item.isOOTB,
    forRecommendation: item.forRecommendation,
    forInventory: item.forInventory,
    isMultiPolicyRule: item.isMultiPolicyRule,
    // Percent (0-100) of the resource cost the rule is expected to save — not a currency amount.
    savingsPercent: item.savings,
    tags: item.tags,
    createdAt: item.createdAt,
    lastUpdatedAt: item.lastUpdatedAt,
  });
}

function projectRuleSet(item: Row): Row {
  const ruleIds = Array.isArray(item.rulesIdentifier) ? item.rulesIdentifier : undefined;
  return compactRow({
    id: item.uuid ?? item.id,
    name: item.name,
    description: truncateText(item.description, MAX_DESCRIPTION_CHARS),
    cloudProvider: item.cloudProvider,
    isOOTB: item.isOOTB,
    ruleCount: ruleIds?.length,
    tags: item.tags,
    createdAt: item.createdAt,
    lastUpdatedAt: item.lastUpdatedAt,
  });
}

/** Keeps every field an update needs (`ruleIds`, targets, schedule…) — only audit noise is dropped. */
function projectEnforcement(item: Row): Row {
  return compactRow({
    id: item.uuid ?? item.id,
    name: item.name,
    description: truncateText(item.description, MAX_DESCRIPTION_CHARS),
    cloudProvider: item.cloudProvider,
    ruleIds: item.ruleIds,
    ruleSetIDs: item.ruleSetIDs,
    executionSchedule: item.executionSchedule,
    executionTimezone: item.executionTimezone,
    targetAccounts: item.targetAccounts,
    targetRegions: item.targetRegions,
    isDryRun: item.isDryRun,
    isEnabled: item.isEnabled,
    runCount: item.runCount,
    tags: item.tags,
    ruleEnforcementRecommendationStatus: item.ruleEnforcementRecommendationStatus,
    pricingCostType: item.pricingCostType,
    createdAt: item.createdAt,
    lastUpdatedAt: item.lastUpdatedAt,
  });
}

function projectEvaluation(item: Row): Row {
  return compactRow({
    id: item.uuid ?? item.id,
    ruleId: item.ruleIdentifier,
    ruleName: item.ruleName,
    ruleEnforcementId: item.ruleEnforcementIdentifier,
    ruleEnforcementName: item.ruleEnforcementName,
    cloudProvider: item.cloudProvider,
    isDryRun: item.isDryRun,
    targetAccount: item.targetAccount,
    targetAccountName: item.targetAccountName,
    targetRegions: item.targetRegions,
    executionStatus: item.executionStatus,
    executionType: item.executionType,
    resourceType: item.resourceType,
    actionType: item.actionType,
    resourceCount: item.resourceCount,
    actionedResourceCount: item.actionedResourceCount,
    // Currency amounts (unlike a rule's savingsPercent).
    cost: item.cost,
    savings: item.savings,
    costType: item.costType,
    errorMessage: truncateText(item.errorMessage, MAX_ERROR_CHARS),
    isMultiPolicyRule: item.isMultiPolicyRule,
    executionCompletedAt: item.executionCompletedAt,
    createdAt: item.createdAt,
    lastUpdatedAt: item.lastUpdatedAt,
  });
}

function projectRecommendationSummary(item: Row): Row {
  const id = asRecord(item.id);
  return compactRow({
    ruleId: id?.ruleId ?? item.ruleId ?? (typeof item.id === "string" ? item.id : undefined),
    ruleName: item.ruleName,
    cloudProvider: item.cloudProvider,
    isOOTB: item.isOOTB,
    status: item.status,
    potentialSavings: item.potentialSavings,
    totalRecommendations: item.totalRecommendations,
    totalExecutions: item.totalExecutions,
    totalFailedExecutions: item.totalFailedExecutions,
    lastEvaluatedAt: item.lastEvaluatedAt,
    enableGranularRecommendation: item.enableGranularRecommendation,
    pricingCostType: item.pricingCostType,
    targets: item.targets,
  });
}

function projectAlert(item: Row): Row {
  return compactRow({
    id: item.uuid ?? item.id,
    name: item.name,
    cloudProvider: item.cloudProvider,
    resourceTypes: item.resourceTypes,
    cloudAccountIds: item.cloudAccountIds,
    resourceCount: item.resourceCount,
    cost: item.cost,
    emailIds: item.emailIds,
    isAttachmentRequired: item.isAttachmentRequired,
    isEnabled: item.isEnabled,
    createdAt: item.createdAt,
    lastUpdatedAt: item.lastUpdatedAt,
  });
}

// ── Lists ────────────────────────────────────────────────────────────────────

/** `POST rule/list` → `{ rules, totalItems }`. Drops `rulesYaml` and sub-rule details. */
export const ccmGovernanceRuleListExtract = (raw: unknown): { items: unknown[]; total: number } =>
  mapItems(pagedList(raw, "rules"), projectRule);

/** `GET rule/potentialRulesForRecommendation` → bare `Rule[]`. */
export const ccmGovernancePotentialRulesExtract = (raw: unknown): { items: unknown[]; total: number } =>
  mapItems(pagedList(raw, "rules"), projectRule);

/** `POST ruleSet/list` → `{ ruleSet, totalItems }`. Drops the full `rulesIdentifier` list. */
export const ccmGovernanceRuleSetListExtract = (raw: unknown): { items: unknown[]; total: number } =>
  mapItems(pagedList(raw, "ruleSet"), projectRuleSet);

/** `POST enforcement/list` → `{ ruleEnforcements, totalItems }`. */
export const ccmGovernanceEnforcementListExtract = (raw: unknown): { items: unknown[]; total: number } =>
  mapItems(pagedList(raw, "ruleEnforcements"), projectEnforcement);

/** `POST enforcementRecommendation/list` → `{ ruleEnforcementRecommendations, totalItems }`. */
export const ccmGovernanceEnforcementRecommendationListExtract = (
  raw: unknown,
): { items: unknown[]; total: number } =>
  mapItems(pagedList(raw, "ruleEnforcementRecommendations"), projectEnforcement);

/** `POST execution/list` → `{ ruleExecution, totalItems }`. Drops per-resource breakdowns and sub-rule details. */
export const ccmGovernanceEvaluationListExtract = (raw: unknown): { items: unknown[]; total: number } =>
  mapItems(pagedList(raw, "ruleExecution"), projectEvaluation);

/** `POST execution/ruleLastExecution` → bare `RuleExecution[]`. */
export const ccmGovernanceLastEvaluationExtract = (raw: unknown): { items: unknown[]; total: number } =>
  mapItems(pagedList(raw, "ruleExecution"), projectEvaluation);

/** `POST recommendationHealth/list` → `{ ruleRecommendationSummaries, totalItems }`. Drops per-run `executions`. */
export const ccmGovernanceRecommendationListExtract = (raw: unknown): { items: unknown[]; total: number } =>
  mapItems(pagedList(raw, "ruleRecommendationSummaries"), projectRecommendationSummary);

/** `GET alert/list` → bare `GovernanceNotification[]` (not paged). */
export const ccmGovernanceAlertListExtract = (raw: unknown): { items: unknown[]; total: number } =>
  mapItems(pagedList(raw, "alerts"), projectAlert);

// ── Single entities ──────────────────────────────────────────────────────────

/** `GET recommendationHealth?ruleId` → one summary. */
export const ccmGovernanceRecommendationGetExtract = (raw: unknown): unknown => {
  const data = dataOf(raw);
  return isRecord(data) ? projectRecommendationSummary(data) : data;
};

/** First rule set from a `ruleSet/list` filtered by id; 404 when none matched. */
export const ccmGovernanceRuleSetFirstExtract = (raw: unknown): unknown => {
  const { items } = pagedList(raw, "ruleSet");
  if (items.length === 0) {
    throw new HarnessApiError("Rule set not found (check rule_set_id and that you can view it)", 404);
  }
  return items[0];
};

/** The alert with `input.alert_id` from `alert/list`; 404 when absent (there is no get-by-id endpoint). */
export const ccmGovernanceAlertGetExtract = (raw: unknown, input?: Row): unknown => {
  const { items } = pagedList(raw, "alerts");
  const wanted = input?.alert_id ?? input?.resource_id;
  const match = items.find((item) => isRecord(item) && (item.uuid === wanted || item.id === wanted));
  if (!match) {
    throw new HarnessApiError(`Governance alert "${String(wanted)}" not found`, 404);
  }
  return match;
};

/**
 * `GET execution/{id}` → one evaluation. Keeps the summary fields in full and caps the
 * per-resource / per-sub-rule arrays, which can run to thousands of rows.
 */
export const ccmGovernanceEvaluationGetExtract = (raw: unknown): unknown => {
  const data = dataOf(raw);
  if (!isRecord(data)) return data;
  const out: Row = { ...projectEvaluation(data) };
  for (const [key, totalKey] of [
    ["subRuleExecutionDetails", "subRuleExecutionTotal"],
    ["resourceBreakdownList", "resourceBreakdownTotal"],
  ] as const) {
    const list = data[key];
    if (Array.isArray(list) && list.length > 0) {
      out[key] = list.slice(0, MAX_EVALUATION_SUBROWS);
      out[totalKey] = list.length;
      if (list.length > MAX_EVALUATION_SUBROWS) out[`${key}Truncated`] = true;
    }
  }
  if (data.executionLogPath !== undefined) out.executionLogPath = data.executionLogPath;
  return out;
};

/**
 * `GET status|logs|actionedResources|ruleYaml/{id}` → `List<PolicyResponseDetails>`.
 * Each entry's `response` is the raw policy output; cap it and the entry count so one call
 * cannot flood the context.
 */
export const ccmGovernanceExecutionDetailsExtract = (
  raw: unknown,
): { items: unknown[]; total: number; truncated: boolean } => {
  const data = dataOf(raw);
  const all = Array.isArray(data) ? data : [];
  let truncated = all.length > MAX_POLICY_ENTRIES;
  const items = all.slice(0, MAX_POLICY_ENTRIES).map((entry) => {
    if (!isRecord(entry)) return entry;
    const response = entry.response;
    if (typeof response === "string" && response.length > MAX_POLICY_RESPONSE_CHARS) {
      truncated = true;
      return {
        ...entry,
        response: `${response.slice(0, MAX_POLICY_RESPONSE_CHARS)}…`,
        responseTruncated: true,
        responseChars: response.length,
      };
    }
    return entry;
  });
  return { items, total: all.length, truncated };
};

// ── Actions and writes ───────────────────────────────────────────────────────

/** `POST enqueueAdhocV2` (202) → `{ ruleExecutionId: [...] }`. */
export const ccmGovernanceEnqueueExtract = (raw: unknown): unknown => {
  const data = asRecord(dataOf(raw));
  const ids = Array.isArray(data?.ruleExecutionId) ? (data.ruleExecutionId as unknown[]) : [];
  return {
    status: "ENQUEUED",
    evaluationIds: ids,
    count: ids.length,
    next:
      ids.length === 0
        ? "No evaluations were queued."
        : "Poll each id with harness_get(resource_type='cost_governance_evaluation', resource_id=<id>) until executionStatus is SUCCESS, PARTIAL_SUCCESS or FAILED.",
  };
};

/** `POST ruleValidate` returns no body on success; any problem comes back as an API error. */
export const ccmGovernanceValidateExtract = (): unknown => ({ valid: true });

/** `GET governanceTargetList` → `Map<accountId, name>`. */
export const ccmGovernanceTargetListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const data = dataOf(raw);
  const entries = isRecord(data) ? Object.entries(data) : [];
  return { items: entries.map(([id, name]) => ({ id, name })), total: entries.length };
};

/** Bare `string[]` / `Set<string>` payloads (regions, resource types). */
export const ccmGovernanceStringListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const data = dataOf(raw);
  const items = Array.isArray(data) ? [...data].sort() : [];
  return { items, total: items.length };
};

/**
 * Wrap non-object write results so the write tools (which require an object output) accept them:
 * boolean → `{ success }`, string → `{ message }`, list → `{ items }`, empty → `{ success: true }`.
 * Objects (the saved entity) pass through.
 */
export const ccmGovernanceWriteExtract = (raw: unknown): unknown => {
  const data = dataOf(raw);
  if (data === null || data === undefined || data === "") return { success: true };
  if (typeof data === "boolean") return { success: data };
  if (typeof data === "string") return { message: data };
  if (typeof data === "number") return { result: data };
  if (Array.isArray(data)) return { items: data };
  return data;
};

// ── Overview ────────────────────────────────────────────────────────────────

/** Scalar overview metrics (`Long` / `Double`) → `{ metric, value }`. */
export const ccmGovernanceOverviewValueExtract = (raw: unknown, input?: Row): unknown => {
  const data = dataOf(raw);
  const metric = input?.metric ?? input?.resource_id;
  if (isRecord(data)) return { metric, ...data };
  return { metric, value: data ?? 0 };
};

/**
 * Breakdown overview metrics → `{ items, total }`:
 *  - map of number           → `[{ key, value }]`   (savings by cloud provider)
 *  - map of map of number    → `[{ key, ...inner }]` (evaluations per day)
 *  - `{ timeSeriesData: [] }` / `{ cloudAccounts: [] }` → the inner array
 */
export const ccmGovernanceOverviewSeriesExtract = (
  raw: unknown,
): { items: unknown[]; total: number; granularity?: unknown } => {
  const data = dataOf(raw);
  if (!isRecord(data)) return { items: [], total: 0 };
  for (const key of ["timeSeriesData", "cloudAccounts"]) {
    const inner = data[key];
    if (Array.isArray(inner)) {
      return {
        items: inner,
        total: inner.length,
        ...(data.granularity !== undefined ? { granularity: data.granularity } : {}),
      };
    }
  }
  const items = Object.entries(data).map(([key, value]) =>
    isRecord(value) ? { key, ...value } : { key, value },
  );
  return { items, total: items.length };
};
