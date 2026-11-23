import { encodePathSegment } from "../../utils/path.js";
import { isRecord } from "../../utils/type-guards.js";
import { HarnessApiError } from "../../utils/errors.js";
import { redactSensitiveFields } from "../../utils/redact.js";
import {
  APPSEC_DATATYPE_MAPPING,
  ONE_DAY_MS,
  TIME_FILTER_MS,
} from "./queries.js";

/**
 * Per-dispatch side-table keyed by the request `input` object identity.
 * Avoids mutating caller `input` with `_`-prefixed side-channel properties.
 */
export interface AppSecDispatchContext {
  uiUrl?: string;
  entityScope?: string;
  exploreScope?: string;
  durationMinutes?: number;
  appliedFilters?: Array<Record<string, unknown>>;
  enumKeys?: string[];
  currentCount?: number;
  periodDays?: number;
}

const dispatchContextMap = new WeakMap<object, AppSecDispatchContext>();

export function setAppSecDispatchContext(
  input: Record<string, unknown>,
  patch: Partial<AppSecDispatchContext>,
): void {
  const existing = dispatchContextMap.get(input) ?? {};
  dispatchContextMap.set(input, { ...existing, ...patch });
}

export function getAppSecDispatchContext(input?: Record<string, unknown>): AppSecDispatchContext {
  if (!input) return {};
  return dispatchContextMap.get(input) ?? {};
}

const DEFAULT_APPSEC_UI_URL = "https://app.traceable.ai";
const MAX_SPAN_BODY_CHARS = 2000;

const SENSITIVE_HEADER_PATTERN =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token|x-access-token|api-key|x-amz-security-token|x-csrf-token|x-xsrf-token)$/i;
const SENSITIVE_HEADER_SUBSTRING_PATTERN =
  /auth|token|secret|key|cookie|password|credential|session|jwt|bearer/i;

const APPSEC_ENTITY_SCOPE_TO_ID_PATH: Record<string, string> = {
  API: "inventory/endpoint",
  SERVICE: "inventory/service",
  BACKEND: "inventory/backend",
  DOMAIN: "inventory/domain",
  API_COVERAGE: "inventory/endpoint",
};

const APPSEC_SCOPE_TO_FILTER_PATH: Record<string, string> = {
  API: "inventory/api-endpoints",
  SERVICE: "inventory/services",
  BACKEND: "inventory/backends",
  DOMAIN: "inventory/domains",
  BACKEND_API: "third-party-apis",
  VULNERABILITY: "issues-v2",
  ACTOR: "attackers-v1",
  THREAT_ACTIVITIES: "threat-activity-v2",
  DOMAIN_EVENT: "security-events-explorer",
  API_UNDER_THREAT: "apis-under-threat",
};

const APPSEC_OPERATOR_MAP: Record<string, string> = {
  EQUALS: "_eq_",
  NOT_EQUALS: "_neq_",
  LESS_THAN: "_lt_",
  LESS_THAN_OR_EQUAL_TO: "_lte_",
  GREATER_THAN: "_gt_",
  GREATER_THAN_OR_EQUAL_TO: "_gte_",
  LIKE: "_lk_",
  IN: "_in_",
  CONTAINS: "_c_",
  NOT_IN: "_nin_",
  CONTAINS_KEY: "_ck_",
  NOT_CONTAINS_KEY: "_nck_",
  CONTAINS_KEY_LIKE: "_ckl_",
  EMPTY: "_is_empty",
  NOT_EMPTY: "_is_not_empty",
  BETWEEN: "_btw_",
};

function resolveAppSecUiBaseUrl(input?: Record<string, unknown>): string {
  const ctx = getAppSecDispatchContext(input);
  const custom = typeof ctx.uiUrl === "string" && ctx.uiUrl.trim()
    ? ctx.uiUrl.trim()
    : DEFAULT_APPSEC_UI_URL;
  return custom.replace(/\/+$/, "");
}

function resolveDurationMinutes(input?: Record<string, unknown>): number {
  const ctx = getAppSecDispatchContext(input);
  if (typeof ctx.durationMinutes === "number" && ctx.durationMinutes > 0) {
    return Math.round(ctx.durationMinutes);
  }
  const tf = typeof input?.time_filter === "string" ? TIME_FILTER_MS[input.time_filter.toUpperCase()] : undefined;
  return Math.max(1, Math.round((tf ?? ONE_DAY_MS) / 60_000));
}

