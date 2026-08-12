/**
 * Unit tests for CCM GraphQL response extractors.
 * Guards against envelope leakage and wrong {items,total} projection shapes.
 */
import { describe, it, expect } from "vitest";
import {
  ccmViewsExtract,
  ccmBreakdownExtract,
  ccmTimeseriesExtract,
  ccmSummaryExtract,
  ccmRecommendationsExtract,
  countExtract,
} from "../../src/registry/extractors.js";
import { Registry } from "../../src/registry/index.js";
import { compactItems } from "../../src/utils/compact.js";
import type { Config } from "../../src/config.js";

function makeCcmConfig(): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "info",
    HARNESS_TOOLSETS: "ccm",
  } as Config;
}

describe("countExtract", () => {
  it("extracts numeric data from NG envelope", () => {
    expect(countExtract({ data: 42 })).toEqual({ count: 42 });
  });

  it("extracts numeric raw value when envelope is absent", () => {
    expect(countExtract(7)).toEqual({ count: 7 });
  });

  it("returns _error when data is not a number", () => {
    expect(countExtract({ data: "not-a-number" })).toEqual({
      count: 0,
      _error: "Unexpected response shape — data is not a number",
    });
  });
});

describe("ccmViewsExtract", () => {
  it("maps views and totalCount to items/total", () => {
    const raw = {
      data: {
        views: [{ id: "v1", name: "Production" }],
        totalCount: 1,
      },
    };
    expect(ccmViewsExtract(raw)).toEqual({
      items: [{ id: "v1", name: "Production" }],
      total: 1,
    });
  });

  it("returns empty defaults when data is missing", () => {
    expect(ccmViewsExtract({})).toEqual({ items: [], total: 0 });
  });
});

describe("ccmBreakdownExtract", () => {
  it("maps perspectiveGrid.data and perspectiveTotalCount", () => {
    const raw = {
      data: {
        perspectiveGrid: { data: [{ cost: 100, label: "compute" }] },
        perspectiveTotalCount: 42,
      },
    };
    expect(ccmBreakdownExtract(raw)).toEqual({
      items: [{ cost: 100, label: "compute" }],
      total: 42,
    });
  });

  it("returns empty defaults when nested fields are absent", () => {
    expect(ccmBreakdownExtract({ data: {} })).toEqual({ items: [], total: 0 });
  });
});

describe("ccmTimeseriesExtract", () => {
  it("returns stats array from perspectiveTimeSeriesStats", () => {
    const stats = [{ timestamp: 1, cost: 50 }];
    const raw = { data: { perspectiveTimeSeriesStats: { stats } } };
    expect(ccmTimeseriesExtract(raw)).toEqual(stats);
  });

  it("returns empty array when stats are missing", () => {
    expect(ccmTimeseriesExtract({})).toEqual([]);
  });
});

describe("ccmSummaryExtract", () => {
  it("returns ccmMetaData directly for metadata queries", () => {
    const meta = { currency: "USD", lastUpdated: "2026-01-01" };
    const raw = { data: { ccmMetaData: meta, perspectiveTrendStats: { ignored: true } } };
    expect(ccmSummaryExtract(raw)).toEqual(meta);
  });

  it("returns trendStats and forecastCost for perspective summary queries", () => {
    const raw = {
      data: {
        perspectiveTrendStats: { totalCost: 1000 },
        perspectiveForecastCost: { nextMonth: 1100 },
      },
    };
    expect(ccmSummaryExtract(raw)).toEqual({
      trendStats: { totalCost: 1000 },
      forecastCost: { nextMonth: 1100 },
    });
  });

  it("passes through raw when data envelope is absent", () => {
    const raw = { status: "ERROR" };
    expect(ccmSummaryExtract(raw)).toBe(raw);
  });
});

describe("ccmRecommendationsExtract", () => {
  it("maps recommendationsV2.items and recommendationStatsV2", () => {
    const raw = {
      data: {
        recommendationsV2: { items: [{ id: "rec-1", savings: 200 }] },
        recommendationStatsV2: { totalSavings: 200 },
      },
    };
    expect(ccmRecommendationsExtract(raw)).toEqual({
      items: [{ id: "rec-1", savings: 200 }],
      stats: { totalSavings: 200 },
    });
  });

  it("returns empty items and undefined stats when data is missing", () => {
    expect(ccmRecommendationsExtract({})).toEqual({ items: [], stats: undefined });
  });
});

describe("cost_timeseries compactItem", () => {
  // A perspectiveTimeSeriesStats data point: { time, values: [{ key: {id,name,type}, value }] }.
  // None of these keys match the generic compaction whitelist, so without a
  // resource-specific compactItem each stat is stripped to `{}` (regression:
  // the AI cost chart returned [{},{},...]).
  const stat = {
    time: 1783468800000,
    values: [
      { key: { id: "ANTHROPIC", name: "Anthropic", type: "", __typename: "Ref" }, value: 696.18, __typename: "DataPoint" },
    ],
    __typename: "TimeSeriesDataPoints",
  };

  it("cost_timeseries resource exposes a compactItem function", () => {
    const registry = new Registry(makeCcmConfig());
    const resource = registry.getResource("cost_timeseries");
    expect(typeof resource.compactItem).toBe("function");
  });

  it("preserves time and values (with slimmed keys) instead of stripping to {}", () => {
    const registry = new Registry(makeCcmConfig());
    const compactFn = registry.getResource("cost_timeseries").compactItem;
    const [compacted] = compactItems([stat], compactFn) as Record<string, unknown>[];
    expect(compacted).toEqual({
      time: 1783468800000,
      values: [{ key: { id: "ANTHROPIC", name: "Anthropic", type: "" }, value: 696.18 }],
    });
  });

  it("would be stripped to {} without the compactItem (documents why it's needed)", () => {
    const [stripped] = compactItems([stat]) as Record<string, unknown>[];
    expect(stripped).toEqual({});
  });

  it("tolerates malformed stats without throwing", () => {
    const registry = new Registry(makeCcmConfig());
    const compactFn = registry.getResource("cost_timeseries").compactItem!;
    expect(compactFn({})).toEqual({});
    expect(compactFn({ time: 1, values: "not-an-array" })).toEqual({ time: 1 });
    expect(compactFn({ values: [null, 42, { value: 5 }] })).toEqual({ values: [null, 42, { value: 5 }] });
  });
});
