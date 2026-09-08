import { describe, expect, it, vi } from "vitest";
import { accessControlToolset } from "../../../src/registry/toolsets/access-control.js";
import { Registry } from "../../../src/registry/index.js";
import type { Config } from "../../../src/config.js";
import type { HarnessClient } from "../../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_AUTO_APPROVE_RISK: "none",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

const userResource = accessControlToolset.resources.find((r) => r.resourceType === "user");
if (!userResource) throw new Error("user resource missing from access-control toolset");

describe("access-control user resource", () => {
  it("lists via POST /ng/api/user/aggregate", () => {
    expect(userResource.operations.list).toMatchObject({
      method: "POST",
      path: "/ng/api/user/aggregate",
    });
  });

  it("gets via GET /ng/api/user/aggregate/{userId} (not the broken /ng/api/user/{userId})", () => {
    expect(userResource.operations.get).toMatchObject({
      method: "GET",
      path: "/ng/api/user/aggregate/{userId}",
    });
    expect(userResource.operations.get!.path).not.toBe("/ng/api/user/{userId}");
    expect(userResource.operations.get!.pathParams).toEqual({ user_id: "userId" });
  });
});

describe("access-control user dispatch", () => {
  it("dispatches user get to the aggregate API path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { uuid: "user-uuid-123", name: "Jane Doe", email: "jane@example.com" },
    });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "access_control" }));

    await registry.dispatch(makeClient(mockRequest), "user", "get", {
      user_id: "user-uuid-123",
    });

    const request = mockRequest.mock.calls[0]![0] as { method: string; path: string };
    expect(request.method).toBe("GET");
    expect(request.path).toBe("/ng/api/user/aggregate/user-uuid-123");
  });

  it("dispatches user list to POST /ng/api/user/aggregate with search term body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS", data: { content: [] } });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "access_control" }));

    await registry.dispatch(makeClient(mockRequest), "user", "list", {
      search_term: "jane",
      page: 0,
      size: 20,
    });

    const request = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
      params: Record<string, unknown>;
    };
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/ng/api/user/aggregate");
    expect(request.body).toEqual({ searchTerm: "jane" });
    expect(request.params.pageIndex).toBe(0);
    expect(request.params.pageSize).toBe(20);
  });
});
