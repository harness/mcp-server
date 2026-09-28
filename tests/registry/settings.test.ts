/**
 * setting resource: required category filter, category enum, and
 * account/org/project via resource_scope (same pattern as policy).
 */
import { describe, it, expect, vi } from "vitest";
import { SETTING_CATEGORIES, settingsToolset } from "../../src/registry/toolsets/settings.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function findSetting() {
  const res = settingsToolset.resources.find((r) => r.resourceType === "setting");
  if (!res) throw new Error("setting resource missing from settingsToolset");
  return res;
}

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "info",
    HARNESS_TOOLSETS: "settings",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({ data: [] }),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("setting resource contract", () => {
  it("declares supportedScopes account/org/project without scopeOptional", () => {
    const res = findSetting();
    expect(res.scope).toBe("project");
    expect(res.supportedScopes).toEqual(["account", "org", "project"]);
    expect(res.scopeOptional).toBeFalsy();
  });

  it("documents resource_scope and default project", () => {
    const res = findSetting();
    expect(res.description).toContain("resource_scope='account'|'org'|'project'");
    expect(res.description).toMatch(/Default is project/i);
  });

  it("requires category with the declared category enum", () => {
    const category = findSetting().listFilterFields?.find((f) => f.name === "category");
    expect(category?.required).toBe(true);
    expect(category?.enum).toEqual([...SETTING_CATEGORIES]);
    expect(category?.enum).toContain("NOTIFICATIONS");
    expect(category?.enum).not.toContain("NOTIFICATION");
    expect(category?.enum).toContain("RELEASE");
  });
});

describe("setting list filters", () => {
  it("rejects list without category before calling the API", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ data: [] });
    const client = makeClient(mockRequest);

    await expect(registry.dispatch(client, "setting", "list", {})).rejects.toThrow(
      /Missing required filter\(s\) for listing setting: category/,
    );
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("canonicalizes lowercase category to the declared enum value", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ data: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "setting", "list", { category: "notifications" });

    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.category).toBe("NOTIFICATIONS");
  });

  it("does not rewrite NOTIFICATION (singular) to NOTIFICATIONS", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ data: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "setting", "list", { category: "NOTIFICATION" });

    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.category).toBe("NOTIFICATION");
  });
});

describe("setting list scope", () => {
  it("omits org/project for resource_scope=account", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ data: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "setting", "list", {
      resource_scope: "account",
      category: "CE",
    });

    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
    expect(call.params.category).toBe("CE");
  });

  it("injects only org for resource_scope=org", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ data: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "setting", "list", {
      resource_scope: "org",
      org_id: "platform",
      category: "PMS",
    });

    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.orgIdentifier).toBe("platform");
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("keeps project default when resource_scope is omitted", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ data: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "setting", "list", { category: "CD" });

    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.orgIdentifier).toBe("default");
    expect(call.params.projectIdentifier).toBe("test-project");
  });

  it("maps include_parent_scopes to includeParentScopes", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ data: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "setting", "list", {
      category: "CORE",
      include_parent_scopes: true,
    });

    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.includeParentScopes).toBe(true);
  });
});
