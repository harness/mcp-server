import type { PathBuilderConfig, PreflightContext } from "../types.js";
import { isRecord } from "../../utils/type-guards.js";
import {
  ALLOWED_VULN_ENUM_KEYS,
  COMMON_ENTITY_ATTRIBUTES,
  DATATYPES_QUERY,
  MCP_AI_ASSET_TYPES,
  ONE_DAY_MS,
  ONE_HOUR_MS,
  ONE_WEEK_MS,
  TIME_FILTER_MS,
  VULNERABILITY_DEFAULT_SOURCES,
  VULNERABILITY_DEFAULT_STATUSES,
  buildAttributeSelectionBlock,
  buildEntitiesQuery,
} from "./queries.js";
import { setAppSecDispatchContext } from "./extractors.js";

function toIsoMillisUtc(ms: number): string {
  return new Date(ms).toISOString();
}

function parseTimestampMs(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
    throw new Error(`Invalid timestamp "${trimmed}". Expected ISO-8601 string or epoch milliseconds.`);
  }
  return undefined;
}

export function resolveAppSecTimeWindow(
  input: Record<string, unknown>,
  defaultDurationMs = ONE_DAY_MS,
): { startTime: string; endTime: string; startMs: number; endMs: number; durationMinutes: number } {
  const nowMs = Date.now();
  const explicitStart = parseTimestampMs(input.start_time);
  const explicitEnd = parseTimestampMs(input.end_time);
  const timeFilterKey = typeof input.time_filter === "string" ? input.time_filter.toUpperCase() : undefined;
  const durationMs =
    typeof input.duration_ms === "number" && input.duration_ms > 0
      ? input.duration_ms
      : timeFilterKey && TIME_FILTER_MS[timeFilterKey]
        ? TIME_FILTER_MS[timeFilterKey]!
        : defaultDurationMs;

  let startMs: number;
  let endMs: number;
  if (explicitStart !== undefined && explicitEnd !== undefined) {
    startMs = explicitStart;
    endMs = explicitEnd;
  } else if (explicitStart !== undefined) {
    startMs = explicitStart;
    endMs = nowMs;
  } else if (explicitEnd !== undefined) {
    endMs = explicitEnd;
    startMs = endMs - durationMs;
  } else {
    endMs = nowMs;
    startMs = nowMs - durationMs;
  }

  if (startMs > endMs) {
    throw new Error(`start_time (${toIsoMillisUtc(startMs)}) must not be after end_time (${toIsoMillisUtc(endMs)}).`);
  }

  const durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60_000));
  setAppSecDispatchContext(input, { durationMinutes });

  return {
    startTime: toIsoMillisUtc(startMs),
    endTime: toIsoMillisUtc(endMs),
    startMs,
    endMs,
    durationMinutes,
  };
}

function splitCsvOrArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function attachUiConfig(input: Record<string, unknown>, config: PathBuilderConfig): void {
  if (config.HARNESS_APPSEC_UI_URL && config.HARNESS_APPSEC_UI_URL !== "https://app.traceable.ai") {
    setAppSecDispatchContext(input, { uiUrl: config.HARNESS_APPSEC_UI_URL });
  } else if (config.HARNESS_APPSEC_BASE_URL) {
    const derived = config.HARNESS_APPSEC_BASE_URL
      .replace(/\/+$/, "")
      .replace(/\/graphql$/i, "")
      .replace("://api-", "://app-")
      .replace("://api.", "://app.");
    setAppSecDispatchContext(input, { uiUrl: derived });
  }
}

function resolveLimitAndOffset(
  input: Record<string, unknown>,
  defaultLimit = 10,
): { limit: number; offset: number } {
  const rawLimit = input.limit ?? input.size;
  const limit =
    typeof rawLimit === "number" && Number.isFinite(rawLimit) && Math.trunc(rawLimit) > 0
      ? Math.min(Math.trunc(rawLimit), 1000)
      : defaultLimit;
  const page = typeof input.page === "number" && Number.isFinite(input.page) && Math.trunc(input.page) >= 0
    ? Math.trunc(input.page)
    : 0;
  const offset =
    typeof input.offset === "number" && Number.isFinite(input.offset) && Math.trunc(input.offset) >= 0
      ? Math.trunc(input.offset)
      : page * limit;
  return { limit, offset };
}

function attrFilter(key: string, operator: string, value: unknown): Record<string, unknown> {
  return {
    keyExpression: { key },
    operator,
    value,
    type: "ATTRIBUTE",
  };
}

function formatGraphqlLiteral(val: unknown): string {
  if (Array.isArray(val)) {
    return `[${val.map(formatGraphqlLiteral).join(", ")}]`;
  }
  if (typeof val === "string") {
    return JSON.stringify(val);
  }
  if (typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  return JSON.stringify(val);
}

// ---------------------------------------------------------------------------
// 1. appsec_api builders
// ---------------------------------------------------------------------------

export function buildApiListBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  setAppSecDispatchContext(input, { entityScope: "API" });

  const { startTime, endTime } = resolveAppSecTimeWindow(input, 2 * ONE_DAY_MS);
  const { limit, offset } = resolveLimitAndOffset(input, 10);

  const filters: Array<Record<string, unknown>> = [];
  if (input.include_unlearnt !== true) {
    filters.push(attrFilter("isLearnt", "EQUALS", true));
  }

  const discoveryStates = splitCsvOrArray(input.discovery_state);
  filters.push(
    attrFilter(
      "apiDiscoveryState",
      "IN",
      discoveryStates.length > 0 ? discoveryStates : ["DISCOVERED", "UNDER_DISCOVERY"],
    ),
  );

  const nameRegex = (input.name_regex ?? input.search ?? input.name) as string | undefined;
  if (typeof nameRegex === "string" && nameRegex.trim() !== "") {
    filters.push(attrFilter("name", "LIKE", nameRegex.trim()));
  }

  if (typeof input.service_name === "string" && input.service_name.trim() !== "") {
    filters.push(attrFilter("serviceName", "IN", splitCsvOrArray(input.service_name)));
  }
  if (typeof input.service_id === "string" && input.service_id.trim() !== "") {
    filters.push(attrFilter("serviceId", "IN", splitCsvOrArray(input.service_id)));
  }
  if (typeof input.environment === "string" && input.environment.trim() !== "") {
    filters.push(attrFilter("environment", "IN", splitCsvOrArray(input.environment)));
  }
  if (typeof input.has_pii === "boolean") {
    filters.push(attrFilter("hasPii", "EQUALS", input.has_pii));
  }
  const datatypeIds = splitCsvOrArray(input.datatype_ids);
  if (datatypeIds.length > 0) {
    filters.push(attrFilter("dataTypeIds", "IN", datatypeIds));
  }
  const riskCategories = splitCsvOrArray(input.risk_score_category);
  if (riskCategories.length > 0) {
    filters.push(attrFilter("riskScoreCategory", "IN", riskCategories.map((c) => c.toUpperCase())));
  }
  if (typeof input.is_authenticated === "boolean") {
    filters.push(attrFilter("isAuthenticated", "EQUALS", input.is_authenticated));
  }
  if (typeof input.is_external === "boolean") {
    filters.push(attrFilter("isExternal", "EQUALS", input.is_external));
  }
  if (typeof input.is_ai_asset === "boolean") {
    filters.push(attrFilter("isAiAsset", "EQUALS", input.is_ai_asset));
  }
  const appGroupIds = splitCsvOrArray(input.application_group_ids);
  if (appGroupIds.length > 0) {
    filters.push(attrFilter("applicationGroupIds", "IN", appGroupIds));
  }
  const changeLabels = splitCsvOrArray(input.change_label);
  if (changeLabels.length > 0) {
    filters.push(attrFilter("changeLabel", "IN", changeLabels.map((c) => c.toUpperCase())));
  }

  setAppSecDispatchContext(input, { appliedFilters: filters });

  const extraAttrs = splitCsvOrArray(input.attributes);
  const selectedAttrs = [...COMMON_ENTITY_ATTRIBUTES.API!, ...extraAttrs];
  const query = buildEntitiesQuery(buildAttributeSelectionBlock(selectedAttrs, "apiMetrics"));

  const sortBy = typeof input.sort_by === "string" && input.sort_by.trim() !== ""
    ? input.sort_by.trim()
    : nameRegex
      ? "numCalls"
      : "riskScore";
  const orderBy =
    sortBy === "numCalls" || sortBy === "errorCount"
      ? [{ aggregation: "SUM", direction: "DESC", keyExpression: { key: sortBy } }]
      : [{ direction: "DESC", keyExpression: { key: sortBy } }];

  return {
    query,
    variables: {
      scope: "API",
      between: { startTime, endTime },
      filterBy: filters,
      orderBy,
      includeInactive: typeof input.include_inactive === "boolean" ? input.include_inactive : true,
      limit,
      offset,
    },
  };
}

