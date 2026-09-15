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
    HARNESS_PROJECT: "adlc-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "error",
    HARNESS_TOOLSETS: "autonomous_work",
    ...overrides,
  };
}

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("autonomous_work YAML ask-body dispatch", () => {
  const yamlDoc = "apiVersion: adlc/v1\nkind: WorkClass\nmetadata:\n  id: demo\n";

  it("unwraps body={ yaml } to a raw YAML string for work_class create", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "work_class", "create", {
      org_id: "my-org",
      project_id: "my-project",
      body: { yaml: yamlDoc },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/adlc/api/work-classes");
    expect(call.body).toBe(yamlDoc);
    expect(typeof call.body).toBe("string");
  });

  it("passes a raw YAML string through unchanged on work_class update", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "work_class", "update", {
      work_class_id: "wc-1",
      body: yamlDoc,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/adlc/api/work-classes/wc-1");
    expect(call.body).toBe(yamlDoc);
  });

  it("team create keeps JSON object bodies (not YAML ask-body unwrap)", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    const teamBody = { id: "platform", name: "Platform" };

    await registry.dispatch(client, "team", "create", {
      body: teamBody,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/adlc/api/teams");
    expect(call.body).toEqual(teamBody);
    expect(typeof call.body).toBe("object");
  });
});
