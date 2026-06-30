import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { registerSchemaTool } from "../../src/tools/harness-schema.js";
import { extractLiveSchema } from "../../src/tools/entity-schema/live.js";
import { VALID_SCHEMAS } from "../../src/data/schemas/index.js";

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

function liveEntitySchema(resourceType: string, fieldName: string) {
  return {
    definitions: {
      [resourceType]: {
        [resourceType]: {
          type: "object",
          properties: {
            [fieldName]: { type: "string" },
          },
        },
      },
    },
  };
}

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

  it("isolates live schema cache entries by project scope identifiers", async () => {
    requestMock.mockReset();
    requestMock
      .mockResolvedValueOnce({ data: liveEntitySchema("environment", "project_a_field") })
      .mockResolvedValueOnce({ data: liveEntitySchema("environment", "project_b_field") });

    const first = parseResult(await server.call("harness_schema", {
      resource_type: "environment",
      scope: "project",
      org_id: "org-a",
      project_id: "project-a",
    })) as { fields: Array<{ name: string }> };
    const second = parseResult(await server.call("harness_schema", {
      resource_type: "environment",
      scope: "project",
      org_id: "org-b",
      project_id: "project-b",
    })) as { fields: Array<{ name: string }> };

    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(first.fields.map((field) => field.name)).toContain("project_a_field");
    expect(second.fields.map((field) => field.name)).toContain("project_b_field");
    expect(second.fields.map((field) => field.name)).not.toContain("project_a_field");
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

  it("drills into a live entity section via path and inlines nested refs", async () => {
    requestMock.mockResolvedValueOnce({
      data: {
        definitions: {
          connector: {
            connector: {
              type: "object",
              properties: { name: { type: "string" } },
            },
          },
          shared: {
            ConnectorSpecDTO: {
              type: "object",
              title: "ConnectorSpecDTO",
              properties: { url: { type: "string" } },
            },
          },
        },
      },
    });

    const result = await server.call("harness_schema", {
      resource_type: "connector",
      path: "shared.ConnectorSpecDTO",
    });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(result.isError).toBeFalsy();
    expect(parsed.path).toBe("shared.ConnectorSpecDTO");
    expect(parsed.source).toBe("ng-yaml-schema");
    expect((parsed.schema as Record<string, unknown>).title).toBe("ConnectorSpecDTO");
  });

  it("errors with available sections when live path is not found", async () => {
    const result = await server.call("harness_schema", {
      resource_type: "connector",
      path: "DoesNotExist",
    });
    const parsed = parseResult(result) as { error: string };

    expect(result.isError).toBe(true);
    expect(parsed.error).toMatch(/not found/);
    expect(parsed.error).toContain("connector");
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

  it("does not expose v1 schemas removed from harness-schema upstream", () => {
    const server = makeMcpServer();
    registerSchemaTool(server, undefined, undefined);

    const call = server.registerTool.mock.calls.find((c: unknown[]) => c[0] === "harness_schema");
    const description = (call![1] as { description: string }).description;

    for (const bundled of VALID_SCHEMAS) {
      expect(description).toContain(bundled);
    }
    for (const removed of ["trigger_v1", "service_v1", "infra_v1"] as const) {
      expect(description).not.toContain(removed);
    }
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

  it("inlines $ref pointers in the returned schema section", async () => {
    const server = makeMcpServer();
    registerSchemaTool(server, undefined, undefined, {
      ref_demo: {
        schema: {
          definitions: {
            ref_demo: {
              ref_demo: { type: "object" },
              wrapper: {
                type: "object",
                properties: {
                  leaf: { $ref: "#/definitions/ref_demo/leaf" },
                },
              },
              leaf: {
                type: "object",
                title: "LeafDef",
                properties: { id: { type: "string" } },
              },
            },
          },
        },
        description: "Ref inlining test schema",
        group: "test",
      },
    });

    const result = await server.call("harness_schema", {
      resource_type: "ref_demo",
      path: "wrapper",
    });
    const parsed = parseResult(result) as { schema: Record<string, unknown> };
    const leaf = (parsed.schema.properties as Record<string, unknown>).leaf as Record<string, unknown>;

    expect(leaf.title).toBe("LeafDef");
    expect(leaf).not.toHaveProperty("$ref");
  });

  it("returns trigger_source section from bundled trigger schema", async () => {
    const server = makeMcpServer();
    registerSchemaTool(server, undefined, undefined);
    const result = await server.call("harness_schema", {
      resource_type: "trigger",
      path: "trigger_source",
    });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(result.isError).toBeFalsy();
    expect(parsed.path).toBe("trigger_source");
    expect(parsed.source).toBe("harness-schema");
    expect((parsed.schema as Record<string, unknown>).title).toBe("trigger_source");
  });
});

// Wrapper definitions that are grouping objects (not schema nodes) must still
// resolve by bare name when no deeper schema-node match exists.
const WRAPPER_FALLBACK_SCHEMA = {
  definitions: {
    wrapper_demo: {
      wrapper_demo: {
        type: "object",
        properties: { ref: { $ref: "#/definitions/wrapper_demo/GroupWrapper" } },
      },
      GroupWrapper: {
        description: "grouping object only — not a schema node",
        children: ["a", "b"],
      },
    },
  },
};

// When both a wrapper and a nested schema node share a name, the schema node wins
// during recursive search (direct top-level keys are returned as-is).
const WRAPPER_VS_SCHEMA_SCHEMA = {
  definitions: {
    prefer_schema: {
      prefer_schema: {
        type: "object",
        properties: { stage: { $ref: "#/definitions/prefer_schema/groups/StageRef" } },
      },
      groups: {
        StageRef: {
          nested: {
            StageRef: {
              type: "object",
              title: "StageRef",
              properties: { name: { type: "string" } },
            },
          },
        },
      },
    },
  },
};

describe("harness_schema wrapper definition fallback", () => {
  it("resolves a bare wrapper definition when it is not a schema node", async () => {
    const server = makeMcpServer();
    registerSchemaTool(server, undefined, undefined, {
      wrapper_demo: {
        schema: WRAPPER_FALLBACK_SCHEMA,
        description: "Wrapper fallback test schema",
        group: "test",
      },
    });

    const result = await server.call("harness_schema", {
      resource_type: "wrapper_demo",
      path: "GroupWrapper",
    });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(result.isError).toBeFalsy();
    expect(parsed.path).toBe("GroupWrapper");
    expect(parsed.requested_path).toBeUndefined();
    expect((parsed.schema as Record<string, unknown>).description).toBe(
      "grouping object only — not a schema node",
    );
  });

  it("prefers a nested schema-node match over a shallow wrapper with the same name", async () => {
    const server = makeMcpServer();
    registerSchemaTool(server, undefined, undefined, {
      prefer_schema: {
        schema: WRAPPER_VS_SCHEMA_SCHEMA,
        description: "Wrapper vs schema node preference test",
        group: "test",
      },
    });

    const result = await server.call("harness_schema", {
      resource_type: "prefer_schema",
      path: "StageRef",
    });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(result.isError).toBeFalsy();
    expect(parsed.path).toBe("groups.StageRef.nested.StageRef");
    expect(parsed.requested_path).toBe("StageRef");
    expect((parsed.schema as Record<string, unknown>).title).toBe("StageRef");
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
