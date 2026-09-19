/**
 * Dynamic blast-radius risk scoring (spec 007).
 *
 * Narrow, opt-in mechanism to lower the *effective* risk of a single call
 * toward `operationPolicy.riskFloor`, using a registered `RiskScorer`. This
 * never raises risk above the static `operationPolicy.risk` ceiling, and any
 * scorer failure/timeout/low-confidence result falls back to that ceiling —
 * i.e. exactly today's behavior. See specs/007-decision-primitive-risk-scoring.md.
 */

import type { Config } from "../config.js";
import type { OperationPolicy, RiskLevel, RiskScorer, RiskScoringContext } from "../registry/types.js";
import { createLogger } from "./logger.js";

const log = createLogger("risk-scoring");

export type RiskScoringStatus = "skipped" | "scored" | "low_confidence" | "error";

export interface RiskScoringOutcome {
  status: RiskScoringStatus;
  blastRadius?: number;
  confidence?: number;
  rationale?: string;
  error?: string;
}

export interface ScoreEffectiveRiskResult {
  effectiveRisk: RiskLevel;
  scoring: RiskScoringOutcome;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Risk scorer timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Compute the effective risk for a single call. Fails closed to
 * `policy.risk` on any disabled/unregistered/timeout/error/low-confidence
 * path — the lowered floor is only reachable via an explicit, confident,
 * successful score.
 */
export async function scoreEffectiveRisk(
  policy: OperationPolicy,
  scorer: RiskScorer | undefined,
  ctx: RiskScoringContext,
  cfg: Pick<
    Config,
    | "HARNESS_DYNAMIC_RISK_SCORING"
    | "HARNESS_DYNAMIC_RISK_THRESHOLD"
    | "HARNESS_DYNAMIC_RISK_MIN_CONFIDENCE"
    | "HARNESS_DYNAMIC_RISK_TIMEOUT_MS"
  >,
): Promise<ScoreEffectiveRiskResult> {
  const floor = policy.riskFloor ?? policy.risk;
  if (floor === policy.risk || !scorer || !cfg.HARNESS_DYNAMIC_RISK_SCORING) {
    return { effectiveRisk: policy.risk, scoring: { status: "skipped" } };
  }

  // Own AbortController, not just a race: on timeout/error we abort the
  // scorer's in-flight requests (HTTP GETs, the TypeSafe call) instead of
  // letting them run to completion in the background after we've already
  // fallen back to the static risk.
  const controller = new AbortController();
  try {
    const signal = await withTimeout(scorer({ ...ctx, signal: controller.signal }), cfg.HARNESS_DYNAMIC_RISK_TIMEOUT_MS);
    if (signal.confidence < cfg.HARNESS_DYNAMIC_RISK_MIN_CONFIDENCE) {
      return {
        effectiveRisk: policy.risk,
        scoring: { status: "low_confidence", blastRadius: signal.blastRadius, confidence: signal.confidence, rationale: signal.rationale },
      };
    }
    const lowered = signal.blastRadius < cfg.HARNESS_DYNAMIC_RISK_THRESHOLD;
    const effectiveRisk = lowered ? floor : policy.risk;
    return {
      effectiveRisk,
      scoring: { status: "scored", blastRadius: signal.blastRadius, confidence: signal.confidence, rationale: signal.rationale },
    };
  } catch (err) {
    controller.abort();
    log.warn("Risk scorer failed, falling back to static risk", { error: String(err) });
    return { effectiveRisk: policy.risk, scoring: { status: "error", error: String(err) } };
  }
}
