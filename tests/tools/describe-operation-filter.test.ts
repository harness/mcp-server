import { describe, it, expect, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import { Registry } from "../../src/registry/index.js";
import { registerDescribeTool } from "../../src/tools/harness-describe.js";

function makeConfig(): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
  } as Config;
}

function makeServer() {
  const tools = new Map<string, (args: Record<string, unknown>) => Promise<ToolResult>>();
  return {
    registerTool: vi.fn((name: string, _schema: unknown, handler: (args: Record<string, unknown>) => Promise<ToolResult>) => {
      tools.set(name, handler);
    }),
    call(name: string, args: Record<string, unknown>) {
      const handler = tools.get(name);
      if (!handler) throw new Error(`Tool "${name}" not registered`);
      return handler(args);
    },
  };
}

function parse(result: ToolResult): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

type Entry = { type: string; name: string; toolset: string; aliases?: string[]; actions?: string[]; ops?: string[] };

describe("harness_describe operation filter", () => {
  const registry = new Registry(makeConfig());
  const server = makeServer();
  registerDescribeTool(server as never, registry);

  it("keeps the no-argument catalog and its mixed ops field", async () => {
    const data = parse(await server.call("harness_describe", {}));
    const types = data.resource_types as Entry[];
    expect(data.total_resource_types).toBe(registry.getAllResourceTypes().length);
    expect(types.find((entry) => entry.type === "pipeline")?.ops).toEqual(expect.arrayContaining(["list", "run"]));
  });

  it("returns lean entries for a CRUD operation", async () => {
    const data = parse(await server.call("harness_describe", { operation: "list" }));
    const types = data.resource_types as Entry[];
    expect(data.operation).toBe("list");
    expect(types.map((entry) => entry.type).sort()).toEqual(registry.getTypesForOperation("list"));
    expect(types.find((entry) => entry.type === "pipeline")).toMatchObject({ name: "Pipeline", toolset: "pipelines" });
    expect(types.every((entry) => entry.ops === undefined && entry.actions === undefined)).toBe(true);
    expect(types.some((entry) => entry.type === "runtime_input_template")).toBe(false);
  });

  it("returns every executable type with its action names", async () => {
    const data = parse(await server.call("harness_describe", { operation: "execute" }));
    const types = data.resource_types as Entry[];
    const pipeline = types.find((entry) => entry.type === "pipeline");
    expect(types.map((entry) => entry.type).sort()).toEqual(registry.getTypesWithExecuteActions());
    expect(pipeline?.actions).toEqual(Object.keys(registry.getExecuteActions("pipeline") ?? {}));
    expect(pipeline?.ops).toBeUndefined();
  });

  it("intersects operation with search and toolset", async () => {
    const searched = parse(await server.call("harness_describe", { operation: "execute", search_term: "pipeline" }));
    const searchTypes = searched.resource_types as Entry[];
    expect(searched.total_results).toBe(searchTypes.length);
    expect(searchTypes.map((entry) => entry.type)).toContain("pipeline");
    expect(searchTypes.every((entry) => entry.actions && entry.actions.length > 0)).toBe(true);

    const toolset = parse(await server.call("harness_describe", { operation: "list", toolset: "pipelines" }));
    const toolsetTypes = toolset.resource_types as Entry[];
    expect(toolsetTypes.length).toBeGreaterThan(0);
    expect(toolsetTypes.every((entry) => entry.toolset === "pipelines")).toBe(true);

    const missed = parse(await server.call("harness_describe", { operation: "list", search_term: "banana" }));
    expect(missed.resource_types).toEqual([]);
    expect(missed.hint).toMatch(/No matches found/);
    expect(missed.hint).toMatch(/operation='list'/);

    const unknown = parse(await server.call("harness_describe", { operation: "list", toolset: "not-a-toolset" }));
    expect(unknown.error).toMatch(/Unknown toolset/);
  });

  it("keeps an unknown resource_type inside the requested operation catalog", async () => {
    const data = parse(await server.call("harness_describe", { resource_type: "not-a-type", operation: "list" }));
    const types = data.resource_types as Entry[];
    expect(data.error).toMatch(/Unknown resource_type "not-a-type"/);
    expect(data.error).toMatch(/operation/);
    expect(data.operation).toBe("list");
    expect(data.total_toolsets).toBeUndefined();
    expect(types.map((entry) => entry.type).sort()).toEqual(registry.getTypesForOperation("list"));
    expect(types.every((entry) => entry.ops === undefined)).toBe(true);
  });

  it("keeps a resource_type lookup detailed when operation is also set", async () => {
    const data = parse(await server.call("harness_describe", { resource_type: "pipeline", operation: "list" }));
    expect(data.resource_type).toBe("pipeline");
    expect(data.operations).toEqual(expect.arrayContaining([expect.objectContaining({ operation: "list" })]));
    expect(data.resource_types).toBeUndefined();
  });
});