function encodeAppSecRhsValue(rhs: unknown): string {
  if (Array.isArray(rhs)) {
    return rhs.map((item) => String(item).replace(/ /g, "%2520")).join("%252c");
  }
  return String(rhs).replace(/ /g, "%2520");
}

export function buildAppSecEntityUrl(
  scope: string,
  id: string,
  input?: Record<string, unknown>,
): string | undefined {
  if (!id) return undefined;
  const baseUrl = resolveAppSecUiBaseUrl(input);
  const durationMinutes = resolveDurationMinutes(input);

  const idPath = APPSEC_ENTITY_SCOPE_TO_ID_PATH[scope];
  if (idPath) {
    return `${baseUrl}/${idPath}/${encodePathSegment(id)}`;
  }
  if (scope === "ACTOR") {
    const encoded = Buffer.from(id, "utf8").toString("base64");
    return `${baseUrl}/attackers-v1?time=${durationMinutes}m&sheet=threat-actors-v1-sidesheet~${encoded}`;
  }
  if (scope === "THREAT_ACTIVITIES") {
    const encoded = Buffer.from(id, "utf8").toString("base64");
    return `${baseUrl}/threat-activity-v2?time=${durationMinutes}m&sheet=threat-activity-v2-detail~${encoded}`;
  }
  return undefined;
}

export function buildAppSecFilterUrl(
  scope: string,
  input?: Record<string, unknown>,
): string | undefined {
  const baseUrl = resolveAppSecUiBaseUrl(input);
  if (scope === "BACKEND_API") {
    return `${baseUrl}/third-party-apis`;
  }

  const ctx = getAppSecDispatchContext(input);
  const filters = Array.isArray(ctx.appliedFilters) ? ctx.appliedFilters : [];
  const durationMinutes = ctx.durationMinutes ? Math.round(ctx.durationMinutes) : undefined;

  const filterParts: string[] = [];
  if (
    durationMinutes &&
    (scope === "THREAT_ACTIVITIES" || scope === "DOMAIN_EVENT" || scope === "API_UNDER_THREAT" || scope === "VULNERABILITY")
  ) {
    filterParts.push(`time=${durationMinutes}m`);
  }

  for (const filter of filters) {
    const keyExpr = isRecord(filter.keyExpression) ? filter.keyExpression : undefined;
    const rawKey = typeof keyExpr?.key === "string"
      ? keyExpr.key
      : typeof filter.key === "string"
        ? filter.key
        : undefined;
    const operator = typeof filter.operator === "string" ? filter.operator : undefined;
    const value = filter.value;
    if (!rawKey || !operator || value === undefined || !(operator in APPSEC_OPERATOR_MAP)) continue;

    if (
      scope === "THREAT_ACTIVITIES" &&
      (rawKey === "ACTIVITY_STATUS" || rawKey === "LAST_SEEN_MILLIS" || rawKey === "START_TIME_MILLIS")
    ) {
      continue;
    }

    const rhs = encodeAppSecRhsValue(value);
    if (rawKey === "environment" && operator === "EQUALS") {
      filterParts.push(`env=${rhs}`);
    } else if (rawKey === "lastCalledMillis" || rawKey === "lastCalledTimestamp") {
      filterParts.push(`filter=lastCalledTime${APPSEC_OPERATOR_MAP[operator]}${rhs}`);
    } else {
      filterParts.push(`filter=${rawKey}${APPSEC_OPERATOR_MAP[operator]}${rhs}`);
    }
  }

  if (scope === "API_COVERAGE" || scope === "AST_SCAN" || scope === "SCANS") {
    const suiteId = typeof input?.suite_id === "string" ? input.suite_id : undefined;
    const basePath = suiteId
      ? scope === "API_COVERAGE"
        ? `api-testing-scans-v2/scan-v2/${encodePathSegment(suiteId)}/api-coverage`
        : `api-testing-scans-v2/scan-v2/${encodePathSegment(suiteId)}/scan-runs`
      : "api-testing-scans-v2";
    return filterParts.length > 0 ? `${baseUrl}/${basePath}?${filterParts.join("&")}` : `${baseUrl}/${basePath}`;
  }

  const path = APPSEC_SCOPE_TO_FILTER_PATH[scope];
  if (!path) return undefined;
  return filterParts.length > 0 ? `${baseUrl}/${path}?${filterParts.join("&")}` : `${baseUrl}/${path}`;
}

