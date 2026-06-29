import { describe, expect, it } from "vitest";
import { buildHttpHealthResponse } from "../../src/utils/http-health.js";
import type { SearchReadiness } from "../../src/search/types.js";

describe("HTTP health response", () => {
  it.each<SearchReadiness>([
    { state: "ready", configured: "local", provider: "LocalSearchProvider" },
    { state: "initializing", configured: "local" },
    { state: "disabled", configured: "none" },
    { state: "failed", configured: "local", error: "model cache unavailable" },
  ])("keeps /health HTTP-successful when search is $state", (search) => {
    const health = buildHttpHealthResponse(search, 3);

    expect(health.statusCode).toBe(200);
    expect(health.body).toEqual({
      status: "ok",
      sessions: 3,
      search,
    });
  });
});
