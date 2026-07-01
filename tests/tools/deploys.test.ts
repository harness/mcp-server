/**
 * Tests for the `deploy` resource type (deploys toolset).
 *
 * The deploys API is read-only (list + get). Verifies the offset-paginated
 * list extractor, scope param mapping, snake_case→camelCase filter mapping,
 * and path-param substitution on get — all with a mocked client.request so
 * no real API is hit.
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
    HARNESS_TOOLSETS: "deploys",
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

describe("deploy — harness_list", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue({
      entities: [{ id: "DEPL-1" }, { id: "DEPL-2" }],
      totalCount: 2,
    });
    client = makeClient(mockRequest);
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(server, registry, client);
  });

  it("maps entities/totalCount to items/total via offsetListExtract", async () => {
    const result = await server.call("harness_list", { resource_type: "deploy" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { items: unknown[]; total: number };
    expect(data.items).toHaveLength(2);
    expect(data.total).toBe(2);
  });

  it("hits the deploys list path with scope params", async () => {
    await server.call("harness_list", { resource_type: "deploy" });
    const callArgs = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(callArgs.path).toBe("/gateway/ir/tp/api/v1/mc/deploys");
    expect(callArgs.params.accountId).toBe("test-account");
    expect(callArgs.params.orgId).toBe("default");
    expect(callArgs.params.projectId).toBe("test-project");
  });

  it("compacts list items to identity fields, dropping empty title/null status and truncating summary", async () => {
    mockRequest.mockResolvedValueOnce({
      entities: [
        {
          id: "DEPLU65-8065",
          projectId: "AI_SRE",
          title: "",
          summary: "### Change Log for resource-hierarchy-service (harness0)\nUnable to find changes.\n",
          status: null,
          environments: ["harness0"],
          buildVersions: [
            {
              service: "resource-hierarchy-service",
              version: "1.20.0",
              commitSha: "f6496b9d336a1c514351a934be9d7263a2c2af5c",
              branch: "release/resource-hierarchy-service_1.20.0",
              repositoryName: "harness-core",
              repositoryUrl: "https://git0.harness.io/acct/PROD/Harness_Commons/harness-core.git",
            },
          ],
          deployTimestamp: 1781175806000,
          webLink: "https://harness0.harness.io/ng/account/acct/changes/DEPLU65-8065",
        },
      ],
      totalCount: 1,
    });
    const result = await server.call("harness_list", { resource_type: "deploy" });
    const data = parseResult(result) as { items: Record<string, unknown>[] };
    const item = data.items[0]!;
    // Identity + useful fields kept
    expect(item.id).toBe("DEPLU65-8065");
    expect(item.environments).toEqual(["harness0"]);
    expect(item.services).toEqual([{ service: "resource-hierarchy-service", version: "1.20.0" }]);
    expect(item.deployTimestamp).toBe(1781175806000);
    expect(item.webLink).toContain("DEPLU65-8065");
    // Summary truncated to first line only
    expect(item.summary).toBe("### Change Log for resource-hierarchy-service (harness0)");
    // Noise dropped
    expect(item).not.toHaveProperty("title");
    expect(item).not.toHaveProperty("status");
    expect(item).not.toHaveProperty("buildVersions");
  });

  it("compact:false leaves raw fields intact", async () => {
    mockRequest.mockResolvedValueOnce({
      entities: [{ id: "DEPL-1", status: null, buildVersions: [{ service: "x", version: "1" }] }],
      totalCount: 1,
    });
    const result = await server.call("harness_list", { resource_type: "deploy", compact: false });
    const data = parseResult(result) as { items: Record<string, unknown>[] };
    expect(data.items[0]).toHaveProperty("buildVersions");
  });

  it("maps snake_case filters to API query param names", async () => {
    await server.call("harness_list", {
      resource_type: "deploy",
      filters: {
        service: ["svc-a", "svc-b"],
        deployed_after: "2026-05-01T00:00:00Z",
        sort_direction: "DESC",
      },
    });
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(callArgs.params.service).toEqual(["svc-a", "svc-b"]);
    expect(callArgs.params.deployedAfter).toBe("2026-05-01T00:00:00Z");
    expect(callArgs.params.sortDirection).toBe("DESC");
  });
});

describe("deploy — harness_get", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue({ id: "DEPL-24", title: "Deploy api-server" });
    client = makeClient(mockRequest);
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, registry, client);
  });

  it("substitutes deploy_id into the path", async () => {
    const result = await server.call("harness_get", { resource_type: "deploy", resource_id: "DEPL-24" });
    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { path: string };
    expect(callArgs.path).toBe("/gateway/ir/tp/api/v1/mc/deploys/DEPL-24");
  });

  it("projects stable fields and strips backend debug fields", async () => {
    mockRequest.mockResolvedValueOnce({
      id: "DEPLU65-8065",
      projectId: "AI_SRE",
      title: "",
      summary: "### Change Log for resource-hierarchy-service (harness0)\nUnable to find changes.\n",
      status: null,
      environments: ["harness0"],
      buildVersions: [
        {
          service: "resource-hierarchy-service",
          version: "1.20.0",
          commitSha: "f6496b9d336a1c514351a934be9d7263a2c2af5c",
          branch: "release/resource-hierarchy-service_1.20.0",
          repositoryName: "harness-core",
          repositoryUrl: "https://git0.harness.io/acct/PROD/Harness_Commons/harness-core.git",
        },
      ],
      deployTimestamp: 1781175806000,
      webLink: "https://harness0.harness.io/ng/account/acct/changes/DEPLU65-8065",
      someBackendDebugField: "should-not-leak",
    });
    const result = await server.call("harness_get", { resource_type: "deploy", resource_id: "DEPLU65-8065" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as Record<string, unknown>;
    // Stable fields present
    expect(data.id).toBe("DEPLU65-8065");
    expect(data.projectId).toBe("AI_SRE");
    expect(data.title).toBe("");
    expect(data.summary).toContain("Change Log for resource-hierarchy-service");
    expect(data.status).toBeNull();
    expect(data.environments).toEqual(["harness0"]);
    expect(data.buildVersions).toHaveLength(1);
    const bv = (data.buildVersions as Record<string, unknown>[])[0]!;
    expect(bv.service).toBe("resource-hierarchy-service");
    expect(bv.version).toBe("1.20.0");
    expect(bv.commitSha).toBe("f6496b9d336a1c514351a934be9d7263a2c2af5c");
    expect(bv.branch).toBe("release/resource-hierarchy-service_1.20.0");
    expect(bv.repositoryName).toBe("harness-core");
    expect(bv.repositoryUrl).toContain("harness-core.git");
    expect(data.deployTimestamp).toBe(1781175806000);
    expect(data.webLink).toContain("DEPLU65-8065");
    // Backend debug field stripped
    expect(data).not.toHaveProperty("someBackendDebugField");
  });
});
