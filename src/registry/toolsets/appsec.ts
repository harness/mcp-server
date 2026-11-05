import { randomUUID } from "node:crypto";
import type {
  ToolsetDefinition,
  FilterFieldSpec,
  PathBuilderConfig,
  PreflightContext,
} from "../types.js";
import {
  appsecEntitiesListExtract,
  appsecEntityGetExtract,
  appsecApiSpecGetExtract,
  appsecApiSpansListExtract,
  appsecVulnerabilitiesListExtract,
  appsecVulnerabilityGetExtract,
  appsecVulnEnumValuesExtract,
  appsecThreatActivityListExtract,
  appsecThreatActivityGetExtract,
  appsecExploreListExtract,
  appsecAstScanListExtract,
  appsecAstScanGetExtract,
  appsecTrendListExtract,
  appsecDatatypesListExtract,
  appsecDatatypeGetExtract,
  appsecFraudPolicyCreateExtract,
  appsecDerivationConfigCreateExtract,
  appsecGraphqlQueryExtract,
  appsecTrinoQueryExtract,
} from "../extractors.js";
import { isRecord } from "../../utils/type-guards.js";

const GRAPHQL_PATH = "/graphql";
const TRINO_PATH = "/v1/statement";

const ONE_HOUR_MS = 3_600_000;
const ONE_DAY_MS = 86_400_000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

const TIME_FILTER_MS: Record<string, number> = {
  LAST_1_HOUR: ONE_HOUR_MS,
  LAST_6_HOURS: 6 * ONE_HOUR_MS,
  LAST_24_HOURS: ONE_DAY_MS,
  LAST_48_HOURS: 2 * ONE_DAY_MS,
  LAST_7_DAYS: ONE_WEEK_MS,
  LAST_14_DAYS: 14 * ONE_DAY_MS,
  LAST_30_DAYS: 30 * ONE_DAY_MS,
  LAST_90_DAYS: 90 * ONE_DAY_MS,
};

const VALID_TIME_FILTERS = Object.keys(TIME_FILTER_MS);

const ENTITY_SCOPES = [
  "SERVICE",
  "BACKEND",
  "BACKEND_API",
  "DOMAIN",
  "ACTOR",
  "APPLICATION_ASSET",
  "APPLICATION_GROUP",
  "MCP_SERVER",
  "MCP_TOOL",
  "MCP_PROMPT",
  "MCP_RESOURCE",
] as const;

const MCP_AI_ASSET_TYPES = new Set(["MCP_TOOL", "MCP_SERVER", "MCP_PROMPT", "MCP_RESOURCE"]);

const COMMON_ENTITY_ATTRIBUTES: Record<string, readonly string[]> = {
  API: [
    "id",
    "name",
    "serviceId",
    "serviceName",
    "environment",
    "apiType",
    "isAuthenticated",
    "authTypes",
    "isExternal",
    "hasPii",
    "dataTypeIds",
    "piiTypes",
    "riskScore",
    "riskScoreCategory",
    "lastCalledTime",
    "createdTime",
    "isLearnt",
  ],
  SERVICE: ["id", "name", "environment", "applicationType"],
  BACKEND: ["id", "name", "type", "environment"],
  BACKEND_API: ["id", "apiName", "backendName", "environment"],
  DOMAIN: ["id", "name", "environment"],
  ACTOR: [
    "actorId",
    "score",
    "scoreCategory",
    "status",
    "environment",
    "mostSuspiciousIpReputationLevel",
    "country",
    "city",
    "createdTime",
  ],
  APPLICATION_ASSET: [
    "id",
    "assetId",
    "assetType",
    "name",
    "environment",
    "riskScore",
    "riskScoreCategory",
    "datatypes",
    "lastCalled",
  ],
  APPLICATION_GROUP: ["id", "name"],
  MCP_TOOL: [
    "name",
    "isExternal",
    "isEncrypted",
    "isAuthenticated",
    "authTypes",
    "datatypeIds",
    "datasetIds",
    "createdTime",
    "lastUpdateTime",
    "owner",
    "schema",
    "mcpServerId",
    "environment",
  ],
  MCP_SERVER: ["name", "host", "createdTime", "lastCalled", "environment", "owner"],
  MCP_PROMPT: [
    "name",
    "isExternal",
    "isEncrypted",
    "authTypes",
    "datatypeIds",
    "datasetIds",
    "createdTime",
    "lastUpdateTime",
    "lastCalled",
    "owner",
    "schema",
    "mcpServerId",
    "environment",
  ],
  MCP_RESOURCE: [
    "name",
    "mcpServerId",
    "isAuthenticated",
    "authTypes",
    "environment",
    "isExternal",
    "isEncrypted",
    "lastCalled",
    "owner",
    "lastUpdateTime",
    "createdTime",
    "schema",
  ],
};

const VULNERABILITY_DEFAULT_SOURCES = [
  "VULNERABILITY_SOURCE_TYPE_RUNTIME_PROTECTION",
  "VULNERABILITY_SOURCE_TYPE_GATEWAY_CONFIGURATION",
  "VULNERABILITY_SOURCE_TYPE_COMPLIANCE",
  "VULNERABILITY_SOURCE_TYPE_SECURITY_TESTING",
  "VULNERABILITY_SOURCE_TYPE_CONFORMANCE_ANALYSIS",
] as const;

const VULNERABILITY_DEFAULT_STATUSES = [
  "VULNERABILITY_STATUS_OPEN",
  "VULNERABILITY_STATUS_REOPENED",
  "VULNERABILITY_STATUS_UNDER_REVIEW",
] as const;

const VULNERABILITY_ALL_STATUSES = [
  ...VULNERABILITY_DEFAULT_STATUSES,
  "VULNERABILITY_STATUS_FIXED",
  "VULNERABILITY_STATUS_ACCEPTED_RISK",
  "VULNERABILITY_STATUS_NOT_A_VULNERABILITY",
] as const;

const VULNERABILITY_SEVERITIES = [
  "VULNERABILITY_SEVERITY_CRITICAL",
  "VULNERABILITY_SEVERITY_HIGH",
  "VULNERABILITY_SEVERITY_MEDIUM",
  "VULNERABILITY_SEVERITY_LOW",
  "VULNERABILITY_SEVERITY_INFO",
] as const;

const ALLOWED_VULN_ENUM_KEYS = new Set([
  "API_DISCOVERY_STATE",
  "STATUS",
  "VULNERABILITY_SUB_CATEGORY",
  "DISPLAY_NAME",
  "SUITE_TYPE",
  "VULNERABILITY_CATEGORY",
  "SEVERITY",
  "OWASP",
  "OWASP_API_TOP10",
  "AFFECTED_ENTITY_TYPE",
  "SOURCES",
  "VULNERABILITY_CHANGE_LOGS_STATUS",
  "API_RISK_CATEGORY",
  "API_RISK_SCORE_CATEGORY",
  "API_ENDPOINT_TYPE",
]);

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
  input._duration_minutes = durationMinutes;

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
    input._appsec_ui_url = config.HARNESS_APPSEC_UI_URL;
  } else if (config.HARNESS_APPSEC_BASE_URL) {
    // Automatically derive UI URL from API URL (e.g. https://api-dev.traceable.ai -> https://app-dev.traceable.ai)
    input._appsec_ui_url = config.HARNESS_APPSEC_BASE_URL
      .replace(/\/+$/, "")
      .replace(/\/graphql$/i, "")
      .replace("://api-", "://app-")
      .replace("://api.", "://app.");
  }
}

