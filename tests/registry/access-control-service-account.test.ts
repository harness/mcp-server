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
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "info",
    HARNESS_TOOLSETS: "access_control",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

const serviceAccount = accessControlToolset.resources.find((r) => r.resourceType === "service_account");

describe("service_account registry shape", () => {
  it("create enables injectAccountInBody on the flat NG body", () => {
    expect(serviceAccount).toBeDefined();
    expect(serviceAccount!.operations.create!.injectAccountInBody).toBe(true);
    expect(serviceAccount!.operations.create!.path).toBe("/ng/api/serviceaccount");
  });
});

describe("service_account create dispatch — injectAccountInBody", () => {
  it("injects accountIdentifier into the POST body alongside caller fields", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS", data: { identifier: "sa-bot" } });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "service_account", "create", {
      body: {
        identifier: "sa-bot",
        name: "Automation SA",
        email: "sa-bot@example.com",
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.body).toMatchObject({
      identifier: "sa-bot",
      name: "Automation SA",
      email: "sa-bot@example.com",
      accountIdentifier: "test-account",
      orgIdentifier: "default",
      projectIdentifier: "test-project",
    });
  });

  it("does not overwrite an explicit accountIdentifier in the body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS" });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "service_account", "create", {
      body: {
        identifier: "sa-bot",
        name: "Automation SA",
        email: "sa-bot@example.com",
        accountIdentifier: "caller-account",
      },
    });

    expect(mockRequest.mock.calls[0][0].body.accountIdentifier).toBe("caller-account");
  });

  it("uses resolved account from accountIdResolver when injecting", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS" });
    const client = makeClient(mockRequest);
    const registry = new Registry(
      makeConfig({ HARNESS_ACCOUNT_ID: "static-account" }),
      { accountIdResolver: () => "resolved-account" },
    );

    await registry.dispatch(client, "service_account", "create", {
      body: {
        identifier: "sa-bot",
        name: "Automation SA",
        email: "sa-bot@example.com",
      },
    });

    expect(mockRequest.mock.calls[0][0].body.accountIdentifier).toBe("resolved-account");
  });
});
