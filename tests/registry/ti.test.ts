import { describe, it, expect, vi } from "vitest";
import type { ZodType } from "zod/v4";
import { Registry } from "../../src/registry/index.js";
import { testCaseListExtract } from "../../src/registry/extractors.js";
import { registerListTool } from "../../src/tools/harness-list.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_TOOLSETS: "ti",
    ...overrides,
  } as Config;
}

function makeListServer(request: ReturnType<typeof vi.fn>) {
  const tools = new Map<string, { schema: { inputSchema: ZodType }; handler: (...args: unknown[]) => Promise<ToolResult> }>();
  const server = {
    registerTool: vi.fn((name: string, schema: { inputSchema: ZodType }, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { schema, handler });
    }),
  };
  const client = { request, account: "test-account" } as unknown as HarnessClient;
  registerListTool(server as never, new Registry(makeConfig()), client);
  const tool = tools.get("harness_list")!;
  return {
    inputSchema: tool.schema.inputSchema,
    async call(args: Record<string, unknown>): Promise<ToolResult> {
      return tool.handler(args, { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} });
    },
  };
}

function parseResult(result: ToolResult): { items: Array<Record<string, unknown>>; total: number } {
  const item = result.content[0]!;
  if (item.type !== "text") throw new Error(`Expected text content, got "${item.type}"`);
  return JSON.parse(item.text);
}

const TEST_CASE = {
  name: "testLogin",
  class_name: "com.acme.AuthTest",
  file_name: "AuthTest.java",
  suite_name: "AuthSuite",
  result: { status: "failed", message: "expected 200", type: "AssertionError", desc: "long stack trace" },
  duration_ms: 1234,
  stdout: "very long stdout",
  stderr: "very long stderr",
  flaky: true,
  quarantine: false,
  problematic: false,
};

describe("testCaseListExtract", () => {
  it("shapes content/data into { items, total }", () => {
    expect(
      testCaseListExtract({ data: { totalItems: 42 }, content: [{ name: "a" }, { name: "b" }] }),
    ).toEqual({ items: [{ name: "a" }, { name: "b" }], total: 42 });
  });

  it("handles empty or null content", () => {
    expect(testCaseListExtract({ content: null })).toEqual({ items: [], total: 0 });
    expect(testCaseListExtract(undefined)).toEqual({ items: [], total: 0 });
  });
});

describe("ti toolset", () => {
  it("is opt-in and not loaded by default", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined }));
    expect(() => registry.getResource("test_case")).toThrow();
  });

  it("is loaded with +ti", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "+ti" }));
    expect(registry.getResource("test_case").toolset).toBe("ti");
  });

  it("maps list params to the public API's camelCase query params and scope", async () => {
    const registry = new Registry(makeConfig());
    const request = vi.fn().mockResolvedValue({ data: { totalItems: 1 }, content: [{ name: "t" }] });
    const client = { request, account: "test-account" } as unknown as HarnessClient;

    const result = await registry.dispatch(client, "test_case", "list", {
      pipeline_id: "p1",
      build_id: "12",
      page: 1,
      size: 100,
    });

    const call = request.mock.calls[0]![0] as { method: string; path: string; params: Record<string, unknown> };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gateway/ti-service/api/v1/test-cases");
    expect(call.params).toMatchObject({
      accountId: "test-account",
      orgId: "default",
      projectId: "test-project",
      pipelineId: "p1",
      buildId: "12",
      pageIndex: 1,
      pageSize: 100,
    });
    // Params the server ignores must never be sent.
    for (const k of ["status", "sort", "order", "report", "flaky", "suite_name", "testCaseSearchTerm"]) {
      expect(call.params).not.toHaveProperty(k);
    }
    expect(result).toMatchObject({ items: [{ name: "t" }], total: 1 });
  });

  it("does not expose the report param (server pins junit)", () => {
    const registry = new Registry(makeConfig());
    const def = registry.getResource("test_case");
    expect(def.operations.list?.queryParams).not.toHaveProperty("report");
    expect(def.listFilterFields?.map((f) => (typeof f === "string" ? f : f.name))).not.toContain("report");
  });

  it("documents the limits agents need in the description", () => {
    const registry = new Registry(makeConfig());
    const def = registry.getResource("test_case");
    expect(def.description.length).toBeLessThanOrEqual(500);
    const desc = def.operations.list!.description;
    expect(desc).toMatch(/size 1-100 \(default 20\)/);
    expect(`${def.description} ${desc} ${def.diagnosticHint}`).not.toMatch(/1000/);
    expect(desc).toMatch(/Does NOT filter or sort server-side/);
    expect(desc).toMatch(/silently ignored/);
    expect(desc).toMatch(/204/);
    expect(desc).toMatch(/Does NOT return console logs/);
    // Descriptions must not steer the agent to other resources.
    expect(`${def.description} ${desc}`).not.toMatch(/resource_type=|\buse (execution|execution_log)\b/);
  });
});

