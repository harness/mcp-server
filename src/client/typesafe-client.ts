/**
 * Minimal HTTP client for TypeSafe's `Score` decision primitive.
 *
 * Scoped deliberately narrow (spec 007, "Prerequisite"): no Node/TS
 * `typesafe-sdk` exists yet, so this hand-writes the wire contract for
 * `POST /v1/systemone` with a single `score`-type question, mirroring the
 * Python `typesafe_sdk` request/response shape (see
 * `typesafe_sdk._core.endpoints.prepare_system_one` and
 * `typesafe_sdk._schemas.models.ScoreQuestion`/`ScoreAnswer`). Choice/Noul
 * are not needed for the v1 pilots and are intentionally not implemented.
 */

import { createLogger } from "../utils/logger.js";

const log = createLogger("typesafe-client");

const SYSTEM_ONE_PATH = "/v1/systemone";
const DEFAULT_MODEL = "jev-latest";

export class TypeSafeError extends Error {}

export interface ScoreQuestionInput {
  /** The content the score question refers to (arbitrary JSON). */
  state: unknown;
  /** What the model should rate. */
  instructions: string;
  /** Ordered rubric descriptions, one per score level starting at 0. */
  criteria: readonly string[];
}

export interface ScoreAnswer {
  /** Probability-weighted average of the rubric levels; may fall between integers. */
  score: number;
  confidence: number;
  legend: Record<string, unknown>;
}

interface SystemOneResponseBody {
  model: string;
  usage: { input_tokens?: number; output_tokens?: number };
  answers: Record<string, { type: string; score?: number; confidence?: number; legend?: Record<string, unknown> }>;
}

export interface TypeSafeClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

/**
 * Ask a single Score question against TypeSafe's System One endpoint.
 * Throws `TypeSafeError` on any non-2xx response, malformed body, or network
 * error — callers (risk-scoring.ts) are expected to catch and fail closed.
 */
export async function scoreQuestion(
  { apiKey, baseUrl = "https://api.typesafe.ai", model = DEFAULT_MODEL }: TypeSafeClientOptions,
  question: ScoreQuestionInput,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<ScoreAnswer> {
  const questionName = "blast_radius";
  const body = {
    state: question.state,
    model,
    questions: {
      [questionName]: {
        type: "score",
        instructions: question.instructions,
        criteria: question.criteria,
      },
    },
  };

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort);
  const timeout = opts.timeoutMs !== undefined ? setTimeout(() => controller.abort(), opts.timeoutMs) : undefined;

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}${SYSTEM_ONE_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new TypeSafeError(`TypeSafe API returned ${response.status}: ${text.slice(0, 200)}`);
    }

    const decoded = (await response.json()) as SystemOneResponseBody;
    const answer = decoded.answers?.[questionName];
    if (!answer || answer.type !== "score" || typeof answer.score !== "number" || typeof answer.confidence !== "number") {
      throw new TypeSafeError(`TypeSafe response missing a valid "${questionName}" score answer`);
    }
    return { score: answer.score, confidence: answer.confidence, legend: answer.legend ?? {} };
  } catch (err) {
    if (err instanceof TypeSafeError) throw err;
    log.warn("TypeSafe request failed", { error: String(err) });
    throw new TypeSafeError(`TypeSafe request failed: ${String(err)}`);
  } finally {
    opts.signal?.removeEventListener("abort", onAbort);
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
