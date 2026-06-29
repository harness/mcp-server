import { describe, it, expect } from "vitest";
import goldenCases from "../fixtures/search-routing-golden.json" with { type: "json" };
import { ALL_TOOLSET_NAMES, Registry } from "../../src/registry/index.js";
import {
  evaluateRouting,
  evaluateRoutingCase,
  validateGoldenCases,
  type SearchRoutingGoldenCase,
} from "../../src/search/routing-eval.js";

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    HARNESS_API_KEY: "pat.test.token.secret",
    HARNESS_ACCOUNT_ID: "test",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "error",
    ...overrides,
  };
}

describe("search routing golden fixture", () => {
  it("contains only known resource types from the all-toolsets registry", () => {
    const defaultRegistry = new Registry(makeConfig() as never);
    const defaultNames = new Set(defaultRegistry.getAllToolsets().map((toolset) => toolset.name));
    const additiveToolsets = ALL_TOOLSET_NAMES
      .filter((name) => !defaultNames.has(name))
      .map((name) => `+${name}`)
      .join(",");
    const registry = new Registry(makeConfig({
      ...(additiveToolsets ? { HARNESS_TOOLSETS: additiveToolsets } : {}),
    }) as never);

    const errors = validateGoldenCases(
      goldenCases as SearchRoutingGoldenCase[],
      registry.getAllResourceTypes(),
    );

    expect(errors).toEqual([]);
  });
});

describe("validateGoldenCases", () => {
  it("reports duplicate ids and unknown resource types", () => {
    const errors = validateGoldenCases([
      {
        id: "duplicate",
        query: "known query",
        mode: "specific",
        expectedTypes: ["pipeline"],
      },
      {
        id: "duplicate",
        query: "unknown query",
        mode: "specific",
        expectedTypes: ["missing_type"],
      },
    ], ["pipeline"]);

    expect(errors).toContain("Duplicate golden case id: duplicate");
    expect(errors).toContain('duplicate: unknown resource type "missing_type"');
  });

  it("reports missing query, invalid mode, and empty expectedTypes", () => {
    const errors = validateGoldenCases([
      {
        id: "no-query",
        query: "",
        mode: "specific",
        expectedTypes: ["pipeline"],
      },
      {
        id: "bad-mode",
        query: "list secrets",
        mode: "invalid" as "specific",
        expectedTypes: ["secret"],
      },
      {
        id: "no-types",
        query: "list secrets",
        mode: "specific",
        expectedTypes: [],
      },
    ], ["pipeline", "secret"]);

    expect(errors).toContain("no-query: query is required");
    expect(errors).toContain("bad-mode: invalid mode invalid");
    expect(errors).toContain("no-types: expectedTypes must contain at least one resource type");
  });
});

describe("evaluateRoutingCase", () => {
  it("passes a specific case when every expected type is routed", () => {
    const result = evaluateRoutingCase({
      id: "pipeline",
      query: "create pipeline",
      mode: "specific",
      expectedTypes: ["pipeline"],
      acceptableTypes: ["template"],
      routedTypes: ["pipeline", "template"],
      semanticRouted: true,
      searchedTypes: 2,
      candidateTypes: 10,
      topScore: 0.8,
      latencyMs: 12,
    });

    expect(result.passed).toBe(true);
    expect(result.expectedRecall).toBe(1);
    expect(result.extraRoutedTypes).toEqual([]);
  });

  it("fails a specific case when an expected type is missing", () => {
    const result = evaluateRoutingCase({
      id: "secret",
      query: "github secret",
      mode: "specific",
      expectedTypes: ["secret"],
      acceptableTypes: ["connector"],
      routedTypes: ["connector"],
      semanticRouted: true,
      searchedTypes: 1,
      candidateTypes: 10,
      topScore: 0.8,
      latencyMs: 12,
    });

    expect(result.passed).toBe(false);
    expect(result.missingExpectedTypes).toEqual(["secret"]);
    expect(result.expectedRecall).toBe(0);
  });

  it("passes an ambiguous case when semantic routing falls back", () => {
    const result = evaluateRoutingCase({
      id: "ambiguous",
      query: "prod deployment",
      mode: "ambiguous",
      expectedTypes: ["pipeline", "environment"],
      acceptableTypes: ["service"],
      routedTypes: [],
      semanticRouted: false,
      searchedTypes: 10,
      candidateTypes: 10,
      topScore: 0.2,
      latencyMs: 12,
    });

    expect(result.passed).toBe(true);
    expect(result.missingExpectedTypes).toEqual(["pipeline", "environment"]);
  });

  it("fails a cross_domain case when any expected type is missing", () => {
    const result = evaluateRoutingCase({
      id: "cross_domain",
      query: "deploy service to production",
      mode: "cross_domain",
      expectedTypes: ["pipeline", "service", "environment"],
      acceptableTypes: ["connector"],
      routedTypes: ["pipeline", "service"],
      semanticRouted: true,
      searchedTypes: 2,
      candidateTypes: 10,
      topScore: 0.7,
      latencyMs: 15,
    });

    expect(result.passed).toBe(false);
    expect(result.missingExpectedTypes).toEqual(["environment"]);
    expect(result.expectedRecall).toBeCloseTo(2 / 3);
  });

  it("passes a cross_domain case when every expected type is routed", () => {
    const result = evaluateRoutingCase({
      id: "cross_domain_ok",
      query: "deploy service to production",
      mode: "cross_domain",
      expectedTypes: ["pipeline", "service"],
      acceptableTypes: ["environment"],
      routedTypes: ["pipeline", "service", "environment"],
      semanticRouted: true,
      searchedTypes: 3,
      candidateTypes: 10,
      topScore: 0.75,
      latencyMs: 18,
    });

    expect(result.passed).toBe(true);
    expect(result.extraRoutedTypes).toEqual([]);
  });
});

describe("evaluateRouting", () => {
  it("aggregates recall, false negatives, routed count, and latency", () => {
    const evaluation = evaluateRouting([
      {
        id: "one",
        query: "pipeline",
        mode: "specific",
        expectedTypes: ["pipeline"],
        acceptableTypes: [],
        routedTypes: ["pipeline"],
        semanticRouted: true,
        searchedTypes: 1,
        candidateTypes: 4,
        topScore: 0.8,
        latencyMs: 10,
      },
      {
        id: "two",
        query: "secret",
        mode: "specific",
        expectedTypes: ["secret"],
        acceptableTypes: [],
        routedTypes: ["connector"],
        semanticRouted: true,
        searchedTypes: 1,
        candidateTypes: 4,
        topScore: 0.6,
        latencyMs: 30,
      },
    ]);

    expect(evaluation.summary.totalCases).toBe(2);
    expect(evaluation.summary.passedCases).toBe(1);
    expect(evaluation.summary.failedCases).toBe(1);
    expect(evaluation.summary.expectedTypeRecall).toBe(0.5);
    expect(evaluation.summary.falseNegativeCount).toBe(1);
    expect(evaluation.summary.averageRoutedTypes).toBe(1);
    expect(evaluation.summary.averageSearchedTypes).toBe(1);
    expect(evaluation.summary.averageLatencyMs).toBe(20);
    expect(evaluation.summary.averageTopScore).toBe(0.7);
  });
});
