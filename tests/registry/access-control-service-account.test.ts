import { describe, it, expect, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "error",
    HARNESS_TOOLSETS: "access_control",
    ...overrides,
  };
}

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("service_account create injectAccountInBody", () => {
  it("injects accountIdentifier and project/org scope into the POST body", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "sa-ci" } });
    const client = makeClient(mockRequest);

    const payload = {
      identifier: "sa-ci",
      name: "CI Bot",
      email: "ci-bot@example.com",
    };

    await registry.dispatch(client, "service_account", "create", {
      org_id: "Security",
      project_id: "DevOps",
      body: payload,
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/serviceaccount");
    expect(call.body).toMatchObject({
      ...payload,
      accountIdentifier: "test-account",
      orgIdentifier: "Security",
      projectIdentifier: "DevOps",
    });
    expect(call.params).toMatchObject({
      orgIdentifier: "Security",
      projectIdentifier: "DevOps",
    });
  });

  it("does not overwrite an explicit accountIdentifier in the body", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ data: {} });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "service_account", "create", {
      body: {
        identifier: "sa-x",
        name: "X",
        email: "x@example.com",
        accountIdentifier: "caller-supplied",
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.accountIdentifier).toBe("caller-supplied");
  });
});
