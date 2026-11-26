import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { RequestOptions } from "../../src/client/types.js";
import { Registry } from "../../src/registry/index.js";
import { featureFlagsToolset } from "../../src/registry/toolsets/feature-flags.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import { registerCreateTool } from "../../src/tools/harness-create.js";
import { registerDeleteTool } from "../../src/tools/harness-delete.js";
import { ACCEPTED_CONFIRMATION, toolHandlerContext } from "../helpers/request-context.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_MCP_MODE: "single-user",
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_TOOLSETS: "feature-flags",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_MCP_ALLOWED_HOSTS: undefined,
    HARNESS_MCP_AUTH_TOKEN: undefined,
    HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: false,
    HARNESS_FME_API_KEY: undefined,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_PIPELINE_VERSION: undefined,
    HARNESS_AUDIT_FILE: undefined,
    HARNESS_AUDIT_WEBHOOK_URL: undefined,
    HARNESS_AUDIT_WEBHOOK_TOKEN: undefined,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
    ...overrides,
  };
}

function makeClient(requestFn?: (options: RequestOptions) => Promise<unknown>): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function firstRequest(mockRequest: ReturnType<typeof vi.fn>): RequestOptions {
  return mockRequest.mock.calls[0][0] as RequestOptions;
}

const nativeScope = { org_id: "o1", project_id: "p1" };
const TT_ID = "bd3fc9a1-0d4b-12fe-984d-f345bcbbe430";
const NATIVE_ONLY = /requires org_id and project_id/;

function findOperation(operation: "create" | "delete") {
  return featureFlagsToolset.resources.find((r) => r.resourceType === "fme_traffic_type")?.operations[operation];
}

describe("fme_traffic_type native-only create/delete", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it.each(["create", "delete"] as const)("%s: rejects workspace_id", async (operation) => {
    const client = makeClient();
    const input: Record<string, unknown> = { workspace_id: "ws1", traffic_type_id: TT_ID };
    if (operation === "create") input.body = { name: "account" };
    await expect(registry.dispatch(client, "fme_traffic_type", operation, input)).rejects.toThrow(NATIVE_ONLY);
  });

  it("create: native POST sends only name with FME scope params and skips NG body injection", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_traffic_type", "create", {
      ...nativeScope,
      body: { name: "account", extra: "ignored" },
    });

    const request = firstRequest(mockRequest);
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/fme/api/v4/traffic-types");
    expect(request.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
    });
    expect(request.body).toEqual({ name: "account" });
    expect(findOperation("create")?.skipScopeBodyInjection).toBe(true);
  });

  it("create: flattens the {entity, governance} envelope", async () => {
    const client = makeClient(vi.fn().mockResolvedValue({
      entity: { id: TT_ID, name: "account" },
      governance: { status: "NONE", details: [] },
    }));

    const result = await registry.dispatch(client, "fme_traffic_type", "create", {
      ...nativeScope,
      body: { name: "account" },
    });

    expect(result).toEqual({ id: TT_ID, name: "account", governance: { status: "NONE", details: [] } });
  });

  it("delete: native routes by traffic_type_id with FME scope params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ governance: { status: "NONE", details: [] } });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "fme_traffic_type", "delete", {
      ...nativeScope,
      traffic_type_id: TT_ID,
    });

    const request = firstRequest(mockRequest);
    expect(request.method).toBe("DELETE");
    expect(request.path).toBe(`/fme/api/v4/traffic-types/${TT_ID}`);
    expect(request.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
    });
    expect(result).toEqual({ governance: { status: "NONE", details: [] } });
  });

  it("delete: requires traffic_type_id", async () => {
    await expect(registry.dispatch(makeClient(), "fme_traffic_type", "delete", nativeScope)).rejects.toThrow(/traffic_type_id/);
  });

  it("risk levels: create low_write, delete destructive, neither retried", () => {
    expect(findOperation("create")?.operationPolicy).toEqual({ risk: "low_write", retryPolicy: "do_not_retry" });
    expect(findOperation("delete")?.operationPolicy).toEqual({ risk: "destructive", retryPolicy: "do_not_retry" });
  });
});

function makeMcpServer(elicitAction: "accept" | "decline" = "accept") {
  const tools = new Map<string, { schema: { inputSchema: { safeParse: (v: unknown) => { success: boolean } } }; handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    server: {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput: vi.fn().mockResolvedValue({ action: elicitAction }),
    },
    registerTool: vi.fn((name: string, schema: never, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { schema, handler });
    }),
    tool(name: string) {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      return tool;
    },
    async call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
      const confirmation = elicitAction === "accept" ? ACCEPTED_CONFIRMATION : { action: elicitAction };
      return this.tool(name).handler(args, toolHandlerContext(new AbortController().signal, confirmation));
    },
  } as any;
}

function resultText(result: ToolResult): string {
  const item = result.content[0]!;
  return item.type === "text" ? item.text : "";
}

describe("fme_traffic_type via harness_create / harness_delete", () => {
  it("harness_create: schema rejects a call without body", () => {
    const server = makeMcpServer();
    registerCreateTool(server, new Registry(makeConfig()), makeClient(), makeConfig());
    const parsed = server.tool("harness_create").schema.inputSchema.safeParse({ resource_type: "fme_traffic_type", ...nativeScope });
    expect(parsed.success).toBe(false);
  });

  it("harness_create: empty body fails required-field validation without sending a request", async () => {
    const server = makeMcpServer();
    const mockRequest = vi.fn().mockResolvedValue({});
    registerCreateTool(server, new Registry(makeConfig()), makeClient(mockRequest), makeConfig());

    const result = await server.call("harness_create", { resource_type: "fme_traffic_type", ...nativeScope, body: {} });

    expect(result.isError).toBe(true);
    expect(resultText(result)).toMatch(/Missing required fields for fme_traffic_type: name/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("harness_delete: maps resource_id to traffic_type_id once confirmed", async () => {
    const server = makeMcpServer("accept");
    const mockRequest = vi.fn().mockResolvedValue({ governance: { status: "NONE", details: [] } });
    registerDeleteTool(server, new Registry(makeConfig()), makeClient(mockRequest), makeConfig());

    const result = await server.call("harness_delete", { resource_type: "fme_traffic_type", resource_id: TT_ID, ...nativeScope });

    expect(result.isError).toBeUndefined();
    const request = firstRequest(mockRequest);
    expect(request.method).toBe("DELETE");
    expect(request.path).toBe(`/fme/api/v4/traffic-types/${TT_ID}`);
  });

  it("harness_delete: sends no request when the user declines", async () => {
    const server = makeMcpServer("decline");
    const mockRequest = vi.fn().mockResolvedValue({});
    registerDeleteTool(server, new Registry(makeConfig()), makeClient(mockRequest), makeConfig());

    const result = await server.call("harness_delete", { resource_type: "fme_traffic_type", resource_id: TT_ID, ...nativeScope });

    expect(result.isError).toBe(true);
    expect(resultText(result)).toMatch(/declined/);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
