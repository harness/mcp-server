import { describe, expect, it, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_TOOLSETS: "access_control",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({ status: "SUCCESS" }),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("service_account create", () => {
  it("injects accountIdentifier into the JSON body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS", data: { identifier: "sa-1" } });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "service_account", "create", {
      body: {
        identifier: "sa-1",
        name: "CI Bot",
        email: "ci-bot@example.invalid",
        orgIdentifier: "default",
        projectIdentifier: "test-project",
      },
    });

    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
    };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/serviceaccount");
    expect(call.body.accountIdentifier).toBe("test-account");
    expect(call.body.identifier).toBe("sa-1");
  });
});
