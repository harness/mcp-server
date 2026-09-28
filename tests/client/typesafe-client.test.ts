import { describe, it, expect, vi, afterEach } from "vitest";
import { classifyQuestion, TypeSafeError } from "../../src/client/typesafe-client.js";

const OPTIONS = { apiKey: "ts-key" };

const ANSWER = (choice: string, confidence = 0.8) => ({
  model: "jev-latest",
  usage: { input_tokens: 10, output_tokens: 5 },
  answers: {
    category: { type: "choice", choice, confidence, legend: { rubric: "v1" } },
  },
});

function mockFetch(body: unknown, status = 200) {
  const ok = status >= 200 && status < 300;
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const QUESTION = {
  state: { failure_message: "boom" },
  instructions: "Classify why this step failed.",
  choices: ["config_error", "infra_flake"],
} as const;

describe("classifyQuestion wire contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs a single named choice question with Bearer auth to /v1/systemone", async () => {
    const fetchMock = mockFetch(ANSWER("config_error"));
    const result = await classifyQuestion(OPTIONS, {
      ...QUESTION,
      descriptions: {
        config_error: "Pipeline YAML, env var, or secret misconfiguration.",
        infra_flake: "Delegate/runner/network transient failure.",
      },
    });

    expect(result).toEqual({ choice: "config_error", confidence: 0.8, legend: { rubric: "v1" } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer ts-key");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("sends `criteria` as a {name: description} dict — never a flat choices array", async () => {
    const fetchMock = mockFetch(ANSWER("infra_flake"));
    await classifyQuestion(OPTIONS, {
      ...QUESTION,
      descriptions: {
        config_error: "Pipeline YAML, env var, or secret misconfiguration.",
        infra_flake: "Delegate/runner/network transient failure.",
      },
    });

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(Object.keys(body)).toEqual(["state", "model", "questions"]);
    expect(body.state).toEqual(QUESTION.state);
    expect(body.model).toBe("jev-latest");
    const question = body.questions.category;
    expect(question.type).toBe("choice");
    expect(question.instructions).toBe(QUESTION.instructions);
    // The exact contract the live API requires: criteria dict, no choices array.
    expect(question.criteria).toEqual({
      config_error: "Pipeline YAML, env var, or secret misconfiguration.",
      infra_flake: "Delegate/runner/network transient failure.",
    });
    expect(question.state).toEqual(QUESTION.state);
    expect(question.choices).toBeUndefined();
  });

  it("maps choices without a description to null criteria values", async () => {
    const fetchMock = mockFetch(ANSWER("config_error"));
    await classifyQuestion(OPTIONS, QUESTION);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.questions.category.criteria).toEqual({
      config_error: null,
      infra_flake: null,
    });
  });

  it("honors baseUrl and model overrides", async () => {
    const fetchMock = mockFetch(ANSWER("config_error"));
    await classifyQuestion(
      { apiKey: "ts-key", baseUrl: "https://typesafe.example.com", model: "custom-model" },
      QUESTION,
    );
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://typesafe.example.com/v1/systemone");
    expect(JSON.parse(init.body as string).model).toBe("custom-model");
  });

  it("throws TypeSafeError on an unrecognized choice in the answer (fail-closed path depends on it)", async () => {
    mockFetch(ANSWER("totally_unknown_category"));
    await expect(classifyQuestion(OPTIONS, QUESTION)).rejects.toThrow(TypeSafeError);
  });

  it("throws TypeSafeError on a non-2xx response", async () => {
    mockFetch({ error: "invalid request" }, 422);
    await expect(classifyQuestion(OPTIONS, QUESTION)).rejects.toThrow(
      "TypeSafe API returned 422",
    );
  });

  it("throws TypeSafeError when the answer is missing from the response", async () => {
    mockFetch({ model: "jev-latest", usage: {}, answers: {} });
    await expect(classifyQuestion(OPTIONS, QUESTION)).rejects.toThrow(
      'TypeSafe response missing a "category" answer',
    );
  });

  it("throws TypeSafeError on a malformed answer shape", async () => {
    mockFetch({
      model: "jev-latest",
      usage: {},
      answers: { category: { type: "choice", confidence: 0.8 } },
    });
    await expect(classifyQuestion(OPTIONS, QUESTION)).rejects.toThrow(
      'TypeSafe response missing a valid "category" choice answer',
    );
  });
});