export function buildApiGetBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  setAppSecDispatchContext(input, { entityScope: "API" });
  const apiId = String(input.api_id ?? input.resource_id ?? "").trim();
  if (!apiId) {
    throw new Error("Missing required field \"api_id\" for appsec_api.");
  }
  const { startTime, endTime } = resolveAppSecTimeWindow(input, 7 * ONE_DAY_MS);
  const attrs = [...COMMON_ENTITY_ATTRIBUTES.API!, "entireUrlPaths", "entireUrlPatterns"];
  return {
    query: buildEntitiesQuery(buildAttributeSelectionBlock(attrs, "apiMetrics")),
    variables: {
      scope: "API",
      between: { startTime, endTime },
      filterBy: [attrFilter("id", "EQUALS", apiId)],
      includeInactive: true,
      limit: 1,
      offset: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// 2. appsec_api_spec & appsec_api_span builders
// ---------------------------------------------------------------------------

export function buildApiSpecGetBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const apiId = String(input.api_id ?? input.resource_id ?? "").trim();
  if (!apiId) {
    throw new Error("Missing required field \"api_id\" for appsec_api_spec.");
  }
  return {
    query: `query GetApiSpec($id: String!) {
  apiInsightByApiId(id: $id) {
    apiDefinition(
      apiDefinition: {
        formats: [OPEN_API_YAML]
        pagination: { paginationType: NONE }
      }
    ) {
      definition
    }
  }
}`,
    variables: { id: apiId },
  };
}

export function buildApiSpansListBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const apiId = String(input.api_id ?? input.resource_id ?? "").trim();
  if (!apiId) {
    throw new Error("Missing required filter \"api_id\" for appsec_api_span.");
  }
  const lookbackHours = typeof input.lookback_hours === "number" && input.lookback_hours > 0
    ? input.lookback_hours
    : 6;
  const endMs = Date.now();
  const startMs = endMs - lookbackHours * ONE_HOUR_MS;
  const { limit } = resolveLimitAndOffset(input, 2);

  return {
    query: `mutation FetchSampleSpans($startTime: DateTime!, $endTime: DateTime!, $apiId: Unknown!, $limit: Int!) {
  submitAnalyticsQueryBatch(
    input: {
      batchScope: "EXPLORER_V3"
      executeAsync: false
      skipView: true
      queries: [
        {
          name: "query_list"
          scope: "SPAN"
          limit: $limit
          between: { startTime: $startTime, endTime: $endTime }
          offset: 0
          filterBy: [
            { keyExpression: { key: "apiId" }, operator: EQUALS, value: $apiId, type: ATTRIBUTE }
          ]
          selections: [
            { expression: { key: "statusCode" } }
            { expression: { key: "spanTags" } }
            { expression: { key: "traceId" } }
            { expression: { key: "apiId" } }
            { expression: { key: "apiName" } }
            { expression: { key: "spanResponseBody" } }
            { expression: { key: "spanResponseHeaders" } }
            { expression: { key: "spanResponseCookies" } }
            { expression: { key: "spanRequestBody" } }
            { expression: { key: "spanRequestHeaders" } }
            { expression: { key: "spanRequestCookies" } }
            { expression: { key: "dataClassificationMatches" } }
            { expression: { key: "id" } }
            { expression: { key: "serviceName" } }
            { expression: { key: "userIdentifier" } }
            { expression: { key: "sessionId" } }
            { expression: { key: "ipAddress" } }
          ]
        }
      ]
    }
  ) {
    batchId
    state
    query_list: queryResult(name: "query_list", scope: "SPAN") {
      results {
        id: selection(expression: { key: "id" }) { value }
        traceId: selection(expression: { key: "traceId" }) { value }
        apiId: selection(expression: { key: "apiId" }) { value }
        apiName: selection(expression: { key: "apiName" }) { value }
        serviceName: selection(expression: { key: "serviceName" }) { value }
        statusCode: selection(expression: { key: "statusCode" }) { value }
        ipAddress: selection(expression: { key: "ipAddress" }) { value }
        userIdentifier: selection(expression: { key: "userIdentifier" }) { value }
        sessionId: selection(expression: { key: "sessionId" }) { value }
        spanRequestHeaders: selection(expression: { key: "spanRequestHeaders" }) { value }
        spanRequestBody: selection(expression: { key: "spanRequestBody" }) { value }
        spanRequestCookies: selection(expression: { key: "spanRequestCookies" }) { value }
        spanResponseHeaders: selection(expression: { key: "spanResponseHeaders" }) { value }
        spanResponseBody: selection(expression: { key: "spanResponseBody" }) { value }
        spanResponseCookies: selection(expression: { key: "spanResponseCookies" }) { value }
        spanTags: selection(expression: { key: "spanTags" }) { value }
        dataClassificationMatches: selection(expression: { key: "dataClassificationMatches" }) { value }
      }
    }
  }
}`,
    variables: {
      startTime: toIsoMillisUtc(startMs),
      endTime: toIsoMillisUtc(endMs),
      apiId,
      limit: Math.min(limit, 10),
    },
  };
}