function resolveLimitAndOffset(
  input: Record<string, unknown>,
  defaultLimit = 10,
): { limit: number; offset: number } {
  const rawLimit = input.limit ?? input.size;
  const limit = typeof rawLimit === "number" && rawLimit > 0 ? Math.min(rawLimit, 1000) : defaultLimit;
  const page = typeof input.page === "number" && input.page >= 0 ? input.page : 0;
  const offset = typeof input.offset === "number" && input.offset >= 0 ? input.offset : page * limit;
  return { limit, offset };
}

function buildAttributeSelectionBlock(
  attributes: readonly string[],
  metricMode: "none" | "numCallsOnly" | "apiMetrics" = "none",
): string {
  const seen = new Set<string>();
  const lines: string[] = ["entityId: id"];
  for (const attr of attributes) {
    if (!attr || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(attr) || seen.has(attr)) continue;
    seen.add(attr);
    if (attr === "numCalls" || (attr === "errorCount" && metricMode === "apiMetrics")) {
      lines.push(`${attr}: metric(expression: {key: "${attr}"}) { sum { value } }`);
    } else {
      lines.push(`${attr}: attribute(expression: {key: "${attr}"})`);
    }
  }
  if (metricMode === "numCallsOnly" || metricMode === "apiMetrics") {
    if (!seen.has("numCalls")) {
      lines.push(`numCalls: metric(expression: {key: "numCalls"}) { sum { value } }`);
    }
  }
  if (metricMode === "apiMetrics" && !seen.has("errorCount")) {
    lines.push(`errorCount: metric(expression: {key: "errorCount"}) { sum { value } }`);
  }
  return lines.join("\n          ");
}

function buildEntitiesQuery(selectionBlock: string): string {
  return `query GetEntities(
  $scope: String,
  $between: InputTimeRange!,
  $filterBy: [InputFilter],
  $orderBy: [InputAggregatableOrder],
  $limit: Int,
  $offset: Int,
  $includeInactive: Boolean
) {
  entities(
    scope: $scope,
    between: $between,
    filterBy: $filterBy,
    orderBy: $orderBy,
    limit: $limit,
    offset: $offset,
    includeInactive: $includeInactive
  ) {
    count
    total
    results {
      ${selectionBlock}
    }
  }
}`;
}

function attrFilter(key: string, operator: string, value: unknown): Record<string, unknown> {
  return {
    keyExpression: { key },
    operator,
    value,
    type: "ATTRIBUTE",
  };
}

// ---------------------------------------------------------------------------
// 1. appsec_api builders
// ---------------------------------------------------------------------------

function buildApiListBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  input._entity_scope = "API";

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

  input._applied_filters = filters;

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

function buildApiGetBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  input._entity_scope = "API";
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

function buildApiSpecGetBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
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

function buildApiSpansListBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
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
// 3. appsec_entity builders (multi-scope inventory + lookup_entity_details)
// ---------------------------------------------------------------------------

function buildEntityListBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const scope = String(input.scope ?? "SERVICE").trim().toUpperCase();
  input._entity_scope = scope;

  const { startTime, endTime } = resolveAppSecTimeWindow(input, ONE_DAY_MS);
  const { limit, offset } = resolveLimitAndOffset(input, 10);

  const filters: Array<Record<string, unknown>> = [];
  const assetTypes = splitCsvOrArray(input.asset_type).map((t) => t.toUpperCase());
  const isMcpAssetQuery = assetTypes.some((t) => MCP_AI_ASSET_TYPES.has(t));

  // Enforce per-scope default filters from query_details.json
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

  // Name & ID filters (replaces lookup_entity_details)
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

  input._applied_filters = filters;

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

function buildEntityGetBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const entityId = String(input.entity_id ?? input.resource_id ?? "").trim();
  if (!entityId) {
    throw new Error("Missing required field \"entity_id\" for appsec_entity.");
  }
  const scope = String(input.scope ?? "SERVICE").trim().toUpperCase();
  input._entity_scope = scope;

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
// 4. appsec_vulnerability builders (vulnerabilitiesV3 + enum_values)
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

function buildVulnerabilityFilterBlock(relationalFilters: Array<Record<string, unknown>>): string {
  const blocks = relationalFilters.map((f) => {
    const rf = f.relationalFilter as { key: string; operator: string; value: unknown };
    return `{ relationalFilter: { key: ${rf.key}, operator: ${rf.operator}, value: ${formatGraphqlLiteral(rf.value)} } }`;
  });
  return `{ logicalFilter: { operator: AND, filters: [${blocks.join(", ")}] } }`;
}

function buildVulnerabilityListBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
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

function buildVulnerabilityGetBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
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

function buildVulnEnumValuesBody(input: Record<string, unknown>): Record<string, unknown> {
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
  input._enum_keys = keys;

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

function buildThreatActivityListBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const { startMs, endMs } = resolveAppSecTimeWindow(input, ONE_DAY_MS);
  const { limit, offset } = resolveLimitAndOffset(input, 10);

  // 4 mandatory timestamp filters from get_threat_activity_timerange
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

  input._applied_filters = filterBy;

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

function buildThreatActivityGetBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
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
// 6. appsec_security_event builders (explore)
// ---------------------------------------------------------------------------

function buildExploreListBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const mode = typeof input.mode === "string" ? input.mode.toLowerCase() : "events";
  const scope = typeof input.scope === "string" && input.scope.trim() !== ""
    ? input.scope.trim().toUpperCase()
    : mode === "ai_assets"
      ? "APPLICATION_ASSET"
      : mode === "ai_traffic"
        ? "SPAN"
        : "DOMAIN_EVENT";
  input._explore_scope = scope;

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

  input._applied_filters = filters;

  const explicitGroupBy = splitCsvOrArray(input.group_by).filter((f) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(f));
  const defaultGroupBy =
    scope === "APPLICATION_ASSET"
      ? ["assetType"]
      : scope === "SPAN"
        ? ["spanKind"]
        : ["apiId", "apiName", "threatCategory", "eventStatus"];
  const groupByFields = explicitGroupBy.length > 0 ? explicitGroupBy : defaultGroupBy;

  // Enforce explore GroupBy <-> Selection rule: every groupBy field must appear in selection + COUNT(id)
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
// 7. appsec_ast_scan builders (searchAst + getAstHookTests)
// ---------------------------------------------------------------------------

function buildAstScanListBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
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
    input._applied_filters = filterBy;

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

  // SCANS data source
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
    input._applied_filters = filterBy;

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

  // All scans summary with mandatory latest-run join and SCAN_RUN_NUMBER >= 0 safety filter
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

function buildAstScanGetBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
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
// 8. appsec_inventory_trend preflight + builder (replaces 3-step trend choreography)
// ---------------------------------------------------------------------------

async function fetchTrendCurrentCountPreflight(ctx: PreflightContext): Promise<void> {
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
    ctx.input._current_count = isRecord(res) && typeof res.total === "number" ? res.total : 0;
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
    ctx.input._current_count = isRecord(res) && typeof res.total === "number" ? res.total : 0;
  }
}

