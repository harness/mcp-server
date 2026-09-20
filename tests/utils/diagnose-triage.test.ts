import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { classifyFailure, FAILURE_CATEGORIES } from "../../src/utils/diagnose-triage.js";
import { TypeSafeError } from "../../src/client/typesafe-client.js";
import * as typesafeClient from "../../src/client/typesafe-client.js";

const CFG = {
  HARNESS_DIAGNOSE_TRIAGE: true,
  HARNESS_DIAGNOSE_TRIAGE_MIN_CONFIDENCE: 0.6,
  HARNESS_DIAGNOSE_TRIAGE_TIMEOUT_MS: 400,
};

const BASE_INPUT = {
  stage: "build",
  step: "run_tests",
  failure_message: "connection refused",
};

describe("classifyFailure", () => {
  const originalKey = process.env.TYPESAFE_API_KEY;

  beforeEach(() => {
    process.env.TYPESAFE_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.TYPESAFE_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("triage disabled → undefined, classifier never called", async () => {
    const spy = vi.spyOn(typesafeClient, "classifyQuestion");
    const result = await classifyFailure(BASE_INPUT, { ...CFG, HARNESS_DIAGNOSE_TRIAGE: false });
    expect(result).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it("no TYPESAFE_API_KEY → undefined, classifier never called", async () => {
    delete process.env.TYPESAFE_API_KEY;
    const spy = vi.spyOn(typesafeClient, "classifyQuestion");
    const result = await classifyFailure(BASE_INPUT, CFG);
    expect(result).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  for (const category of FAILURE_CATEGORIES) {
    it(`confident classification into "${category}" → populated signal`, async () => {
      vi.spyOn(typesafeClient, "classifyQuestion").mockResolvedValue({
        choice: category,
        confidence: 0.9,
        legend: {},
      });
      const result = await classifyFailure(BASE_INPUT, CFG);
      expect(result).toEqual({
        category,
        confidence: 0.9,
        rationale: "build/run_tests failed: connection refused",
      });
    });
  }

  it("includes delegate in rationale when present", async () => {
    vi.spyOn(typesafeClient, "classifyQuestion").mockResolvedValue({
      choice: "infra_flake",
      confidence: 0.9,
      legend: {},
    });
    const result = await classifyFailure({ ...BASE_INPUT, delegate: "delegate-1" }, CFG);
    expect(result?.rationale).toBe("build/run_tests failed: connection refused (delegate: delegate-1)");
  });

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
