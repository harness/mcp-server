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
    LOG_LEVEL: "error",
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

describe("autonomous_work yamlAskBodyBuilder", () => {
  const build = workClass!.operations.create!.bodyBuilder!;

  it("unwraps { yaml: doc } to a raw YAML string for ADLC ask-body routes", () => {
    const yaml = "apiVersion: adlc/v1\nkind: WorkClass\nmetadata:\n  id: wc1\n";
    expect(build({ body: { yaml } })).toBe(yaml);
  });

  it("passes through a raw YAML string body unchanged", () => {
    const yaml = "apiVersion: adlc/v1\nkind: WorkClass\n";
    expect(build({ body: yaml })).toBe(yaml);
  });

  it("does not unwrap non-yaml object bodies", () => {
    const body = { id: "wc1", name: "Example" };
    expect(build({ body })).toEqual(body);
  });
});

describe("autonomous_work dispatch — YAML vs JSON bodies", () => {
  it("work_class create sends unwrapped YAML string (not JSON wrapper)", async () => {
    const yaml = "apiVersion: adlc/v1\nkind: WorkClass\nmetadata:\n  id: wc1\n";
    const mockRequest = vi.fn().mockResolvedValue({ id: "wc1" });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "work_class", "create", {
      body: { yaml },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/adlc/api/work-classes");
    expect(call.body).toBe(yaml);
    expect(typeof call.body).toBe("string");
    expect(call.body.orgIdentifier).toBeUndefined();
  });

  it("team create keeps plain JSON body (no yaml unwrap)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ id: "team-a" });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "team", "create", {
      body: { id: "team-a", name: "Platform" },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/adlc/api/teams");
    expect(call.body).toEqual({ id: "team-a", name: "Platform" });
    expect(typeof call.body).toBe("object");
  });

  it("team bodySchema documents JSON fields, not a yaml ask-body", () => {
    const schema = team!.operations.create!.bodySchema!;
    expect(schema.fields.map((f) => f.name)).toEqual(["id", "name"]);
    expect(schema.fields.find((f) => f.name === "yaml")).toBeUndefined();
    expect(schema.description).toContain("plain JSON");
  });
});