export function unwrapAppSecGraphql(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) {
    throw new HarnessApiError("Unexpected AppSec GraphQL response: expected JSON object", 502);
  }
  if (Array.isArray(raw.errors) && raw.errors.length > 0) {
    const messages = raw.errors
      .map((err) => (isRecord(err) && typeof err.message === "string" ? err.message : JSON.stringify(err)))
      .join("; ");
    throw new HarnessApiError(`AppSec GraphQL error: ${messages}`, 400);
  }
  if (typeof raw.error === "string" && raw.error.length > 0) {
    throw new HarnessApiError(raw.error, 400);
  }
  return isRecord(raw.data) ? raw.data : raw;
}

export function flattenAppSecResultRow(row: unknown): Record<string, unknown> {
  if (!isRecord(row)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    if (key === "__typename") continue;
    if (isRecord(val)) {
      if ("value" in val && Object.keys(val).every((k) => k === "value" || k === "type" || k === "__typename")) {
        out[key] = val.value;
        continue;
      }
      if (isRecord(val.sum) && "value" in val.sum) {
        out[key] = val.sum.value;
        continue;
      }
      if (isRecord(val.count) && "value" in val.count) {
        out[key] = val.count.value;
        continue;
      }
      if (isRecord(val.avg) && "value" in val.avg) {
        out[key] = val.avg.value;
        continue;
      }
    }
    out[key] = val;
  }
  return out;
}

/**
 * Per-resource compactItem projection for AppSec list resources.
 * Keeps already-projected domain fields while dropping bulky raw schema/pattern arrays in compact list mode.
 */
export function compactAppSecItem(item: Record<string, unknown>): Record<string, unknown> {
  const { entireUrlPaths: _p, entireUrlPatterns: _pt, schema: _s, ...rest } = item;
  return rest;
}

export function appsecEntitiesListExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const data = unwrapAppSecGraphql(raw);
  const entities = isRecord(data.entities) ? data.entities : {};
  const results = Array.isArray(entities.results) ? entities.results : [];
  const ctx = getAppSecDispatchContext(input);
  const scope = ctx.entityScope
    ?? (typeof input?.scope === "string" && input.scope.trim() ? input.scope.trim().toUpperCase() : "API");

  const items = results.map((entry) => {
    const flat = flattenAppSecResultRow(entry);
    const id = typeof flat.entityId === "string"
      ? flat.entityId
      : typeof flat.id === "string"
        ? flat.id
        : typeof flat.actorId === "string"
          ? flat.actorId
          : undefined;
    if (id && !flat.id) flat.id = id;
    const url = id ? buildAppSecEntityUrl(scope, id, input) : undefined;
    return url ? { ...flat, url } : flat;
  });

  const total = typeof entities.total === "number" ? entities.total : items.length;
  const filterUrl = buildAppSecFilterUrl(scope, input);
  return {
    items,
    total,
    scope,
    ...(filterUrl ? { filter_url: filterUrl } : {}),
  };
}

export function appsecEntityGetExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const list = appsecEntitiesListExtract(raw, input) as { items: Record<string, unknown>[] };
  if (!list.items || list.items.length === 0) {
    throw new HarnessApiError("AppSec entity not found", 404);
  }
  return list.items[0];
}

export function appsecApiSpecGetExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const data = unwrapAppSecGraphql(raw);
  const apiId = (input?.api_id ?? input?.resource_id ?? "") as string;
  const insight = isRecord(data.apiInsightByApiId) ? data.apiInsightByApiId : undefined;
  const rawDef = insight?.apiDefinition;
  const defObj = Array.isArray(rawDef)
    ? (isRecord(rawDef[0]) ? rawDef[0] : undefined)
    : isRecord(rawDef)
      ? rawDef
      : undefined;
  const definition = typeof defObj?.definition === "string" ? defObj.definition : undefined;
  if (!definition) {
    throw new HarnessApiError(`No OpenAPI specification found for API ID "${apiId}"`, 404);
  }
  return {
    api_id: apiId,
    definition,
    url: buildAppSecEntityUrl("API", apiId, input),
  };
}

