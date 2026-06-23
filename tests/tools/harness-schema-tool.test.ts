import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { registerSchemaTool } from "../../src/tools/harness-schema.js";
import { extractLiveSchema } from "../../src/tools/entity-schema/live.js";

function makeMcpServer() {
  const tools = new Map<string, { handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    registerTool: vi.fn((name: string, _schema: unknown, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { handler });
    }),
    async call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      const extra = { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} };
      return tool.handler(args, extra) as Promise<ToolResult>;
    },
  } as any;
}

function parseResult(result: ToolResult): unknown {
  return JSON.parse(result.content[0]!.text);
}

const CONNECTOR_LIVE_SCHEMA = {
  definitions: {
    connector: {
      connector: {
        type: "object",
        properties: {
          name: { type: "string" },
          identifier: { type: "string" },
        },
        required: ["name", "identifier"],
      },
      ConnectorInfoDTO: {
        type: "object",
        properties: {
          identifier: { type: "string", const: "pinned" },
        },
      },
    },
  },
};

describe("harness_schema live entities", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let requestMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    server = makeMcpServer();
    requestMock = vi.fn().mockResolvedValue({ data: CONNECTOR_LIVE_SCHEMA });
    const client = {
      account: "acct-123",
      request: requestMock,
    } as unknown as HarnessClient;
    registerSchemaTool(server, undefined, client);
  });

  it("includes live entity types in registration", () => {
    const call = server.registerTool.mock.calls.find((c: unknown[]) => c[0] === "harness_schema");
    expect(call).toBeDefined();
    const description = (call![1] as { description: string }).description;
    expect(description).toContain("connector");
    expect(description).toContain("infrastructure");
  });

  it("fetches connector schema from /ng/api/yaml-schema and returns summary", async () => {
    const result = await server.call("harness_schema", { resource_type: "connector" });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/ng/api/yaml-schema",
        params: expect.objectContaining({ entityType: "Connectors", scope: "account" }),
      }),
    );
    expect(parsed.source).toBe("ng-yaml-schema");
    expect(parsed.resource_type).toBe("connector");
    expect(Array.isArray(parsed.fields)).toBe(true);
  });

  it("caches by account and scope (second call does not refetch)", async () => {
    await server.call("harness_schema", { resource_type: "connector" });
    await server.call("harness_schema", { resource_type: "connector" });
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it("passes org_id and project_id for project scope", async () => {
    await server.call("harness_schema", {
      resource_type: "environment",
      scope: "project",
      org_id: "my-org",
      project_id: "my-proj",
    });

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          entityType: "Environment",
          scope: "project",
          orgIdentifier: "my-org",
          projectIdentifier: "my-proj",
        }),
      }),
    );
  });

  it("static pipeline schema still works without API call", async () => {
    requestMock.mockClear();
    const result = await server.call("harness_schema", { resource_type: "pipeline" });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(requestMock).not.toHaveBeenCalled();
    expect(parsed.source).toBe("harness-schema");
    expect(parsed.resource_type).toBe("pipeline");
  });

  it("rejects project scope without org_id before bundled or live fetch", async () => {
    vi.spyOn(
      await import("../../src/tools/entity-schema/bundled.js"),
      "getBundledEntitySchema",
    ).mockReturnValue({ type: "object" });

    const result = await server.call("harness_schema", {
      resource_type: "connector",
      scope: "project",
    });
    const parsed = parseResult(result) as { error: string };

    expect(result.isError).toBe(true);
    expect(parsed.error).toMatch(/org_id is required/);
    expect(requestMock).not.toHaveBeenCalled();
  });
});

describe("harness_schema static enum", () => {
  it("lists both legacy and v1 bundled pipeline schemas (no version preference)", () => {
    const server = makeMcpServer();
    registerSchemaTool(server, undefined, undefined);

    const call = server.registerTool.mock.calls.find((c: unknown[]) => c[0] === "harness_schema");
    const description = (call![1] as { description: string }).description;

    expect(description).toContain("pipeline,");
    expect(description).toContain("pipeline_v1");
    expect(description).not.toMatch(/prefer pipeline_v1/i);
  });
});