// ---------------------------------------------------------------------------
// 3. appsec_entity builders
// ---------------------------------------------------------------------------

export function buildEntityListBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const scope = String(input.scope ?? "SERVICE").trim().toUpperCase();
  setAppSecDispatchContext(input, { entityScope: scope });

  const { startTime, endTime } = resolveAppSecTimeWindow(input, ONE_DAY_MS);
  const { limit, offset } = resolveLimitAndOffset(input, 10);

  const filters: Array<Record<string, unknown>> = [];
  const assetTypes = splitCsvOrArray(input.asset_type).map((t) => t.toUpperCase());
  const isMcpAssetQuery = assetTypes.some((t) => MCP_AI_ASSET_TYPES.has(t));

  if (scope === "SERVICE" || scope === "DOMAIN") {
    filters.push(attrFilter("isLearnt", "EQUALS", true));
  } else if (scope === "BACKEND") {
    filters.push(attrFilter("isThirdParty", "EQUALS", false));
    filters.push(attrFilter("id", "NOT_EQUALS", null));
    if (input.has_sensitive_data === true) {
      filters.push(attrFilter("sensitivity", "GREATER_THAN", 0));
    }
  } else if (scope === "BACKEND_API") {
    filters.push(attrFilter("id", "NOT_EQUALS", null));
    filters.push(attrFilter("isBackendThirdParty", "EQUALS", true));
    filters.push(attrFilter("apiDiscoveryFrom", "NOT_EQUALS", "DEFAULT_ENDPOINT"));
    if (input.has_sensitive_data === true) {
      filters.push(attrFilter("sensitivity", "GREATER_THAN", 0));
    }
  } else if (scope === "APPLICATION_ASSET") {
    filters.push(attrFilter("isLearnt", "EQUALS", true));
    if (input.is_ai_asset === true || isMcpAssetQuery || splitCsvOrArray(input.genai_types).length > 0) {
      filters.push(attrFilter("isAiAsset", "EQUALS", true));
    }
    if (assetTypes.length > 0) {
      filters.push(attrFilter("assetType", "IN", assetTypes));
    }
    if (typeof input.parent_id === "string" && input.parent_id.trim() !== "") {
      filters.push(attrFilter("parentId", "EQUALS", input.parent_id.trim()));
    }
    const genAiTypes = splitCsvOrArray(input.genai_types);
    if (genAiTypes.length > 0) {
      filters.push(attrFilter("genAiTypes", "IN", genAiTypes));
    }
  } else if (scope === "ACTOR") {
    const actorStatuses = splitCsvOrArray(input.actor_status);
    if (actorStatuses.length > 0) {
      filters.push(attrFilter("status", "IN", actorStatuses.map((s) => s.toUpperCase())));
    }
    const scoreCategories = splitCsvOrArray(input.score_category);
    if (scoreCategories.length > 0) {
      filters.push(attrFilter("scoreCategory", "IN", scoreCategories.map((s) => s.toUpperCase())));
    }
  }

  const names = splitCsvOrArray(input.names ?? input.name ?? input.search);
  if (names.length === 1) {
    filters.push(attrFilter("name", "LIKE", names[0]));
  } else if (names.length > 1) {
    filters.push(attrFilter("name", "IN", names));
  }

  const ids = splitCsvOrArray(input.ids);
  if (ids.length > 0) {
    filters.push(attrFilter("id", "IN", ids));
  }

  if (typeof input.environment === "string" && input.environment.trim() !== "") {
    filters.push(attrFilter("environment", "IN", splitCsvOrArray(input.environment)));
  }

  setAppSecDispatchContext(input, { appliedFilters: filters });

  const defaultAttrs = COMMON_ENTITY_ATTRIBUTES[scope] ?? ["id", "name"];
  const extraAttrs = splitCsvOrArray(input.attributes);
  const metricMode = scope === "APPLICATION_ASSET" ? "numCallsOnly" : "none";
  const query = buildEntitiesQuery(buildAttributeSelectionBlock([...defaultAttrs, ...extraAttrs], metricMode));

  const includeInactive = scope === "ACTOR" ? false : true;
  const orderBy =
    scope === "ACTOR"
      ? [{ direction: "DESC", keyExpression: { key: "createdTime" } }]
      : scope === "APPLICATION_ASSET"
        ? [{ direction: "DESC", keyExpression: { key: "riskScore" } }]
        : undefined;

  return {
    query,
    variables: {
      scope,
      between: { startTime, endTime },
      filterBy: filters,
      ...(orderBy ? { orderBy } : {}),
      includeInactive,
      limit,
      offset,
    },
  };
}