function parseJsonOrString(raw: unknown): unknown {
  if (typeof raw !== "string") return raw ?? "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
}

function parseJsonRecord(raw: unknown): Record<string, string> {
  const parsed = parseJsonOrString(raw);
  if (!isRecord(parsed)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

function isSensitiveSpanHeader(headerName: string): boolean {
  const normalized = headerName.trim();
  return SENSITIVE_HEADER_PATTERN.test(normalized) || SENSITIVE_HEADER_SUBSTRING_PATTERN.test(normalized);
}

export function redactSpanHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = isSensitiveSpanHeader(k) ? "[REDACTED]" : v;
  }
  return out;
}

export function redactSpanCookies(cookies: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(cookies)) {
    out[k] = "[REDACTED]";
  }
  return out;
}

export function sanitizeAndBoundSpanBody(rawBody: unknown): unknown {
  const parsed = parseJsonOrString(rawBody);
  if (typeof parsed === "string") {
    return parsed.length > MAX_SPAN_BODY_CHARS
      ? `${parsed.slice(0, MAX_SPAN_BODY_CHARS)}...[truncated]`
      : parsed;
  }
  if (isRecord(parsed) || Array.isArray(parsed)) {
    const redacted = redactSensitiveFields(parsed);
    const serialized = JSON.stringify(redacted);
    if (serialized.length > MAX_SPAN_BODY_CHARS) {
      return `${serialized.slice(0, MAX_SPAN_BODY_CHARS)}...[truncated]`;
    }
    return redacted;
  }
  return parsed;
}

export function appsecApiSpansListExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const data = unwrapAppSecGraphql(raw);
  const apiId = (input?.api_id ?? input?.resource_id ?? "") as string;
  const batch = isRecord(data.submitAnalyticsQueryBatch) ? data.submitAnalyticsQueryBatch : {};
  const queryList = isRecord(batch.query_list) ? batch.query_list : {};
  const results = Array.isArray(queryList.results) ? queryList.results : [];

  const items = results.map((entry) => {
    const flat = flattenAppSecResultRow(entry);
    const spanId = String(flat.id ?? "");
    return {
      span_id: spanId,
      trace_id: String(flat.traceId ?? ""),
      api_id: String(flat.apiId ?? apiId),
      api_name: String(flat.apiName ?? ""),
      service_name: String(flat.serviceName ?? ""),
      status_code: flat.statusCode,
      ip_address: flat.ipAddress,
      user_identifier: flat.userIdentifier,
      session_id: flat.sessionId ? "[REDACTED]" : flat.sessionId,
      request_headers: redactSpanHeaders(parseJsonRecord(flat.spanRequestHeaders)),
      request_body: sanitizeAndBoundSpanBody(flat.spanRequestBody),
      request_cookies: redactSpanCookies(parseJsonRecord(flat.spanRequestCookies)),
      response_headers: redactSpanHeaders(parseJsonRecord(flat.spanResponseHeaders)),
      response_body: sanitizeAndBoundSpanBody(flat.spanResponseBody),
      response_cookies: redactSpanCookies(parseJsonRecord(flat.spanResponseCookies)),
      attributes: redactSpanHeaders(parseJsonRecord(flat.spanTags)),
      data_classification_matches: parseJsonOrString(flat.dataClassificationMatches),
    };
  });

  return {
    items,
    total: items.length,
    api_id: apiId,
  };
}

export function appsecVulnerabilitiesListExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const data = unwrapAppSecGraphql(raw);
  const vuln = isRecord(data.vulnerabilitiesV3) ? data.vulnerabilitiesV3 : {};
  const results = Array.isArray(vuln.results) ? vuln.results : [];
  const items = results.map((entry) => {
    const flat = flattenAppSecResultRow(entry);
    const id = typeof flat.VULNERABILITY_ID === "string"
      ? flat.VULNERABILITY_ID
      : typeof flat.id === "string"
        ? flat.id
        : undefined;
    return id && !flat.id ? { id, ...flat } : flat;
  });
  const total = typeof vuln.total === "number" ? vuln.total : items.length;
  const filterUrl = buildAppSecFilterUrl("VULNERABILITY", input);
  return {
    items,
    total,
    ...(filterUrl ? { filter_url: filterUrl } : {}),
  };
}

export function appsecVulnerabilityGetExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const list = appsecVulnerabilitiesListExtract(raw, input) as { items: Record<string, unknown>[]; filter_url?: string };
  if (!list.items || list.items.length === 0) {
    throw new HarnessApiError("Vulnerability not found", 404);
  }
  return {
    ...list.items[0],
    ...(list.filter_url ? { url: list.filter_url } : {}),
  };
}

export function appsecVulnEnumValuesExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const data = unwrapAppSecGraphql(raw);
  const ctx = getAppSecDispatchContext(input);
  const supportedValues: Record<string, { values: unknown[]; valueType: string }> = {};

  // Support legacy single vulnerabilitiesV3.results[0] shape
  if (isRecord(data.vulnerabilitiesV3) && Array.isArray(data.vulnerabilitiesV3.results)) {
    const first = isRecord(data.vulnerabilitiesV3.results[0]) ? data.vulnerabilitiesV3.results[0] : {};
    const keys = ctx.enumKeys ?? Object.keys(first);
    for (const key of keys) {
      const cell = first[key];
      if (isRecord(cell) && Array.isArray(cell.value)) {
        supportedValues[key] = { values: cell.value, valueType: "string" };
      }
    }
    return { supported_values: supportedValues };
  }

  // Fast aliased groupBy shape: data[key].results = [{ [key]: { value }, count: { value } }]
  const keys = ctx.enumKeys ?? Object.keys(data);
  for (const key of keys) {
    const bucket = data[key];
    if (!isRecord(bucket) || !Array.isArray(bucket.results)) continue;
    const values: unknown[] = [];
    for (const row of bucket.results) {
      if (!isRecord(row)) continue;
      const cell = row[key];
      if (isRecord(cell) && cell.value !== undefined && cell.value !== null) {
        values.push(cell.value);
      }
    }
    supportedValues[key] = { values, valueType: "string" };
  }
  return { supported_values: supportedValues };
}

export function appsecThreatActivityListExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const data = unwrapAppSecGraphql(raw);
  const threat = isRecord(data.threatActivity) ? data.threatActivity : {};
  const results = Array.isArray(threat.results) ? threat.results : [];
  const items = results.map((entry) => {
    const flat = flattenAppSecResultRow(entry);
    const id = typeof flat.ID === "string"
      ? flat.ID
      : typeof flat.id === "string"
        ? flat.id
        : undefined;
    const url = id ? buildAppSecEntityUrl("THREAT_ACTIVITIES", id, input) : undefined;
    return {
      ...(id && !flat.id ? { id } : {}),
      ...flat,
      ...(url ? { url } : {}),
    };
  });
  const total = typeof threat.total === "number" ? threat.total : items.length;
  const filterUrl = buildAppSecFilterUrl("THREAT_ACTIVITIES", input);
  return {
    items,
    total,
    ...(filterUrl ? { filter_url: filterUrl } : {}),
  };
}

export function appsecThreatActivityGetExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const list = appsecThreatActivityListExtract(raw, input) as { items: Record<string, unknown>[] };
  if (!list.items || list.items.length === 0) {
    throw new HarnessApiError("Threat activity not found", 404);
  }
  return list.items[0];
}

export function appsecExploreListExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const data = unwrapAppSecGraphql(raw);
  const explore = isRecord(data.explore) ? data.explore : {};
  const results = Array.isArray(explore.results) ? explore.results : [];
  const items = results.map((entry) => flattenAppSecResultRow(entry));
  const total = typeof explore.total === "number" ? explore.total : items.length;
  const ctx = getAppSecDispatchContext(input);
  const exploreScope = ctx.exploreScope ?? "DOMAIN_EVENT";
  const urlScope = input?.mode === "apis_under_threat" ? "API_UNDER_THREAT" : exploreScope;
  const filterUrl = buildAppSecFilterUrl(urlScope, input);
  return {
    items,
    total,
    scope: exploreScope,
    ...(filterUrl ? { filter_url: filterUrl } : {}),
  };
}

