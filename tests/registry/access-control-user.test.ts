/**
 * Regression: user get must use the aggregate API path.
 *
 * GET /ng/api/user/{userId} returns 405 on ng-manager (surfaced as 500).
 * The UI and this server use GET /ng/api/user/aggregate/{userId} instead.
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_TOOLSETS: "access_control",
    ...overrides,
  } as Config;
}

describe("access_control user resource", () => {
  it("routes user get through the aggregate API path", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { user: { uuid: "user-uuid", email: "agent@example.com" } },
    });
    const client = {
      request: mockRequest,
      account: "test-account",
    } as unknown as HarnessClient;

    await registry.dispatch(client, "user", "get", { user_id: "user-uuid" });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0]![0] as { method: string; path: string };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/ng/api/user/aggregate/user-uuid");
    expect(call.path).not.toBe("/ng/api/user/user-uuid");
  });

  it("lists users through the aggregate API", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { content: [], totalItems: 0 },
    });
    const client = {
      request: mockRequest,
      account: "test-account",
    } as unknown as HarnessClient;

    await registry.dispatch(client, "user", "list", { search_term: "agent" });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0]![0] as { method: string; path: string; body: Record<string, unknown> };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/user/aggregate");
    expect(call.body.searchTerm).toBe("agent");
  });
});