export function buildEntityGetBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const entityId = String(input.entity_id ?? input.resource_id ?? "").trim();
  if (!entityId) {
    throw new Error("Missing required field \"entity_id\" for appsec_entity.");
  }
  const scope = String(input.scope ?? "SERVICE").trim().toUpperCase();
  setAppSecDispatchContext(input, { entityScope: scope });

  const { startTime, endTime } = resolveAppSecTimeWindow(input, 7 * ONE_DAY_MS);
  const defaultAttrs = COMMON_ENTITY_ATTRIBUTES[scope] ?? ["id", "name"];
  const extraAttrs = splitCsvOrArray(input.attributes);

  const idFilter = MCP_AI_ASSET_TYPES.has(scope)
    ? { operator: "EQUALS", value: entityId, type: "ID", idScope: scope }
    : attrFilter("id", "EQUALS", entityId);

  return {
    query: buildEntitiesQuery(buildAttributeSelectionBlock([...defaultAttrs, ...extraAttrs], "none")),
    variables: {
      scope,
      between: { startTime, endTime },
      filterBy: [idFilter],
      includeInactive: true,
      limit: 1,
      offset: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// 4. appsec_vulnerability builders
// ---------------------------------------------------------------------------

function normalizeVulnSeverity(val: string): string {
  const upper = val.trim().toUpperCase();
  return upper.startsWith("VULNERABILITY_SEVERITY_") ? upper : `VULNERABILITY_SEVERITY_${upper}`;
}

function normalizeVulnStatus(val: string): string {
  const upper = val.trim().toUpperCase();
  return upper.startsWith("VULNERABILITY_STATUS_") ? upper : `VULNERABILITY_STATUS_${upper}`;
}

function normalizeVulnSource(val: string): string {
  const upper = val.trim().toUpperCase();
  return upper.startsWith("VULNERABILITY_SOURCE_TYPE_") ? upper : `VULNERABILITY_SOURCE_TYPE_${upper}`;
}

function buildVulnerabilityRelationalFilters(input: Record<string, unknown>): Array<Record<string, unknown>> {
  const rawSources = splitCsvOrArray(input.sources);
  const sources = rawSources.length > 0 ? rawSources.map(normalizeVulnSource) : [...VULNERABILITY_DEFAULT_SOURCES];

  const rawStatuses = splitCsvOrArray(input.status);
  const statuses = rawStatuses.length > 0 ? rawStatuses.map(normalizeVulnStatus) : [...VULNERABILITY_DEFAULT_STATUSES];

  const relational: Array<Record<string, unknown>> = [
    { relationalFilter: { key: "SOURCES", operator: "IN", value: sources } },
    { relationalFilter: { key: "STATUS", operator: "IN", value: statuses } },
  ];

  const rawSeverities = splitCsvOrArray(input.severity);
  if (rawSeverities.length > 0) {
    relational.push({
      relationalFilter: { key: "SEVERITY", operator: "IN", value: rawSeverities.map(normalizeVulnSeverity) },
    });
  }
  if (typeof input.category === "string" && input.category.trim() !== "") {
    relational.push({
      relationalFilter: { key: "VULNERABILITY_CATEGORY", operator: "IN", value: splitCsvOrArray(input.category) },
    });
  }
  if (typeof input.sub_category === "string" && input.sub_category.trim() !== "") {
    relational.push({
      relationalFilter: {
        key: "VULNERABILITY_SUB_CATEGORY",
        operator: "IN",
        value: splitCsvOrArray(input.sub_category),
      },
    });
  }
  if (typeof input.entity_id === "string" && input.entity_id.trim() !== "") {
    relational.push({
      relationalFilter: { key: "ENTITY_ID", operator: "IN", value: splitCsvOrArray(input.entity_id) },
    });
  }
  if (typeof input.entity_name === "string" && input.entity_name.trim() !== "") {
    relational.push({
      relationalFilter: { key: "ENTITY_NAME", operator: "LIKE", value: input.entity_name.trim() },
    });
  }
  if (typeof input.affected_entity_type === "string" && input.affected_entity_type.trim() !== "") {
    relational.push({
      relationalFilter: {
        key: "AFFECTED_ENTITY_TYPE",
        operator: "IN",
        value: splitCsvOrArray(input.affected_entity_type),
      },
    });
  }
  if (typeof input.service_id === "string" && input.service_id.trim() !== "") {
    relational.push({
      relationalFilter: { key: "SERVICE_ID", operator: "IN", value: splitCsvOrArray(input.service_id) },
    });
  }
  const envVal = (input.environment_id ?? input.environment) as string | undefined;
  if (typeof envVal === "string" && envVal.trim() !== "") {
    relational.push({
      relationalFilter: { key: "ENVIRONMENT_ID", operator: "IN", value: splitCsvOrArray(envVal) },
    });
  }
  if (typeof input.owasp_api_top10 === "string" && input.owasp_api_top10.trim() !== "") {
    relational.push({
      relationalFilter: { key: "OWASP_API_TOP10", operator: "IN", value: splitCsvOrArray(input.owasp_api_top10) },
    });
  }
  if (typeof input.is_ai_asset === "boolean") {
    relational.push({
      relationalFilter: { key: "IS_AI_ASSET", operator: "EQUALS", value: input.is_ai_asset },
    });
  }
  if (input.has_jira === true) {
    relational.push({
      relationalFilter: { key: "JIRA_ISSUE_URL_FIELD", operator: "CONTAINS_KEY", value: "" },
    });
  }

  return relational;
}

function buildVulnerabilityFilterBlock(relationalFilters: Array<Record<string, unknown>>): string {
  const blocks = relationalFilters.map((f) => {
    const rf = f.relationalFilter as { key: string; operator: string; value: unknown };
    return `{ relationalFilter: { key: ${rf.key}, operator: ${rf.operator}, value: ${formatGraphqlLiteral(rf.value)} } }`;
  });
  return `{ logicalFilter: { operator: AND, filters: [${blocks.join(", ")}] } }`;
}

export function buildVulnerabilityListBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const { limit, offset } = resolveLimitAndOffset(input, 10);
  const relationalFilters = buildVulnerabilityRelationalFilters(input);
  const filterBlock = buildVulnerabilityFilterBlock(relationalFilters);

  const groupByKey = typeof input.group_by === "string" && /^[A-Z0-9_]+$/.test(input.group_by.trim().toUpperCase())
    ? input.group_by.trim().toUpperCase()
    : undefined;

  if (groupByKey) {
    const query = `{
  vulnerabilitiesV3(
    filter: ${filterBlock}
    orderBy: { key: ${groupByKey}, direction: DESC }
    groupBy: [{ key: ${groupByKey} }]
    isUiRequest: true
  ) {
    results {
      ${groupByKey}: selection(key: ${groupByKey}) { value type }
      VULNERABILITY_ID_COUNT: aggregation(key: VULNERABILITY_ID, aggregation: COUNT) { value type }
    }
    count
    total
  }
}`;
    return { query, variables: {} };
  }

  const query = `{
  vulnerabilitiesV3(
    filter: ${filterBlock}
    orderBy: { key: SEVERITY, direction: DESC }
    limit: ${limit}
    offset: ${offset}
  ) {
    results {
      VULNERABILITY_ID: selection(key: VULNERABILITY_ID) { value type }
      DISPLAY_NAME: selection(key: DISPLAY_NAME) { value type }
      SEVERITY: selection(key: SEVERITY) { value type }
      STATUS: selection(key: STATUS) { value type }
      VULNERABILITY_CATEGORY: selection(key: VULNERABILITY_CATEGORY) { value type }
      VULNERABILITY_SUB_CATEGORY: selection(key: VULNERABILITY_SUB_CATEGORY) { value type }
      ENTITY_ID: selection(key: ENTITY_ID) { value type }
      ENTITY_NAME: selection(key: ENTITY_NAME) { value type }
      AFFECTED_ENTITY_TYPE: selection(key: AFFECTED_ENTITY_TYPE) { value type }
      ENVIRONMENT_ID: selection(key: ENVIRONMENT_ID) { value type }
      SOURCES: selection(key: SOURCES) { value type }
      OWASP_API_TOP10: selection(key: OWASP_API_TOP10) { value type }
      LAST_SEEN_TIMESTAMP_MILLIS: selection(key: LAST_SEEN_TIMESTAMP_MILLIS) { value type }
    }
    count
    total
  }
}`;
  return { query, variables: {} };
}

export function buildVulnerabilityGetBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const vulnId = String(input.vulnerability_id ?? input.resource_id ?? "").trim();
  if (!vulnId) {
    throw new Error("Missing required field \"vulnerability_id\" for appsec_vulnerability.");
  }
  const filterBlock = buildVulnerabilityFilterBlock([
    { relationalFilter: { key: "VULNERABILITY_ID", operator: "EQUALS", value: vulnId } },
  ]);
  const query = `{
  vulnerabilitiesV3(
    filter: ${filterBlock}
    limit: 1
    offset: 0
  ) {
    results {
      VULNERABILITY_ID: selection(key: VULNERABILITY_ID) { value type }
      DISPLAY_NAME: selection(key: DISPLAY_NAME) { value type }
      SEVERITY: selection(key: SEVERITY) { value type }
      STATUS: selection(key: STATUS) { value type }
      VULNERABILITY_CATEGORY: selection(key: VULNERABILITY_CATEGORY) { value type }
      VULNERABILITY_SUB_CATEGORY: selection(key: VULNERABILITY_SUB_CATEGORY) { value type }
      ENTITY_ID: selection(key: ENTITY_ID) { value type }
      ENTITY_NAME: selection(key: ENTITY_NAME) { value type }
      AFFECTED_ENTITY_TYPE: selection(key: AFFECTED_ENTITY_TYPE) { value type }
      ENVIRONMENT_ID: selection(key: ENVIRONMENT_ID) { value type }
      SERVICE_ID: selection(key: SERVICE_ID) { value type }
      SOURCES: selection(key: SOURCES) { value type }
      OWASP: selection(key: OWASP) { value type }
      OWASP_API_TOP10: selection(key: OWASP_API_TOP10) { value type }
      API_DISCOVERY_STATE: selection(key: API_DISCOVERY_STATE) { value type }
      LAST_SEEN_TIMESTAMP_MILLIS: selection(key: LAST_SEEN_TIMESTAMP_MILLIS) { value type }
      CLOSED_TIMESTAMP_MILLIS: selection(key: CLOSED_TIMESTAMP_MILLIS) { value type }
    }
    count
    total
  }
}`;
  return { query, variables: {} };
}