export function appsecAstScanListExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const data = unwrapAppSecGraphql(raw);
  const searchAst = isRecord(data.searchAst) ? data.searchAst : {};
  const results = Array.isArray(searchAst.results) ? searchAst.results : [];
  const dataSource = typeof input?.data_source === "string" ? input.data_source : "SCANS";
  const items = results.map((entry) => {
    const flat = flattenAppSecResultRow(entry);
    const apiId = typeof flat.API_ID === "string" ? flat.API_ID : undefined;
    const url = dataSource === "API_COVERAGE" && apiId
      ? buildAppSecEntityUrl("API_COVERAGE", apiId, input)
      : undefined;
    return url ? { ...flat, url } : flat;
  });
  const total = typeof searchAst.total === "number" ? searchAst.total : items.length;
  const filterUrl = buildAppSecFilterUrl(dataSource === "API_COVERAGE" ? "API_COVERAGE" : "AST_SCAN", input);
  return {
    items,
    total,
    data_source: dataSource,
    ...(filterUrl ? { filter_url: filterUrl } : {}),
  };
}

export function appsecAstScanGetExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const data = unwrapAppSecGraphql(raw);
  if (data.getAstHookTests !== undefined) {
    return {
      hook_id: input?.hook_id ?? input?.suite_id ?? input?.resource_id,
      hook_tests: data.getAstHookTests,
    };
  }
  const list = appsecAstScanListExtract(raw, input) as { items: Record<string, unknown>[]; total: number; filter_url?: string };
  if (!list.items || list.items.length === 0) {
    throw new HarnessApiError("AST scan not found", 404);
  }
  return {
    suite_id: input?.suite_id ?? input?.resource_id,
    latest_run: list.items[0],
    runs: list.items,
    total: list.total,
    ...(list.filter_url ? { url: list.filter_url } : {}),
  };
}

function extractBatchEventCountsByDate(
  queryResult: unknown,
): { byDate: Record<string, number>; totalEvents: number } {
  const qr = isRecord(queryResult) ? queryResult : {};
  const results = Array.isArray(qr.results) ? qr.results : [];
  const byDate: Record<string, number> = {};
  let totalEvents = 0;

  for (const event of results) {
    if (!isRecord(event)) continue;
    let count = 0;
    for (const [key, val] of Object.entries(event)) {
      if (key === "intervalStart" || key === "__typename") continue;
      if (typeof val === "number") {
        count = val;
        break;
      }
      if (isRecord(val) && typeof val.value === "number") {
        count = val.value;
        break;
      }
    }
    totalEvents += count;
    if (typeof event.intervalStart === "string" && event.intervalStart.length >= 10) {
      const dateStr = event.intervalStart.slice(0, 10);
      byDate[dateStr] = (byDate[dateStr] ?? 0) + count;
    }
  }
  return { byDate, totalEvents };
}

export function appsecTrendListExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const data = unwrapAppSecGraphql(raw);
  const batch = isRecord(data.submitAnalyticsQueryBatch) ? data.submitAnalyticsQueryBatch : {};
  const ctx = getAppSecDispatchContext(input);
  const currentCount = typeof ctx.currentCount === "number" ? ctx.currentCount : 0;
  const periodDays = typeof ctx.periodDays === "number"
    ? ctx.periodDays
    : typeof input?.period_days === "number" && input.period_days > 0
      ? Math.min(input.period_days, 90)
      : 7;
  const trendType = typeof input?.trend_type === "string" ? input.trend_type : "apis";

  const openedStats = extractBatchEventCountsByDate(batch.opened_events);
  const closedStats = extractBatchEventCountsByDate(batch.closed_events);

  const countNDaysAgo = currentCount - openedStats.totalEvents + closedStats.totalEvents;

  const now = new Date();
  const currentUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const series: Array<{ date: string; count: number; opened: number; closed: number }> = [];
  let runningValue = currentCount;

  for (let day = 0; day < periodDays; day++) {
    const calcDate = new Date(currentUtcMidnight.getTime() - day * 86_400_000);
    const dateKey = calcDate.toISOString().slice(0, 10);
    const dayOpened = openedStats.byDate[dateKey] ?? 0;
    const dayClosed = closedStats.byDate[dateKey] ?? 0;

    if (day === 0) {
      series.push({ date: dateKey, count: runningValue, opened: dayOpened, closed: dayClosed });
    } else if (day === 1) {
      const todayKey = currentUtcMidnight.toISOString().slice(0, 10);
      const todayOpened = openedStats.byDate[todayKey] ?? 0;
      const todayClosed = closedStats.byDate[todayKey] ?? 0;
      const yesterdayCount = currentCount - todayOpened - dayOpened + todayClosed + dayClosed;
      runningValue = yesterdayCount;
      series.push({ date: dateKey, count: runningValue, opened: dayOpened, closed: dayClosed });
    } else {
      runningValue = runningValue - dayOpened + dayClosed;
      series.push({ date: dateKey, count: runningValue, opened: dayOpened, closed: dayClosed });
    }
  }

  return {
    trend_type: trendType,
    period_days: periodDays,
    current_count: currentCount,
    count_n_days_ago: countNDaysAgo,
    total_opened_or_discovered: openedStats.totalEvents,
    total_closed_or_deleted: closedStats.totalEvents,
    formula: `current(${currentCount}) - opened(${openedStats.totalEvents}) + closed(${closedStats.totalEvents}) = ${countNDaysAgo}`,
    items: series,
    total: series.length,
  };
}

