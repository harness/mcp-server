/**
 * Tests for the `alert` resource type (alerts toolset).
 *
 * Verifies the offset-paginated list extractor, path-param substitution,
 * update PATCH body, lifecycle execute actions, and absence of create — all
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
    HARNESS_TOOLSETS: "alerts",
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

describe("alert resource definition", () => {
  it("does not expose create", () => {
    const registry = new Registry(makeConfig());
    const def = registry.getResource("alert");
    expect(def.operations.create).toBeUndefined();
    expect(Object.keys(def.operations)).toEqual(["list", "get", "update"]);
    expect(Object.keys(def.executeActions ?? {})).toEqual(["acknowledge", "resolve", "dismiss"]);
  });

  it("constrains the priority filter to the known option ids", () => {
    const registry = new Registry(makeConfig());
    const def = registry.getResource("alert");
    const priorityFilter = def.listFilterFields?.find((f) => f.name === "priority");
    expect(priorityFilter?.enum).toEqual(["p1_critical", "p2_error", "p3_warning", "p4_info"]);
  });

  it("names the priority option ids in the update body schema", () => {
    const registry = new Registry(makeConfig());
    const def = registry.getResource("alert");
    const priorityField = def.operations.update?.bodySchema?.fields.find((f) => f.name === "priority");
    // BodyFieldSpec has no enum support, so the values must live in the description.
    for (const id of ["p1_critical", "p2_error", "p3_warning", "p4_info"]) {
      expect(priorityField?.description).toContain(id);
    }
  });

  it("surfaces alert troubleshooting guidance and status response casing", () => {
    const registry = new Registry(makeConfig());
    const def = registry.getResource("alert");
    const statusFilter = def.listFilterFields?.find((f) => f.name === "status");
    expect(def.diagnosticHint).toContain("external writers");
    expect(def.diagnosticHint).toContain("harness_execute");
    expect(def.diagnosticHint).toContain("unrecognized values return an error rather than an empty list");
    expect(def.executeHint).toContain("acknowledge");
    expect(def.executeHint).toContain("resolve");
    expect(def.executeHint).toContain("dismiss");
    expect(statusFilter?.description).toContain("responses return status uppercase");
    expect(statusFilter?.description).toContain("case-insensitively");
  });

  it.each([
    ["impacted_service", "registered services"],
    ["environment", "registered environments"],
    ["template_short_id", "per-project"],
  ] as const)("documents validated registry lookup for the %s filter", (filterName, hint) => {
    const registry = new Registry(makeConfig());
    const def = registry.getResource("alert");
    const filter = def.listFilterFields?.find((f) => f.name === filterName);
    expect(filter?.description).toContain(hint);
    expect(filter?.description).toContain("returns an error, not an empty list");
  });
});

describe("alert — harness_list", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue({
      entities: [{ prettyId: "ALERT-1" }, { prettyId: "ALERT-2" }],
      totalCount: 2,
    });
    client = makeClient(mockRequest);
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(server, registry, client);
  });

  it("maps entities/totalCount to items/total via offsetListExtract", async () => {
    const result = await server.call("harness_list", { resource_type: "alert" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { items: unknown[]; total: number };
    expect(data.items).toHaveLength(2);
    expect(data.total).toBe(2);
  });

  it("hits the alerts list path with MC scope params", async () => {
    await server.call("harness_list", { resource_type: "alert" });
    const callArgs = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(callArgs.path).toBe("/gateway/ir/tp/api/v1/mc/alerts");
    expect(callArgs.params.accountId).toBe("test-account");
    expect(callArgs.params.orgId).toBe("default");
    expect(callArgs.params.projectId).toBe("test-project");
  });

  it("maps snake_case filters to API query param names", async () => {
    await server.call("harness_list", {
      resource_type: "alert",
      filters: {
        status: ["triggered"],
        impacted_service: ["svc-a"],
        template_short_id: ["PALERTAED1EE"],
        sort_field: "CREATED_AT",
      },
    });
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(callArgs.params.status).toEqual(["triggered"]);
    expect(callArgs.params.impactedService).toEqual(["svc-a"]);
    expect(callArgs.params.templateShortId).toEqual(["PALERTAED1EE"]);
    expect(callArgs.params.sortField).toBe("CREATED_AT");
  });

  // harness_search dispatches list with search_term set to the query. Without a
  // mapping the term was dropped and the caller got an unfiltered page back,
  // which reads as "these are your matches".
  it("maps the top-level search_term to the text query param", async () => {
    await server.call("harness_list", { resource_type: "alert", search_term: "kafka lag" });
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(callArgs.params.text).toBe("kafka lag");
  });

  it("lets an explicit text filter win over search_term", async () => {
    await server.call("harness_list", {
      resource_type: "alert",
      search_term: "from-search",
      filters: { text: "from-filter" },
    });
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(callArgs.params.text).toBe("from-filter");
  });

  it("compacts list items: keeps prettyId/priority, replaces keyEvents with count", async () => {
    mockRequest.mockResolvedValueOnce({
      entities: [{
        prettyId: "ALERT-1",
        title: "CPU spike",
        priority: { id: "p1_critical", label: "P1 Critical" },
        impactedServices: ["svc-a"],
        description: "short",
        keyEvents: [
          { timestamp: 1, status: "TRIGGERED", details: "x" },
          { timestamp: 2, status: "ACKNOWLEDGED", details: "y" },
        ],
        __internalMeta: { trace: "abc" },
      }],
      totalCount: 1,
    });
    const result = await server.call("harness_list", { resource_type: "alert" });
    const data = parseResult(result) as { items: Array<Record<string, unknown>> };
    const item = data.items[0]!;
    expect(item.prettyId).toBe("ALERT-1");
    expect(item.priority).toEqual({ id: "p1_critical", label: "P1 Critical" });
    expect(item.impactedServices).toEqual(["svc-a"]);
    expect(item.keyEvents).toBe(2);
    expect(item).not.toHaveProperty("__internalMeta");
  });

  it("keeps a short description verbatim in list view", async () => {
    mockRequest.mockResolvedValueOnce({
      entities: [{ prettyId: "ALERT-1", description: "short" }],
      totalCount: 1,
    });
    const result = await server.call("harness_list", { resource_type: "alert" });
    const data = parseResult(result) as { items: Array<Record<string, unknown>> };
    expect(data.items[0]!.description).toBe("short");
  });

  // Ingested alerts carry ~1-2KB of webhook boilerplate here, which dominates the
  // payload once multiplied by the page size.
  it("truncates a long description in list view and points at harness_get", async () => {
    const long = "x".repeat(1500);
    mockRequest.mockResolvedValueOnce({
      entities: [{ prettyId: "ALERT-1", description: long }],
      totalCount: 1,
    });
    const result = await server.call("harness_list", { resource_type: "alert" });
    const data = parseResult(result) as { items: Array<Record<string, unknown>> };
    const description = data.items[0]!.description as string;
    expect(description.length).toBeLessThan(long.length);
    expect(description).toContain("harness_get");
    expect(description.startsWith("x".repeat(400))).toBe(true);
  });
});

describe("alert — harness_get", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue({
      prettyId: "ALERT-42",
      title: "CPU spike",
      priority: { id: "p2_error", label: "P2 Error" },
      createdAtTimestamp: 1781776808000,
      keyEvents: [{ timestamp: 1, status: "TRIGGERED", details: "looking" }],
      __internalMeta: { trace: "abc" },
      correlationId: "xyz",
    });
    client = makeClient(mockRequest);
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, registry, client);
  });

  it("substitutes alert_id into the path", async () => {
    const result = await server.call("harness_get", { resource_type: "alert", resource_id: "ALERT-42" });
    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { path: string };
    expect(callArgs.path).toBe("/gateway/ir/tp/api/v1/mc/alerts/ALERT-42");
  });

  it("returns an openInHarness link for the alert", async () => {
    const result = await server.call("harness_get", { resource_type: "alert", resource_id: "ALERT-42" });
    const data = parseResult(result) as Record<string, unknown>;
    expect(data.openInHarness).toBe(
      "https://app.harness.io/ng/account/test-account/module/ir/orgs/default/projects/test-project/alerts/ALERT-42",
    );
  });

  it("projects a stable shape and drops backend envelope/meta fields", async () => {
    const result = await server.call("harness_get", { resource_type: "alert", resource_id: "ALERT-42" });
    const data = parseResult(result) as Record<string, unknown>;
    expect(data.prettyId).toBe("ALERT-42");
    expect(data.title).toBe("CPU spike");
    expect(data.priority).toEqual({ id: "p2_error", label: "P2 Error" });
    expect(data.createdAtTimestamp).toBe(1781776808000);
    expect(data.keyEvents).toEqual([{ timestamp: 1, status: "TRIGGERED", details: "looking" }]);
    expect(data).not.toHaveProperty("__internalMeta");
    expect(data).not.toHaveProperty("correlationId");
  });

  it("keeps the full description in the detail view", async () => {
    const long = "x".repeat(1500);
    mockRequest.mockResolvedValueOnce({ prettyId: "ALERT-42", description: long });
    const result = await server.call("harness_get", { resource_type: "alert", resource_id: "ALERT-42" });
    const data = parseResult(result) as Record<string, unknown>;
    expect(data.description).toBe(long);
  });
});

describe("alert — harness_create", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;

  beforeEach(async () => {
    server = makeMcpServer("accept");
    registry = new Registry(makeConfig());
    client = makeClient();
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(server, registry, client, makeConfig());
  });

  it("is not a creatable resource type", () => {
    const creatableTypes = registry.getTypesForOperation("create");
    expect(creatableTypes).not.toContain("alert");
  });
});

describe("alert — harness_update", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer("accept");
    registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue({ prettyId: "ALERT-42" });
    client = makeClient(mockRequest);
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(server, registry, client, makeConfig());
  });

  it("issues a PATCH to the alert path with the merge-patch body", async () => {
    const result = await server.call("harness_update", {
      resource_type: "alert",
      resource_id: "ALERT-42",
      body: { priority: "p3_warning", quietMode: true },
    });
    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { method: string; path: string; body: Record<string, unknown> };
    expect(callArgs.method).toBe("PATCH");
    expect(callArgs.path).toBe("/gateway/ir/tp/api/v1/mc/alerts/ALERT-42");
    expect(callArgs.body).toMatchObject({ priority: "p3_warning", quietMode: true });
  });
});

describe("alert — harness_execute (lifecycle)", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer("accept");
    registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue({ prettyId: "ALERT-42", status: "acknowledged" });
    client = makeClient(mockRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server, registry, client, makeConfig());
  });

  it.each([
    ["acknowledge", "/gateway/ir/tp/api/v1/mc/alerts/ALERT-42/acknowledge", "acknowledged"],
    ["resolve", "/gateway/ir/tp/api/v1/mc/alerts/ALERT-42/resolve", "resolved"],
    ["dismiss", "/gateway/ir/tp/api/v1/mc/alerts/ALERT-42/dismiss", "dismissed"],
  ] as const)("posts to the %s path with no body", async (action, expectedPath, status) => {
    mockRequest.mockResolvedValueOnce({ prettyId: "ALERT-42", status });

    const result = await server.call("harness_execute", {
      resource_type: "alert",
      action,
      resource_id: "ALERT-42",
    });
    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { method: string; path: string; body: unknown };
    expect(callArgs.method).toBe("POST");
    expect(callArgs.path).toBe(expectedPath);
    expect(callArgs.body).toBeUndefined();

    const data = parseResult(result) as Record<string, unknown>;
    expect(data.prettyId).toBe("ALERT-42");
    expect(data.status).toBe(status);
  });
});
