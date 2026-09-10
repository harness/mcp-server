/**
 * Regression tests for autonomous_work write-body handling (PR #932).
 * - yamlAskBodyBuilder unwraps { yaml } so the HTTP client sends application/yaml.
 * - team uses plain JSON { id, name }, not a YAML ask-body.
 */
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

function getOp(resourceType: string, operation: "create" | "update") {
  const resource = autonomousWorkToolset.resources.find((r) => r.resourceType === resourceType);
  expect(resource).toBeDefined();
  const spec = resource!.operations[operation];
  expect(spec).toBeDefined();
  return spec!;
}

const YAML_ASK_RESOURCES = [
  "work_class",
  "work_trigger",
  "capability",
  "risk_evaluator",
  "member",
  "member_template",
  "software_component",
] as const;

const SAMPLE_YAML = "apiVersion: adlc.harness.io/v1\nkind: WorkClass\nid: pilot\n";

describe("autonomous_work yamlAskBodyBuilder", () => {
  it("unwraps { yaml } to a raw string and passes raw YAML strings through", () => {
    for (const resourceType of YAML_ASK_RESOURCES) {
      for (const operation of ["create", "update"] as const) {
        const builder = getOp(resourceType, operation).bodyBuilder!;
        expect(builder({ body: { yaml: SAMPLE_YAML } })).toBe(SAMPLE_YAML);
        expect(builder({ body: SAMPLE_YAML })).toBe(SAMPLE_YAML);
      }
    }
  });

  it("leaves non-yaml object bodies unchanged", () => {
    const builder = getOp("work_class", "create").bodyBuilder!;
    const passthrough = { metadata: { version: 1 } };
    expect(builder({ body: passthrough })).toEqual(passthrough);
  });

  it("wires yamlAskBodyBuilder on all YAML ask-body create/update ops", () => {
    for (const resourceType of YAML_ASK_RESOURCES) {
      for (const operation of ["create", "update"] as const) {
        const spec = getOp(resourceType, operation);
        expect(spec.skipScopeBodyInjection).toBe(true);
        expect(spec.bodyBuilder!({ body: { yaml: "x" } })).toBe("x");
      }
    }
  });
});

describe("autonomous_work yaml ask-body dispatch", () => {
  it("POSTs work_class create with a string body when caller passes { yaml }", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ id: "wc-1" });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "work_class", "create", {
      body: { yaml: SAMPLE_YAML },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/adlc/api/work-classes");
    expect(call.body).toBe(SAMPLE_YAML);
    expect(typeof call.body).toBe("string");
  });

  it("PUTs capability update with a raw YAML string body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ id: "cap-1" });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "capability", "update", {
      capability_id: "cap-1",
      body: SAMPLE_YAML,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/adlc/api/capabilities/cap-1");
    expect(call.body).toBe(SAMPLE_YAML);
  });
});

describe("autonomous_work team JSON body", () => {
  const team = autonomousWorkToolset.resources.find((r) => r.resourceType === "team");

  it("declares id/name JSON fields (not a yaml ask-body)", () => {
    const fields = team!.operations.create!.bodySchema!.fields;
    expect(fields.map((f) => f.name)).toEqual(["id", "name"]);
    expect(fields.find((f) => f.name === "id")).toMatchObject({ required: true, type: "string" });
    expect(fields.find((f) => f.name === "name")).toMatchObject({ required: false, type: "string" });
    expect(team!.description).toMatch(/plain JSON body/i);
  });

  it("does not use yamlAskBodyBuilder on create/update", () => {
    const createBuilder = team!.operations.create!.bodyBuilder!;
    const updateBuilder = team!.operations.update!.bodyBuilder!;
    const jsonBody = { id: "pilot-team", name: "Pilot Team" };
    expect(createBuilder({ body: jsonBody })).toEqual(jsonBody);
    expect(updateBuilder({ body: { name: "Renamed" } })).toEqual({ name: "Renamed" });
  });

  it("POSTs team create with the JSON object unchanged", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ id: "pilot-team" });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "team", "create", {
      body: { id: "pilot-team", name: "Pilot Team" },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/adlc/api/teams");
    expect(call.body).toEqual({ id: "pilot-team", name: "Pilot Team" });
    expect(typeof call.body).toBe("object");
  });

  it("rejects team create when id is missing", async () => {
    const registry = new Registry(makeConfig());
    const client = makeClient();

    await expect(
      registry.dispatch(client, "team", "create", { body: { name: "No Id Team" } }),
    ).rejects.toThrow(/Missing required fields for team: id/);
  });

  it("rejects team create when only the old yaml envelope is provided", async () => {
    const registry = new Registry(makeConfig());
    const client = makeClient();

    await expect(
      registry.dispatch(client, "team", "create", {
        body: { yaml: "id: pilot-team\nname: Pilot Team\n" },
      }),
    ).rejects.toThrow(/Missing required fields for team: id/);
  });
});
