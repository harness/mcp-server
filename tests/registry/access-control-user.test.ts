/**
 * User list/get/invite: search_term is a query param, identity is UUID under
 * nested `user`, scope is account/org/project.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { compactItems } from "../../src/utils/compact.js";
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
    content: [
      {
        user: {
          name: "Ada Lovelace",
          email: "ada@example.com",
          uuid: "uuid-ada",
          locked: false,
          disabled: false,
        },
        roleAssignmentMetadata: [{ identifier: "ra1" }],
      },
    ],
    totalElements: 1,
  },
};

describe("user resource", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("declares project default with account/org/project scopes", () => {
    const def = registry.getResource("user");
    expect(def.scope).toBe("project");
    expect(def.scopeOptional).toBeUndefined();
    expect(def.supportedScopes).toEqual(["account", "org", "project"]);
  });

  it("list: searchTerm is a query param, not JSON body; injects org/project", async () => {
    const mockRequest = vi.fn().mockResolvedValue(listResponse);
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "user", "list", {
      search_term: "ada@example.com",
      page: 0,
      size: 20,
    })) as { items: Record<string, unknown>[] };

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/user/aggregate");
    expect(call.params.searchTerm).toBe("ada@example.com");
    expect(call.params.pageIndex).toBe(0);
    expect(call.params.pageSize).toBe(20);
    expect(call.params.orgIdentifier).toBe("default");
    expect(call.params.projectIdentifier).toBe("test-project");
    expect(call.body.searchTerm).toBeUndefined();
    expect(call.body).toEqual({});

    expect(result.items[0]).toMatchObject({
      identifier: "uuid-ada",
      uuid: "uuid-ada",
      email: "ada@example.com",
      name: "Ada Lovelace",
    });
    expect(String(result.items[0].openInHarness)).toContain(
      "/all/orgs/default/projects/test-project/settings/access-control/users",
    );
  });

  it("list compact keeps uuid and email for a follow-up get", async () => {
    const mockRequest = vi.fn().mockResolvedValue(listResponse);
    const client = makeClient(mockRequest);
    const result = (await registry.dispatch(client, "user", "list", {})) as {
      items: Record<string, unknown>[];
    };
    const [slim] = compactItems(result.items, registry.getResource("user").compactItem) as Record<
      string,
      unknown
    >[];
    expect(slim.identifier).toBe("uuid-ada");
    expect(slim.uuid).toBe("uuid-ada");
    expect(slim.email).toBe("ada@example.com");
    expect(String(slim.name)).toContain("Ada Lovelace");
    expect(slim.user).toBeUndefined();
    expect(slim.roleAssignmentMetadata).toBeUndefined();
  });

  it("list: ACL filters go in the body and cannot combine with search_term", async () => {
    const mockRequest = vi.fn().mockResolvedValue(listResponse);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "user", "list", {
      role_identifiers: "_account_viewer,_project_admin",
    });
    expect(mockRequest.mock.calls[0][0].body).toEqual({
      roleIdentifiers: ["_account_viewer", "_project_admin"],
    });
    expect(mockRequest.mock.calls[0][0].params.searchTerm).toBeUndefined();

    await expect(
      registry.dispatch(client, "user", "list", {
        search_term: "ada",
        role_identifiers: "_account_viewer",
      }),
    ).rejects.toThrow(/Search and Filter are not supported together/);
  });

  it("list: resource_scope=account omits org/project query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue(listResponse);
    const client = makeClient(mockRequest);

    const listed = (await registry.dispatch(client, "user", "list", { resource_scope: "account" })) as {
      items: Record<string, unknown>[];
    };

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
    expect(String(listed.items[0].openInHarness)).toContain("/all/settings/access-control/users");
    expect(String(listed.items[0].openInHarness)).not.toContain("/orgs/");
  });

  it("get: user_id maps to aggregate path and flattens UUID", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: listResponse.data.content[0],
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "user", "get", {
      user_id: "uuid-ada",
    })) as Record<string, unknown>;

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/ng/api/user/aggregate/uuid-ada");
    expect(call.params.orgIdentifier).toBe("default");
    expect(result).toMatchObject({
      identifier: "uuid-ada",
      email: "ada@example.com",
    });
    expect(result.roleAssignmentMetadata).toEqual([{ identifier: "ra1" }]);
  });

  it("invite: maps emails, boolean managedRole, and scope query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS", data: {} });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "user", "invite", {
      body: {
        emails: "a@x.com, b@x.com",
        user_groups: ["g1"],
        role_bindings: [
          {
            roleIdentifier: "_account_viewer",
            resourceGroupIdentifier: "_all_resources_including_child_scopes",
            managedRole: "true",
          },
        ],
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/user/users");
    expect(call.params.orgIdentifier).toBe("default");
    expect(call.params.projectIdentifier).toBe("test-project");
    expect(call.body).toEqual({
      emails: ["a@x.com", "b@x.com"],
      userGroups: ["g1"],
      roleBindings: [
        {
          roleIdentifier: "_account_viewer",
          resourceGroupIdentifier: "_all_resources_including_child_scopes",
          managedRole: true,
        },
      ],
    });
  });

  it("invite: empty emails fail locally", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);
    await expect(
      registry.dispatchExecute(client, "user", "invite", { body: { emails: [] } }),
    ).rejects.toThrow(/emails is required/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("invite: emails without user_groups or role_bindings fail locally", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);
    await expect(
      registry.dispatchExecute(client, "user", "invite", { body: { emails: ["a@x.com"] } }),
    ).rejects.toThrow(/user_groups and\/or role_bindings/);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
