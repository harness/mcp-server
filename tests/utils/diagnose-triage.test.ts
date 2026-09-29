import { describe, it, expect, vi, afterEach } from "vitest";
import { classifyFailure, FAILURE_CATEGORIES, CATEGORY_DESCRIPTIONS } from "../../src/utils/diagnose-triage.js";
import { TypeSafeError } from "../../src/client/typesafe-client.js";
import * as typesafeClient from "../../src/client/typesafe-client.js";

const CFG = {
  HARNESS_DIAGNOSE_TRIAGE: true,
  HARNESS_DIAGNOSE_TRIAGE_MIN_CONFIDENCE: 0.6,
  HARNESS_DIAGNOSE_TRIAGE_TIMEOUT_MS: 400,
  TYPESAFE_API_KEY: "test-key",
};

const BASE_INPUT = {
  stage: "build",
  step: "run_tests",
  failure_message: "connection refused",
};

describe("classifyFailure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("triage disabled → undefined, classifier never called", async () => {
    const spy = vi.spyOn(typesafeClient, "classifyQuestion");
    const result = await classifyFailure(BASE_INPUT, { ...CFG, HARNESS_DIAGNOSE_TRIAGE: false });
    expect(result).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it("no TYPESAFE_API_KEY on Config → undefined, classifier never called", async () => {
    const spy = vi.spyOn(typesafeClient, "classifyQuestion");
    const { TYPESAFE_API_KEY: _unset, ...cfgWithoutKey } = CFG;
    const result = await classifyFailure(BASE_INPUT, cfgWithoutKey);
    expect(result).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it("sends the spec 010 rubric as the choice descriptions so the classifier sees definitions, not labels", async () => {
    const spy = vi.spyOn(typesafeClient, "classifyQuestion").mockResolvedValue({
      choice: "config_error",
      confidence: 0.9,
      legend: {},
    });
    await classifyFailure(BASE_INPUT, CFG);
    expect(spy).toHaveBeenCalledTimes(1);
    const question = spy.mock.calls[0]![1];
    expect(question.choices).toEqual([...FAILURE_CATEGORIES]);
    // Every category must carry its spec-010 definition.
    expect(question.descriptions).toEqual(CATEGORY_DESCRIPTIONS);
    expect(Object.keys(question.descriptions)).toHaveLength(FAILURE_CATEGORIES.length);
  });

  it("passes the TypeSafe base URL from Config", async () => {
    const spy = vi.spyOn(typesafeClient, "classifyQuestion").mockResolvedValue({
      choice: "infra_flake",
      confidence: 0.9,
      legend: {},
    });
    await classifyFailure(BASE_INPUT, { ...CFG, TYPESAFE_BASE_URL: "https://typesafe.example.com" });
    expect(spy.mock.calls[0]![0]).toEqual({
      apiKey: "test-key",
      baseUrl: "https://typesafe.example.com",
    });
  });

  for (const category of FAILURE_CATEGORIES) {
    it(`confident classification into "${category}" → {category, confidence} signal`, async () => {
      vi.spyOn(typesafeClient, "classifyQuestion").mockResolvedValue({
        choice: category,
        confidence: 0.9,
        legend: {},
      });
      const result = await classifyFailure(BASE_INPUT, CFG);
      expect(result).toEqual({ category, confidence: 0.9 });
    });
  }

  it("confidence below min_confidence → undefined", async () => {
    vi.spyOn(typesafeClient, "classifyQuestion").mockResolvedValue({
      choice: "infra_flake",
      confidence: 0.3,
      legend: {},
    });
    const result = await classifyFailure(BASE_INPUT, CFG);
    expect(result).toBeUndefined();
  });

  it("classifier throws → undefined, no exception propagates", async () => {
    vi.spyOn(typesafeClient, "classifyQuestion").mockRejectedValue(new TypeSafeError("boom"));
    const result = await classifyFailure(BASE_INPUT, CFG);
    expect(result).toBeUndefined();
  });

  it("classifier hangs past timeout → undefined, no exception propagates", async () => {
    vi.spyOn(typesafeClient, "classifyQuestion").mockImplementation(
      () => new Promise(() => {}),
    );
    const result = await classifyFailure(BASE_INPUT, { ...CFG, HARNESS_DIAGNOSE_TRIAGE_TIMEOUT_MS: 20 });
    expect(result).toBeUndefined();
  });
});