export function buildVulnEnumValuesBody(input: Record<string, unknown>): Record<string, unknown> {
  const body = isRecord(input.body) ? input.body : {};
  const rawKeys = splitCsvOrArray(body.filter_enum_keys ?? input.filter_enum_keys);
  const keys = (rawKeys.length > 0 ? rawKeys : ["STATUS", "SEVERITY", "VULNERABILITY_CATEGORY"])
    .map((k) => k.toUpperCase())
    .filter((k) => ALLOWED_VULN_ENUM_KEYS.has(k));

  if (keys.length === 0) {
    throw new Error(
      `filter_enum_keys must contain at least one valid enum key (${[...ALLOWED_VULN_ENUM_KEYS].join(", ")}).`,
    );
  }
  setAppSecDispatchContext(input, { enumKeys: keys });

  const filterBlock = buildVulnerabilityFilterBlock([
    { relationalFilter: { key: "SOURCES", operator: "IN", value: [...VULNERABILITY_DEFAULT_SOURCES] } },
    { relationalFilter: { key: "STATUS", operator: "IN", value: [...VULNERABILITY_DEFAULT_STATUSES] } },
  ]);

  const subQueries = keys
    .map(
      (key) => `${key}: vulnerabilitiesV3(
    filter: ${filterBlock}
    orderBy: { key: ${key}, direction: DESC }
    groupBy: [{ key: ${key} }]
    isUiRequest: true
  ) {
    results {
      ${key}: selection(key: ${key}) { value }
      count: aggregation(key: VULNERABILITY_ID, aggregation: COUNT) { value }
    }
  }`,
    )
    .join("\n  ");

  const query = `query {
  ${subQueries}
}`;
  return { query, variables: {} };
}

// ---------------------------------------------------------------------------
// 5. appsec_threat_activity builders
// ---------------------------------------------------------------------------

export function buildThreatActivityListBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const { startMs, endMs } = resolveAppSecTimeWindow(input, ONE_DAY_MS);
  const { limit, offset } = resolveLimitAndOffset(input, 10);

  const filterBy: Array<{ key: string; operator: string; value: unknown }> = [
    { key: "START_TIME_MILLIS", operator: "LESS_THAN", value: endMs },
    { key: "START_TIME_MILLIS", operator: "GREATER_THAN", value: startMs - ONE_WEEK_MS },
    { key: "LAST_SEEN_MILLIS", operator: "LESS_THAN", value: endMs + ONE_WEEK_MS },
    { key: "LAST_SEEN_MILLIS", operator: "GREATER_THAN", value: startMs },
    { key: "ACTIVITY_STATUS", operator: "NOT_IN", value: ["Internal", "Tagged", "Excluded"] },
  ];

  const categories = splitCsvOrArray(input.event_category);
  if (categories.length > 0) {
    filterBy.push({ key: "EVENT_CATEGORY", operator: "IN", value: categories });
  }
  if (typeof input.behaviour === "string" && input.behaviour.trim() !== "") {
    filterBy.push({ key: "BEHAVIOUR", operator: "IN", value: splitCsvOrArray(input.behaviour) });
  }
  const severities = splitCsvOrArray(input.severity);
  if (severities.length > 0) {
    filterBy.push({ key: "SEVERITY_LEVEL", operator: "IN", value: severities.map((s) => s.toUpperCase()) });
  }
  const apiIds = splitCsvOrArray(input.api_ids);
  if (apiIds.length > 0) {
    filterBy.push({ key: "API_IDS", operator: "IN", value: apiIds });
  }
  const serviceIds = splitCsvOrArray(input.service_ids);
  if (serviceIds.length > 0) {
    filterBy.push({ key: "SERVICE_IDS", operator: "IN", value: serviceIds });
  }
  const actorIds = splitCsvOrArray(input.actor_ids);
  if (actorIds.length > 0) {
    filterBy.push({ key: "ACTOR_ENTITY_IDS", operator: "IN", value: actorIds });
  }
  const domainIds = splitCsvOrArray(input.domain_ids);
  if (domainIds.length > 0) {
    filterBy.push({ key: "DOMAIN_IDS", operator: "IN", value: domainIds });
  }

  setAppSecDispatchContext(input, { appliedFilters: filterBy });

  const filterBlock = filterBy
    .map((f) => `{ key: ${f.key}, operator: ${f.operator}, value: ${formatGraphqlLiteral(f.value)} }`)
    .join(",\n      ");

  const groupByKey = typeof input.group_by === "string" && /^[A-Z0-9_]+$/.test(input.group_by.trim().toUpperCase())
    ? input.group_by.trim().toUpperCase()
    : undefined;

  if (groupByKey) {
    const query = `{
  threatActivity(
    filterBy: [
      ${filterBlock}
    ]
    groupBy: [{ key: ${groupByKey} }]
    limit: ${limit}
    offset: ${offset}
  ) {
    results {
      ${groupByKey}: selection(key: ${groupByKey}) { value type }
      THREAT_COUNT: aggregation(key: ID, aggregation: DISTINCT_COUNT) { value type }
    }
    count
    total
  }
}`;
    return { query, variables: {} };
  }

  const query = `{
  threatActivity(
    filterBy: [
      ${filterBlock}
    ]
    orderBy: [{ direction: DESC, key: LAST_SEEN_MILLIS }]
    unnest: [
      { key: ACTOR_ENTITY_IDS }
      { key: API_IDS }
      { key: API_NAMES }
      { key: SERVICE_NAMES }
      { key: ANOMALOUS_ATTRIBUTES }
    ]
    limit: ${limit}
    offset: ${offset}
  ) {
    results {
      ID: selection(key: ID) { value type }
      BEHAVIOUR: selection(key: BEHAVIOUR) { value type }
      EVENT_CATEGORY: selection(key: EVENT_CATEGORY) { value type }
      SEVERITY_LEVEL: selection(key: SEVERITY_LEVEL) { value type }
      ACTIVITY_STATUS: selection(key: ACTIVITY_STATUS) { value type }
      ACTOR_ENTITY_IDS: selection(key: ACTOR_ENTITY_IDS) { value type }
      API_IDS: selection(key: API_IDS) { value type }
      API_NAMES: selection(key: API_NAMES) { value type }
      SERVICE_NAMES: selection(key: SERVICE_NAMES) { value type }
      ANOMALOUS_ATTRIBUTES: selection(key: ANOMALOUS_ATTRIBUTES) { value type }
      START_TIME_MILLIS: selection(key: START_TIME_MILLIS) { value type }
      LAST_SEEN_MILLIS: selection(key: LAST_SEEN_MILLIS) { value type }
      EVENTS_COUNT: selection(key: EVENTS_COUNT) { value type }
    }
    count
    total
  }
}`;
  return { query, variables: {} };
}