describe("test_case — harness_list entry path", () => {
  it("sends scope and filters, with harness_list paging mapped to pageIndex/pageSize", async () => {
    const request = vi.fn().mockResolvedValue({ data: { totalItems: 30 }, content: [TEST_CASE] });
    const server = makeListServer(request);

    const result = await server.call({
      resource_type: "test_case",
      page: 2,
      size: 15,
      filters: { pipeline_id: "p1", build_id: "12", stage_id: "build", step_id: "run_tests" },
    });

    expect(result.isError).toBeUndefined();
    const call = request.mock.calls[0]![0] as { method: string; path: string; params: Record<string, unknown> };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gateway/ti-service/api/v1/test-cases");
    expect(call.params).toMatchObject({
      accountId: "test-account",
      orgId: "default",
      projectId: "test-project",
      pipelineId: "p1",
      buildId: "12",
      stageId: "build",
      stepId: "run_tests",
      pageIndex: 2,
      pageSize: 15,
    });
    expect(parseResult(result).total).toBe(30);
  });

  it("caps size at 100 in the public input schema", () => {
    const { inputSchema } = makeListServer(vi.fn());
    expect(inputSchema.safeParse({ size: 100 }).success).toBe(true);
    expect(inputSchema.safeParse({ size: 101 }).success).toBe(false);
  });

  it("keeps the advertised fields in compact mode and drops stdout/stderr", async () => {
    const request = vi.fn().mockResolvedValue({ data: { totalItems: 1 }, content: [TEST_CASE] });
    const result = await makeListServer(request).call({
      resource_type: "test_case",
      filters: { pipeline_id: "p1", build_id: "12" },
    });

    expect(parseResult(result).items).toEqual([
      {
        name: "testLogin",
        suite_name: "AuthSuite",
        class_name: "com.acme.AuthTest",
        file_name: "AuthTest.java",
        result: { status: "failed", message: "expected 200" },
        duration_ms: 1234,
        flaky: true,
        quarantine: false,
        problematic: false,
      },
    ]);
  });

  it("returns stdout/stderr with compact=false", async () => {
    const request = vi.fn().mockResolvedValue({ data: { totalItems: 1 }, content: [TEST_CASE] });
    const result = await makeListServer(request).call({
      resource_type: "test_case",
      compact: false,
      filters: { pipeline_id: "p1", build_id: "12" },
    });

    expect(parseResult(result).items).toEqual([TEST_CASE]);
  });

  it("returns an empty list for a 204 (client yields its no-content marker)", async () => {
    const request = vi.fn().mockResolvedValue({ status: "SUCCESS", message: "No content" });
    const result = await makeListServer(request).call({
      resource_type: "test_case",
      filters: { pipeline_id: "p1", build_id: "12" },
    });

    expect(result.isError).toBeUndefined();
    expect(parseResult(result)).toMatchObject({ items: [], total: 0 });
  });

  it("fails loudly when a required filter is missing", async () => {
    const request = vi.fn();
    const result = await makeListServer(request).call({
      resource_type: "test_case",
      filters: { pipeline_id: "p1" },
    });

    expect(result.isError).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
});
