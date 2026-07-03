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
  anomalyListExtract,
} from "../../src/registry/extractors.js";

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

describe("anomalyListExtract", () => {
  it("maps data array to items/total for v2 anomaly list responses", () => {
    const raw = { data: [{ id: "anom-1" }, { id: "anom-2" }] };
    expect(anomalyListExtract(raw)).toEqual({
      items: [{ id: "anom-1" }, { id: "anom-2" }],
      total: 2,
    });
  });

  it("returns empty defaults when data is missing or not an array", () => {
    expect(anomalyListExtract({})).toEqual({ items: [], total: 0 });
    expect(anomalyListExtract({ data: "unexpected" })).toEqual({ items: [], total: 0 });
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
