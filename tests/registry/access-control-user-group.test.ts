/**
 * User group list/get/create/update/delete: multi-scope, filter_type on list,
 * member IDs on create/update.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_TOOLSETS: "access_control",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

const listResponse = {
  status: "SUCCESS",
  data: {
    content: [{ identifier: "admins", name: "Admins", orgIdentifier: "default", projectIdentifier: "test-project" }],
    totalElements: 1,
  },
};

describe("user_group resource", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("declares project default with account/org/project scopes", () => {
    const def = registry.getResource("user_group");
    expect(def.scope).toBe("project");
    expect(def.supportedScopes).toEqual(["account", "org", "project"]);
    expect(def.operations.create).toBeDefined();
    expect(def.operations.update).toBeDefined();
  });

  it("list: searchTerm and filterType query params; injects org/project", async () => {
    const mockRequest = vi.fn().mockResolvedValue(listResponse);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "user_group", "list", {
      search_term: "admin",
      filter_type: "include_inherited_groups",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/ng/api/user-groups");
    expect(call.params.searchTerm).toBe("admin");
    expect(call.params.filterType).toBe("INCLUDE_INHERITED_GROUPS");
    expect(call.params.orgIdentifier).toBe("default");
    expect(call.params.projectIdentifier).toBe("test-project");
  });

  it("list: resource_scope=account omits org/project", async () => {
    const mockRequest = vi.fn().mockResolvedValue(listResponse);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "user_group", "list", { resource_scope: "account" });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("get: user_group_id in path at current scope", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { identifier: "admins", name: "Admins" },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "user_group", "get", { user_group_id: "admins" })) as Record<
      string,
      unknown
    >;

    const call = mockRequest.mock.calls[0][0];
    expect(call.path).toBe("/ng/api/user-groups/admins");
    expect(call.params.orgIdentifier).toBe("default");
    expect(String(result.openInHarness)).toContain(
      "/all/orgs/default/projects/test-project/settings/access-control/user-groups/admins",
    );
  });

  it("create: injects account/org/project into body; rejects email members", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS", data: {} });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "user_group", "create", {
      body: { identifier: "g1", name: "G1", users: ["uuid-ada"] },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/user-groups");
    expect(call.body).toMatchObject({
      identifier: "g1",
      name: "G1",
      users: ["uuid-ada"],
      accountIdentifier: "test-account",
      orgIdentifier: "default",
      projectIdentifier: "test-project",
    });

    await expect(
      registry.dispatch(client, "user_group", "create", {
        body: { identifier: "g1", name: "G1", users: ["ada@example.com"] },
      }),
    ).rejects.toThrow(/UUIDs, not emails/);
  });

  it("update: PUT with identifier from user_group_id", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS", data: {} });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "user_group", "update", {
      user_group_id: "g1",
      body: { name: "G1", users: ["uuid-ada", "uuid-bob"] },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/ng/api/user-groups");
    expect(call.body).toMatchObject({
      identifier: "g1",
      name: "G1",
      users: ["uuid-ada", "uuid-bob"],
    });
  });

  it("update: omitting users fails locally", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);
    await expect(
      registry.dispatch(client, "user_group", "update", {
        user_group_id: "g1",
        body: { name: "G1" },
      }),
    ).rejects.toThrow(/users is required on update/);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