function buildInventoryTrendBody(input: Record<string, unknown>, config: PathBuilderConfig): Record<string, unknown> {
  attachUiConfig(input, config);
  const trendType = String(input.trend_type ?? "apis").trim().toLowerCase();
  const periodDays = typeof input.period_days === "number" && input.period_days > 0 ? Math.min(input.period_days, 90) : 7;
  input._period_days = periodDays;

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

const DATATYPES_QUERY = `query GetDataTypes {
  dataTypes {
    results {
      id
      name
      description
      dataSuppression
      sensitivity
    }
  }
}`;

function buildDatatypesBody(): Record<string, unknown> {
  return { query: DATATYPES_QUERY, variables: {} };
}

// ---------------------------------------------------------------------------
// 10. appsec_fraud_policy & appsec_derivation_config builders
// ---------------------------------------------------------------------------

function buildFraudPolicyCreateBody(input: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(input.body)) {
    throw new Error("body must be a JSON object. Use harness_describe(resource_type=\"appsec_fraud_policy\") for required fields.");
  }
  const b = input.body;
  const policyName = typeof b.policy_name === "string" ? b.policy_name.trim() : "";
  const description = typeof b.description === "string" ? b.description.trim() : "";
  const sqlQuery = typeof b.sql_query === "string" ? b.sql_query.trim() : "";
  const apiId = typeof b.api_id === "string" ? b.api_id.trim() : "";
  const derivationConfigId =
    typeof b.associated_event_derivation_config_id === "string" && b.associated_event_derivation_config_id.trim()
      ? b.associated_event_derivation_config_id.trim()
      : undefined;

  if (sqlQuery && !/\bselect\b/i.test(sqlQuery)) {
    throw new Error("sql_query must be a valid SELECT query for entity graph fraud rule evaluation.");
  }

  const variables: Record<string, unknown> = {
    policy_id: randomUUID(),
    policy_name: policyName || undefined,
    description: description || undefined,
    sql_query: sqlQuery || undefined,
    api_id: apiId || undefined,
    ...(derivationConfigId ? { associated_event_derivation_config_id: derivationConfigId } : {}),
  };

  const query = `mutation CreateFraudPolicy(
  $policy_name: String!
  $description: String!
  $sql_query: String!
  $policy_id: String!
  $associated_event_derivation_config_id: String
  $api_id: String
) {
  CreateFraudPolicy(
    input: {
      fraud_policy: {
        id: $policy_id
        name: $policy_name
        fraud_policy_rule: {
          fraud_rule: {
            fraud_rule_id: "ai_rule"
            entity_graph_fraud_rule: {
              entity_graph_data_query: { raw_sql_query: $sql_query }
            }
          }
        }
        primary_entity_type: "API"
        disabled: true
        description: $description
        risk_spec: { score: 5, severity: FRAUD_RISK_SEVERITY_MEDIUM }
        policy_group: POLICY_GROUP_BOT
        policy_type: POLICY_TYPE_CUSTOM
        labels: ["api-generated"]
        fraud_policy_stage: FRAUD_POLICY_STAGE_PRODUCTION
        schedule: { interval: { value: 1, unit: TIME_UNIT_HOURS } }
        target: { api_endpoint: { api_id: $api_id } }
        backreferences_info: { derivation_config: { derivation_config_id: $associated_event_derivation_config_id } }
      }
    }
  ) {
    fraud_policy {
      id
      name
      primary_entity_type
      disabled
      labels
      description
      policy_group
      policy_type
    }
  }
}`;

  return { query, variables };
}

interface DerivationFeatureInput {
  name: string;
  expression: string;
  explanation?: string;
  type?: string;
}

function parseDerivationFeaturesFromXml(xml: string): DerivationFeatureInput[] {
  const features: DerivationFeatureInput[] = [];
  const featureBlocks = [...xml.matchAll(/<Feature\s+name=["']([^"']+)["']\s*>([\s\S]*?)<\/Feature>/g)];
  for (const match of featureBlocks) {
    const name = match[1]!.trim();
    const inner = match[2]!;
    const exprMatch = /<Expression>([\s\S]*?)<\/Expression>/.exec(inner);
    const explMatch = /<Explanation>([\s\S]*?)<\/Explanation>/.exec(inner);
    const typeMatch = /<Type>([\s\S]*?)<\/Type>/.exec(inner);
    if (!exprMatch || !exprMatch[1]?.trim()) {
      throw new Error(`Feature "${name}" is missing an <Expression> element.`);
    }
    features.push({
      name,
      expression: exprMatch[1].trim(),
      explanation: explMatch?.[1]?.trim() ?? "",
      type: typeMatch?.[1]?.trim() ?? "string",
    });
  }
  if (features.length === 0) {
    throw new Error("jexl_expressions_xml must contain at least one <Feature name=\"...\"> element.");
  }
  return features;
}

function buildDerivationConfigCreateBody(input: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(input.body)) {
    throw new Error("body must be a JSON object. Use harness_describe(resource_type=\"appsec_derivation_config\") for required fields.");
  }
  const b = input.body;
  const apiId = typeof b.api_id === "string" ? b.api_id.trim() : "";
  if (!apiId) {
    throw new Error("Missing required fields for appsec_derivation_config: api_id.");
  }

  let features: DerivationFeatureInput[] = [];
  if (Array.isArray(b.features) && b.features.length > 0) {
    features = b.features.map((item) => {
      if (!isRecord(item)) throw new Error("Each entry in body.features must be an object.");
      return {
        name: typeof item.name === "string" ? item.name.trim() : "",
        expression: typeof item.expression === "string" ? item.expression.trim() : "",
        explanation: typeof item.explanation === "string" ? item.explanation.trim() : "",
        type: typeof item.type === "string" ? item.type.trim() : "string",
      };
    });
  } else if (typeof b.jexl_expressions_xml === "string" && b.jexl_expressions_xml.trim() !== "") {
    features = parseDerivationFeaturesFromXml(b.jexl_expressions_xml);
  } else {
    throw new Error("appsec_derivation_config requires either body.features (array) or body.jexl_expressions_xml (XML string).");
  }

  for (const feat of features) {
    if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(feat.name)) {
      throw new Error(`Feature name "${feat.name}" must be in snake_case format.`);
    }
    if (!feat.expression) {
      throw new Error(`Feature "${feat.name}" is missing a non-empty JEXL expression.`);
    }
  }

  const configUuid = randomUUID();
  const innerConfig = {
    kind: "event_derivation_config",
    id: `ai_gen_${configUuid}`,
    name: `ai-generated-derivation-config-${configUuid}`,
    scope: `$s.api_id.equals('${apiId}')`,
    targetEventType: "customer_events",
    variables: [
      {
        name: "response_body_json_object",
        type: "string",
        rules: [{ expression: "traceable:parseJson($s.response_body)", script: null, condition: null }],
      },
    ],
    attributes: features.map((f) => ({
      name: f.name,
      type: f.type || "string",
      rules: [
        {
          expression: f.expression,
          script: null,
          condition: null,
          description: f.explanation ?? "",
        },
      ],
    })),
    entities: [],
    relationships: [],
  };

  const query = `mutation CreateDerivationConfig(
  $name: String!
  $description: String!
  $derivation_config: String!
) {
  CreateDerivationConfig(
    input: {
      name: $name
      description: $description
      derivation_config: $derivation_config
      derivation_config_type: DERIVATION_CONFIG_TYPE_EVENT
      disabled: true
    }
  ) {
    derivation_config {
      id
      derivation_config_type
      name
      derivation_config
      disabled
      description
      template_id
    }
  }
}`;

  return {
    query,
    variables: {
      name: `ai-generated-derivation-config-${configUuid}`,
      description: `AI Generated Derivation Config Inner ${configUuid}`,
      derivation_config: JSON.stringify(innerConfig),
    },
  };
}

