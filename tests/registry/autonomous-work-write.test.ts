import { describe, expect, it, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { autonomousWorkToolset } from "../../src/registry/toolsets/autonomous_work.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "adlc-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_TOOLSETS: "autonomous_work",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

const workClass = autonomousWorkToolset.resources.find((r) => r.resourceType === "work_class");
const team = autonomousWorkToolset.resources.find((r) => r.resourceType === "team");

describe("autonomous_work YAML ask-body writes", () => {
  it("work_class create/update use yamlAskBodyBuilder", () => {
    expect(workClass!.operations.create!.bodyBuilder).toBe(workClass!.operations.update!.bodyBuilder);
    expect(workClass!.operations.create!.skipScopeBodyInjection).toBe(true);
  });

  it("unwraps body.yaml to a string so the HTTP client sends application/yaml", async () => {
    const yamlDoc = "apiVersion: v1\nkind: WorkClass\nid: wc-1\n";
    const mockRequest = vi.fn().mockResolvedValue({ id: "wc-1" });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "work_class", "create", {
      body: { yaml: yamlDoc },
    });

    const call = mockRequest.mock.calls[0]![0] as { method: string; path: string; body: unknown };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/adlc/api/work-classes");
    expect(call.body).toBe(yamlDoc);
    expect(typeof call.body).toBe("string");
  });

  it("passes a raw YAML string body through unchanged", async () => {
    const yamlDoc = "apiVersion: v1\nkind: WorkClass\nid: wc-2\n";
    const mockRequest = vi.fn().mockResolvedValue({ id: "wc-2" });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "work_class", "update", {
      work_class_id: "wc-2",
      body: yamlDoc,
    });

    const call = mockRequest.mock.calls[0]![0] as { method: string; path: string; body: unknown };
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/adlc/api/work-classes/wc-2");
    expect(call.body).toBe(yamlDoc);
  });
});

describe("autonomous_work team JSON writes", () => {
  it("team create keeps a plain JSON object body (not YAML ask-body)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ id: "platform" });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "team", "create", {
      body: { id: "platform", name: "Platform" },
    });

    const call = mockRequest.mock.calls[0]![0] as { body: Record<string, unknown> };
    expect(call.body).toEqual({ id: "platform", name: "Platform" });
    expect(team!.operations.create!.bodySchema!.fields.some((f) => f.name === "yaml")).toBe(false);
  });
});
