import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { accessControlToolset } from "../../src/registry/toolsets/access-control.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "demo",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "error",
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
    request: requestFn ?? vi.fn().mockResolvedValue({ status: "SUCCESS", data: {} }),
    account: "test-account",
  } as unknown as HarnessClient;
}

const serviceAccount = accessControlToolset.resources.find((r) => r.resourceType === "service_account");

describe("service_account create", () => {
  it("declares injectAccountInBody on create", () => {
    expect(serviceAccount!.operations.create!.injectAccountInBody).toBe(true);
  });

  it("injects accountIdentifier when the caller omits it (NG 400 without body scope)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS", data: { identifier: "sa1" } });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "service_account", "create", {
      body: {
        identifier: "sa1",
        name: "Automation SA",
        email: "sa1@example.com",
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/serviceaccount");
    expect(call.body).toMatchObject({
      identifier: "sa1",
      name: "Automation SA",
      email: "sa1@example.com",
      accountIdentifier: "test-account",
      orgIdentifier: "default",
      projectIdentifier: "demo",
    });
  });

  it("does not overwrite an explicit accountIdentifier in the body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS" });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "service_account", "create", {
      body: {
        identifier: "sa2",
        name: "Other",
        email: "sa2@example.com",
        accountIdentifier: "caller-account",
      },
    });

    expect(mockRequest.mock.calls[0][0].body.accountIdentifier).toBe("caller-account");
  });
});
