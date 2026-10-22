/**
 * Tests for the `runbook` and `runbook_execution` resources (runbooks toolset).
 *
 * All GraphQL calls go through a mocked client.request; no real API is hit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import { Registry } from "../../src/registry/index.js";

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
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_TOOLSETS: "runbooks",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function makeMcpServer(elicitAction: "accept" | "decline" | "cancel" = "accept") {
  const tools = new Map<string, { handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    server: {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput: vi.fn().mockResolvedValue({ action: elicitAction }),
    },
    registerTool: vi.fn((name: string, _schema: unknown, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { handler });
    }),
    async call(name: string, args: Record<string, unknown>, extra?: Record<string, unknown>): Promise<ToolResult> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      const defaultExtra = { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} };
      return tool.handler(args, { ...defaultExtra, ...extra }) as Promise<ToolResult>;
    },
  } as any;
}

function parseResult(result: ToolResult): unknown {
  const item = result.content[0]!;
  if (item.type !== "text") throw new Error(`Expected text content, got "${item.type}"`);
  return JSON.parse(item.text);
}

const GRAPHQL_PATH = "/gateway/ir/tp/api/v1/mc/graphql/harness/query";

function gql(data: unknown) {
  return { data };
}

function bodyOf(call: unknown[]): { operationName: string; variables: Record<string, any> } {
  return (call[0] as { body: any }).body;
}

describe("runbook — harness_list", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    const registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockImplementation(async (opts: { body: { operationName: string } }) => {
      if (opts.body.operationName === "ActivityLookup") {
        return gql({ activity: { id: "act-global", publicId: "INC-1", templateGlobalId: "tpl-global" } });
      }
      return gql({
        scriptedActions: {
          actions: [
            { serviceId: "a", displayName: "A", description: "d", exposeToAi: true },
            { serviceId: "b", displayName: "B", description: "d", exposeToAi: false },
          ],
        },
      });
    });
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(server, registry, makeClient(mockRequest));
  });

  it("returns only exposeToAi runbooks with a compact shape", async () => {
    const result = await server.call("harness_list", { resource_type: "runbook" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { items: Array<Record<string, unknown>>; total: number };
    expect(data.items).toEqual([{ serviceId: "a", displayName: "A", description: "d" }]);
    expect(data.total).toBe(1);
  });

  it("caps the list at 10 runbooks and flags truncation", async () => {
    const actions = Array.from({ length: 12 }, (_, i) => ({
      serviceId: `rb-${i}`, displayName: `R${i}`, description: "d", exposeToAi: true,
    }));
    mockRequest.mockResolvedValue(gql({ scriptedActions: { actions } }));
    const result = await server.call("harness_list", { resource_type: "runbook" });
    const data = parseResult(result) as { items: unknown[]; total: number; truncated: boolean };
    expect(data.items).toHaveLength(10);
    expect(data.total).toBe(12);
    expect(data.truncated).toBe(true);
  });

  it("posts ListRunbooks to the graphql route with MC scope params and no template filter", async () => {
    await server.call("harness_list", { resource_type: "runbook" });
    const call = mockRequest.mock.calls[0]!;
    const opts = call[0] as { path: string; method: string; params: Record<string, unknown> };
    expect(opts.path).toBe(GRAPHQL_PATH);
    expect(opts.method).toBe("POST");
    expect(opts.params.accountId).toBe("test-account");
    expect(opts.params.orgId).toBe("default");
    expect(opts.params.projectId).toBe("test-project");
    expect(bodyOf(call).operationName).toBe("ListRunbooks");
    expect(bodyOf(call).variables.activityTemplateGlobalId).toBeNull();
  });

  it("narrows by the incident's template when incident_id is given", async () => {
    await server.call("harness_list", { resource_type: "runbook", filters: { incident_id: "INC-1" } });
    expect(bodyOf(mockRequest.mock.calls[0]!).operationName).toBe("ActivityLookup");
    const listCall = mockRequest.mock.calls[1]!;
    expect(bodyOf(listCall).operationName).toBe("ListRunbooks");
    expect(bodyOf(listCall).variables.activityTemplateGlobalId).toBe("tpl-global");
  });

  it("surfaces GraphQL errors returned with HTTP 200", async () => {
    mockRequest.mockResolvedValue({ errors: [{ message: "boom" }] });
    const result = await server.call("harness_list", { resource_type: "runbook" });
    expect(result.isError).toBe(true);
  });

  it("surfaces incident lookup failures when incident_id filter is invalid", async () => {
    mockRequest.mockImplementation(async (opts: { body: { operationName: string } }) => {
      if (opts.body.operationName === "ActivityLookup") {
        return { errors: [{ message: "not found" }] };
      }
      return gql({ scriptedActions: { actions: [] } });
    });
    const result = await server.call("harness_list", {
      resource_type: "runbook",
      filters: { incident_id: "INC-bad" },
    });
    expect(result.isError).toBe(true);
    expect(mockRequest.mock.calls.some((c) => bodyOf(c).operationName === "ListRunbooks")).toBe(false);
  });
});

describe("runbook — harness_get", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    const registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue(
      gql({
        scriptedAction: {
          action: {
            serviceId: "rb",
            displayName: "Restart",
            exposeToAi: true,
            inputs: [{ name: "host", type: "STRING", required: true }],
            outputs: [],
          },
        },
      }),
    );
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, registry, makeClient(mockRequest));
  });

  it("returns the runbook action when exposed to AI", async () => {
    const result = await server.call("harness_get", { resource_type: "runbook", resource_id: "rb" });
    expect(result.isError).toBeUndefined();
    expect(parseResult(result)).toMatchObject({ serviceId: "rb", exposeToAi: true });
    const call = mockRequest.mock.calls[0]!;
    expect(bodyOf(call).operationName).toBe("GetRunbook");
    expect(bodyOf(call).variables.serviceId).toBe("rb");
  });

  it("rejects runbooks that are not exposed to AI", async () => {
    mockRequest.mockResolvedValue(
      gql({ scriptedAction: { action: { serviceId: "rb", exposeToAi: false } } }),
    );
    const result = await server.call("harness_get", { resource_type: "runbook", resource_id: "rb" });
    expect(result.isError).toBe(true);
  });
});

describe("runbook — harness_execute run", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let mockRequest: ReturnType<typeof vi.fn>;
  let executeResponse: unknown;

  beforeEach(async () => {
    server = makeMcpServer();
    const registry = new Registry(makeConfig());
    executeResponse = gql({ executeScriptedAction: { scriptRunId: "run-1", success: true, errors: [] } });
    mockRequest = vi.fn().mockImplementation(async (opts: { body: { operationName: string } }) => {
      switch (opts.body.operationName) {
        case "GetRunbook":
          return gql({
            scriptedAction: {
              action: {
                serviceId: "rb",
                exposeToAi: true,
                inputs: [
                  { name: "host", type: "STRING", required: true },
                  { name: "count", type: "INTEGER", required: false },
                ],
              },
            },
          });
        case "ActivityLookup":
          return gql({ activity: { id: "act-global", publicId: "INC-1", templateGlobalId: "tpl" } });
        default:
          return executeResponse;
      }
    });
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server, registry, makeClient(mockRequest), makeConfig());
  });

  const run = (body: Record<string, unknown>) =>
    server.call("harness_execute", { resource_type: "runbook", action: "run", body });

  it("sends typed parameters, isTest:false, empty keys and the resolved activity", async () => {
    const result = await run({ service_id: "rb", inputs: { host: "h1", count: 3 }, incident_id: "INC-1" });
    expect(result.isError).toBeUndefined();
    expect(parseResult(result)).toMatchObject({ scriptRunId: "run-1" });
    const exec = bodyOf(mockRequest.mock.calls.at(-1)!);
    expect(exec.operationName).toBe("ExecuteRunbook");
    expect(exec.variables).toMatchObject({
      serviceId: "rb",
      parameters: [
        { name: "host", type: "STRING", value: "h1" },
        { name: "count", type: "INTEGER", value: "3" },
      ],
      keys: [],
      isTest: false,
      activityGlobalId: "act-global",
    });
  });

  it("runs standalone without incident_id", async () => {
    await run({ service_id: "rb", inputs: { host: "h1" } });
    const exec = bodyOf(mockRequest.mock.calls.at(-1)!);
    expect(exec.variables.activityGlobalId).toBeNull();
    expect(exec.variables.isTest).toBe(false);
    expect(mockRequest.mock.calls.some((c) => bodyOf(c).operationName === "ActivityLookup")).toBe(false);
  });

  it("rejects undeclared inputs without executing", async () => {
    const result = await run({ service_id: "rb", inputs: { host: "h1", bogus: "x" } });
    expect(result.isError).toBe(true);
    expect(mockRequest.mock.calls.some((c) => bodyOf(c).operationName === "ExecuteRunbook")).toBe(false);
  });

  it("rejects a missing required input without executing", async () => {
    const result = await run({ service_id: "rb", inputs: {} });
    expect(result.isError).toBe(true);
    expect(mockRequest.mock.calls.some((c) => bodyOf(c).operationName === "ExecuteRunbook")).toBe(false);
  });

  it("rejects when the runbook does not exist before ExecuteRunbook", async () => {
    mockRequest.mockImplementation(async (opts: { body: { operationName: string } }) => {
      if (opts.body.operationName === "GetRunbook") {
        return gql({ scriptedAction: { action: null } });
      }
      return executeResponse;
    });
    const result = await run({ service_id: "missing", inputs: { host: "h1" } });
    expect(result.isError).toBe(true);
    expect(mockRequest.mock.calls.some((c) => bodyOf(c).operationName === "ExecuteRunbook")).toBe(false);
  });

  it("passes string input values through without JSON-encoding them", async () => {
    await run({ service_id: "rb", inputs: { host: "literal-string" } });
    const exec = bodyOf(mockRequest.mock.calls.at(-1)!);
    expect(exec.variables.parameters).toContainEqual({
      name: "host",
      type: "STRING",
      value: "literal-string",
    });
  });

  it("maps success:false to an error", async () => {
    executeResponse = gql({ executeScriptedAction: { scriptRunId: null, success: false, errors: [{ message: "nope" }] } });
    const result = await run({ service_id: "rb", inputs: { host: "h1" } });
    expect(result.isError).toBe(true);
  });

  it("is low_write and never retried", () => {
    const def = new Registry(makeConfig()).getResource("runbook");
    expect(def.executeActions?.run?.operationPolicy).toEqual({ risk: "low_write", retryPolicy: "do_not_retry" });
  });
});

describe("runbook_execution — harness_get", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    const registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue(
      gql({
        runbookExecutions: {
          executions: [
            { scriptRunId: "run-2", status: "RUNNING" },
            { scriptRunId: "run-1", status: "SUCCESS" },
          ],
          hasMore: false,
          paginationToken: null,
        },
      }),
    );
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, registry, makeClient(mockRequest));
  });

  it("returns the matching run for service_id + script_run_id", async () => {
    const result = await server.call("harness_get", {
      resource_type: "runbook_execution",
      resource_id: "run-1",
      params: { service_id: "rb" },
    });
    expect(result.isError).toBeUndefined();
    expect(parseResult(result)).toMatchObject({ scriptRunId: "run-1", status: "SUCCESS" });
    const call = mockRequest.mock.calls[0]!;
    expect(bodyOf(call).operationName).toBe("RunbookExecutions");
    expect(bodyOf(call).variables.scriptedActionId).toBe("rb");
    expect(bodyOf(call).query).toContain("errorMessage outputsJson");
  });

  it("errors when the run is not among the recent runs", async () => {
    const result = await server.call("harness_get", {
      resource_type: "runbook_execution",
      resource_id: "missing",
      params: { service_id: "rb" },
    });
    expect(result.isError).toBe(true);
  });
});

describe("runbook_execution — harness_list", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    const registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue(
      gql({
        runbookExecutions: {
          executions: [{ scriptRunId: "run-1", status: "SUCCESS" }],
          hasMore: true,
          paginationToken: "tok-2",
        },
      }),
    );
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(server, registry, makeClient(mockRequest));
  });

  it("requires filters.service_id", async () => {
    const result = await server.call("harness_list", { resource_type: "runbook_execution" });
    expect(result.isError).toBe(true);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("lists recent runs with pagination metadata", async () => {
    const result = await server.call("harness_list", {
      resource_type: "runbook_execution",
      filters: { service_id: "rb", cursor: "tok-1" },
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as {
      items: unknown[];
      pagination: { has_more: boolean; next_cursor?: string };
    };
    expect(data.items).toHaveLength(1);
    expect(data.pagination).toEqual({ has_more: true, next_cursor: "tok-2" });
    const call = mockRequest.mock.calls[0]!;
    expect(bodyOf(call).operationName).toBe("RunbookExecutions");
    expect(bodyOf(call).variables).toMatchObject({
      scriptedActionId: "rb",
      paginationToken: "tok-1",
    });
  });
});
