/**
 * Regression tests for access_control toolset — user aggregate API routing (#876)
 * and invite body normalization.
 *
 * GET /ng/api/user/{userId} returns 405 on ng-manager; the UI uses
 * GET /ng/api/user/aggregate/{userId}. List is POST /ng/api/user/aggregate.
 */
import { describe, it, expect, vi } from "vitest";
import { accessControlToolset } from "../../src/registry/toolsets/access-control.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { EndpointSpec, ResourceDefinition } from "../../src/registry/types.js";

function findResource(type: string): ResourceDefinition {
  const res = accessControlToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in accessControlToolset`);
  return res;
}

function getOp(type: string, op: string): EndpointSpec {
  const res = findResource(type);
  const spec = (res.operations as Record<string, EndpointSpec>)[op];
  if (!spec) throw new Error(`Operation "${op}" not found on "${type}"`);
  return spec;
}

function getExecuteAction(type: string, action: string): EndpointSpec {
  const res = findResource(type);
  const spec = res.executeActions?.[action];
  if (!spec) throw new Error(`Execute action "${action}" not found on "${type}"`);
  return spec;
}

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default-org",
    HARNESS_PROJECT: "default-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    ...overrides,
  } as Config;
}

function makeClient(requestFn: (...args: unknown[]) => unknown = vi.fn().mockResolvedValue({})): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("user resource — aggregate API paths (#876)", () => {
  it("list uses POST /ng/api/user/aggregate", () => {
    const spec = getOp("user", "list");
    expect(spec.method).toBe("POST");
    expect(spec.path).toBe("/ng/api/user/aggregate");
    expect(spec.path).not.toContain("/ng/api/user/users");
  });

  it("get uses GET /ng/api/user/aggregate/{userId}", () => {
    const spec = getOp("user", "get");
    expect(spec.method).toBe("GET");
    expect(spec.path).toBe("/ng/api/user/aggregate/{userId}");
    expect(spec.path).not.toBe("/ng/api/user/{userId}");
  });

  it("maps user_id path param to userId placeholder", () => {
    const spec = getOp("user", "get");
    expect(spec.pathParams).toEqual({ user_id: "userId" });
  });

  it("list bodyBuilder maps search_term to searchTerm", () => {
    const spec = getOp("user", "list");
    expect(spec.bodyBuilder!({ search_term: "alice@example.com" })).toEqual({
      searchTerm: "alice@example.com",
    });
    expect(spec.bodyBuilder!({})).toEqual({ searchTerm: "" });
  });
});

describe("user dispatch — aggregate API integration", () => {
  it("harness_get routes to /ng/api/user/aggregate/{userId}", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "access_control" }));
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { user: { uuid: "usr-42", email: "alice@example.com" } },
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "user", "get", { user_id: "usr-42" });

    const call = mockRequest.mock.calls[0]![0] as { method: string; path: string };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/ng/api/user/aggregate/usr-42");
    expect(call.path).not.toMatch(/\/ng\/api\/user\/usr-42$/);
  });

  it("harness_list posts searchTerm to /ng/api/user/aggregate", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "access_control" }));
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { content: [], totalItems: 0 },
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "user", "list", { search_term: "bob" });

    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
    };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/user/aggregate");
    expect(call.body).toEqual({ searchTerm: "bob" });
  });
});

describe("user invite — body normalization", () => {
  it("invite action posts to /ng/api/user/users", () => {
    const spec = getExecuteAction("user", "invite");
    expect(spec.method).toBe("POST");
    expect(spec.path).toBe("/ng/api/user/users");
  });

  it("bodyBuilder normalizes comma-separated emails and snake_case aliases", () => {
    const spec = getExecuteAction("user", "invite");
    const body = spec.bodyBuilder!({
      body: {
        email_ids: "a@example.com, b@example.com",
        user_group_ids: ["grp-1", "grp-2"],
        role_bindings: [{ roleIdentifier: "_account_viewer" }],
      },
    }) as Record<string, unknown>;

    expect(body.emails).toEqual(["a@example.com", "b@example.com"]);
    expect(body.userGroups).toEqual(["grp-1", "grp-2"]);
    expect(body.roleBindings).toEqual([{ roleIdentifier: "_account_viewer" }]);
  });

  it("dispatchExecute sends normalized invite body", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "access_control" }));
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "user", "invite", {
      body: {
        emails: ["new@example.com"],
        user_groups: ["developers"],
      },
    });

    const call = mockRequest.mock.calls[0]![0] as { path: string; body: Record<string, unknown> };
    expect(call.path).toBe("/ng/api/user/users");
    expect(call.body).toEqual({
      emails: ["new@example.com"],
      userGroups: ["developers"],
      roleBindings: [],
    });
  });
});