export function buildThreatActivityGetBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const threatId = String(input.threat_activity_id ?? input.resource_id ?? "").trim();
  if (!threatId) {
    throw new Error("Missing required field \"threat_activity_id\" for appsec_threat_activity.");
  }
  const { startMs, endMs } = resolveAppSecTimeWindow(input, 30 * ONE_DAY_MS);
  const query = `{
  threatActivity(
    filterBy: [
      { key: ID, operator: EQUALS, value: ${formatGraphqlLiteral(threatId)} },
      { key: START_TIME_MILLIS, operator: LESS_THAN, value: ${endMs} },
      { key: START_TIME_MILLIS, operator: GREATER_THAN, value: ${startMs - ONE_WEEK_MS} },
      { key: LAST_SEEN_MILLIS, operator: LESS_THAN, value: ${endMs + ONE_WEEK_MS} },
      { key: LAST_SEEN_MILLIS, operator: GREATER_THAN, value: ${startMs} }
    ]
    unnest: [
      { key: ACTOR_ENTITY_IDS }
      { key: API_IDS }
      { key: API_NAMES }
      { key: SERVICE_IDS }
      { key: SERVICE_NAMES }
      { key: DOMAIN_NAMES }
      { key: ANOMALOUS_ATTRIBUTES }
    ]
    limit: 1
    offset: 0
  ) {
    results {
      ID: selection(key: ID) { value type }
      BEHAVIOUR: selection(key: BEHAVIOUR) { value type }
      EVENT_CATEGORY: selection(key: EVENT_CATEGORY) { value type }
      SEVERITY_LEVEL: selection(key: SEVERITY_LEVEL) { value type }
      ACTIVITY_STATUS: selection(key: ACTIVITY_STATUS) { value type }
      ACTOR_ENTITY_IDS: selection(key: ACTOR_ENTITY_IDS) { value type }
      API_IDS: selection(key: API_IDS) { value type }
      API_NAMES: selection(key: API_NAMES) { value type }
      SERVICE_IDS: selection(key: SERVICE_IDS) { value type }
      SERVICE_NAMES: selection(key: SERVICE_NAMES) { value type }
      DOMAIN_NAMES: selection(key: DOMAIN_NAMES) { value type }
      ANOMALOUS_ATTRIBUTES: selection(key: ANOMALOUS_ATTRIBUTES) { value type }
      START_TIME_MILLIS: selection(key: START_TIME_MILLIS) { value type }
      LAST_SEEN_MILLIS: selection(key: LAST_SEEN_MILLIS) { value type }
      EVENTS_COUNT: selection(key: EVENTS_COUNT) { value type }
    }
    count
    total
  }
}`;
  return { query, variables: {} };
}

// ---------------------------------------------------------------------------
// 6. appsec_security_event builders
// ---------------------------------------------------------------------------

export function buildExploreListBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const mode = typeof input.mode === "string" ? input.mode.toLowerCase() : "events";
  const scope = typeof input.scope === "string" && input.scope.trim() !== ""
    ? input.scope.trim().toUpperCase()
    : mode === "ai_assets"
      ? "APPLICATION_ASSET"
      : mode === "ai_traffic"
        ? "SPAN"
        : "DOMAIN_EVENT";
  setAppSecDispatchContext(input, { exploreScope: scope });

  const { startTime, endTime } = resolveAppSecTimeWindow(input, ONE_DAY_MS);
  const { limit, offset } = resolveLimitAndOffset(input, 10);

  const filters: Array<Record<string, unknown>> = [];
  if (scope === "DOMAIN_EVENT") {
    filters.push(attrFilter("eventStatus", "NOT_IN", ["TAGGED", "INTERNAL", "EXCLUDED"]));
  }
  if (scope === "APPLICATION_ASSET" || mode === "ai_assets") {
    filters.push(attrFilter("isLearnt", "EQUALS", true));
    filters.push(attrFilter("isAiAsset", "EQUALS", true));
  }
  if (scope === "SPAN" && (mode === "ai_traffic" || input.is_gen_ai === true)) {
    filters.push(attrFilter("isGenAi", "EQUALS", true));
  }
  if (typeof input.environment === "string" && input.environment.trim() !== "") {
    filters.push(attrFilter("environment", "IN", splitCsvOrArray(input.environment)));
  }
  if (typeof input.service_name === "string" && input.service_name.trim() !== "") {
    filters.push(attrFilter("serviceName", "IN", splitCsvOrArray(input.service_name)));
  }
  if (typeof input.api_id === "string" && input.api_id.trim() !== "") {
    filters.push(attrFilter("apiId", "IN", splitCsvOrArray(input.api_id)));
  }
  if (typeof input.actor_id === "string" && input.actor_id.trim() !== "") {
    filters.push(attrFilter("actorId", "IN", splitCsvOrArray(input.actor_id)));
  }
  if (typeof input.ip_address === "string" && input.ip_address.trim() !== "") {
    filters.push(attrFilter("ipAddress", "IN", splitCsvOrArray(input.ip_address)));
  }

  setAppSecDispatchContext(input, { appliedFilters: filters });

  const explicitGroupBy = splitCsvOrArray(input.group_by).filter((f) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(f));
  const defaultGroupBy =
    scope === "APPLICATION_ASSET"
      ? ["assetType"]
      : scope === "SPAN"
        ? ["spanKind"]
        : ["apiId", "apiName", "threatCategory", "eventStatus"];
  const groupByFields = explicitGroupBy.length > 0 ? explicitGroupBy : defaultGroupBy;

  const selections = [
    ...groupByFields.map((f) => `${f}: selection(expression: { key: "${f}" }) { value type }`),
    `count_id: selection(expression: { key: "id" }, aggregation: COUNT) { value type }`,
  ].join("\n      ");

  const expressionsLiteral = groupByFields.map((key) => `{ key: ${JSON.stringify(key)} }`).join(", ");

  const query = `query ExploreGrouped(
  $scope: String,
  $between: InputTimeRange!,
  $filterBy: [InputFilter],
  $limit: Int,
  $offset: Int
) {
  explore(
    scope: $scope,
    between: $between,
    filterBy: $filterBy,
    groupBy: { expressions: [${expressionsLiteral}], groupLimit: ${limit} },
    limit: $limit,
    offset: $offset
  ) {
    results {
      ${selections}
    }
    count
    total
  }
}`;
  return {
    query,
    variables: {
      scope,
      between: { startTime, endTime },
      filterBy: filters,
      limit,
      offset,
    },
  };
}

