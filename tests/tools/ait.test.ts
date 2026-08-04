/**
 * Tests for the AIT knowledge-base toolset (`kb_crawl`, `kb_crawl_page`,
 * `kb_page_artifact`).
 *
 * Verifies the /ait/api/v1/kb/… paths, cursor pagination, header-only scoping
 * (AIT resolves the org from the PAT, and its routes reject unknown body
 * fields), snake_case agent responses with camelCase on the wire, body mapping
 * on create/recrawl, artifact projection, and that the toolset stays out of the
 * default registry — all with a mocked client.request so no real API is hit.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
    HARNESS_AUTO_APPROVE_RISK: "high_write",
    HARNESS_TOOLSETS: "ait",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function makeMcpServer() {
  const tools = new Map<string, { handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    server: {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput: vi.fn().mockResolvedValue({ action: "accept" }),
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

const ENV_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const RUN_ID = "63f312e3-b508-4492-849a-b3c0002bbaac";
const PAGE_ID = "b8791282-95d8-4d69-8d24-44c9b886c43d";

describe("kb_crawl — harness_list", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    mockRequest = vi.fn().mockResolvedValue({
      items: [{ crawlRunId: RUN_ID, status: "completed" }],
      nextCursor: "eyJhdCI6IjIwMjYifQ",
    });
    client = makeClient(mockRequest);
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(server, new Registry(makeConfig()), client);
  });

  it("lists an environment's crawl history and maps items to snake_case", async () => {
    const result = await server.call("harness_list", {
      resource_type: "kb_crawl",
      params: { test_environment_id: ENV_ID },
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { items: Array<Record<string, unknown>>; next_cursor: string };
    expect(data.items).toHaveLength(1);
    expect(data.items[0]!.crawl_run_id).toBe(RUN_ID);
    expect(data.items[0]!.status).toBe("completed");
    expect(data.next_cursor).toBe("eyJhdCI6IjIwMjYifQ");
    const callArgs = mockRequest.mock.calls[0]![0] as { path: string };
    expect(callArgs.path).toBe(`/ait/api/v1/kb/${ENV_ID}/crawls`);
  });

  it("maps size to limit and passes the cursor filter through", async () => {
    await server.call("harness_list", {
      resource_type: "kb_crawl",
      params: { test_environment_id: ENV_ID },
      size: 5,
      filters: { cursor: "abc" },
    });
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(callArgs.params.limit).toBe(5);
    expect(callArgs.params.cursor).toBe("abc");
  });

  it("scopes through the header only — no accountIdentifier or org/project params", async () => {
    await server.call("harness_list", {
      resource_type: "kb_crawl",
      params: { test_environment_id: ENV_ID },
    });
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(callArgs.params.accountIdentifier).toBeUndefined();
    expect(callArgs.params.orgIdentifier).toBeUndefined();
    expect(callArgs.params.projectIdentifier).toBeUndefined();
  });
});

describe("kb_crawl — harness_get", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    mockRequest = vi.fn().mockResolvedValue({ crawlRunId: RUN_ID, status: "running", pagesDiscovered: 1 });
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, new Registry(makeConfig()), makeClient(mockRequest));
  });

  it("fetches a crawl run by id and projects snake_case fields", async () => {
    const result = await server.call("harness_get", { resource_type: "kb_crawl", resource_id: RUN_ID });
    const callArgs = mockRequest.mock.calls[0]![0] as { path: string };
    expect(callArgs.path).toBe(`/ait/api/v1/kb/crawls/${RUN_ID}`);
    const data = parseResult(result) as { status: string; pages_discovered: number; crawl_run_id: string };
    expect(data.status).toBe("running");
    expect(data.pages_discovered).toBe(1);
    expect(data.crawl_run_id).toBe(RUN_ID);
  });
});

describe("kb_crawl — harness_create", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    mockRequest = vi.fn().mockResolvedValue({ crawlRunId: RUN_ID, testEnvironmentId: ENV_ID });
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(server, new Registry(makeConfig()), makeClient(mockRequest), makeConfig());
  });

  it("accepts snake_case body and posts camelCase wire JSON", async () => {
    const result = await server.call("harness_create", {
      resource_type: "kb_crawl",
      body: {
        app_id: "app-1",
        test_environment_id: ENV_ID,
        config: {
          max_pages: 10,
          tunnel_name: "corp",
          crawl_instructions_addendum: "only crawl under /docs",
        },
      },
    });
    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { method: string; path: string; body: Record<string, unknown> };
    expect(callArgs.method).toBe("POST");
    expect(callArgs.path).toBe("/ait/api/v1/kb/crawls");
    expect(callArgs.body).toEqual({
      appId: "app-1",
      testEnvironmentId: ENV_ID,
      config: { maxPages: 10, tunnelName: "corp", crawlInstructionsAddendum: "only crawl under /docs" },
    });
    const data = parseResult(result) as { crawl_run_id: string; test_environment_id: string };
    expect(data.crawl_run_id).toBe(RUN_ID);
    expect(data.test_environment_id).toBe(ENV_ID);
  });

  it("drops unknown body fields, which AIT's routes would reject", async () => {
    await server.call("harness_create", {
      resource_type: "kb_crawl",
      body: { app_id: "app-1", start_url: "https://example.com", orgIdentifier: "default", nonsense: true },
    });
    const callArgs = mockRequest.mock.calls[0]![0] as { body: Record<string, unknown> };
    expect(callArgs.body).toEqual({ appId: "app-1", startUrl: "https://example.com" });
  });

  it("errors when neither test_environment_id nor start_url is given", async () => {
    const result = await server.call("harness_create", {
      resource_type: "kb_crawl",
      body: { app_id: "app-1" },
    });
    expect(result.isError).toBe(true);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("errors when app_id is missing", async () => {
    const result = await server.call("harness_create", {
      resource_type: "kb_crawl",
      body: { start_url: "https://example.com" },
    });
    expect(result.isError).toBe(true);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("kb_crawl — harness_execute", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    mockRequest = vi.fn().mockResolvedValue({ crawlRunId: RUN_ID });
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server, new Registry(makeConfig()), makeClient(mockRequest), makeConfig());
  });

  it("recrawl posts snake_case overrides as camelCase on the wire", async () => {
    const result = await server.call("harness_execute", {
      resource_type: "kb_crawl",
      action: "recrawl",
      params: { test_environment_id: ENV_ID },
      body: { max_pages: 3 },
    });
    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { method: string; path: string; body: Record<string, unknown> };
    expect(callArgs.method).toBe("POST");
    expect(callArgs.path).toBe(`/ait/api/v1/kb/${ENV_ID}/recrawl`);
    expect(callArgs.body).toEqual({ maxPages: 3 });
    const data = parseResult(result) as { crawl_run_id: string };
    expect(data.crawl_run_id).toBe(RUN_ID);
  });

  it("latest_status reads the environment's most recent run", async () => {
    await server.call("harness_execute", {
      resource_type: "kb_crawl",
      action: "latest_status",
      params: { test_environment_id: ENV_ID },
    });
    const callArgs = mockRequest.mock.calls[0]![0] as { method: string; path: string };
    expect(callArgs.method).toBe("GET");
    expect(callArgs.path).toBe(`/ait/api/v1/kb/${ENV_ID}/crawl/status`);
  });
});

describe("kb_crawl_page", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    server = makeMcpServer();
    mockRequest = vi.fn();
  });

  it("filters pages by query and projects list items to snake_case", async () => {
    mockRequest.mockResolvedValue({
      items: [
        {
          pageId: PAGE_ID,
          crawlRunId: RUN_ID,
          url: "https://playwright.dev/docs/intro",
          title: "Installation",
          depth: 1,
          capturedAt: "2026-07-31T23:53:30.000Z",
          artifacts: { accessibility: true, markdown: true, metadata: true, screenshot: true },
          internalRowVersion: 7,
        },
      ],
    });
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(server, new Registry(makeConfig()), makeClient(mockRequest));

    const result = await server.call("harness_list", {
      resource_type: "kb_crawl_page",
      params: { crawl_run_id: RUN_ID },
      filters: { query: "install" },
    });
    const callArgs = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(callArgs.path).toBe(`/ait/api/v1/kb/crawls/${RUN_ID}/pages`);
    expect(callArgs.params.query).toBe("install");

    const data = parseResult(result) as { items: Array<Record<string, unknown>> };
    const page = data.items[0]!;
    expect(page.page_id).toBe(PAGE_ID);
    expect(page.crawl_run_id).toBe(RUN_ID);
    expect(page.captured_at).toBe("2026-07-31T23:53:30.000Z");
    expect(page.artifacts).toEqual({ accessibility: true, markdown: true, metadata: true, screenshot: true });
    expect(page.internalRowVersion).toBeUndefined();
  });

  it("passes include through on get and keeps the grounding surface in snake_case", async () => {
    mockRequest.mockResolvedValue({
      pageId: PAGE_ID,
      crawlRunId: RUN_ID,
      url: "https://playwright.dev/docs/intro",
      links: [{ href: "/docs/writing-tests" }],
      structure: { forms: [] },
      testableFeatures: ["install"],
      includedArtifacts: {
        metadata: {
          pageId: PAGE_ID,
          crawlRunId: RUN_ID,
          kind: "metadata",
          contentType: "application/json",
          text: "{}",
          sha256: "abc",
          truncated: false,
        },
      },
    });
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, new Registry(makeConfig()), makeClient(mockRequest));

    const result = await server.call("harness_get", {
      resource_type: "kb_crawl_page",
      resource_id: PAGE_ID,
      params: { crawl_run_id: RUN_ID, include: "metadata" },
    });
    const callArgs = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(callArgs.path).toBe(`/ait/api/v1/kb/crawls/${RUN_ID}/pages/${PAGE_ID}`);
    expect(callArgs.params.include).toBe("metadata");

    const data = parseResult(result) as Record<string, unknown>;
    expect(data.page_id).toBe(PAGE_ID);
    expect(data.links).toEqual([{ href: "/docs/writing-tests" }]);
    expect(data.structure).toEqual({ forms: [] });
    expect(data.testable_features).toEqual(["install"]);
    const included = data.included_artifacts as Record<string, Record<string, unknown>>;
    expect(included.metadata!.content_type).toBe("application/json");
    expect(included.metadata!.sha256).toBeUndefined();
  });
});

describe("kb_page_artifact", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    server = makeMcpServer();
    mockRequest = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches a text artifact and projects snake_case fields, dropping the digest", async () => {
    mockRequest.mockResolvedValue({
      pageId: PAGE_ID,
      crawlRunId: RUN_ID,
      kind: "accessibility",
      contentType: "application/json",
      text: "{\"role\":\"main\"}",
      sha256: "b7e2…",
      truncated: false,
    });
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, new Registry(makeConfig()), makeClient(mockRequest));

    const result = await server.call("harness_get", {
      resource_type: "kb_page_artifact",
      resource_id: "accessibility",
      params: { crawl_run_id: RUN_ID, page_id: PAGE_ID },
    });
    const callArgs = mockRequest.mock.calls[0]![0] as { path: string };
    expect(callArgs.path).toBe(`/ait/api/v1/kb/crawls/${RUN_ID}/pages/${PAGE_ID}/artifacts/accessibility`);

    const data = parseResult(result) as Record<string, unknown>;
    expect(data.page_id).toBe(PAGE_ID);
    expect(data.content_type).toBe("application/json");
    expect(data.text).toBe("{\"role\":\"main\"}");
    expect(data.truncated).toBe(false);
    expect(data.sha256).toBeUndefined();
  });

  it("returns signed_url and attaches an MCP image block for a screenshot", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "image/png" },
        arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
      }),
    );
    mockRequest.mockResolvedValue({
      pageId: PAGE_ID,
      crawlRunId: RUN_ID,
      kind: "screenshot",
      contentType: "image/png",
      signedUrl: "https://storage.googleapis.com/bucket/shot.png?X-Goog-Expires=300",
      expiresAt: "2026-08-01T00:00:00.000Z",
      sha256: "c9f1…",
    });
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, new Registry(makeConfig()), makeClient(mockRequest));

    const result = await server.call("harness_get", {
      resource_type: "kb_page_artifact",
      resource_id: "screenshot",
      params: { crawl_run_id: RUN_ID, page_id: PAGE_ID },
    });
    const data = parseResult(result) as Record<string, unknown>;
    expect(String(data.signed_url)).toContain("X-Goog-Expires=300");
    expect(data.expires_at).toBe("2026-08-01T00:00:00.000Z");
    expect(result.content).toEqual([
      { type: "text", text: JSON.stringify(data) },
      { type: "image", mimeType: "image/png", data: png.toString("base64") },
    ]);
  });

  it("documents the compound identifier example on the resource", () => {
    const def = new Registry(makeConfig()).getResource("kb_page_artifact");
    expect(def.description).toContain("resource_id=screenshot");
    expect(def.description).toContain("crawl_run_id");
    expect(def.description).toContain("page_id");
    expect(def.description).toContain("MCP image content block");
    expect(def.operations.get?.description).toContain("resource_id must be the kind");
  });
});

describe("ait toolset registration", () => {
  it("is excluded from the default registry and enabled by HARNESS_TOOLSETS", () => {
    const defaultRegistry = new Registry({ ...makeConfig(), HARNESS_TOOLSETS: undefined } as Config);
    expect(defaultRegistry.getAllToolsets().some((t) => t.name === "ait")).toBe(false);

    const optedIn = new Registry({ ...makeConfig(), HARNESS_TOOLSETS: "+ait" } as Config);
    expect(optedIn.getAllToolsets().some((t) => t.name === "ait")).toBe(true);
  });

  it("prescribes MCP-only KB access and warns about the Java catch-all proxy", () => {
    const toolset = new Registry(makeConfig()).getAllToolsets().find((t) => t.name === "ait");
    expect(toolset?.description).toContain("harness_list");
    expect(toolset?.description).toContain("ait-java-api-service");
    expect(toolset?.description).toContain("explore-knowledge-base");

    const crawl = new Registry(makeConfig()).getResource("kb_crawl");
    expect(crawl.diagnosticHint).toContain("ait-java-api-service");
    expect(crawl.searchAliases).toContain("crawl history");
  });
});
