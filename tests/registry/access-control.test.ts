import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "acct123",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "myProject",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    ...overrides,
  };
}

function makeClient(response: unknown): HarnessClient {
  return {
    request: vi.fn().mockResolvedValue(response),
  } as unknown as HarnessClient;
}

describe("access_control user", () => {
  const registry = new Registry(makeConfig());

  it("get routes through /ng/api/user/aggregate/{userId} (not the 405 ng-manager path)", async () => {
    const client = makeClient({
      data: { user: { uuid: "user-uuid-1", email: "alice@example.com", name: "Alice" } },
    });

    await registry.dispatch(client, "user", "get", { user_id: "user-uuid-1" });

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/ng/api/user/aggregate/user-uuid-1");
    expect(call.path).not.toBe("/ng/api/user/user-uuid-1");
  });

  it("list posts to /ng/api/user/aggregate with searchTerm in body", async () => {
    const client = makeClient({
      data: { content: [], totalElements: 0 },
    });

    await registry.dispatch(client, "user", "list", { search_term: "alice" });

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/user/aggregate");
    expect(call.body).toEqual({ searchTerm: "alice" });
  });
});