// ---------------------------------------------------------------------------
// 7. appsec_ast_scan builders
// ---------------------------------------------------------------------------

export function buildAstScanListBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const dataSource = String(input.data_source ?? "SCANS").trim().toUpperCase() === "API_COVERAGE"
    ? "API_COVERAGE"
    : "SCANS";
  const { limit, offset } = resolveLimitAndOffset(input, 10);
  const suiteId = typeof input.suite_id === "string" ? input.suite_id.trim() : undefined;
  const suiteName = typeof input.suite_name === "string" ? input.suite_name.trim() : undefined;
  const scanId = typeof input.scan_id === "string" ? input.scan_id.trim() : undefined;
  const scanRunNumber = typeof input.scan_run_number === "number" ? input.scan_run_number : undefined;

  if (dataSource === "API_COVERAGE") {
    if (!suiteId && !suiteName) {
      throw new Error("data_source=\"API_COVERAGE\" requires suite_id or suite_name filter.");
    }
    const filterBy: Array<{ key: string; operator: string; value: unknown }> = [];
    if (suiteId) filterBy.push({ key: "SCAN_SUITE_ID", operator: "EQUALS", value: suiteId });
    if (suiteName) filterBy.push({ key: "SCAN_SUITE_NAME", operator: "EQUALS", value: suiteName });
    if (scanRunNumber !== undefined) {
      filterBy.push({ key: "SCAN_RUN_NUMBER", operator: "EQUALS", value: scanRunNumber });
    }
    setAppSecDispatchContext(input, { appliedFilters: filterBy });

    const filterBlock = filterBy
      .map((f) => `{ key: ${f.key}, operator: ${f.operator}, value: ${formatGraphqlLiteral(f.value)} }`)
      .join(", ");

    const query = `{
  searchAst(
    astDataSource: API_COVERAGE
    limit: ${limit}
    offset: ${offset}
    filterBy: [${filterBlock}]
    orderBy: { key: EXECUTED_TESTS_COUNT, direction: DESC }
  ) {
    count
    total
    results {
      API_ID: selection(key: API_ID) { value type }
      API_NAME: selection(key: API_NAME) { value type }
      API_REACHABILITY: selection(key: API_REACHABILITY) { value type }
      GENERATED_TESTS_COUNT: selection(key: GENERATED_TESTS_COUNT) { value type }
      EXECUTED_TESTS_COUNT: selection(key: EXECUTED_TESTS_COUNT) { value type }
      VULNERABILITY_DISCOVERED_COUNT: selection(key: VULNERABILITY_DISCOVERED_COUNT) { value type }
      SKIPPED_API_REASON: selection(key: SKIPPED_API_REASON) { value type }
    }
  }
}`;
    return { query, variables: {} };
  }

  if (suiteId || suiteName || scanId) {
    const filterBy: Array<{ key: string; operator: string; value: unknown }> = [
      { key: "IS_METADATA", operator: "EQUALS", value: false },
    ];
    if (suiteId) filterBy.push({ key: "SCAN_SUITE_ID", operator: "EQUALS", value: suiteId });
    if (suiteName) filterBy.push({ key: "SCAN_SUITE_NAME", operator: "EQUALS", value: suiteName });
    if (scanId) filterBy.push({ key: "SCAN_ID", operator: "EQUALS", value: scanId });
    if (scanRunNumber !== undefined) {
      filterBy.push({ key: "SCAN_RUN_NUMBER", operator: "EQUALS", value: scanRunNumber });
    }
    setAppSecDispatchContext(input, { appliedFilters: filterBy });

    const filterBlock = filterBy
      .map((f) => `{ key: ${f.key}, operator: ${f.operator}, value: ${formatGraphqlLiteral(f.value)} }`)
      .join(", ");

    const query = `{
  searchAst(
    astDataSource: SCANS
    limit: ${limit}
    offset: ${offset}
    filterBy: [${filterBlock}]
    orderBy: { key: SCAN_START_TIME, direction: DESC }
  ) {
    count
    total
    results {
      SCAN_STATUS: selection(key: SCAN_STATUS) { value type }
      SCAN_SUITE_ID: selection(key: SCAN_SUITE_ID) { value type }
      SCAN_SUITE_NAME: selection(key: SCAN_SUITE_NAME) { value type }
      SCAN_ID: selection(key: SCAN_ID) { value type }
      SCAN_RUN_NUMBER: selection(key: SCAN_RUN_NUMBER) { value type }
      SCAN_START_TIME: selection(key: SCAN_START_TIME) { value type }
      SCAN_END_TIME: selection(key: SCAN_END_TIME) { value type }
      GENERATED_TESTS_COUNT: selection(key: GENERATED_TESTS_COUNT) { value type }
      EXECUTED_TESTS_COUNT: selection(key: EXECUTED_TESTS_COUNT) { value type }
      SCANNED_APIS_COUNT: selection(key: SCANNED_APIS_COUNT) { value type }
      VULNERABILITY_DISCOVERED_COUNT: selection(key: VULNERABILITY_DISCOVERED_COUNT) { value type }
    }
  }
}`;
    return { query, variables: {} };
  }

  const query = `{
  searchAst(
    astDataSource: SCANS
    limit: ${limit}
    offset: ${offset}
    filterBy: [
      { key: SCAN_RUN_NUMBER, operator: GREATER_THAN_OR_EQUAL_TO, value: 0 }
    ]
    orderBy: { key: SCAN_START_TIME, direction: DESC }
    join: {
      subQuery: {
        selections: [SCAN_SUITE_ID]
        aggregations: [{ key: SCAN_RUN_NUMBER, aggregation: MAX }]
        groupBy: [{ key: SCAN_SUITE_ID }]
      }
      joinConditions: [
        { mainQueryKey: SCAN_SUITE_ID, operator: EQUALS, subQueryKey: SCAN_SUITE_ID }
        { mainQueryKey: SCAN_RUN_NUMBER, operator: EQUALS, subQueryKey: SCAN_RUN_NUMBER }
      ]
    }
  ) {
    count
    total
    results {
      SCAN_STATUS: selection(key: SCAN_STATUS) { value type }
      SCAN_SUITE_ID: selection(key: SCAN_SUITE_ID) { value type }
      SCAN_SUITE_NAME: selection(key: SCAN_SUITE_NAME) { value type }
      ATTACK_POLICY: selection(key: ATTACK_POLICY) { value type }
      ENVIRONMENT: selection(key: ENVIRONMENT) { value type }
      SCANNED_APIS_COUNT: selection(key: SCANNED_APIS_COUNT) { value type }
      VULNERABILITY_DISCOVERED_COUNT: selection(key: VULNERABILITY_DISCOVERED_COUNT) { value type }
      SCAN_START_TIME: selection(key: SCAN_START_TIME) { value type }
      SCAN_RUN_NUMBER: selection(key: SCAN_RUN_NUMBER) { value type }
    }
  }
}`;
  return { query, variables: {} };
}

