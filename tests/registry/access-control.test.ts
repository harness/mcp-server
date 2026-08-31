/**
 * Access-control registry tests — user list/get routing and invite execute.
 *
 * Regression: GET /ng/api/user/{userId} returns 405 on ng-manager (surfaced as 500).
 * User get must use GET /ng/api/user/aggregate/{userId} like the Harness UI (#876).
 */
import { describe, it, expect, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import { accessControlToolset } from "../../src/registry/toolsets/access-control.js";
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
    HARNESS_TOOLSETS: "access_control",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function findUserResource() {
  const resource = accessControlToolset.resources.find((r) => r.resourceType === "user");
  if (!resource) throw new Error("user resource missing from access_control toolset");
  return resource;
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

describe("user resource definition", () => {
  it("routes get through the aggregate API path (not the legacy /user/{userId} endpoint)", () => {
    const get = findUserResource().operations.get;
    expect(get?.path).toBe("/ng/api/user/aggregate/{userId}");
    expect(get?.path).not.toBe("/ng/api/user/{userId}");
    expect(get?.method).toBe("GET");
    expect(get?.pathParams).toEqual({ user_id: "userId" });
  });

  it("routes list through POST /ng/api/user/aggregate", () => {
    const list = findUserResource().operations.list;
    expect(list?.path).toBe("/ng/api/user/aggregate");
    expect(list?.method).toBe("POST");
  });
});

describe("user registry dispatch", () => {
  it("get substitutes user_id into the aggregate path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { uuid: "user-uuid-42", email: "alice@example.com" },
    });
    const registry = new Registry(makeConfig());
    await registry.dispatch(makeClient(mockRequest), "user", "get", { user_id: "user-uuid-42" });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0]![0] as { method: string; path: string };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/ng/api/user/aggregate/user-uuid-42");
    expect(call.path).not.toContain("/ng/api/user/user-uuid-42");
  });

  it("list posts searchTerm in the body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { content: [{ uuid: "u1" }], totalItems: 1 },
    });
    const registry = new Registry(makeConfig());
    await registry.dispatch(makeClient(mockRequest), "user", "list", { search_term: "alice@example.com" });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
    };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/user/aggregate");
    expect(call.body).toEqual({ searchTerm: "alice@example.com" });
  });

  it("invite maps emails and role_bindings for the users endpoint", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS" });
    const registry = new Registry(makeConfig());
    await registry.dispatchExecute(makeClient(mockRequest), "user", "invite", {
      body: {
        emails: "one@example.com, two@example.com",
        role_bindings: [{
          roleIdentifier: "_account_viewer",
          resourceGroupIdentifier: "_all_resources",
          roleScopeLevel: "account",
          roleName: "Account Viewer",
          resourceGroupName: "All Resources",
          managedRole: "true",
        }],
      },
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
    };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/user/users");
    expect(call.body.emails).toEqual(["one@example.com", "two@example.com"]);
    expect(call.body.roleBindings).toHaveLength(1);
  });
});

describe("user — harness_get", () => {
  it("end-to-end: routes harness_get through the aggregate user API", async () => {
    const userPayload = { uuid: "user-uuid-42", email: "alice@example.com", name: "Alice" };
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS", data: userPayload });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);
    const server = makeMcpServer();
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, registry, client);

    const result = await server.call("harness_get", {
      resource_type: "user",
      user_id: "user-uuid-42",
    });

    expect(result.isError).toBeUndefined();
    expect(parseResult(result)).toMatchObject(userPayload);
    const call = mockRequest.mock.calls[0]![0] as { method: string; path: string };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/ng/api/user/aggregate/user-uuid-42");
  });
});
