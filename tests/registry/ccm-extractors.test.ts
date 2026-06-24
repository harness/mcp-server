import { describe, it, expect } from "vitest";
import {
  ccmViewsExtract,
  ccmBreakdownExtract,
  ccmTimeseriesExtract,
  ccmSummaryExtract,
  ccmRecommendationsExtract,
} from "../../src/registry/extractors.js";

describe("ccmViewsExtract", () => {
  it("maps views and totalCount to items and total", () => {
    const raw = {
      data: {
        views: [{ id: "v1", name: "AWS" }],
        totalCount: 42,
      },
    };
    expect(ccmViewsExtract(raw)).toEqual({
      items: [{ id: "v1", name: "AWS" }],
      total: 42,
    });
  });

  it("defaults missing envelope fields to empty array and zero", () => {
    expect(ccmViewsExtract({})).toEqual({ items: [], total: 0 });
    expect(ccmViewsExtract({ data: {} })).toEqual({ items: [], total: 0 });
  });
});

describe("ccmBreakdownExtract", () => {
  it("maps perspectiveGrid.data and perspectiveTotalCount", () => {
    const raw = {
      data: {
        perspectiveGrid: { data: [{ cost: 100 }] },
        perspectiveTotalCount: 7,
      },
    };
    expect(ccmBreakdownExtract(raw)).toEqual({
      items: [{ cost: 100 }],
      total: 7,
    });
  });

  it("defaults missing fields safely", () => {
    expect(ccmBreakdownExtract({})).toEqual({ items: [], total: 0 });
  });
});

describe("ccmTimeseriesExtract", () => {
  it("returns stats array from perspectiveTimeSeriesStats", () => {
    const stats = [{ date: "2026-01-01", cost: 50 }];
    const raw = { data: { perspectiveTimeSeriesStats: { stats } } };
    expect(ccmTimeseriesExtract(raw)).toEqual(stats);
  });

  it("returns empty array when stats missing", () => {
    expect(ccmTimeseriesExtract({})).toEqual([]);
    expect(ccmTimeseriesExtract({ data: {} })).toEqual([]);
  });
});

describe("ccmSummaryExtract", () => {
  it("returns ccmMetaData directly when present", () => {
    const meta = { currency: "USD", lastUpdated: "2026-01-01" };
    expect(ccmSummaryExtract({ data: { ccmMetaData: meta } })).toEqual(meta);
  });

  it("returns trendStats and forecastCost for perspective summary queries", () => {
    const raw = {
      data: {
        perspectiveTrendStats: { trend: "up" },
        perspectiveForecastCost: { amount: 1000 },
      },
    };
    expect(ccmSummaryExtract(raw)).toEqual({
      trendStats: { trend: "up" },
      forecastCost: { amount: 1000 },
    });
  });

  it("passes through raw when data envelope is absent", () => {
    const raw = { unexpected: true };
    expect(ccmSummaryExtract(raw)).toBe(raw);
  });
});

describe("ccmRecommendationsExtract", () => {
  it("maps recommendationsV2 items and recommendationStatsV2", () => {
    const items = [{ id: "rec-1", saving: 200 }];
    const stats = { totalSaving: 500 };
    const raw = {
      data: {
        recommendationsV2: { items },
        recommendationStatsV2: stats,
      },
    };
    expect(ccmRecommendationsExtract(raw)).toEqual({ items, stats });
  });

  it("defaults missing items to empty array", () => {
    expect(ccmRecommendationsExtract({})).toEqual({ items: [], stats: undefined });
  });
});