// ---------------------------------------------------------------------------
// 11. appsec_query templates, GraphQL guard, and Trino SQL guard
// ---------------------------------------------------------------------------

const CURATED_QUERY_TEMPLATES: Record<string, { description: string; template: string; required_rules: string[] }> = {
  entities: {
    description: "Fetches entities across API, SERVICE, DOMAIN, BACKEND, ACTOR, BACKEND_API, APPLICATION_ASSET, and MCP_* scopes.",
    template: `query Entities($scope: String, $between: InputTimeRange!, $filterBy: [InputFilter], $orderBy: [InputAggregatableOrder], $limit: Int, $offset: Int, $includeInactive: Boolean) {
  entities(scope: $scope, between: $between, filterBy: $filterBy, orderBy: $orderBy, limit: $limit, offset: $offset, includeInactive: $includeInactive) {
    results {
      entityId: id
      name: attribute(expression: { key: "name" })
    }
    total
  }
}`,
    required_rules: [
      "between with ISO-8601 .000Z startTime and endTime is mandatory.",
      "Use attribute(expression: { key: \"<attr>\" }) for attributes and metric(expression: { key: \"numCalls\" }) { sum { value } } for metrics.",
    ],
  },
  vulnerabilitiesV3: {
    description: "Fetches vulnerabilities from runtime protection, security testing (AST), gateway config, compliance, and conformance analysis.",
    template: `{
  vulnerabilitiesV3(
    filter: {
      logicalFilter: {
        operator: AND
        filters: [
          { relationalFilter: { key: SOURCES, operator: IN, value: ["VULNERABILITY_SOURCE_TYPE_RUNTIME_PROTECTION", "VULNERABILITY_SOURCE_TYPE_SECURITY_TESTING"] } }
          { relationalFilter: { key: STATUS, operator: IN, value: ["VULNERABILITY_STATUS_OPEN", "VULNERABILITY_STATUS_REOPENED"] } }
        ]
      }
    }
    limit: 10
    offset: 0
  ) {
    results {
      VULNERABILITY_ID: selection(key: VULNERABILITY_ID) { value }
      DISPLAY_NAME: selection(key: DISPLAY_NAME) { value }
      SEVERITY: selection(key: SEVERITY) { value }
      STATUS: selection(key: STATUS) { value }
    }
    total
  }
}`,
    required_rules: [
      "At least one aliased selection(key: ...) inside results is mandatory even for count queries.",
    ],
  },
  explore: {
    description: "Explores security events (DOMAIN_EVENT), threat requests (PROTECTION_SPAN), AI assets (APPLICATION_ASSET), and spans (SPAN).",
    template: `query Explore($scope: String, $between: InputTimeRange!, $filterBy: [InputFilter], $limit: Int, $offset: Int) {
  explore(scope: $scope, between: $between, filterBy: $filterBy, limit: $limit, offset: $offset) {
    results {
      id: attribute(expression: { key: "id" })
      name: attribute(expression: { key: "name" })
    }
    total
  }
}`,
    required_rules: [
      "When using groupBy, every non-aggregated field in results.selection must match groupBy.expressions and at least one COUNT aggregation is required.",
    ],
  },
  threatActivity: {
    description: "Fetches runtime threat activities with mandatory 4-part START_TIME_MILLIS / LAST_SEEN_MILLIS filters.",
    template: `{
  threatActivity(
    filterBy: [
      { key: START_TIME_MILLIS, operator: LESS_THAN, value: 0 }
      { key: START_TIME_MILLIS, operator: GREATER_THAN, value: 0 }
      { key: LAST_SEEN_MILLIS, operator: LESS_THAN, value: 0 }
      { key: LAST_SEEN_MILLIS, operator: GREATER_THAN, value: 0 }
      { key: ACTIVITY_STATUS, operator: NOT_IN, value: ["Internal", "Tagged", "Excluded"] }
    ]
    orderBy: [{ direction: DESC, key: LAST_SEEN_MILLIS }]
    limit: 10
    offset: 0
  ) {
    results {
      ID: selection(key: ID) { value }
      BEHAVIOUR: selection(key: BEHAVIOUR) { value }
      EVENT_CATEGORY: selection(key: EVENT_CATEGORY) { value }
    }
    total
  }
}`,
    required_rules: [
      "Always include the 4 START_TIME_MILLIS / LAST_SEEN_MILLIS filters and ACTIVITY_STATUS NOT_IN [\"Internal\", \"Tagged\", \"Excluded\"].",
    ],
  },
  searchAst: {
    description: "Fetches AST scans and API coverage.",
    template: `{
  searchAst(
    astDataSource: SCANS
    limit: 10
    offset: 0
    filterBy: [{ key: SCAN_RUN_NUMBER, operator: GREATER_THAN_OR_EQUAL_TO, value: 0 }]
    orderBy: { key: SCAN_START_TIME, direction: DESC }
  ) {
    count
    total
    results {
      SCAN_STATUS: selection(key: SCAN_STATUS) { value }
      SCAN_SUITE_ID: selection(key: SCAN_SUITE_ID) { value }
      SCAN_SUITE_NAME: selection(key: SCAN_SUITE_NAME) { value }
    }
  }
}`,
    required_rules: [
      "SCAN_STATUS selection is mandatory for astDataSource: SCANS.",
    ],
  },
  submitAnalyticsQueryBatch: {
    description: "Executes batch analytics queries on ACTIVITY_EVENT or SPAN scopes.",
    template: `mutation {
  submitAnalyticsQueryBatch(
    input: {
      batchScope: "ACTIVITY_EVENT"
      executeAsync: true
      skipView: true
      queries: [
        {
          name: "q1"
          scope: "ACTIVITY_EVENT"
          limit: 1
          between: { startTime: "2026-01-01T00:00:00.000Z", endTime: "2026-01-02T00:00:00.000Z" }
          offset: 0
          filterBy: []
          selections: [{ expression: { key: "activityEventType" }, aggregation: COUNT }]
        }
      ]
    }
  ) {
    batchId
    state
    q1: queryResult(name: "q1", scope: "ACTIVITY_EVENT") {
      results {
        selection(expression: { key: "activityEventType" }, aggregation: COUNT) { value }
      }
    }
  }
}`,
    required_rules: ["Set executeAsync: true and skipView: true for ACTIVITY_EVENT queries."],
  },
  getAstHookTests: {
    description: "Fetches AST authentication hook test details for a specific hook ID.",
    template: `{
  getAstHookTests(astHookTestFilters: [{ testIdFilter: { ids: ["<hook-id>"] } }]) {
    advancedMode {
      hookScript
    }
  }
}`,
    required_rules: ["Requires an explicit hook ID."],
  },
};

