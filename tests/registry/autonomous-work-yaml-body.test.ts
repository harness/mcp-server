import { describe, it, expect, vi } from "vitest";
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

const member = autonomousWorkToolset.resources.find((r) => r.resourceType === "member");
const team = autonomousWorkToolset.resources.find((r) => r.resourceType === "team");

describe("autonomous_work YAML ask-body (#932)", () => {
  it("member create bodyBuilder differs from team JSON passthrough", () => {
    expect(member!.operations.create!.bodyBuilder).toBeDefined();
    expect(member!.operations.create!.bodyBuilder).not.toBe(team!.operations.create!.bodyBuilder);
  });

  it("unwraps { yaml: \"...\" } so the HTTP client sends a YAML string body", async () => {
    const yamlDoc = "apiVersion: adlc/v1\nkind: Member\nmetadata:\n  name: reviewer\n";
    const mockRequest = vi.fn().mockResolvedValue({});
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "member", "create", {
      body: { yaml: yamlDoc },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/adlc/api/members");
    expect(call.body).toBe(yamlDoc);
    expect(typeof call.body).toBe("string");
  });

  it("passes a raw YAML string body through unchanged", async () => {
    const yamlDoc = "apiVersion: adlc/v1\nkind: Member\n";
    const mockRequest = vi.fn().mockResolvedValue({});
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "member", "create", {
      body: yamlDoc,
    });

    expect(mockRequest.mock.calls[0][0].body).toBe(yamlDoc);
  });

  it("member update unwraps yaml wrapper on PUT", async () => {
    const yamlDoc = "apiVersion: adlc/v1\nkind: Member\nmetadata:\n  name: updated\n";
    const mockRequest = vi.fn().mockResolvedValue({});
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "member", "update", {
      member_id: "mem-1",
      body: { yaml: yamlDoc },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/adlc/api/members/mem-1");
    expect(call.body).toBe(yamlDoc);
  });
});

describe("autonomous_work team JSON body (#932)", () => {
  it("team bodySchema documents JSON fields (not YAML ask-body)", () => {
    expect(team!.operations.create!.bodySchema!.fields.map((f) => f.name)).toEqual(["id", "name"]);
    expect(team!.operations.create!.bodySchema!.description).toMatch(/plain JSON/i);
    expect(team!.operations.create!.skipScopeBodyInjection).toBe(true);
  });

  it("team create sends plain JSON object body without yaml wrapper or scope injection", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "team", "create", {
      body: { id: "platform", name: "Platform" },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/adlc/api/teams");
    expect(call.body).toEqual({ id: "platform", name: "Platform" });
    expect(call.body.yaml).toBeUndefined();
    expect(call.body.orgIdentifier).toBeUndefined();
    expect(call.body.projectIdentifier).toBeUndefined();
  });
});
