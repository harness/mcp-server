import { describe, it, expect, vi, afterEach } from "vitest";
import type { Config } from "../../src/config.js";
import { HarnessClient } from "../../src/client/harness-client.js";
import { mergeConfigWithHttpRequest } from "../../src/utils/http-session-config.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.static-account.token.secret",
    HARNESS_ACCOUNT_ID: "static-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 5000,
    HARNESS_MAX_RETRIES: 2,
    LOG_LEVEL: "error",
    HARNESS_RATE_LIMIT_RPS: 1000,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    ...overrides,
  };
}

describe("mergeConfigWithHttpRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses hosted Harness request headers and host for downstream log-service calls", async () => {
    const config = mergeConfigWithHttpRequest(makeConfig(), {
      headers: {
        "x-api-key": "pat.header-account.token.secret",
        "harness-account": "header-account",
        host: "qa.harness.io",
        "x-forwarded-proto": "https",
        "x-harness-pipeline-version": "1",
      },
    });

    expect(config.HARNESS_API_KEY).toBe("pat.header-account.token.secret");
    expect(config.HARNESS_ACCOUNT_ID).toBe("header-account");
    expect(config.HARNESS_BASE_URL).toBe("https://qa.harness.io");
    expect(config.HARNESS_PIPELINE_VERSION).toBe("1");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ status: "queued" }), { status: 200 }));
    const client = new HarnessClient(config);

    await client.request({
      method: "POST",
      path: "/gateway/log-service/blob/download",
      params: { prefix: "header-account/pipeline/calculator_ci_v1/5/-cCr1aDFiS52unbV4XG08Sw" },
    });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.origin).toBe("https://qa.harness.io");
    expect(url.searchParams.get("accountID")).toBe("header-account");
    expect(url.searchParams.get("accountIdentifier")).toBe("header-account");

    const requestInit = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("pat.header-account.token.secret");
    expect(headers["Harness-Account"]).toBe("header-account");
  });

  it("does not infer a Harness API base URL from non-Harness MCP hosts", () => {
    const config = mergeConfigWithHttpRequest(makeConfig(), {
      headers: {
        host: "mcp.example.com",
        "x-forwarded-proto": "https",
      },
    });

    expect(config.HARNESS_BASE_URL).toBe("https://app.harness.io");
  });

  it("preserves an explicit Harness base URL over the incoming hosted request host", () => {
    const config = mergeConfigWithHttpRequest(
      makeConfig({ HARNESS_BASE_URL: "https://harness0.harness.io" }),
      {
        headers: {
          host: "qa.harness.io",
          "x-forwarded-proto": "https",
        },
      },
    );

    expect(config.HARNESS_BASE_URL).toBe("https://harness0.harness.io");
  });
});
