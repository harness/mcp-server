import { describe, expect, it } from "vitest";
import { buildHttpHealthResponse } from "../../src/utils/http-health.js";

describe("buildHttpHealthResponse", () => {
  it("returns ok probe status when search is ready", () => {
    const response = buildHttpHealthResponse(
      { state: "ready", configured: "local", provider: "LocalSearchProvider" },
      2,
    );

    expect(response).toEqual({
      statusCode: 200,
      body: {
        status: "ok",
        sessions: 2,
        search: { state: "ready", configured: "local", provider: "LocalSearchProvider" },
      },
    });
  });

  it("keeps health probes passing when optional semantic search fails", () => {
    const response = buildHttpHealthResponse(
      { state: "failed", configured: "local", error: "Cannot find module '@huggingface/transformers'" },
      0,
    );

    expect(response).toEqual({
      statusCode: 200,
      body: {
        status: "degraded",
        sessions: 0,
        search: {
          state: "failed",
          configured: "local",
          error: "Cannot find module '@huggingface/transformers'",
        },
      },
    });
  });
});
