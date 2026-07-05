/**
 * Regression tests for Zod 4 input schema description chaining (PR #398).
 *
 * In Zod 4, `.optional()` / `.default()` / `.min()` each return a fresh wrapper
 * whose `.description` getter does not inherit from inner schemas. Fields that
 * call `.describe()` before `.optional()` or `.default()` lose descriptions on
 * the MCP tool surface — breaking LLM tool selection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";

type InputSchema = Record<string, { description?: string | null } | undefined>;

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    ...overrides,
  };
}

function makeClient(): HarnessClient {
  return {
    request: vi.fn().mockResolvedValue({ data: {} }),
    account: "test-account",
  } as unknown as HarnessClient;
}

function makeMcpServer() {
  const tools = new Map<string, { schema: { inputSchema: InputSchema } }>();
  return {
    registerTool: vi.fn((name: string, schema: { inputSchema: InputSchema }) => {
      tools.set(name, { schema });
    }),
    schema(name: string): { inputSchema: InputSchema } {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      return tool.schema;
    },
  };
}

function expectFieldDescriptions(inputSchema: InputSchema, fields: string[]): void {
  for (const field of fields) {
    const desc = inputSchema[field]?.description;
    expect(desc, `field "${field}" must expose a description on the registered schema`).toBeTruthy();
    expect(desc!.length, `field "${field}" description must be non-empty`).toBeGreaterThan(5);
  }
}

describe("Zod 4 input schema descriptions (PR #398 regression)", () => {
  let registry: Registry;
  let client: HarnessClient;
  let server: ReturnType<typeof makeMcpServer>;

  beforeEach(() => {
    registry = new Registry(makeConfig());
    client = makeClient();
    server = makeMcpServer();
  });

  it("harness_list exposes descriptions on default-backed pagination and visual fields", async () => {
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(server as never, registry, client);

    expectFieldDescriptions(server.schema("harness_list").inputSchema, [
      "page",
      "size",
      "compact",
      "include_visual",
      "visual_type",
      "org_id",
      "project_id",
      "resource_scope",
    ]);
  });

  it("harness_search exposes descriptions on default-backed result limits", async () => {
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(server as never, registry, client);

    expectFieldDescriptions(server.schema("harness_search").inputSchema, [
      "max_per_type",
      "compact",
      "org_id",
      "project_id",
      "resource_scope",
      "query",
    ]);
  });

  it("harness_status exposes descriptions on default-backed limit and visual fields", async () => {
    const { registerStatusTool } = await import("../../src/tools/harness-status.js");
    registerStatusTool(server as never, registry, client);

    expectFieldDescriptions(server.schema("harness_status").inputSchema, [
      "limit",
      "include_visual",
      "org_id",
      "project_id",
      "url",
    ]);
  });

  it("harness_describe exposes descriptions on optional filter fields", async () => {
    const { registerDescribeTool } = await import("../../src/tools/harness-describe.js");
    registerDescribeTool(server as never, registry);

    expectFieldDescriptions(server.schema("harness_describe").inputSchema, [
      "resource_type",
      "toolset",
      "search_term",
    ]);
  });

  it("harness_diagnose exposes descriptions on optional scope and option fields", async () => {
    const { registerDiagnoseTool } = await import("../../src/tools/harness-diagnose.js");
    registerDiagnoseTool(server as never, registry, client);

    expectFieldDescriptions(server.schema("harness_diagnose").inputSchema, [
      "resource_type",
      "resource_id",
      "url",
      "org_id",
      "project_id",
      "options",
    ]);
  });

  it("harness_get exposes descriptions on optional scope and identifier fields", async () => {
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server as never, registry, client);

    expectFieldDescriptions(server.schema("harness_get").inputSchema, [
      "resource_type",
      "resource_id",
      "url",
      "org_id",
      "project_id",
      "resource_scope",
      "params",
      "return_download_url",
    ]);
  });

  it("harness_schema exposes descriptions on live-entity scope fields", async () => {
    const { registerSchemaTool } = await import("../../src/tools/harness-schema.js");
    registerSchemaTool(server as never, registry, client);

    expectFieldDescriptions(server.schema("harness_schema").inputSchema, [
      "resource_type",
      "scope",
      "org_id",
      "project_id",
      "path",
      "example",
      "example_search",
    ]);
  });
});
