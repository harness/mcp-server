/**
 * Shared response extractors for Harness API responses.
 * Used across all toolset definitions — eliminates per-file duplication.
 */
import { isRecord } from "../utils/type-guards.js";

/** Extract `data` from standard NG API responses: `{ status, data, ... }` */
export const ngExtract = (raw: unknown): unknown => {
  const r = raw as { data?: unknown };
  return r.data ?? raw;
};

/** Extract paginated content from NG API responses: `{ data: { content, totalElements } }` */
export const pageExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: { content?: unknown[]; totalElements?: number } };
  return {
    items: r.data?.content ?? [],
    total: r.data?.totalElements ?? 0,
  };
};

/** Pass-through extractor — returns raw response unchanged. Used for APIs that don't wrap in `data`. */
export const passthrough = (raw: unknown): unknown => raw;

/**
 * Factory for v1 list responses (bare arrays).
 * If `wrapperKey` is provided, each item is unwrapped: `{ project: {...} }` → `{...}`.
 * Total is derived from array length since response headers aren't accessible.
 */
export const v1ListExtract = (wrapperKey?: string) => (raw: unknown): { items: unknown[]; total: number } => {
  const arr = Array.isArray(raw) ? raw : [];
  const items = wrapperKey
    ? arr.map(item => (isRecord(item) && wrapperKey in item ? item[wrapperKey] : item))
    : arr;
  return { items, total: items.length };
};

/** Factory for v1 single-item responses that may be wrapped: `{ org: {...} }` → `{...}`. */
export const v1Unwrap = (wrapperKey: string) => (raw: unknown): unknown => {
  if (isRecord(raw) && wrapperKey in raw) {
    return raw[wrapperKey];
  }
  return raw;
};

/** Factory for GraphQL field extraction (used by CCM). */
export const gqlExtract = (field: string) => (raw: unknown): unknown => {
  const r = raw as { data?: Record<string, unknown> };
  return r.data?.[field] ?? raw;
};

/**
 * Extracts the runtime input template from the Harness pipeline template endpoint.
 * Unwraps `data.inputSetTemplateYaml`, `data.hasInputSets`, `data.modules`, and adds
 * a `_hint` field describing whether inputs are required.
 */
export const runtimeInputExtract = (raw: unknown): unknown => {
  const r = raw as { data?: { inputSetTemplateYaml?: string; hasInputSets?: boolean; modules?: string[] } };
  return {
    inputSetTemplateYaml: r.data?.inputSetTemplateYaml ?? null,
    hasInputSets: r.data?.hasInputSets ?? false,
    modules: r.data?.modules ?? [],
    _hint: r.data?.inputSetTemplateYaml
      ? "This YAML template shows all runtime inputs needed. Fields with '<+input>' are required. Pass matching key-value pairs to harness_execute(action='run', inputs={...})."
      : "This pipeline has no runtime inputs. You can execute it without providing any inputs.",
  };
};

/**
 * Extracts CCM cost breakdown data from GraphQL perspectiveGrid response.
 * Maps `data.perspectiveGrid.data` → `items` and `data.perspectiveTotalCount` → `total`.
 */
export const ccmBreakdownExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as {
    data?: {
      perspectiveGrid?: { data?: unknown[] };
      perspectiveTotalCount?: number;
    };
  };
  return {
    items: r.data?.perspectiveGrid?.data ?? [],
    total: r.data?.perspectiveTotalCount ?? 0,
  };
};

/**
 * Extracts CCM cost time series stats from GraphQL perspectiveTimeSeriesStats response.
 * Returns the `stats` array from `data.perspectiveTimeSeriesStats.stats`.
 */
export const ccmTimeseriesExtract = (raw: unknown): unknown => {
  const r = raw as {
    data?: { perspectiveTimeSeriesStats?: { stats?: unknown[] } };
  };
  return r.data?.perspectiveTimeSeriesStats?.stats ?? [];
};

/**
 * Extracts CCM cost summary from a dual-mode GraphQL response.
 * When `data.ccmMetaData` is present (metadata query), returns it directly.
 * Otherwise returns `{ trendStats, forecastCost }` for a perspective summary query.
 */
export const ccmSummaryExtract = (raw: unknown): unknown => {
  const r = raw as { data?: Record<string, unknown> };
  if (!r.data) return raw;
  if (r.data.ccmMetaData) return r.data.ccmMetaData;
  return {
    trendStats: r.data.perspectiveTrendStats,
    forecastCost: r.data.perspectiveForecastCost,
  };
};

/**
 * Extracts CCM perspective-scoped recommendations from GraphQL response.
 * Returns `{ items, stats }` from `data.recommendationsV2` and `data.recommendationStatsV2`.
 */
export const ccmRecommendationsExtract = (raw: unknown): { items: unknown[]; stats: unknown } => {
  const r = raw as {
    data?: {
      recommendationsV2?: { items?: unknown[] };
      recommendationStatsV2?: unknown;
    };
  };
  return {
    items: r.data?.recommendationsV2?.items ?? [],
    stats: r.data?.recommendationStatsV2,
  };
};
