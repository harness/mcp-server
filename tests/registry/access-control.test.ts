/**
 * Access Control toolset — user resource routing and invite body shaping.
 *
 * Regression guard for #876: GET /ng/api/user/{userId} returns 405 on ng-manager;
 * the UI and MCP must use GET /ng/api/user/aggregate/{userId}.
 */
import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { accessControlToolset } from "../../src/registry/toolsets/access-control.js";

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

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

function userResource() {
  const resource = accessControlToolset.resources.find((r) => r.resourceType === "user");
  if (!resource) throw new Error("user resource missing from access_control toolset");
  return resource;
}

describe("access_control user resource definition", () => {
  it("routes get through the aggregate API (not the legacy /user/{id} path)", () => {
    const getOp = userResource().operations.get!;
    expect(getOp.method).toBe("GET");
    expect(getOp.path).toBe("/ng/api/user/aggregate/{userId}");
    expect(getOp.path).not.toBe("/ng/api/user/{userId}");
    expect(getOp.pathParams).toEqual({ user_id: "userId" });
  });

  it("routes list through POST /ng/api/user/aggregate with searchTerm body", () => {
    const listOp = userResource().operations.list!;
    expect(listOp.method).toBe("POST");
    expect(listOp.path).toBe("/ng/api/user/aggregate");
    expect(listOp.bodyBuilder!({ search_term: "Ada" })).toEqual({ searchTerm: "Ada" });
    expect(listOp.bodyBuilder!({})).toEqual({ searchTerm: "" });
  });
});

describe("access_control user dispatch", () => {
  it("get substitutes user_id into the aggregate path", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      data: { uuid: "user-uuid-1", name: "Ada Lovelace", email: "ada@example.com" },
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "user", "get", { user_id: "user-uuid-1" });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/ng/api/user/aggregate/user-uuid-1",
      }),
    );
    const call = mockRequest.mock.calls[0]![0] as { path?: string };
    expect(call.path).not.toMatch(/^\/ng\/api\/user\/user-uuid-1$/);
  });

  it("list sends searchTerm in the POST body and paginates via query params", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      data: { content: [{ uuid: "u1", name: "Ada" }], totalElements: 1 },
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "user", "list", {
      search_term: "ada@example.com",
      page: 1,
      size: 10,
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/ng/api/user/aggregate",
        body: { searchTerm: "ada@example.com" },
        params: expect.objectContaining({
          pageIndex: 1,
          pageSize: 10,
        }),
      }),
    );
  });
});

describe("access_control user invite bodyBuilder", () => {
  const invite = userResource().executeActions!.invite!;
  const buildBody = invite.bodyBuilder!;

  it("normalizes emails and user_groups from arrays", () => {
    expect(
      buildBody({
        body: {
          emails: ["a@example.com", "b@example.com"],
          user_groups: ["devs", "ops"],
          role_bindings: [{ roleIdentifier: "_account_viewer" }],
        },
      }),
    ).toEqual({
      emails: ["a@example.com", "b@example.com"],
      userGroups: ["devs", "ops"],
      roleBindings: [{ roleIdentifier: "_account_viewer" }],
    });
  });

  it("parses comma-separated emails and user_groups strings", () => {
    expect(
      buildBody({
        body: {
          email_ids: "a@example.com, b@example.com",
          user_group_ids: "devs, ops",
        },
      }),
    ).toEqual({
      emails: ["a@example.com", "b@example.com"],
      userGroups: ["devs", "ops"],
      roleBindings: [],
    });
  });

  it("defaults missing invite fields to empty arrays", () => {
    expect(buildBody({ body: {} })).toEqual({
      emails: [],
      userGroups: [],
      roleBindings: [],
    });
  });
});
