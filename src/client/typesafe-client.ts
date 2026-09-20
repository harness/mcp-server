/**
 * Minimal HTTP client for TypeSafe's `Choice` decision primitive.
 *
 * Scoped deliberately narrow: no Node/TS `typesafe-sdk` exists yet, so this
 * hand-writes the wire contract for `POST /v1/systemone` with a single
 * question, mirroring the Python `typesafe_sdk` request/response shape (see
 * `typesafe_sdk._core.endpoints.prepare_system_one` and
 * `typesafe_sdk._schemas.models.ChoiceQuestion`/`ChoiceAnswer`).
 */

import { createLogger } from "../utils/logger.js";

const log = createLogger("typesafe-client");

const SYSTEM_ONE_PATH = "/v1/systemone";
const DEFAULT_MODEL = "jev-latest";

export class TypeSafeError extends Error {}

export interface ChoiceQuestionInput {
  /** The content the choice question refers to (arbitrary JSON). */
  state: unknown;
  /** What the model should classify. */
  instructions: string;
  /** Closed set of mutually exclusive named alternatives. */
  choices: readonly string[];
}

export interface ChoiceAnswer {
  /** One of the input `choices`, verified against that list before returning. */
  choice: string;
  confidence: number;
  legend: Record<string, unknown>;
}

interface SystemOneAnswer {
  type: string;
  choice?: string;
  confidence?: number;
  legend?: Record<string, unknown>;
}

interface SystemOneResponseBody {
  model: string;
  usage: { input_tokens?: number; output_tokens?: number };
  answers: Record<string, SystemOneAnswer>;
}

export interface TypeSafeClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

/**
 * POSTs a single named question to TypeSafe's System One endpoint and
 * returns its decoded answer. `classifyQuestion` validates the answer
 * shape for its question type.
 */
async function postSystemOneQuestion(
  { apiKey, baseUrl = "https://api.typesafe.ai", model = DEFAULT_MODEL }: TypeSafeClientOptions,
  questionName: string,
  question: Record<string, unknown>,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<SystemOneAnswer> {
  const body = {
    state: question.state,
    model,
    questions: { [questionName]: question },
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
    if (!answer) {
      throw new TypeSafeError(`TypeSafe response missing a "${questionName}" answer`);
    }
    return answer;
  } catch (err) {
    if (err instanceof TypeSafeError) throw err;
    log.warn("TypeSafe request failed", { error: String(err) });
    throw new TypeSafeError(`TypeSafe request failed: ${String(err)}`);
  } finally {
    opts.signal?.removeEventListener("abort", onAbort);
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

/**
 * Ask a single Choice question against TypeSafe's System One endpoint —
 * classify `state` into exactly one of `choices`. Throws `TypeSafeError` on
 * any non-2xx response, malformed body, unrecognized choice, or network
 * error — callers (diagnose-triage.ts) are expected to catch and fail
 * closed (spec 010's fallback contract: no `triage` field, not an error).
 */
export async function classifyQuestion(
  options: TypeSafeClientOptions,
  question: ChoiceQuestionInput,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<ChoiceAnswer> {
  const questionName = "category";
  // Wire contract (typesafe_sdk._schemas.models.ChoiceQuestion): `criteria` is a
  // dict of choice name -> description, not a flat `choices` array. Choices
  // here carry no per-option description, so each maps to `null`.
  const criteria = Object.fromEntries(question.choices.map((choice) => [choice, null]));
  const answer = await postSystemOneQuestion(
    options,
    questionName,
    { type: "choice", instructions: question.instructions, criteria, state: question.state },
    opts,
  );
  if (answer.type !== "choice" || typeof answer.choice !== "string" || typeof answer.confidence !== "number") {
    throw new TypeSafeError(`TypeSafe response missing a valid "${questionName}" choice answer`);
  }
  if (!question.choices.includes(answer.choice)) {
    throw new TypeSafeError(`TypeSafe returned an unrecognized choice "${answer.choice}" for "${questionName}"`);
  }
  return { choice: answer.choice, confidence: answer.confidence, legend: answer.legend ?? {} };
}