function buildQueryTemplateGetBody(input: Record<string, unknown>): Record<string, unknown> {
  const queryName = String(input.query_name ?? input.resource_id ?? "entities").trim();
  const entry = CURATED_QUERY_TEMPLATES[queryName];
  if (!entry) {
    throw new Error(
      `Unsupported query_name "${queryName}". Supported: ${Object.keys(CURATED_QUERY_TEMPLATES).join(", ")}`,
    );
  }
  input._template_response = {
    query_name: queryName,
    description: entry.description,
    graphql_query_template: entry.template,
    required_rules: entry.required_rules,
  };
  return { query: "{ __typename }", variables: {} };
}

const MAX_GRAPHQL_VARIABLES_BYTES = 100 * 1024;
const MAX_OPERATION_NAME_LENGTH = 256;

function buildRawGraphqlExecuteBody(input: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(input.body)) {
    throw new Error("body must be a JSON object with a \"query\" string.");
  }
  const query = typeof input.body.query === "string" ? input.body.query.trim() : "";
  if (!query) {
    throw new Error("Missing required field \"query\" in body.");
  }

  // Block state-changing GraphQL mutations on the read-only execute action
  // (allow only read-only submitAnalyticsQueryBatch analytics queries).
  if (/^\s*mutation\b/i.test(query) && !/\bsubmitAnalyticsQueryBatch\s*\(/.test(query)) {
    throw new Error(
      "Write mutations are not allowed in appsec_query.graphql. Use harness_create with appsec_fraud_policy or appsec_derivation_config instead.",
    );
  }

  if (query.includes("vulnerabilitiesV3(") && !query.includes(": selection(")) {
    throw new Error(
      "vulnerabilitiesV3 query is missing aliased selections. Include at least one selection, e.g. `VULNERABILITY_ID: selection(key: VULNERABILITY_ID) { value }`.",
    );
  }

  const operationName = input.body.operation_name ?? input.body.operationName;
  if (operationName !== undefined) {
    if (typeof operationName !== "string") {
      throw new Error("operation_name must be a string.");
    }
    if (operationName.length > MAX_OPERATION_NAME_LENGTH) {
      throw new Error(`operation_name length exceeds maximum (${MAX_OPERATION_NAME_LENGTH} characters).`);
    }
  }

  const variables = input.body.variables;
  if (variables !== undefined) {
    if (!isRecord(variables)) {
      throw new Error("variables must be a JSON object.");
    }
    const serializedBytes = Buffer.byteLength(JSON.stringify(variables), "utf8");
    if (serializedBytes > MAX_GRAPHQL_VARIABLES_BYTES) {
      throw new Error(`variables size (${serializedBytes} bytes) exceeds maximum (100KB).`);
    }
  }

  return {
    query,
    ...(variables !== undefined ? { variables } : {}),
    ...(typeof operationName === "string" ? { operationName } : {}),
  };
}

const TRINO_FORBIDDEN_DML_DDL =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|merge|call|execute)\b/i;

export function validateAppSecTrinoSql(sql: string, tenantId?: string): void {
  const trimmed = sql.trim();
  if (!trimmed) {
    throw new Error("sql_query must not be empty.");
  }
  const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, "");
  if (withoutTrailingSemicolon.includes(";")) {
    throw new Error("Exactly one SQL statement is allowed.");
  }
  if (!/^(select|with|show\s+tables|show\s+columns|describe|desc)\b/i.test(withoutTrailingSemicolon)) {
    throw new Error("Only read-only SELECT, SHOW TABLES, SHOW COLUMNS, or DESCRIBE statements are allowed.");
  }
  if (TRINO_FORBIDDEN_DML_DDL.test(withoutTrailingSemicolon)) {
    throw new Error("Mutating or administrative SQL keywords are not allowed in Trino queries.");
  }
  if (/\b(system|mongodb|psql|postgres|mysql|information_schema)\s*\./i.test(withoutTrailingSemicolon)) {
    throw new Error("Only the iceberg catalog (iceberg_gcs / iceberg_datalake schemas) is allowed.");
  }
  if (tenantId) {
    const normalizedTenant = tenantId.replace(/-/g, "_").toLowerCase();
    const viewMatches = [...withoutTrailingSemicolon.matchAll(/_customer_events_([a-z0-9_]+)/gi)];
    for (const match of viewMatches) {
      if (match[1]!.toLowerCase() !== normalizedTenant) {
        throw new Error("Customer events view is for a different tenant.");
      }
    }
  }
}

function buildTrinoExecuteBody(input: Record<string, unknown>, config: PathBuilderConfig): string {
  if (!isRecord(input.body)) {
    throw new Error("body must be a JSON object with \"sql_query\".");
  }
  const sqlQuery = typeof input.body.sql_query === "string" ? input.body.sql_query.trim() : "";
  validateAppSecTrinoSql(sqlQuery, config.HARNESS_ACCOUNT_ID);
  const limit = typeof input.body.limit === "number" && input.body.limit > 0
    ? Math.min(Math.trunc(input.body.limit), 5000)
    : 1000;
  input._trino_cap = limit;
  return sqlQuery;
}

// ---------------------------------------------------------------------------
// Shared filter field definitions
// ---------------------------------------------------------------------------

const TIME_WINDOW_FILTER_FIELDS: FilterFieldSpec[] = [
  {
    name: "time_filter",
    description: "Relative time window preset",
    enum: VALID_TIME_FILTERS,
  },
  {
    name: "start_time",
    description: "Window start time (ISO-8601 UTC string or epoch milliseconds)",
    type: "string",
  },
  {
    name: "end_time",
    description: "Window end time (ISO-8601 UTC string or epoch milliseconds)",
    type: "string",
  },
];

// ---------------------------------------------------------------------------
// Toolset Definition
// ---------------------------------------------------------------------------

