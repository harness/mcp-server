/**
 * Tests for the `runbook` and `runbook_execution` resources (runbooks toolset).
 *
 * All REST calls go through a mocked client.request; no real API is hit.
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

const RUNBOOKS_PATH = "/gateway/ir/tp/api/v1/mc/runbooks";
const RUNBOOK_ID = "tp::test-project/scripted_restart:latest";
const ENCODED_RUNBOOK_ID = encodeURIComponent(RUNBOOK_ID);

type RequestOpts = {
  method: string;
  path: string;
  params: Record<string, unknown>;
  body?: Record<string, unknown>;
};

function optsOf(call: unknown[]): RequestOpts {
  return call[0] as RequestOpts;
}

describe("runbook — harness_list", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    const registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue({
      entities: [{ runbookId: "a", displayName: "A", description: "d", exposeToAi: true }],
      totalCount: 1,
    });
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(server, registry, makeClient(mockRequest));
  });

  it("GETs the runbooks route with MC scope params and exposedToAi=true", async () => {
    await server.call("harness_list", { resource_type: "runbook" });
    const opts = optsOf(mockRequest.mock.calls[0]!);
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe(RUNBOOKS_PATH);
    expect(opts.params.accountId).toBe("test-account");
    expect(opts.params.orgId).toBe("default");
    expect(opts.params.projectId).toBe("test-project");
    expect(opts.params.exposedToAi).toBe("true");
    expect(opts.params.incidentId).toBeUndefined();
  });

  it("projects each runbook to serviceId, displayName and description", async () => {
    const result = await server.call("harness_list", { resource_type: "runbook" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { items: Array<Record<string, unknown>>; total: number };
    expect(data.items).toEqual([{ serviceId: "a", displayName: "A", description: "d" }]);
    expect(data.total).toBe(1);
  });

  it("caps the list at 10 runbooks and flags truncation", async () => {
    const entities = Array.from({ length: 12 }, (_, i) => ({
      runbookId: `rb-${i}`, displayName: `R${i}`, description: "d", exposeToAi: true,
    }));
    mockRequest.mockResolvedValue({ entities, totalCount: 12 });
    const result = await server.call("harness_list", { resource_type: "runbook" });
    const data = parseResult(result) as { items: Array<{ serviceId: string }>; total: number; truncated: boolean };
    expect(data.items).toHaveLength(10);
    expect(data.items[0]?.serviceId).toBe("rb-0");
    expect(data.items[9]?.serviceId).toBe("rb-9");
    expect(data.total).toBe(12);
    expect(data.truncated).toBe(true);
  });

  it("requests at most 10 runbooks per page so the next page is contiguous", async () => {
    await server.call("harness_list", { resource_type: "runbook" });
    await server.call("harness_list", { resource_type: "runbook", size: 20, page: 0 });
    await server.call("harness_list", { resource_type: "runbook", size: "50", page: 1 });
    await server.call("harness_list", { resource_type: "runbook", size: 5, page: 2 });
    expect(optsOf(mockRequest.mock.calls[0]!).params.pageSize).toBe(10);
    expect(optsOf(mockRequest.mock.calls[0]!).params.page).toBeUndefined();
    expect(optsOf(mockRequest.mock.calls[1]!).params).toMatchObject({ pageSize: 10, page: 0 });
    expect(optsOf(mockRequest.mock.calls[2]!).params).toMatchObject({ pageSize: 10, page: 1 });
    expect(optsOf(mockRequest.mock.calls[3]!).params).toMatchObject({ pageSize: 5, page: 2 });
  });

  it("does not mark a full or final page truncated when the payload itself was not cut", async () => {
    const page = Array.from({ length: 10 }, (_, i) => ({
      runbookId: `rb-${i}`, displayName: `R${i}`, description: "d",
    }));
    mockRequest.mockResolvedValue({ entities: page, totalCount: 25 });
    const full = parseResult(await server.call("harness_list", { resource_type: "runbook", page: 0 })) as {
      truncated: boolean; total: number; items: unknown[];
    };
    expect(full.items).toHaveLength(10);
    expect(full.total).toBe(25);
    expect(full.truncated).toBe(false);

    mockRequest.mockResolvedValue({ entities: page.slice(0, 2), totalCount: 12 });
    const last = parseResult(await server.call("harness_list", { resource_type: "runbook", page: 1 })) as {
      truncated: boolean; items: unknown[];
    };
    expect(last.items).toHaveLength(2);
    expect(last.truncated).toBe(false);
  });

  it("passes incident_id through as the incidentId query param", async () => {
    await server.call("harness_list", { resource_type: "runbook", filters: { incident_id: "INC-1" } });
    expect(optsOf(mockRequest.mock.calls[0]!).params.incidentId).toBe("INC-1");
  });

  it("surfaces REST errors", async () => {
    mockRequest.mockRejectedValue(new Error("boom"));
    const result = await server.call("harness_list", { resource_type: "runbook" });
    expect(result.isError).toBe(true);
  });
});

describe("runbook — harness_get", () => {
  it("GETs the percent-encoded runbook id path and maps inputs", async () => {
    const server = makeMcpServer();
    const mockRequest = vi.fn().mockResolvedValue({
      runbookId: RUNBOOK_ID,
      displayName: "Restart",
      exposeToAi: true,
      inputs: [
        { name: "host", type: "STRING", required: true },
        { name: "count", type: "INTEGER", required: false, defaultValue: "3" },
      ],
      outputs: [],
    });
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, new Registry(makeConfig()), makeClient(mockRequest));

    const result = await server.call("harness_get", { resource_type: "runbook", resource_id: RUNBOOK_ID });

    expect(result.isError).toBeUndefined();
    expect(optsOf(mockRequest.mock.calls[0]!).path).toBe(`${RUNBOOKS_PATH}/${ENCODED_RUNBOOK_ID}`);
    const data = parseResult(result) as { serviceId: string; inputs: Array<Record<string, unknown>> };
    expect(data.serviceId).toBe(RUNBOOK_ID);
    expect(data.inputs[0]).toEqual({ name: "host", type: "STRING", required: true });
    expect(data.inputs[1]).toEqual({ name: "count", type: "INTEGER", required: false, default: "3" });
  });
});

describe("runbook — harness_execute run", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    mockRequest = vi.fn().mockResolvedValue({ scriptRunId: "run-1", status: "PENDING" });
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server, new Registry(makeConfig()), makeClient(mockRequest), makeConfig());
  });

  it("POSTs inputs and incidentId to the executions path built from resource_id", async () => {
    const result = await server.call("harness_execute", {
      resource_type: "runbook",
      action: "run",
      resource_id: RUNBOOK_ID,
      body: { inputs: { host: "h1", count: 3 }, incidentId: "INC-1" },
    });
    expect(result.isError).toBeUndefined();
    expect(parseResult(result)).toMatchObject({ scriptRunId: "run-1", status: "PENDING" });
    const opts = optsOf(mockRequest.mock.calls[0]!);
    expect(opts.method).toBe("POST");
    expect(opts.path).toBe(`${RUNBOOKS_PATH}/${ENCODED_RUNBOOK_ID}/executions`);
    expect(opts.params.projectId).toBe("test-project");
    expect(opts.body).toEqual({ inputs: { host: "h1", count: 3 }, incidentId: "INC-1" });
  });

  it("takes service_id from the body and omits it, and an absent incident, from the request body", async () => {
    await server.call("harness_execute", {
      resource_type: "runbook",
      action: "run",
      body: { service_id: RUNBOOK_ID, inputs: { host: "h1" } },
    });
    const opts = optsOf(mockRequest.mock.calls[0]!);
    expect(opts.path).toBe(`${RUNBOOKS_PATH}/${ENCODED_RUNBOOK_ID}/executions`);
    expect(opts.body).toEqual({ inputs: { host: "h1" } });
  });

  it("accepts the legacy incident_id spelling", async () => {
    await server.call("harness_execute", {
      resource_type: "runbook",
      action: "run",
      resource_id: RUNBOOK_ID,
      body: { inputs: {}, incident_id: "INC-2" },
    });
    expect(optsOf(mockRequest.mock.calls[0]!).body).toEqual({ inputs: {}, incidentId: "INC-2" });
  });

  it("surfaces a server-side validation error", async () => {
    mockRequest.mockRejectedValue(new Error("Missing required inputs: host"));
    const result = await server.call("harness_execute", {
      resource_type: "runbook",
      action: "run",
      resource_id: RUNBOOK_ID,
      body: { inputs: {} },
    });
    expect(result.isError).toBe(true);
  });

  it("is low_write and never retried", () => {
    const def = new Registry(makeConfig()).getResource("runbook");
    expect(def.executeActions?.run?.operationPolicy).toEqual({ risk: "low_write", retryPolicy: "do_not_retry" });
  });
});

describe("runbook_execution", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    mockRequest = vi.fn();
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerGetTool(server, registry, client);
    registerListTool(server, registry, client);
  });

  it("gets one run by service_id + script_run_id with parsed outputs", async () => {
    mockRequest.mockResolvedValue({
      scriptRunId: "run-1",
      status: "SUCCESS",
      startedAt: 1000,
      triggeredByAiAgent: true,
      outputs: { echo: "hi" },
    });
    const result = await server.call("harness_get", {
      resource_type: "runbook_execution",
      resource_id: "run-1",
      params: { service_id: RUNBOOK_ID },
    });
    expect(result.isError).toBeUndefined();
    expect(optsOf(mockRequest.mock.calls[0]!).path).toBe(
      `${RUNBOOKS_PATH}/${ENCODED_RUNBOOK_ID}/executions/run-1`,
    );
    expect(parseResult(result)).toMatchObject({ scriptRunId: "run-1", status: "SUCCESS", outputs: { echo: "hi" } });
  });

  it("lists runs with cursor pagination and hides the cursor on the last page", async () => {
    mockRequest.mockResolvedValue({
      results: [{ scriptRunId: "run-2", status: "RUNNING" }],
      nextPageCursor: "stale",
      hasMoreResults: false,
    });
    const result = await server.call("harness_list", {
      resource_type: "runbook_execution",
      filters: { service_id: RUNBOOK_ID, cursor: "cur" },
    });
    const opts = optsOf(mockRequest.mock.calls[0]!);
    expect(opts.path).toBe(`${RUNBOOKS_PATH}/${ENCODED_RUNBOOK_ID}/executions`);
    expect(opts.params.cursor).toBe("cur");
    const data = parseResult(result) as { items: unknown[]; pagination: Record<string, unknown> };
    expect(data.items).toHaveLength(1);
    expect(data.pagination.has_more).toBe(false);
    expect(data.pagination.next_cursor).toBeUndefined();
  });

  it("returns next_cursor when more results remain", async () => {
    mockRequest.mockResolvedValue({ results: [], nextPageCursor: "next", hasMoreResults: true });
    const result = await server.call("harness_list", {
      resource_type: "runbook_execution",
      filters: { service_id: RUNBOOK_ID },
    });
    const data = parseResult(result) as { pagination: Record<string, unknown> };
    expect(data.pagination).toMatchObject({ has_more: true, next_cursor: "next" });
  });
});
