/**
 * Advisory-only failure-category triage for `harness_diagnose` (spec 010).
 *
 * Narrow, opt-in mechanism to classify an already-fetched pipeline failure
 * (step name, failure message, log snippet, delegate) into one of 6 fixed
 * categories using TypeSafe's Choice primitive. This is a pure read-tool
 * enrichment — it never gates or changes any diagnose behavior. Any
 * disabled/missing-key/timeout/error/low-confidence result simply omits the
 * `triage` field. See specs/010-diagnose-failure-triage.md.
 */

import type { Config } from "../config.js";
import { classifyQuestion, TypeSafeError } from "../client/typesafe-client.js";
import { createLogger } from "./logger.js";

const log = createLogger("diagnose-triage");

export const FAILURE_CATEGORIES = [
  "infra_flake",
  "test_failure",
  "config_error",
  "dependency_failure",
  "permission_error",
  "timeout",
] as const;

type FailureCategory = (typeof FAILURE_CATEGORIES)[number];

/** Spec 010's rubric — sent as the TypeSafe Choice `criteria` values so the
 * classifier sees the category definitions, not just labels. Keep in sync
 * with specs/010-diagnose-failure-triage.md. */
export const CATEGORY_DESCRIPTIONS: Record<FailureCategory, string> = {
  infra_flake: "Delegate/runner/network transient failure — no code or config at fault.",
  test_failure: "The code under test genuinely failed its assertions.",
  config_error: "Pipeline YAML, environment variable, or secret misconfiguration.",
  dependency_failure: "A downstream service or dependency the step calls failed or was unavailable.",
  permission_error: "Auth, RBAC, or scope failure calling an external system.",
  timeout: "The step exceeded its time budget with no clear error beyond that.",
};

interface TriageInput {
  stage: string;
  step: string;
  failure_message: string;
  delegate?: string;
  log_snippet?: string;
}

interface TriageSignal {
  category: FailureCategory;
  confidence: number;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Failure triage timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Classify a single failed step. Disabled, missing key, timeout, error, or
 * below-min-confidence all resolve to `undefined` — the diagnose response is
 * identical to pre-spec-010 output in every one of those cases, by
 * construction (there is no other path back to the caller).
 */
export async function classifyFailure(
  input: TriageInput,
  cfg: Pick<
    Config,
    | "HARNESS_DIAGNOSE_TRIAGE"
    | "HARNESS_DIAGNOSE_TRIAGE_MIN_CONFIDENCE"
    | "HARNESS_DIAGNOSE_TRIAGE_TIMEOUT_MS"
    | "TYPESAFE_API_KEY"
    | "TYPESAFE_BASE_URL"
  >,
  opts: { signal?: AbortSignal } = {},
): Promise<TriageSignal | undefined> {
  const apiKey = cfg.TYPESAFE_API_KEY;
  if (!cfg.HARNESS_DIAGNOSE_TRIAGE || !apiKey) {
    return undefined;
  }

  const state = {
    stage: input.stage,
    step: input.step,
    failure_message: input.failure_message,
    delegate: input.delegate,
    log_snippet: input.log_snippet,
  };

  const controller = new AbortController();
  opts.signal?.addEventListener("abort", () => controller.abort());
  try {
    const answer = await withTimeout(
      classifyQuestion(
        { apiKey, baseUrl: cfg.TYPESAFE_BASE_URL },
        {
          state,
          instructions:
            "Classify why this CI/CD pipeline step failed, using its failure message, log snippet, and delegate info.",
          choices: FAILURE_CATEGORIES,
          descriptions: CATEGORY_DESCRIPTIONS,
        },
        { signal: controller.signal, timeoutMs: cfg.HARNESS_DIAGNOSE_TRIAGE_TIMEOUT_MS },
      ),
      cfg.HARNESS_DIAGNOSE_TRIAGE_TIMEOUT_MS,
    );

    if (answer.confidence < cfg.HARNESS_DIAGNOSE_TRIAGE_MIN_CONFIDENCE) {
      return undefined;
    }

    return {
      category: answer.choice as FailureCategory,
      confidence: answer.confidence,
    };
  } catch (err) {
    controller.abort();
    if (err instanceof TypeSafeError) {
      log.warn("Failure triage classifier failed, omitting triage", { error: String(err) });
    } else {
      log.warn("Failure triage timed out or errored, omitting triage", { error: String(err) });
    }
    return undefined;
  }
}