export function appsecDatatypesListExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const data = unwrapAppSecGraphql(raw);
  const dtRoot = isRecord(data.dataTypes) ? data.dataTypes : {};
  const allEntries = (Array.isArray(dtRoot.results) ? dtRoot.results : []).filter(isRecord);

  const rawNames = input?.names;
  const names = Array.isArray(rawNames)
    ? rawNames.map(String)
    : typeof rawNames === "string" && rawNames.trim()
      ? rawNames.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  const rawIds = input?.ids;
  const ids = Array.isArray(rawIds)
    ? rawIds.map(String)
    : typeof rawIds === "string" && rawIds.trim()
      ? rawIds.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  const sensitivityFilter = typeof input?.sensitivity === "string" && input.sensitivity.trim()
    ? input.sensitivity.trim().toUpperCase()
    : undefined;

  let filtered = allEntries;

  if (ids.length > 0) {
    const idSet = new Set(ids);
    filtered = filtered.filter((entry) => typeof entry.id === "string" && idSet.has(entry.id));
  } else if (names.length > 0) {
    const matchedIds = new Set<string>();
    const matched: Record<string, unknown>[] = [];
    const nameToEntries = new Map<string, Record<string, unknown>[]>();
    for (const entry of allEntries) {
      const n = typeof entry.name === "string" ? entry.name : "";
      if (!nameToEntries.has(n)) nameToEntries.set(n, []);
      nameToEntries.get(n)!.push(entry);
    }

    const addEntry = (e: Record<string, unknown>) => {
      const key = typeof e.id === "string" ? e.id : JSON.stringify(e);
      if (!matchedIds.has(key)) {
        matchedIds.add(key);
        matched.push(e);
      }
    };

    for (const name of names) {
      const parts = name.toLowerCase().split(/\s+/).filter(Boolean);
      for (const [categoryKey, categoryValues] of Object.entries(APPSEC_DATATYPE_MAPPING)) {
        const catLower = categoryKey.toLowerCase();
        if (parts.some((p) => catLower.includes(p))) {
          for (const mappedName of categoryValues) {
            for (const e of nameToEntries.get(mappedName) ?? []) addEntry(e);
          }
        }
      }
      for (const [entryName, entries] of nameToEntries.entries()) {
        const entryLower = entryName.toLowerCase();
        if (parts.some((p) => entryLower.includes(p))) {
          for (const e of entries) addEntry(e);
        }
      }
    }
    filtered = matched;
  }

  if (sensitivityFilter) {
    filtered = filtered.filter(
      (entry) => typeof entry.sensitivity === "string" && entry.sensitivity.toUpperCase() === sensitivityFilter,
    );
  }

  const items = filtered.map((entry) => {
    const { __typename: _t, ...rest } = entry;
    return {
      ...rest,
      dataTypeId: entry.id,
    };
  });

  return {
    items,
    total: items.length,
  };
}

export function appsecDatatypeGetExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const id = (input?.datatype_id ?? input?.resource_id ?? "") as string;
  const list = appsecDatatypesListExtract(raw, { ...input, ids: [id] }) as { items: Record<string, unknown>[] };
  if (!list.items || list.items.length === 0) {
    throw new HarnessApiError(`AppSec datatype "${id}" not found`, 404);
  }
  return list.items[0];
}
