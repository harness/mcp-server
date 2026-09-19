import { describe, it, expect, vi } from "vitest";
import { scoreEffectiveRisk } from "../../src/utils/risk-scoring.js";
import { RISK_SEVERITY } from "../../src/registry/types.js";
import type { OperationPolicy, RiskLevel, RiskScorer, RiskScoringContext, RiskSignal } from "../../src/registry/types.js";

const CFG = {
  HARNESS_DYNAMIC_RISK_SCORING: true,
  HARNESS_DYNAMIC_RISK_THRESHOLD: 0.5,
  HARNESS_DYNAMIC_RISK_MIN_CONFIDENCE: 0.6,
  HARNESS_DYNAMIC_RISK_TIMEOUT_MS: 400,
};

const BASE_POLICY: OperationPolicy = { risk: "destructive", riskFloor: "high_write", retryPolicy: "do_not_retry" };

const BASE_CTX: RiskScoringContext = {
  resourceType: "pipeline",
  operation: "delete",
  input: {},
  client: { account: "acc", getCurrentUserId: vi.fn(), request: vi.fn() },
};

function scorerReturning(signal: RiskSignal): RiskScorer {
  return async () => signal;
}

describe("scoreEffectiveRisk", () => {
  it("riskFloor unset → effectiveRisk === risk always, scorer never called", async () => {
    const scorer = vi.fn();
    const policy: OperationPolicy = { risk: "destructive", retryPolicy: "do_not_retry" };
    const result = await scoreEffectiveRisk(policy, scorer, BASE_CTX, CFG);
    expect(result.effectiveRisk).toBe("destructive");
    expect(result.scoring.status).toBe("skipped");
    expect(scorer).not.toHaveBeenCalled();
  });

  it("riskFloor set, scoring disabled → effectiveRisk === risk, status skipped", async () => {
    const scorer = vi.fn();
    const result = await scoreEffectiveRisk(BASE_POLICY, scorer, BASE_CTX, { ...CFG, HARNESS_DYNAMIC_RISK_SCORING: false });
    expect(result.effectiveRisk).toBe("destructive");
    expect(result.scoring.status).toBe("skipped");
    expect(scorer).not.toHaveBeenCalled();
  });

  it("scorer returns blastRadius < threshold, confidence >= min → effectiveRisk === riskFloor, status scored", async () => {
    const scorer = scorerReturning({ blastRadius: 0.1, confidence: 0.9, rationale: "never run" });
    const result = await scoreEffectiveRisk(BASE_POLICY, scorer, BASE_CTX, CFG);
    expect(result.effectiveRisk).toBe("high_write");
    expect(result.scoring.status).toBe("scored");
    expect(result.scoring.blastRadius).toBe(0.1);
    expect(result.scoring.rationale).toBe("never run");
  });

  it("scorer returns blastRadius >= threshold → effectiveRisk === risk", async () => {
    const scorer = scorerReturning({ blastRadius: 0.8, confidence: 0.9, rationale: "active in prod" });
    const result = await scoreEffectiveRisk(BASE_POLICY, scorer, BASE_CTX, CFG);
    expect(result.effectiveRisk).toBe("destructive");
    expect(result.scoring.status).toBe("scored");
  });

  it("confidence below min_confidence → effectiveRisk === risk, status low_confidence, regardless of blastRadius", async () => {
    const scorer = scorerReturning({ blastRadius: 0.1, confidence: 0.3, rationale: "unsure" });
    const result = await scoreEffectiveRisk(BASE_POLICY, scorer, BASE_CTX, CFG);
    expect(result.effectiveRisk).toBe("destructive");
    expect(result.scoring.status).toBe("low_confidence");
  });

  it("scorer throws → effectiveRisk === risk, status error, no exception propagates", async () => {
    const scorer: RiskScorer = async () => {
      throw new Error("TypeSafe unavailable");
    };
    const result = await scoreEffectiveRisk(BASE_POLICY, scorer, BASE_CTX, CFG);
    expect(result.effectiveRisk).toBe("destructive");
    expect(result.scoring.status).toBe("error");
    expect(result.scoring.error).toContain("TypeSafe unavailable");
  });

  it("scorer exceeds timeout → treated as error, effectiveRisk === risk", async () => {
    const scorer: RiskScorer = () => new Promise((resolve) => setTimeout(() => resolve({ blastRadius: 0.1, confidence: 0.9, rationale: "slow" }), 50));
    const result = await scoreEffectiveRisk(BASE_POLICY, scorer, BASE_CTX, { ...CFG, HARNESS_DYNAMIC_RISK_TIMEOUT_MS: 5 });
    expect(result.effectiveRisk).toBe("destructive");
    expect(result.scoring.status).toBe("error");
  });

  it("effectiveRisk is never more severe than the static risk, for all blastRadius/confidence inputs", async () => {
    const blastRadii = [0, 0.1, 0.3, 0.49, 0.5, 0.51, 0.7, 1];
    const confidences = [0, 0.3, 0.59, 0.6, 0.61, 0.8, 1];
    for (const blastRadius of blastRadii) {
      for (const confidence of confidences) {
        const scorer = scorerReturning({ blastRadius, confidence, rationale: "prop test" });
        const result = await scoreEffectiveRisk(BASE_POLICY, scorer, BASE_CTX, CFG);
        expect(RISK_SEVERITY.get(result.effectiveRisk)!).toBeLessThanOrEqual(RISK_SEVERITY.get(BASE_POLICY.risk)!);
      }
    }
  });

  it("never registered (scorer undefined) → effectiveRisk === risk, status skipped", async () => {
    const result = await scoreEffectiveRisk(BASE_POLICY, undefined, BASE_CTX, CFG);
    expect(result.effectiveRisk).toBe("destructive");
    expect(result.scoring.status).toBe("skipped");
  });
});