export function buildAstScanGetBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const hookId = typeof input.hook_id === "string" && input.hook_id.trim() !== "" ? input.hook_id.trim() : undefined;
  if (hookId) {
    return {
      query: `{
  getAstHookTests(
    astHookTestFilters: [{ testIdFilter: { ids: [${formatGraphqlLiteral(hookId)}] } }]
  ) {
    advancedMode {
      hookScript
    }
  }
}`,
      variables: {},
    };
  }
  const suiteId = String(input.suite_id ?? input.resource_id ?? "").trim();
  if (!suiteId) {
    throw new Error("Missing required field \"suite_id\" (or \"hook_id\" in params) for appsec_ast_scan.");
  }
  return buildAstScanListBody({ ...input, suite_id: suiteId, limit: 5 }, config);
}

// ---------------------------------------------------------------------------
// 8. appsec_inventory_trend preflight + builder
// ---------------------------------------------------------------------------

export async function fetchTrendCurrentCountPreflight(ctx: PreflightContext): Promise<void> {
  const trendType = String(ctx.input.trend_type ?? "apis").trim().toLowerCase();
  const isVuln = trendType === "vulnerabilities" || trendType === "issues";

  if (isVuln) {
    const res = await ctx.registry.dispatch(
      ctx.client,
      "appsec_vulnerability",
      "list",
      {
        limit: 1,
        ...(ctx.input.severity ? { severity: ctx.input.severity } : {}),
      },
      ctx.signal,
    );
    const currentCount = isRecord(res) && typeof res.total === "number" ? res.total : 0;
    setAppSecDispatchContext(ctx.input, { currentCount });
  } else {
    const res = await ctx.registry.dispatch(
      ctx.client,
      "appsec_api",
      "list",
      {
        limit: 1,
        ...(ctx.input.application_group_ids ? { application_group_ids: ctx.input.application_group_ids } : {}),
      },
      ctx.signal,
    );
    const currentCount = isRecord(res) && typeof res.total === "number" ? res.total : 0;
    setAppSecDispatchContext(ctx.input, { currentCount });
  }
}

export function buildInventoryTrendBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const trendType = String(input.trend_type ?? "apis").trim().toLowerCase();
  const periodDays = typeof input.period_days === "number" && input.period_days > 0 ? Math.min(input.period_days, 90) : 7;
  setAppSecDispatchContext(input, { periodDays });

  const endMs = Date.now();
  const startMs = endMs - periodDays * ONE_DAY_MS;
  const startTime = toIsoMillisUtc(startMs);
  const endTime = toIsoMillisUtc(endMs);
  const intervalUnits = periodDays > 30 ? "WEEKS" : "DAYS";

  const isVuln = trendType === "vulnerabilities" || trendType === "issues";
  const severityFilter = typeof input.severity === "string" && input.severity.trim() !== ""
    ? `{ keyExpression: { key: "vulnerabilitySeverity" }, operator: EQUALS, value: ${formatGraphqlLiteral(input.severity.trim().toUpperCase())}, type: ATTRIBUTE },`
    : "";

  const openedFilters = isVuln
    ? `[
              { keyExpression: { key: "activityEventType" }, operator: EQUALS, value: "VULNERABILITY_CHANGE", type: ATTRIBUTE },
              ${severityFilter}
              { keyExpression: { key: "vulnerabilityCurrentStatus" }, operator: IN, value: ["OPEN", "REOPENED"], type: ATTRIBUTE }
            ]`
    : `[
              { keyExpression: { key: "activityEventType" }, operator: EQUALS, value: "API_INTELLIGENCE_CHANGE", type: ATTRIBUTE },
              { keyExpression: { key: "apiCurrentState" }, operator: EQUALS, value: "API_STATE_LEARNT", type: ATTRIBUTE },
              { keyExpression: { key: "apiPreviousState" }, operator: EQUALS, value: "API_STATE_LEARNING", type: ATTRIBUTE }
            ]`;

  const closedFilters = isVuln
    ? `[
              { keyExpression: { key: "activityEventType" }, operator: EQUALS, value: "VULNERABILITY_CHANGE", type: ATTRIBUTE },
              ${severityFilter}
              { keyExpression: { key: "vulnerabilityCurrentStatus" }, operator: IN, value: ["FIXED", "NOT_A_VULNERABILITY", "ACCEPTED_RISK"], type: ATTRIBUTE }
            ]`
    : `[
              { keyExpression: { key: "activityEventType" }, operator: EQUALS, value: "API_DEFINITION_CHANGE", type: ATTRIBUTE },
              { keyExpression: { key: "apiChangeType" }, operator: EQUALS, value: "REMOVE", type: ATTRIBUTE },
              { keyExpression: { key: "isLearnt" }, operator: EQUALS, value: true, type: ATTRIBUTE },
              { keyExpression: { key: "apiDiscoveryState" }, operator: IN, value: ["DISCOVERED", "UNDER_DISCOVERY"], type: ATTRIBUTE }
            ]`;

  const query = `mutation SubmitTrendAnalyticsBatch {
  submitAnalyticsQueryBatch(
    input: {
      batchScope: "ACTIVITY_EVENT"
      executeAsync: true
      skipView: true
      queries: [
        {
          name: "opened_events"
          scope: "ACTIVITY_EVENT"
          limit: 10000
          between: { startTime: "${startTime}", endTime: "${endTime}" }
          offset: 0
          filterBy: ${openedFilters}
          interval: { size: 1, units: ${intervalUnits} }
          selections: [{ expression: { key: "activityEventType" }, aggregation: COUNT }]
        }
        {
          name: "closed_events"
          scope: "ACTIVITY_EVENT"
          limit: 10000
          between: { startTime: "${startTime}", endTime: "${endTime}" }
          offset: 0
          filterBy: ${closedFilters}
          interval: { size: 1, units: ${intervalUnits} }
          selections: [{ expression: { key: "activityEventType" }, aggregation: COUNT }]
        }
      ]
    }
  ) {
    batchId
    state
    opened_events: queryResult(name: "opened_events", scope: "ACTIVITY_EVENT") {
      results {
        intervalStart
        count: selection(expression: { key: "activityEventType" }, aggregation: COUNT) { value }
      }
    }
    closed_events: queryResult(name: "closed_events", scope: "ACTIVITY_EVENT") {
      results {
        intervalStart
        count: selection(expression: { key: "activityEventType" }, aggregation: COUNT) { value }
      }
    }
  }
}`;
  return { query, variables: {} };
}

// ---------------------------------------------------------------------------
// 9. appsec_datatype builders
// ---------------------------------------------------------------------------

export function buildDatatypesBody(): Record<string, unknown> {
  return { query: DATATYPES_QUERY, variables: {} };
}
