/**
 * Service account list/get/create/delete at account, org, and project scope.
 * Account queries must omit configured HARNESS_ORG / HARNESS_PROJECT.
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

const aggregateListResponse = {
  status: "SUCCESS",
  data: {
    content: [
      {
        serviceAccount: {
          identifier: "ci-bot",
          name: "CI Bot",
          email: "ci-bot@service.harness.io",
          description: "Account automation",
          accountIdentifier: "test-account",
          governanceMetadata: { deny: false },
        },
        createdAt: 1710000000000,
        lastModifiedAt: 1710000001000,
        tokensCount: 2,
      },
    ],
    totalItems: 1,
  },
};

describe("service_account resource", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("declares project default with account/org/project scopes", () => {
    const def = registry.getResource("service_account");
    expect(def.scope).toBe("project");
    expect(def.scopeOptional).toBeUndefined();
    expect(def.supportedScopes).toEqual(["account", "org", "project"]);
    expect(def.operations.list?.path).toBe("/ng/api/serviceaccount/aggregate");
  });

  it("list: default scope injects configured org and project", async () => {
    const mockRequest = vi.fn().mockResolvedValue(aggregateListResponse);
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "service_account", "list", {
      search_term: "ci-bot",
    })) as { items: Record<string, unknown>[] };

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/ng/api/serviceaccount/aggregate");
    expect(call.params.searchTerm).toBe("ci-bot");
    expect(call.params.orgIdentifier).toBe("default");
    expect(call.params.projectIdentifier).toBe("test-project");
    expect(String(result.items[0].openInHarness)).toContain(
      "/all/orgs/default/projects/test-project/settings/access-control/service-accounts/ci-bot",
    );
  });

  it("list: resource_scope=account omits configured org and project", async () => {
    const mockRequest = vi.fn().mockResolvedValue(aggregateListResponse);
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "service_account", "list", {
      resource_scope: "account",
      filter_type: "include_child_scope_service_accounts",
    })) as { items: Record<string, unknown>[]; total: number };

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
    expect(call.params.filterType).toBe("INCLUDE_CHILD_SCOPE_SERVICE_ACCOUNTS");
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      tokensCount: 2,
    });
    expect(result.items[0].serviceAccount).toBeUndefined();
    expect(result.items[0].governanceMetadata).toBeUndefined();
    expect(String(result.items[0].openInHarness)).toContain(
      "/all/settings/access-control/service-accounts/ci-bot",
    );
    expect(String(result.items[0].openInHarness)).not.toContain("/projects/");

    const [slim] = compactItems(result.items, registry.getResource("service_account").compactItem) as Record<
      string,
      unknown
    >[];
    expect(slim.email).toBe("ci-bot@service.harness.io");
    expect(slim.identifier).toBe("ci-bot");
    expect(slim.tokensCount).toBe(2);
  });

  it("list: resource_scope=org sends org only", async () => {
    const mockRequest = vi.fn().mockResolvedValue(aggregateListResponse);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "service_account", "list", { resource_scope: "org", org_id: "platform" });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.orgIdentifier).toBe("platform");
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("list: raw data array is not dropped", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: [
        {
          identifier: "account-sa",
          name: "Account SA",
          email: "account-sa@service.harness.io",
          accountIdentifier: "test-account",
        },
      ],
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "service_account", "list", {
      resource_scope: "account",
    })) as { items: Record<string, unknown>[]; total: number };

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      identifier: "account-sa",
      email: "account-sa@service.harness.io",
    });
  });

  it("get: account scope omits org and project", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { identifier: "ci-bot", name: "CI Bot", email: "ci-bot@service.harness.io" },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "service_account", "get", {
      resource_scope: "account",
      service_account_id: "ci-bot",
    })) as Record<string, unknown>;

    const call = mockRequest.mock.calls[0][0];
    expect(call.path).toBe("/ng/api/serviceaccount/ci-bot");
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
    expect(String(result.openInHarness)).toContain("/all/settings/access-control/service-accounts/ci-bot");
    expect(String(result.openInHarness)).not.toContain("/projects/");
  });

  it("get: org scope sends org only and avoids configured project in deep link", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: {
        identifier: "ci-bot",
        name: "CI Bot",
        email: "ci-bot@service.harness.io",
        orgIdentifier: "platform",
      },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "service_account", "get", {
      resource_scope: "org",
      org_id: "platform",
      service_account_id: "ci-bot",
    })) as Record<string, unknown>;

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.orgIdentifier).toBe("platform");
    expect(call.params.projectIdentifier).toBeUndefined();
    expect(String(result.openInHarness)).toContain(
      "/all/orgs/platform/settings/access-control/service-accounts/ci-bot",
    );
    expect(String(result.openInHarness)).not.toContain("/projects/");
  });

  it("create: account scope injects account only", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS", data: { identifier: "ci-bot" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "service_account", "create", {
      resource_scope: "account",
      body: { identifier: "ci-bot", name: "CI Bot", email: "ci-bot@service.harness.io" },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/serviceaccount");
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
    expect(call.body).toEqual({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      accountIdentifier: "test-account",
    });
  });

  it("delete: account scope omits org and project", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS", data: true });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "service_account", "delete", {
      resource_scope: "account",
      service_account_id: "ci-bot",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/ng/api/serviceaccount/ci-bot");
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });
});
