import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { RequestOptions } from "../../src/client/types.js";
import { Registry } from "../../src/registry/index.js";
import { accessControlToolset } from "../../src/registry/toolsets/access-control.js";

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
    HARNESS_TOOLSETS: "access_control",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (options: RequestOptions) => Promise<unknown>): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function firstRequest(mockRequest: ReturnType<typeof vi.fn>): RequestOptions {
  return mockRequest.mock.calls[0]![0] as RequestOptions;
}

describe("access_control user routing", () => {
  it("documents user get on the aggregate endpoint (ng-manager rejects bare /user/{id})", () => {
    const user = accessControlToolset.resources.find((r) => r.resourceType === "user");
    expect(user?.operations.get?.path).toBe("/ng/api/user/aggregate/{userId}");
  });

  it("dispatches user get to /ng/api/user/aggregate/{userId}", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS", data: { uuid: "u1" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "user", "get", { user_id: "u1" });

    const req = firstRequest(mockRequest);
    expect(req.method).toBe("GET");
    expect(req.path).toBe("/ng/api/user/aggregate/u1");
    expect(req.path).not.toContain("/ng/api/user/u1");
  });
});
