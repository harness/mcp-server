/**
 * Tests for the `incident` resource type (incidents toolset).
 *
 * Verifies the offset-paginated list extractor, path-param substitution,
 * required-field validation on create, and the close execute action — all
 * with a mocked client.request so no real API is hit.
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
    HARNESS_TOOLSETS: "incidents",
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

describe("incident — harness_list", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue({
      entities: [{ prettyId: "INC-1" }, { prettyId: "INC-2" }],
      totalCount: 2,
    });
    client = makeClient(mockRequest);
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(server, registry, client);
  });

  it("maps entities/totalCount to items/total via offsetListExtract", async () => {
    const result = await server.call("harness_list", { resource_type: "incident" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { items: unknown[]; total: number };
    expect(data.items).toHaveLength(2);
    expect(data.total).toBe(2);
  });

  it("hits the incidents list path with scope params", async () => {
    await server.call("harness_list", { resource_type: "incident" });
    const callArgs = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(callArgs.path).toBe("/gateway/ir/tp/api/v1/mc/incidents");
    expect(callArgs.params.accountId).toBe("test-account");
    expect(callArgs.params.orgId).toBe("default");
    expect(callArgs.params.projectId).toBe("test-project");
  });

  it("maps snake_case filters to API query param names", async () => {
    await server.call("harness_list", {
      resource_type: "incident",
      filters: { status: ["new"], impacted_service: ["svc-a"], sort_field: "REPORTED_AT" },
    });
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(callArgs.params.status).toEqual(["new"]);
    expect(callArgs.params.impactedService).toEqual(["svc-a"]);
    expect(callArgs.params.sortField).toBe("REPORTED_AT");
  });

  it("compacts list items: keeps prettyId/severity, replaces heavy timelines with counts", async () => {
    mockRequest.mockResolvedValueOnce({
      entities: [{
        prettyId: "INC-1",
        title: "Outage",
        severity: { id: "1", label: "SEV1" },
        impactedServices: ["svc-a"],
        summary: "short",
        keyEvents: [{ timestamp: 1, status: "FIXING", details: "x" }, { timestamp: 2, status: "FIXING", details: "y" }],
        rootCauseTheories: [{ message: "db", status: "CONFIRMED", confidence: 90, aiGenerated: true }],
        __internalMeta: { trace: "abc" },
      }],
      totalCount: 1,
    });
    const result = await server.call("harness_list", { resource_type: "incident" });
    const data = parseResult(result) as { items: Array<Record<string, unknown>> };
    const item = data.items[0]!;
    expect(item.prettyId).toBe("INC-1");
    expect(item.severity).toEqual({ id: "1", label: "SEV1" });
    expect(item.impactedServices).toEqual(["svc-a"]);
    // Heavy timelines become counts in the list view
    expect(item.keyEvents).toBe(2);
    expect(item.rootCauseTheories).toBe(1);
    // Internal/meta fields are dropped
    expect(item).not.toHaveProperty("__internalMeta");
  });
});

describe("incident — harness_get", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue({
      prettyId: "INC-42",
      title: "Outage",
      severity: { id: "1", label: "SEV1" },
      reportedAtTimestamp: 1781776808000,
      keyEvents: [{ timestamp: 1, status: "INVESTIGATING", details: "looking" }],
      rootCauseTheories: [{ message: "db", status: "CONFIRMED", confidence: 90, aiGenerated: true }],
      // Backend envelope/internal fields that must NOT cross the tool boundary
      __internalMeta: { trace: "abc" },
      correlationId: "xyz",
    });
    client = makeClient(mockRequest);
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, registry, client);
  });

  it("substitutes incident_id into the path", async () => {
    const result = await server.call("harness_get", { resource_type: "incident", resource_id: "INC-42" });
    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { path: string };
    expect(callArgs.path).toBe("/gateway/ir/tp/api/v1/mc/incidents/INC-42");
  });

  it("projects a stable shape and drops backend envelope/meta fields", async () => {
    const result = await server.call("harness_get", { resource_type: "incident", resource_id: "INC-42" });
    const data = parseResult(result) as Record<string, unknown>;
    // Documented fields survive, with severity kept as the {id,label} object
    expect(data.prettyId).toBe("INC-42");
    expect(data.title).toBe("Outage");
    expect(data.severity).toEqual({ id: "1", label: "SEV1" });
    expect(data.reportedAtTimestamp).toBe(1781776808000);
    // Detail view keeps the full timelines (projected to their stable fields)
    expect(data.keyEvents).toEqual([{ timestamp: 1, status: "INVESTIGATING", details: "looking" }]);
    expect(data.rootCauseTheories).toEqual([
      { message: "db", status: "CONFIRMED", confidence: 90, aiGenerated: true },
    ]);
    // Backend envelope/meta must not leak across the tool boundary
    expect(data).not.toHaveProperty("__internalMeta");
    expect(data).not.toHaveProperty("correlationId");
  });
});

describe("incident — harness_create", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer("accept");
    registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue({ prettyId: "INC-99" });
    client = makeClient(mockRequest);
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(server, registry, client);
  });

  it("errors when required fields (templateShortId/title) are missing", async () => {
    const result = await server.call("harness_create", {
      resource_type: "incident",
      body: { summary: "no template or title" },
    });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: string };
    expect(data.error).toContain("templateShortId");
    expect(data.error).toContain("title");
  });

  it("creates an incident when required fields are present", async () => {
    const result = await server.call("harness_create", {
      resource_type: "incident",
      body: { templateShortId: "tmpl-1", title: "DB down", impactedServices: ["svc-a"] },
    });
    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { method: string; path: string; body: Record<string, unknown> };
    expect(callArgs.method).toBe("POST");
    expect(callArgs.path).toBe("/gateway/ir/tp/api/v1/mc/incidents");
    expect(callArgs.body).toMatchObject({ templateShortId: "tmpl-1", title: "DB down" });
  });

  it("projects create response and drops backend envelope fields", async () => {
    mockRequest.mockResolvedValueOnce({
      prettyId: "INC-99",
      title: "DB down",
      severity: { id: "1", label: "SEV1" },
      __internalMeta: { trace: "abc" },
      correlationId: "xyz",
    });

    const result = await server.call("harness_create", {
      resource_type: "incident",
      body: { templateShortId: "tmpl-1", title: "DB down" },
    });
    const data = parseResult(result) as Record<string, unknown>;

    expect(data.prettyId).toBe("INC-99");
    expect(data.title).toBe("DB down");
    expect(data.severity).toEqual({ id: "1", label: "SEV1" });
    expect(data).not.toHaveProperty("__internalMeta");
    expect(data).not.toHaveProperty("correlationId");
  });
});

describe("incident — harness_update", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer("accept");
    registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue({ prettyId: "INC-42" });
    client = makeClient(mockRequest);
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(server, registry, client);
  });

  it("issues a PATCH to the incident path with the merge-patch body", async () => {
    const result = await server.call("harness_update", {
      resource_type: "incident",
      resource_id: "INC-42",
      body: { status: "monitoring" },
    });
    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { method: string; path: string; body: Record<string, unknown> };
    expect(callArgs.method).toBe("PATCH");
    expect(callArgs.path).toBe("/gateway/ir/tp/api/v1/mc/incidents/INC-42");
    expect(callArgs.body).toMatchObject({ status: "monitoring" });
  });
});

describe("incident — harness_execute (close)", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer("accept");
    registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue({ prettyId: "INC-42", status: "CLOSED" });
    client = makeClient(mockRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server, registry, client);
  });

  it("posts to the /close path with no body", async () => {
    const result = await server.call("harness_execute", {
      resource_type: "incident",
      action: "close",
      resource_id: "INC-42",
    });
    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { method: string; path: string; body: unknown };
    expect(callArgs.method).toBe("POST");
    expect(callArgs.path).toBe("/gateway/ir/tp/api/v1/mc/incidents/INC-42/close");
    expect(callArgs.body).toBeUndefined();
  });

  it("projects a stable close response and drops backend envelope/meta fields", async () => {
    mockRequest.mockResolvedValueOnce({
      prettyId: "INC-42",
      status: "CLOSED",
      keyEvents: [{ timestamp: 1, status: "CLOSED", details: "resolved" }],
      rootCauseTheories: [{ message: "db", status: "CONFIRMED", confidence: 90, aiGenerated: true }],
      __internalMeta: { trace: "abc" },
      correlationId: "xyz",
    });

    const result = await server.call("harness_execute", {
      resource_type: "incident",
      action: "close",
      resource_id: "INC-42",
    });
    expect(result.isError).toBeUndefined();

    const data = parseResult(result) as Record<string, unknown>;
    expect(data.prettyId).toBe("INC-42");
    expect(data.status).toBe("CLOSED");
    expect(data.keyEvents).toEqual([{ timestamp: 1, status: "CLOSED", details: "resolved" }]);
    expect(data.rootCauseTheories).toEqual([
      { message: "db", status: "CONFIRMED", confidence: 90, aiGenerated: true },
    ]);
    expect(data).not.toHaveProperty("__internalMeta");
    expect(data).not.toHaveProperty("correlationId");
  });
});
