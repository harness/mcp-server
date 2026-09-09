/**
 * Autonomous work toolset — YAML ask-body unwrapping and Team JSON schema.
 * Guards PR #932 fixes: yamlAskBodyBuilder must send raw YAML strings (not
 * { yaml: "..." } objects) so HarnessClient sets Content-Type: application/yaml.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { autonomousWorkToolset } from "../../src/registry/toolsets/autonomous_work.js";
import { accessControlToolset } from "../../src/registry/toolsets/access-control.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

const YAML_ASK_RESOURCES = [
  "work_class",
  "work_trigger",
  "capability",
  "risk_evaluator",
  "member",
  "member_template",
  "software_component",
] as const;

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

function getResource(resourceType: string) {
  const resource = autonomousWorkToolset.resources.find((r) => r.resourceType === resourceType);
  if (!resource) throw new Error(`missing resource: ${resourceType}`);
  return resource;
}

describe("autonomous_work team bodySchema", () => {
  const team = getResource("team");

  it("declares plain JSON id/name fields (not a yaml ask-body)", () => {
    const schema = team.operations.create!.bodySchema!;
    expect(schema.fields.map((f) => f.name)).toEqual(["id", "name"]);
    expect(schema.fields.find((f) => f.name === "id")).toMatchObject({ type: "string", required: true });
    expect(schema.fields.find((f) => f.name === "name")).toMatchObject({ type: "string", required: false });
    expect(schema.description).toMatch(/plain JSON/i);
  });

  it("create/update use identity bodyBuilder (no yaml unwrapping)", () => {
    const yamlDoc = "id: team-1\nname: Team One\n";
    const jsonBody = { id: "team-1", name: "Team One" };

    expect(team.operations.create!.bodyBuilder!({ body: jsonBody })).toEqual(jsonBody);
    expect(team.operations.update!.bodyBuilder!({ body: { name: "Renamed" } })).toEqual({ name: "Renamed" });
    expect(team.operations.create!.bodyBuilder!({ body: { yaml: yamlDoc } })).toEqual({ yaml: yamlDoc });
  });
});

describe("autonomous_work yamlAskBodyBuilder", () => {
  for (const resourceType of YAML_ASK_RESOURCES) {
    const resource = getResource(resourceType);
    const build = resource.operations.create!.bodyBuilder!;

    it(`${resourceType} create unwraps { yaml: "<doc>" } to a raw string`, () => {
      const yaml = "apiVersion: v1\nkind: WorkClass\nid: demo\n";
      expect(build({ body: { yaml } })).toBe(yaml);
    });

    it(`${resourceType} create passes through a raw YAML string body`, () => {
      const yaml = "apiVersion: v1\nid: raw\n";
      expect(build({ body: yaml })).toBe(yaml);
    });

    it(`${resourceType} update uses the same yamlAskBodyBuilder`, () => {
      const yaml = "apiVersion: v1\nid: updated\n";
      expect(resource.operations.update!.bodyBuilder!({ body: { yaml } })).toBe(yaml);
    });
  }
});

describe("autonomous_work yaml ask-body dispatch", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("work_class create sends unwrapped YAML string in request body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ id: "wc-1" });
    const client = makeClient(mockRequest);
    const yaml = "apiVersion: v1\nkind: WorkClass\nid: pilot\n";

    await registry.dispatch(client, "work_class", "create", {
      org_id: "default",
      project_id: "adlc-project",
      body: { yaml },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body).toBe(yaml);
    expect(typeof call.body).toBe("string");
  });
});

describe("access_control service_account injectAccountInBody", () => {
  const serviceAccount = accessControlToolset.resources.find((r) => r.resourceType === "service_account");
  if (!serviceAccount) throw new Error("service_account resource missing");

  it("create operation sets injectAccountInBody: true", () => {
    expect(serviceAccount.operations.create!.injectAccountInBody).toBe(true);
  });

  it("create dispatch injects accountIdentifier into POST body", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "access_control" }));
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS", data: {} });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "service_account", "create", {
      org_id: "default",
      project_id: "proj",
      body: {
        identifier: "sa-bot",
        name: "SA Bot",
        email: "sa-bot@example.com",
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.accountIdentifier).toBe("test-account");
    expect(call.body.identifier).toBe("sa-bot");
  });
});