// A static schema whose reusable definition (EnvironmentV1) is nested under
// group keys, mirroring how harness-schema nests pipeline_v1 definitions
// (e.g. stages.unified.EnvironmentV1). Registered via additionalSchemas so the
// nested-lookup contract is tested without coupling to bundled schema content.
const NESTED_STATIC_SCHEMA = {
  definitions: {
    nested_demo: {
      nested_demo: {
        type: "object",
        properties: { stages: { $ref: "#/definitions/nested_demo/stages" } },
      },
      stages: {
        unified: {
          EnvironmentV1: {
            type: "object",
            title: "EnvironmentV1",
            properties: { ref: { type: "string" } },
          },
        },
      },
    },
  },
};

describe("harness_schema nested static definition lookup", () => {
  function makeServerWithNestedSchema() {
    const server = makeMcpServer();
    registerSchemaTool(server, undefined, undefined, {
      nested_demo: {
        schema: NESTED_STATIC_SCHEMA,
        description: "Nested lookup test schema",
        group: "test",
      },
    });
    return server;
  }

  it("resolves a bare nested definition name and reports requested_path", async () => {
    const server = makeServerWithNestedSchema();
    const result = await server.call("harness_schema", {
      resource_type: "nested_demo",
      path: "EnvironmentV1",
    });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(result.isError).toBeFalsy();
    expect(parsed.path).toBe("stages.unified.EnvironmentV1");
    expect(parsed.requested_path).toBe("EnvironmentV1");
    expect((parsed.schema as Record<string, unknown>).title).toBe("EnvironmentV1");
  });

  it("resolves an explicit dot-path without setting requested_path", async () => {
    const server = makeServerWithNestedSchema();
    const result = await server.call("harness_schema", {
      resource_type: "nested_demo",
      path: "stages.unified.EnvironmentV1",
    });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(result.isError).toBeFalsy();
    expect(parsed.path).toBe("stages.unified.EnvironmentV1");
    expect(parsed.requested_path).toBeUndefined();
  });

  it("resolves a direct top-level key without setting requested_path", async () => {
    const server = makeServerWithNestedSchema();
    const result = await server.call("harness_schema", {
      resource_type: "nested_demo",
      path: "stages",
    });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(result.isError).toBeFalsy();
    expect(parsed.path).toBe("stages");
    expect(parsed.requested_path).toBeUndefined();
  });

  it("errors with available sections when no definition matches", async () => {
    const server = makeServerWithNestedSchema();
    const result = await server.call("harness_schema", {
      resource_type: "nested_demo",
      path: "DoesNotExist",
    });
    const parsed = parseResult(result) as { error: string };

    expect(result.isError).toBe(true);
    expect(parsed.error).toMatch(/not found/);
    expect(parsed.error).toContain("nested_demo");
  });

  it("resolves a bundled pipeline_v1 nested definition by bare name", async () => {
    const server = makeMcpServer();
    registerSchemaTool(server, undefined, undefined);
    const result = await server.call("harness_schema", {
      resource_type: "pipeline_v1",
      path: "EnvironmentV1",
    });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(result.isError).toBeFalsy();
    expect(parsed.path).toBe("stages.unified.EnvironmentV1");
    expect(parsed.requested_path).toBe("EnvironmentV1");
  });
});

describe("extractLiveSchema", () => {
  it("extracts schema from Harness data envelope", () => {
    const schema = { type: "object", properties: { x: { type: "string" } } };
    expect(extractLiveSchema({ data: schema })).toEqual(schema);
  });

  it("extracts stringified schema", () => {
    const schema = { definitions: { foo: { type: "object" } } };
    expect(extractLiveSchema({ data: JSON.stringify(schema) })).toEqual(schema);
  });
});
