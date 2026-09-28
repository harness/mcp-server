/**
 * Delegate and delegate_token registry wiring: scope, query params, and
 * `{ resource }` / `{ data }` response unwrapping.
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import {
  restResourceFirstExtract,
  restResourceListExtract,
  restResourceUnwrap,
} from "../../src/registry/extractors.js";
import { HarnessApiError } from "../../src/utils/errors.js";
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
    HARNESS_TOOLSETS: "delegates",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({ resource: [] }),
    account: "test-account",
  } as unknown as HarnessClient;
}

type RequestCall = {
  method: string;
  path: string;
  params: Record<string, unknown>;
  body: unknown;
};

function lastCall(mockRequest: ReturnType<typeof vi.fn>): RequestCall {
  return mockRequest.mock.calls[0]![0] as RequestCall;
}

describe("restResource extractors", () => {
  it("unwraps the resource envelope", () => {
    expect(restResourceUnwrap({ resource: [{ name: "d1" }], responseMessages: [] })).toEqual([{ name: "d1" }]);
  });

  it("falls back to NG data envelope", () => {
    expect(restResourceUnwrap({ status: "SUCCESS", data: [{ name: "d1" }] })).toEqual([{ name: "d1" }]);
  });

  it("shapes list payloads as { items, total }", () => {
    expect(restResourceListExtract({ resource: [{ name: "a" }, { name: "b" }] })).toEqual({
      items: [{ name: "a" }, { name: "b" }],
      total: 2,
    });
  });

  it("returns the first item for get-by-name", () => {
    expect(restResourceFirstExtract({ resource: [{ name: "only" }] })).toEqual({ name: "only" });
  });

  it("throws 404 when get-by-name has no matches", () => {
    expect(() => restResourceFirstExtract({ resource: [] })).toThrow(HarnessApiError);
  });
});

describe("delegate resource", () => {
  it("declares account/org/project supportedScopes and scopeOptional", () => {
    const registry = new Registry(makeConfig());
    const def = registry.getResource("delegate");
    expect(def.scope).toBe("account");
    expect(def.supportedScopes).toEqual(["account", "org", "project"]);
    expect(def.scopeOptional).toBe(true);
    expect(def.operations.get).toBeDefined();
    expect(def.operations.list?.skipScopeBodyInjection).toBe(true);
  });

  it("accepts resource_scope=project on list", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ resource: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "delegate", "list", {
      resource_scope: "project",
      org_id: "my-org",
      project_id: "my-project",
    });

    const call = lastCall(mockRequest);
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/delegate-setup/listDelegates");
    expect(call.params.orgIdentifier).toBe("my-org");
    expect(call.params.projectIdentifier).toBe("my-project");
    expect(call.params.all).toBeUndefined();
    expect(call.body).toBeUndefined();
  });

  it("omits org/project for resource_scope=account", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ resource: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "delegate", "list", { resource_scope: "account" });

    const call = lastCall(mockRequest);
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
    expect(call.params.all).toBeUndefined();
  });

  it("does not leak config org/project when scope is omitted", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ resource: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "delegate", "list", {});

    const call = lastCall(mockRequest);
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("puts filters in the body without injecting orgIdentifier", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ resource: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "delegate", "list", {
      org_id: "my-org",
      project_id: "my-project",
      status: "CONNECTED",
      delegate_name: "prod-del",
    });

    const call = lastCall(mockRequest);
    expect(call.body).toEqual({
      filterType: "Delegate",
      status: "CONNECTED",
      delegateName: "prod-del",
    });
    expect(call.params.orgIdentifier).toBe("my-org");
    expect(call.params.projectIdentifier).toBe("my-project");
  });

  it("forwards all=true only when the caller sets it", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ resource: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "delegate", "list", { all: true });

    const call = lastCall(mockRequest);
    expect(call.params.all).toBe(true);
    expect(call.body).toBeUndefined();
  });

  it("gets a delegate by name", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ resource: [{ name: "prod-del", connected: true }] });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "delegate", "get", { delegate_id: "prod-del" });

    const call = lastCall(mockRequest);
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/delegate-setup/listDelegates");
    expect(call.body).toEqual({ filterType: "Delegate", delegateName: "prod-del" });
    expect(call.params.all).toBe("true");
    expect(call.params.delegateName).toBeUndefined();
    expect(result).toMatchObject({ name: "prod-del", connected: true });
  });
});

describe("delegate_token resource", () => {
  it("declares account/org/project supportedScopes and scopeOptional", () => {
    const registry = new Registry(makeConfig());
    const def = registry.getResource("delegate_token");
    expect(def.scope).toBe("project");
    expect(def.supportedScopes).toEqual(["account", "org", "project"]);
    expect(def.scopeOptional).toBe(true);
    expect(def.operations.get?.path).toBe("/ng/api/delegate-token-ng");
    expect(def.operations.get?.pathParams).toBeUndefined();
  });

  it("lists with name/status query params and unwraps the resource envelope", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      resource: [{ name: "default_token", status: "ACTIVE" }],
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "delegate_token", "list", {
      name: "default_token",
      status: "ACTIVE",
      org_id: "my-org",
      project_id: "my-project",
    });

    const call = lastCall(mockRequest);
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/ng/api/delegate-token-ng");
    expect(call.params.name).toBe("default_token");
    expect(call.params.status).toBe("ACTIVE");
    expect(call.params.orgIdentifier).toBe("my-org");
    expect(result).toMatchObject({
      items: [{ name: "default_token", status: "ACTIVE" }],
      total: 1,
    });
  });

  it("gets by name query param, not a path segment", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ resource: [{ name: "my_token" }] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "delegate_token", "get", { token_name: "my_token" });

    const call = lastCall(mockRequest);
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/ng/api/delegate-token-ng");
    expect(call.params.name).toBe("my_token");
    expect(call.body).toBeUndefined();
  });

  it("creates with tokenName query param and no JSON body", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ resource: { name: "new_token" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "delegate_token", "create", {
      body: { name: "new_token" },
      org_id: "my-org",
      project_id: "my-project",
    });

    const call = lastCall(mockRequest);
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/delegate-token-ng");
    expect(call.params.tokenName).toBe("new_token");
    expect(call.params.orgIdentifier).toBe("my-org");
    expect(call.params.projectIdentifier).toBe("my-project");
    expect(call.body).toBeUndefined();
  });

  it("deletes with tokenName query param on the collection path", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "delegate_token", "delete", { token_name: "old_token" });

    const call = lastCall(mockRequest);
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/ng/api/delegate-token-ng");
    expect(call.params.tokenName).toBe("old_token");
  });

  it("revokes with PUT tokenName query param, not status or a path segment", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ resource: { name: "my_token", status: "REVOKED" } });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "delegate_token", "revoke", { token_name: "my_token" });

    const call = lastCall(mockRequest);
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/ng/api/delegate-token-ng");
    expect(call.params.tokenName).toBe("my_token");
    expect(call.params.status).toBeUndefined();
    expect(call.body).toBeUndefined();
  });

  it("lists groups for a token via delegate-groups?delegateTokenName=", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ resource: { delegateGroupDetails: [] } });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "delegate_token", "get_delegates", { token_name: "my_token" });

    const call = lastCall(mockRequest);
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/ng/api/delegate-token-ng/delegate-groups");
    expect(call.params.delegateTokenName).toBe("my_token");
  });

  it("rejects create without a token name before calling the API", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(registry.dispatch(client, "delegate_token", "create", { body: {} })).rejects.toThrow(/token_name/);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