export const appsecToolset: ToolsetDefinition = {
  name: "appsec",
  displayName: "Application & API Security",
  description:
    "Traceable Application & API Security — discover API endpoints, OpenAPI specs, sample spans, " +
    "sensitive data types (PII), runtime threat activities, security events, AST scans, inventory trends, " +
    "and author fraud policies and event derivation configs.",
  resources: [
    // 1. appsec_api
    {
      resourceType: "appsec_api",
      displayName: "AppSec API Endpoint",
      description:
        "Discovered API endpoint in Application & API Security inventory. Supports regex name search, " +
        "PII/datatype filtering, risk score sorting, environment/service filtering, and automatic UI deep links.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["api_id"],
      searchAliases: ["api_endpoint", "traceable_api", "endpoint_inventory"],
      relatedResources: [
        {
          resourceType: "appsec_api_spec",
          relationship: "has-one",
          description: "Fetch the learned OpenAPI YAML specification for an api_id",
        },
        {
          resourceType: "appsec_api_span",
          relationship: "has-many",
          description: "Fetch sample request/response trace spans for an api_id",
        },
        {
          resourceType: "appsec_vulnerability",
          relationship: "has-many",
          description: "List runtime and AST vulnerabilities affecting an api_id (pass entity_id)",
        },
      ],
      listFilterFields: [
        { name: "name_regex", description: "Regex/LIKE pattern to match API endpoint paths (e.g. '.*payment.*')" },
        { name: "service_name", description: "Comma-separated owning service names" },
        { name: "service_id", description: "Comma-separated owning service IDs" },
        { name: "environment", description: "Comma-separated deployment environments (e.g. prod, staging)" },
        { name: "has_pii", description: "Filter APIs exposing sensitive/PII data", type: "boolean" },
        { name: "datatype_ids", description: "Comma-separated sensitive datatype IDs (from appsec_datatype)" },
        {
          name: "risk_score_category",
          description: "Risk score category filter",
          enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        },
        { name: "is_authenticated", description: "Filter by authentication requirement", type: "boolean" },
        { name: "is_external", description: "Filter external vs internal APIs", type: "boolean" },
        { name: "is_ai_asset", description: "Filter AI/GenAI API endpoints", type: "boolean" },
        { name: "application_group_ids", description: "Comma-separated application group IDs" },
        { name: "change_label", description: "Filter recently changed APIs", enum: ["CHANGED"] },
        {
          name: "sort_by",
          description: "Sort field (default: riskScore, or numCalls when name_regex is used)",
          enum: ["riskScore", "numCalls", "errorCount", "createdTime", "lastCalledTime"],
        },
        { name: "attributes", description: "Optional comma-separated extra attribute keys to select" },
        ...TIME_WINDOW_FILTER_FIELDS,
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildApiListBody,
          responseExtractor: appsecEntitiesListExtract,
          skipCompact: true,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List and search discovered API endpoints with risk score, traffic volume, PII exposure, and UI links",
        },
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildApiGetBody,
          responseExtractor: appsecEntityGetExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Get full metadata, risk score, sensitive data types, and traffic metrics for a single API endpoint",
        },
      },
    },

    // 2. appsec_api_spec
    {
      resourceType: "appsec_api_spec",
      displayName: "AppSec API OpenAPI Specification",
      description:
        "Learned OpenAPI (YAML) specification for a discovered API endpoint. Pass the endpoint's api_id as resource_id.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["api_id"],
      operations: {
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildApiSpecGetBody,
          responseExtractor: appsecApiSpecGetExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Fetch the OpenAPI YAML definition for an API endpoint by api_id",
        },
      },
    },

    // 3. appsec_api_span
    {
      resourceType: "appsec_api_span",
      displayName: "AppSec API Sample Spans",
      description:
        "Sample request/response trace spans for an API endpoint, including headers, bodies, cookies, and PII classification matches.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["api_id"],
      listFilterFields: [
        { name: "api_id", description: "Target API endpoint ID", required: true },
        { name: "limit", description: "Maximum number of sample spans to fetch (default 2, max 10)", type: "number" },
        { name: "lookback_hours", description: "Lookback window in hours (default 6)", type: "number" },
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildApiSpansListBody,
          responseExtractor: appsecApiSpansListExtract,
          skipCompact: true,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List sample trace spans for an API endpoint to inspect headers, payloads, and JEXL paths",
        },
      },
    },

    // 4. appsec_entity
    {
      resourceType: "appsec_entity",
      displayName: "AppSec Inventory Entity",
      description:
        "Multi-scope security inventory entities: SERVICE, BACKEND, BACKEND_API (third-party APIs), DOMAIN, " +
        "ACTOR (threat actors), APPLICATION_ASSET (including AI/GenAI assets), APPLICATION_GROUP, and MCP assets " +
        "(MCP_SERVER, MCP_TOOL, MCP_PROMPT, MCP_RESOURCE).",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["entity_id"],
      listFilterFields: [
        {
          name: "scope",
          description: "Entity scope to query (default: SERVICE)",
          enum: [...ENTITY_SCOPES],
        },
        { name: "names", description: "Comma-separated entity names to search (fuzzy LIKE match for single name)" },
        { name: "ids", description: "Comma-separated entity IDs for exact lookup" },
        { name: "environment", description: "Comma-separated environment filter" },
        {
          name: "asset_type",
          description: "For APPLICATION_ASSET scope: filter by assetType (e.g. MCP_SERVER, MCP_TOOL, MCP_PROMPT, MCP_RESOURCE, API)",
        },
        { name: "is_ai_asset", description: "For APPLICATION_ASSET scope: filter AI/MCP assets", type: "boolean" },
        { name: "parent_id", description: "For APPLICATION_ASSET scope: filter child assets by parent MCP server ID" },
        { name: "genai_types", description: "Comma-separated GenAI vendor types (e.g. OpenAI, Anthropic)" },
        { name: "has_sensitive_data", description: "For BACKEND / BACKEND_API: filter entities exposing sensitive data", type: "boolean" },
        { name: "actor_status", description: "For ACTOR scope: status filter (e.g. THREAT_ACTOR)" },
        { name: "score_category", description: "For ACTOR scope: risk score category (e.g. CRITICAL, HIGH)" },
        { name: "attributes", description: "Optional comma-separated extra attribute keys to select" },
        ...TIME_WINDOW_FILTER_FIELDS,
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildEntityListBody,
          responseExtractor: appsecEntitiesListExtract,
          skipCompact: true,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List or resolve entities by scope, name, ID, environment, or AI asset type",
        },
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildEntityGetBody,
          responseExtractor: appsecEntityGetExtract,
          paramsSchema: {
            fields: [
              {
                name: "entity_id",
                required: true,
                description: "Entity ID (passed via resource_id)",
              },
              {
                name: "scope",
                required: false,
                description: `Entity scope (${ENTITY_SCOPES.join(", ")}); defaults to SERVICE`,
              },
            ],
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Get detailed attributes for a single entity by ID and scope",
        },
      },
    },

    // 5. appsec_vulnerability
    {
      resourceType: "appsec_vulnerability",
      displayName: "AppSec Vulnerability",
      description:
        "Application & API Security vulnerabilities and posture issues across Runtime Protection, Security Testing (AST), " +
        "Gateway Configuration, Compliance, and Conformance Analysis (`vulnerabilitiesV3`).",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["vulnerability_id"],
      searchAliases: ["traceable_vulnerability", "api_vulnerability", "appsec_issue"],
      listFilterFields: [
        {
          name: "severity",
          description: "Comma-separated severity filter (accepts CRITICAL, HIGH, MEDIUM, LOW, INFO or full enum)",
          enum: [...VULNERABILITY_SEVERITIES],
        },
        {
          name: "status",
          description: "Comma-separated status filter (defaults to OPEN, REOPENED, UNDER_REVIEW)",
          enum: [...VULNERABILITY_ALL_STATUSES],
        },
        {
          name: "sources",
          description: "Comma-separated source types (defaults to all 5 sources; use SECURITY_TESTING for AST issues)",
          enum: [...VULNERABILITY_DEFAULT_SOURCES],
        },
        { name: "category", description: "Filter by VULNERABILITY_CATEGORY" },
        { name: "sub_category", description: "Filter by VULNERABILITY_SUB_CATEGORY (e.g. xss_reflected, jwt_token_expiry)" },
        { name: "entity_id", description: "Filter by affected entity ID (e.g. api_id)" },
        { name: "entity_name", description: "Filter by affected entity name (LIKE match)" },
        { name: "affected_entity_type", description: "Filter by affected entity type (e.g. API)" },
        { name: "service_id", description: "Filter by service ID" },
        { name: "environment_id", description: "Filter by environment ID / name" },
        { name: "owasp_api_top10", description: "Filter by OWASP API Top 10 classification" },
        { name: "is_ai_asset", description: "Filter AI asset vulnerabilities", type: "boolean" },
        { name: "has_jira", description: "Filter vulnerabilities with an associated Jira ticket", type: "boolean" },
        {
          name: "group_by",
          description: "Group and count vulnerabilities by dimension",
          enum: [
            "SEVERITY",
            "STATUS",
            "VULNERABILITY_CATEGORY",
            "VULNERABILITY_SUB_CATEGORY",
            "ENVIRONMENT_ID",
            "SOURCES",
            "OWASP_API_TOP10",
            "AFFECTED_ENTITY_TYPE",
          ],
        },
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildVulnerabilityListBody,
          responseExtractor: appsecVulnerabilitiesListExtract,
          skipCompact: true,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List or group vulnerabilities with automatic default source and active status filters",
        },
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildVulnerabilityGetBody,
          responseExtractor: appsecVulnerabilityGetExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Get full details for a single vulnerability by vulnerability_id",
        },
      },
      executeActions: {
        enum_values: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildVulnEnumValuesBody,
          responseExtractor: appsecVulnEnumValuesExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          actionDescription:
            "Discover distinct supported values for dynamic vulnerability filter enum keys (e.g. VULNERABILITY_SUB_CATEGORY, VULNERABILITY_CATEGORY).",
          description: "Fetch distinct supported enum values for vulnerability filter keys",
          bodySchema: {
            description: "Filter enum keys to inspect",
            fields: [
              {
                name: "filter_enum_keys",
                type: "array",
                required: false,
                description: "Array of enum keys (e.g. [\"VULNERABILITY_SUB_CATEGORY\", \"STATUS\"]); defaults to STATUS, SEVERITY, VULNERABILITY_CATEGORY",
              },
            ],
          },
        },
      },
    },

    // 6. appsec_threat_activity
    {
      resourceType: "appsec_threat_activity",
      displayName: "AppSec Threat Activity",
      description:
        "Runtime threat detections and attack activities (`threatActivity`). Automatically applies the mandatory " +
        "4-part ±7-day timestamp window filters and excludes Internal/Tagged/Excluded statuses.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["threat_activity_id"],
      listFilterFields: [
        {
          name: "event_category",
          description: "Filter by threat event category",
          enum: ["AI Application Protection", "Web Application Protection", "API Protection", "Custom Policies"],
        },
        { name: "behaviour", description: "Filter by threat rule / behaviour name" },
        { name: "severity", description: "Filter by threat severity (CRITICAL, HIGH, MEDIUM, LOW)" },
        { name: "api_ids", description: "Comma-separated target API IDs" },
        { name: "service_ids", description: "Comma-separated target service IDs" },
        { name: "actor_ids", description: "Comma-separated threat actor IDs / names" },
        { name: "domain_ids", description: "Comma-separated target domain IDs" },
        {
          name: "group_by",
          description: "Optional single dimension to group threat counts by",
          enum: ["EVENT_CATEGORY", "BEHAVIOUR", "API_IDS", "API_NAMES", "SERVICE_IDS", "SERVICE_NAMES", "ACTOR_ENTITY_IDS", "DOMAIN_IDS"],
        },
        ...TIME_WINDOW_FILTER_FIELDS,
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildThreatActivityListBody,
          responseExtractor: appsecThreatActivityListExtract,
          skipCompact: true,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List or group runtime threat activities with automatic time-window padding and UI deep links",
        },
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildThreatActivityGetBody,
          responseExtractor: appsecThreatActivityGetExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Get details for a single runtime threat activity by ID",
        },
      },
    },

    // 7. appsec_security_event
    {
      resourceType: "appsec_security_event",
      displayName: "AppSec Security Event & Explorer",
      description:
        "Security event explorer (`explore` query) for DOMAIN_EVENT (security events & APIs under threat), " +
        "PROTECTION_SPAN (threat requests), APPLICATION_ASSET (AI asset distribution), and SPAN (AI/GenAI traffic).",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["event_id"],
      listFilterFields: [
        {
          name: "scope",
          description: "Explorer scope (default: DOMAIN_EVENT)",
          enum: ["DOMAIN_EVENT", "PROTECTION_SPAN", "APPLICATION_ASSET", "SPAN"],
        },
        {
          name: "mode",
          description: "Preset mode for common explorer workflows",
          enum: ["events", "apis_under_threat", "ai_assets", "ai_traffic"],
        },
        { name: "environment", description: "Filter by environment" },
        { name: "service_name", description: "Filter by service name" },
        { name: "api_id", description: "Filter by API endpoint ID" },
        { name: "actor_id", description: "Filter by actor ID" },
        { name: "ip_address", description: "Filter by client IP address" },
        { name: "is_gen_ai", description: "For SPAN scope: filter GenAI traffic", type: "boolean" },
        { name: "group_by", description: "Comma-separated field keys to group and count by (e.g. 'apiId,apiName')" },
        ...TIME_WINDOW_FILTER_FIELDS,
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildExploreListBody,
          responseExtractor: appsecExploreListExtract,
          skipCompact: true,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Explore security events, APIs under threat, AI asset distributions, or GenAI traffic spans",
        },
      },
    },

    // 8. appsec_ast_scan
    {
      resourceType: "appsec_ast_scan",
      displayName: "AppSec AST Scan",
      description:
        "API Security Testing (AST) scan suites, scan runs, API coverage (`searchAst`), and authentication hook tests (`getAstHookTests`).",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["suite_id"],
      listFilterFields: [
        {
          name: "data_source",
          description: "AST data source: SCANS (scan suites/runs) or API_COVERAGE (per-endpoint test coverage)",
          enum: ["SCANS", "API_COVERAGE"],
        },
        { name: "suite_id", description: "Filter to a specific scan suite ID" },
        { name: "suite_name", description: "Filter to a specific scan suite name" },
        { name: "scan_id", description: "Filter to a specific scan ID (e.g. from API lastScanId)" },
        { name: "scan_run_number", description: "Filter to a specific scan run number", type: "number" },
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildAstScanListBody,
          responseExtractor: appsecAstScanListExtract,
          skipCompact: true,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List AST scan suites, scan runs for a suite, or API test coverage for a scan run",
        },
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildAstScanGetBody,
          responseExtractor: appsecAstScanGetExtract,
          paramsSchema: {
            fields: [
              { name: "suite_id", required: false, description: "Scan suite ID (passed via resource_id)" },
              { name: "hook_id", required: false, description: "AST authentication hook test ID (fetches hookScript)" },
            ],
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Get recent scan runs for a suite_id, or fetch AST auth hook script when hook_id is provided",
        },
      },
    },

    // 9. appsec_inventory_trend
    {
      resourceType: "appsec_inventory_trend",
      displayName: "AppSec Inventory & Vulnerability Trend",
      description:
        "Historical point-in-time counts ('how many APIs/vulnerabilities N days ago') and daily/weekly trend series. " +
        "Automatically fetches current count, queries ACTIVITY_EVENT changes via submitAnalyticsQueryBatch, and computes backward daily counts.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: [],
      listFilterFields: [
        {
          name: "trend_type",
          description: "Type of trend to calculate",
          enum: ["apis", "vulnerabilities"],
          required: true,
        },
        {
          name: "period_days",
          description: "Number of days to look back (default 7; max 30 for daily, max 90 for weekly)",
          type: "number",
        },
        {
          name: "severity",
          description: "Optional severity filter when trend_type='vulnerabilities' (e.g. CRITICAL, HIGH)",
        },
        {
          name: "application_group_ids",
          description: "Optional application group ID filter when trend_type='apis'",
        },
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          preflight: fetchTrendCurrentCountPreflight,
          bodyBuilder: buildInventoryTrendBody,
          responseExtractor: appsecTrendListExtract,
          skipCompact: true,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Compute historical count N days ago and daily/weekly trend series for APIs or vulnerabilities",
        },
      },
    },

    // 10. appsec_datatype
    {
      resourceType: "appsec_datatype",
      displayName: "AppSec Sensitive Data Type",
      description:
        "Sensitive data type (PII) definitions (`dataTypes`). Supports category expansion (e.g. 'Financial Information', " +
        "'Personal Identification', 'Contact Information', 'Authentication Credentials') and fuzzy name or exact ID lookup.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["datatype_id"],
      listFilterFields: [
        {
          name: "names",
          description:
            "Comma-separated datatype or category names (e.g. 'Financial Information,SSN,Credit Card,Email')",
        },
        { name: "ids", description: "Comma-separated datatype UUIDs" },
        { name: "sensitivity", description: "Filter by sensitivity level", enum: ["HIGH", "MEDIUM", "LOW"] },
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildDatatypesBody,
          responseExtractor: appsecDatatypesListExtract,
          skipCompact: true,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List or search sensitive data types by category/name, IDs, or sensitivity",
        },
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildDatatypesBody,
          responseExtractor: appsecDatatypeGetExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Get details for a single sensitive data type by datatype_id",
        },
      },
    },

    // 11. appsec_fraud_policy
    {
      resourceType: "appsec_fraud_policy",
      displayName: "AppSec Fraud Policy",
      description:
        "Custom entity-graph SQL fraud detection policy (`CreateFraudPolicy` mutation). Created in disabled state (`disabled: true`) by default.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["policy_id"],
      operations: {
        create: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyWrapperKey: "variables",
          skipScopeBodyInjection: true,
          bodyBuilder: buildFraudPolicyCreateBody,
          responseExtractor: appsecFraudPolicyCreateExtract,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          description: "Create a custom fraud detection policy backed by an entity-graph SQL query",
          bodySchema: {
            description: "Fraud policy creation payload",
            fields: [
              { name: "policy_name", type: "string", required: true, description: "Name for the fraud policy" },
              { name: "description", type: "string", required: true, description: "Description of what the policy detects" },
              { name: "sql_query", type: "string", required: true, description: "Entity-graph SELECT SQL query for the fraud rule" },
              { name: "api_id", type: "string", required: true, description: "Target API endpoint ID" },
              {
                name: "associated_event_derivation_config_id",
                type: "string",
                required: false,
                description: "Optional derivation config ID created via appsec_derivation_config",
              },
            ],
          },
        },
      },
    },

    // 12. appsec_derivation_config
    {
      resourceType: "appsec_derivation_config",
      displayName: "AppSec Event Derivation Config",
      description:
        "JEXL-based event derivation configuration (`CreateDerivationConfig` mutation) that extracts custom attributes from API spans.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["derivation_config_id"],
      operations: {
        create: {
          method: "POST",
          path: GRAPHQL_PATH,
          skipScopeBodyInjection: true,
          bodyBuilder: buildDerivationConfigCreateBody,
          responseExtractor: appsecDerivationConfigCreateExtract,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          description: "Create an event derivation config from structured JEXL features (or legacy JEXLExpressions XML)",
          bodySchema: {
            description: "Event derivation configuration payload",
            fields: [
              { name: "api_id", type: "string", required: false, description: "Target API endpoint ID (required)" },
              {
                name: "features",
                type: "array",
                required: false,
                description: "Array of JEXL feature definitions: [{ name (snake_case), expression, explanation, type }]",
                itemType: "object",
              },
              {
                name: "jexl_expressions_xml",
                type: "string",
                required: false,
                description: "Optional legacy <JEXLExpressions><Feature name=\"...\"> XML string (alternative to features array)",
              },
            ],
          },
        },
      },
    },

    // 13. appsec_query
    {
      resourceType: "appsec_query",
      displayName: "AppSec GraphQL & Trino Query",
      description:
        "Read-only escape hatch for custom Traceable GraphQL queries and tenant-scoped Trino SQL queries. " +
        "Use `get` with resource_id set to a query name (entities, vulnerabilitiesV3, explore, threatActivity, searchAst, " +
        "submitAnalyticsQueryBatch, getAstHookTests) to inspect templates, and `execute` with action='graphql' or action='trino' to run.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["query_name"],
      executeHint:
        "1. Prefer structured resources (appsec_api, appsec_vulnerability, appsec_threat_activity, appsec_security_event, appsec_ast_scan, appsec_inventory_trend) first. " +
        "2. For custom GraphQL: harness_get(resource_type='appsec_query', resource_id='entities') to view template, then harness_execute(resource_type='appsec_query', action='graphql', body={query: '...', variables: {}}). " +
        "3. For Trino SQL: harness_execute(resource_type='appsec_query', action='trino', body={sql_query: 'SELECT ...', limit: 100}).",
      operations: {
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildQueryTemplateGetBody,
          responseExtractor: appsecGraphqlQueryExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Get the GraphQL query template and required syntax rules for a query_name",
        },
      },
      executeActions: {
        graphql: {
          method: "POST",
          path: GRAPHQL_PATH,
          skipScopeBodyInjection: true,
          bodyBuilder: buildRawGraphqlExecuteBody,
          responseExtractor: appsecGraphqlQueryExtract,
          operationPolicy: { risk: "read", retryPolicy: "do_not_retry" },
          actionDescription:
            "Execute a read-only Traceable GraphQL query. Mutations (other than submitAnalyticsQueryBatch) are rejected.",
          description: "Execute a read-only AppSec GraphQL query",
          bodySchema: {
            description: "GraphQL query execution payload",
            fields: [
              { name: "query", type: "string", required: true, description: "GraphQL query string" },
              { name: "variables", type: "object", required: false, description: "Optional GraphQL variables object (max 100KB)" },
              { name: "operation_name", type: "string", required: false, description: "Optional GraphQL operation name" },
            ],
          },
        },
        trino: {
          method: "POST",
          path: TRINO_PATH,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Trino-User": "appsec-mcp",
            "X-Trino-Source": "appsec-mcp",
            "X-Trino-Catalog": "iceberg",
          },
          skipScopeBodyInjection: true,
          bodyBuilder: buildTrinoExecuteBody,
          responseExtractor: appsecTrinoQueryExtract,
          operationPolicy: { risk: "read", retryPolicy: "do_not_retry" },
          actionDescription:
            "Execute a single read-only Trino SQL statement (SELECT, SHOW TABLES, SHOW COLUMNS, DESCRIBE) against the iceberg catalog.",
          description: "Execute a read-only Trino SQL query",
          bodySchema: {
            description: "Trino SQL query payload",
            fields: [
              { name: "sql_query", type: "string", required: true, description: "Read-only SQL statement (SELECT / SHOW / DESCRIBE)" },
              { name: "limit", type: "number", required: false, description: "Maximum rows to return (default 1000, max 5000)" },
            ],
          },
        },
      },
    },
  ],
};
