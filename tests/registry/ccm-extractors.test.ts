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
  ccmBudgetListCompactExtract,
  ccmBudgetDetailExtract,
  countExtract,
} from "../../src/registry/extractors.js";

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

describe("ccmBudgetListCompactExtract", () => {
  it("maps summaries to compact items and totalCount to total", () => {
    const raw = {
      data: {
        summaries: [
          {
            uuid: "bud-1",
            name: "Q1 Prod",
            perspectiveName: "Production",
            budgetAmount: 1000,
            actualCost: 800,
            forecastCost: 950,
            alertThresholds: [{ emailAddresses: ["admin@example.com"] }],
            budgetMonthlyBreakdown: { budgetMonthlyAmount: [] },
          },
        ],
        totalCount: 1,
      },
    };
    expect(ccmBudgetListCompactExtract(raw)).toEqual({
      items: [
        {
          id: "bud-1",
          name: "Q1 Prod",
          perspectiveId: undefined,
          perspectiveName: "Production",
          budgetAmount: 1000,
          actualCost: 800,
          forecastCost: 950,
          timeLeft: undefined,
          timeUnit: undefined,
          period: undefined,
          type: undefined,
          growthRate: undefined,
          actualCostAlerts: undefined,
          forecastCostAlerts: undefined,
          budgetGroup: undefined,
          folderId: undefined,
        },
      ],
      total: 1,
    });
  });

  it("prefers uuid over id and falls back to pageExtract when summaries is empty", () => {
    const paged = {
      data: {
        content: [{ id: "bud-2", name: "Staging", budgetAmount: 500 }],
        totalElements: 3,
      },
    };
    expect(ccmBudgetListCompactExtract(paged)).toEqual({
      items: [{ id: "bud-2", name: "Staging", perspectiveId: undefined, perspectiveName: undefined, budgetAmount: 500, actualCost: undefined, forecastCost: undefined, timeLeft: undefined, timeUnit: undefined, period: undefined, type: undefined, growthRate: undefined, actualCostAlerts: undefined, forecastCostAlerts: undefined, budgetGroup: undefined, folderId: undefined }],
      total: 3,
    });
  });

  it("uses items.length as total when totalCount is absent", () => {
    const raw = { data: { summaries: [{ uuid: "a" }, { uuid: "b" }] } };
    expect(ccmBudgetListCompactExtract(raw).total).toBe(2);
  });

  it("passes through non-record summary entries unchanged", () => {
    const raw = { data: { summaries: ["bad-row"], totalCount: 1 } };
    expect(ccmBudgetListCompactExtract(raw)).toEqual({ items: ["bad-row"], total: 1 });
  });
});

describe("ccmBudgetDetailExtract", () => {
  it("derives ascending costData from budgetHistory and strips envelope fields", () => {
    const raw = {
      data: {
        uuid: "bud-1",
        name: "Q1 Prod",
        period: "MONTHLY",
        budgetAmount: 1000,
        forecastCost: 950,
        actualCost: 800,
        budgetHistory: {
          "1704067200000": {
            time: 1704067200000,
            endTime: 1706745600000,
            actualCost: 400,
            forecastCost: 450,
            budgeted: 500,
            budgetVariance: -100,
            budgetVariancePercentage: -20,
          },
          "1701388800000": {
            time: 1701388800000,
            endTime: 1704067200000,
            actualCost: 300,
            forecastCost: 350,
            budgeted: 500,
            budgetVariance: -200,
            budgetVariancePercentage: -40,
          },
        },
        alertThresholds: [{ emailAddresses: ["admin@example.com"] }],
      },
    };
    expect(ccmBudgetDetailExtract(raw)).toEqual({
      budgetId: "bud-1",
      name: "Q1 Prod",
      period: "MONTHLY",
      budgetAmount: 1000,
      forecastCost: 950,
      actualCost: 800,
      costData: [
        {
          time: 1701388800000,
          endTime: 1704067200000,
          actualCost: 300,
          forecastCost: 350,
          budgeted: 500,
          budgetVariance: -200,
          budgetVariancePercentage: -40,
        },
        {
          time: 1704067200000,
          endTime: 1706745600000,
          actualCost: 400,
          forecastCost: 450,
          budgeted: 500,
          budgetVariance: -100,
          budgetVariancePercentage: -20,
        },
      ],
    });
  });

  it("reads budgetGroupHistory and budgetGroupAmount for budget groups", () => {
    const raw = {
      data: {
        id: "grp-1",
        name: "Eng Group",
        period: "QUARTERLY",
        budgetGroupAmount: 5000,
        budgetGroupHistory: {
          "1": { time: 2, endTime: 3, actualCost: 100, forecastCost: 110, budgeted: 120, budgetVariance: -20, budgetVariancePercentage: -16.7 },
        },
      },
    };
    const result = ccmBudgetDetailExtract(raw) as { budgetAmount: number; costData: unknown[] };
    expect(result.budgetAmount).toBe(5000);
    expect(result.costData).toHaveLength(1);
  });

  it("returns empty costData when history is absent and accepts unwrapped payloads", () => {
    const raw = { uuid: "bud-3", name: "No History", period: "YEARLY" };
    expect(ccmBudgetDetailExtract(raw)).toEqual({
      budgetId: "bud-3",
      name: "No History",
      period: "YEARLY",
      budgetAmount: undefined,
      forecastCost: undefined,
      actualCost: undefined,
      costData: [],
    });
  });

  it("passes through non-record raw values unchanged", () => {
    expect(ccmBudgetDetailExtract(null)).toBeNull();
    expect(ccmBudgetDetailExtract("not-json")).toBe("not-json");
  });

  it("returns empty costData for error envelopes without history", () => {
    const raw = { status: "ERROR", message: "not found" };
    expect(ccmBudgetDetailExtract(raw)).toEqual({
      budgetId: undefined,
      name: undefined,
      period: undefined,
      budgetAmount: undefined,
      forecastCost: undefined,
      actualCost: undefined,
      costData: [],
    });
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
