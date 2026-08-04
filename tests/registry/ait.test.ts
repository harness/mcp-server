import { describe, it, expect, vi } from "vitest";
import { aitToolset } from "../../src/registry/toolsets/ait.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ResourceDefinition, EndpointSpec } from "../../src/registry/types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "Testim",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function findResource(type: string): ResourceDefinition {
  const res = aitToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in aitToolset`);
  return res;
}

function getOp(type: string, op: "list" | "get" | "create"): EndpointSpec {
  const res = findResource(type);
  const spec = res.operations[op];
  if (!spec) throw new Error(`Operation "${op}" not found on "${type}"`);
  return spec;
}

// ─── Toolset structure ───────────────────────────────────────────────────────

describe("aitToolset structure", () => {
  it("has name 'ait'", () => {
    expect(aitToolset.name).toBe("ait");
  });

  it("is opt-in (not loaded by default)", () => {
    expect(aitToolset.optIn).toBe(true);
  });

  it("registers 3 noun-oriented resource types", () => {
    const types = aitToolset.resources.map((r) => r.resourceType);
    expect(types).toContain("ait_app");
    expect(types).toContain("ait_test_environment");
    expect(types).toContain("ait_test");
    expect(types).toHaveLength(3);
  });

  it("ait_test has list, create operations and run executeAction", () => {
    const res = findResource("ait_test");
    expect(res.operations.list).toBeDefined();
    expect(res.operations.create).toBeDefined();
    expect(res.executeActions?.run).toBeDefined();
  });

  it("all resources are account-scoped", () => {
    for (const resource of aitToolset.resources) {
      expect(resource.scope, `${resource.resourceType} should be account-scoped`).toBe("account");
    }
  });

  it("all list/get/create endpoint specs have operationPolicy", () => {
    for (const resource of aitToolset.resources) {
      for (const [opName, spec] of Object.entries(resource.operations)) {
        expect(
          spec.operationPolicy,
          `${resource.resourceType}.${opName} is missing operationPolicy`,
        ).toBeDefined();
      }
    }
  });
});

// ─── Registry opt-in behaviour ──────────────────────────────────────────────

describe("ait opt-in with Registry", () => {
  it("is NOT present when HARNESS_TOOLSETS is unset (all defaults)", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined }));
    expect(registry.getAllResourceTypes()).not.toContain("ait_app");
  });

  it("IS present when explicitly enabled with HARNESS_TOOLSETS=+ait", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "+ait" }));
    expect(registry.getAllResourceTypes()).toContain("ait_app");
    expect(registry.getAllResourceTypes()).toContain("ait_test_environment");
    expect(registry.getAllResourceTypes()).toContain("ait_test");
  });

  it("IS present when listed explicitly in HARNESS_TOOLSETS=ait", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ait" }));
    expect(registry.getAllResourceTypes()).toContain("ait_app");
  });
});

// ─── Response extractor: ait_app list ───────────────────────────────────────

describe("ait_app list extractor", () => {
  function extract(raw: unknown) {
    return getOp("ait_app", "list").responseExtractor!(raw);
  }

  it("normalizes camelCase app fields to snake_case", () => {
    const raw = [
      {
        appId: "abc-123",
        appName: "my-app",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        workspaceId: 1,
        isDeleted: false,
        sandbox: false,
        hasSessions: true,
      },
    ];
    const result = extract(raw) as { items: Record<string, unknown>[]; total: number };
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      app_id: "abc-123",
      app_name: "my-app",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      workspace_id: 1,
      sandbox: false,
      has_sessions: true,
    });
    expect(result.total).toBe(1);
  });

  it("filters out deleted apps", () => {
    const raw = [
      { appId: "a1", appName: "active", isDeleted: false },
      { appId: "a2", appName: "deleted", isDeleted: true },
    ];
    const result = extract(raw) as { items: Record<string, unknown>[]; total: number };
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.app_id).toBe("a1");
    expect(result.total).toBe(1);
  });

  it("handles empty array", () => {
    const result = extract([]) as { items: unknown[]; total: number };
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("throws on non-array response", () => {
    expect(() => extract({ error: "unauthorized" })).toThrow("ait_app: expected array response");
    expect(() => extract("string")).toThrow("ait_app: expected array response");
    expect(() => extract(null)).toThrow("ait_app: expected array response");
  });
});

// ─── Response extractor: ait_test_environment list ──────────────────────────

describe("ait_test_environment list extractor", () => {
  function extract(raw: unknown) {
    return getOp("ait_test_environment", "list").responseExtractor!(raw);
  }

  it("normalizes camelCase env fields to snake_case", () => {
    const raw = [
      {
        id: "env-1",
        appId: "app-1",
        envName: "production",
        test: true,
        monitor: false,
        preRelease: true,
        baseUrl: "https://example.com",
      },
    ];
    const result = extract(raw) as { items: Record<string, unknown>[]; total: number };
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      id: "env-1",
      app_id: "app-1",
      env_name: "production",
      test: true,
      monitor: false,
      pre_release: true,
      base_url: "https://example.com",
    });
    expect(result.total).toBe(1);
  });

  it("handles null baseUrl", () => {
    const raw = [{ id: "env-1", baseUrl: null }];
    const result = extract(raw) as { items: Record<string, unknown>[] };
    expect(result.items[0]!.base_url).toBeNull();
  });

  it("handles empty array", () => {
    const result = extract([]) as { items: unknown[]; total: number };
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("throws on non-array response", () => {
    expect(() => extract({ error: "unauthorized" })).toThrow("ait_test_environment: expected array response");
    expect(() => extract("string")).toThrow("ait_test_environment: expected array response");
    expect(() => extract(null)).toThrow("ait_test_environment: expected array response");
  });
});

// ─── Response extractor: ait_test list ──────────────────────────────────────

describe("ait_test list extractor", () => {
  function extract(raw: unknown) {
    return getOp("ait_test", "list").responseExtractor!(raw);
  }

  it("extracts paginated test list with key fields", () => {
    const raw = {
      data: [
        {
          testId: 1,
          testName: "Login test",
          createdBy: "user@example.com",
          createdByNickname: "User",
          createdAt: "2026-01-01T00:00:00Z",
          lastRunId: 10,
          testVersionId: 2,
          tags: "[]",
          lastKRunDetailsList: [{ displayStatus: "PASSED" }],
        },
      ],
      totalPages: 1,
      totalItems: 1,
      itemsPerPage: 20,
      currentPage: 1,
    };
    const result = extract(raw) as Record<string, unknown>;
    const items = result.items as Record<string, unknown>[];
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      test_id: 1,
      name: "Login test",
      created_by: "User",
      created_at: "2026-01-01T00:00:00Z",
      display_status: "PASSED",
      last_run_id: 10,
      test_version_id: 2,
      tags: "[]",
    });
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.currentPage).toBe(1);
    expect(result.itemsPerPage).toBe(20);
  });

  it("falls back to createdBy when createdByNickname is absent", () => {
    const raw = {
      data: [{ testId: 1, testName: "Test", createdBy: "user@example.com" }],
    };
    const result = extract(raw) as { items: Record<string, unknown>[] };
    expect(result.items[0]!.created_by).toBe("user@example.com");
  });

  it("display_status is null when lastKRunDetailsList is empty", () => {
    const raw = {
      data: [{ testId: 1, testName: "Test", lastKRunDetailsList: [] }],
    };
    const result = extract(raw) as { items: Record<string, unknown>[] };
    expect(result.items[0]!.display_status).toBeNull();
  });

  it("handles empty data", () => {
    const raw = { data: [], totalPages: 0, totalItems: 0, itemsPerPage: 20, currentPage: 1 };
    const result = extract(raw) as Record<string, unknown>;
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("throws on non-object response", () => {
    expect(() => extract("string")).toThrow("ait_test: expected paginated object response");
    expect(() => extract(null)).toThrow("ait_test: expected paginated object response");
    expect(() => extract([1, 2, 3])).toThrow("ait_test: expected paginated object response");
  });

  it("throws when data field is not an array", () => {
    expect(() => extract({ data: "not-array" })).toThrow("ait_test: expected data field to be an array");
  });
});

// ─── Response extractor: ait_test create ────────────────────────────────────

describe("ait_test create extractor", () => {
  function extract(raw: unknown) {
    return getOp("ait_test", "create").responseExtractor!(raw);
  }

  it("normalizes camelCase to snake_case", () => {
    const raw = { testId: 42, testVersionId: 7 };
    const result = extract(raw) as Record<string, unknown>;
    expect(result).toEqual({ test_id: 42, test_version_id: 7 });
  });
});

// ─── Response extractor: ait_test execute.run ───────────────────────────────

describe("ait_test run extractor", () => {
  function extract(raw: unknown) {
    const res = findResource("ait_test");
    return res.executeActions!.run.responseExtractor!(raw);
  }

  it("extracts key fields from run response", () => {
    const raw = {
      id: 99,
      app_id: "app-uuid",
      test_id: 10,
      test_version_id: 20,
      test_environment_id: "env-uuid",
      status: "RUNNING",
      test_session_id: "sess-1",
      start_epoch: 1700000000,
      error: null,
    };
    const result = extract(raw) as Record<string, unknown>;
    expect(result).toEqual({
      id: 99,
      app_id: "app-uuid",
      test_id: 10,
      test_version_id: 20,
      test_environment_id: "env-uuid",
      status: "RUNNING",
      error: null,
    });
  });

  it("does not include process.env-dependent URLs or _note", () => {
    const raw = {
      id: 1,
      app_id: "a",
      test_id: 2,
      test_version_id: 3,
      test_environment_id: "e",
      status: null,
      test_session_id: null,
      start_epoch: null,
      error: null,
    };
    const result = extract(raw) as Record<string, unknown>;
    expect(result).not.toHaveProperty("test_run_url");
    expect(result).not.toHaveProperty("_note");
  });
});

// ─── API paths ───────────────────────────────────────────────────────────────

describe("endpoint paths", () => {
  it("ait_app list uses /ait/api/v1/application", () => {
    expect(getOp("ait_app", "list").path).toBe("/ait/api/v1/application");
  });

  it("ait_test_environment list uses /ait/api/v1/testEnvironments", () => {
    expect(getOp("ait_test_environment", "list").path).toBe("/ait/api/v1/testEnvironments");
  });

  it("ait_test list uses /ait/api/v1/testNew", () => {
    expect(getOp("ait_test", "list").path).toBe("/ait/api/v1/testNew");
  });

  it("ait_test create uses /ait/api/v1/testNew/copilotTest/import", () => {
    expect(getOp("ait_test", "create").path).toBe("/ait/api/v1/testNew/copilotTest/import");
  });

  it("ait_test execute.run uses /ait/api/v1/testNew/{test_id}/version/{test_version_id}/run", () => {
    const res = findResource("ait_test");
    expect(res.executeActions!.run.path).toBe("/ait/api/v1/testNew/{test_id}/version/{test_version_id}/run");
  });
});

// ─── bodyBuilder snake_case acceptance ──────────────────────────────────────

describe("ait_test create bodyBuilder", () => {
  function getBodyBuilder() {
    return getOp("ait_test", "create").bodyBuilder!;
  }

  it("accepts snake_case fields and maps to camelCase wire format", () => {
    const builder = getBodyBuilder();
    const result = builder({ body: { app_id: "a1", env_id: "e1", description: "test desc", auth_type: "no_auth", entry_url: "https://example.com" } });
    expect(result).toEqual({
      appId: "a1",
      envId: "e1",
      description: "test desc",
      authType: "no_auth",
      entryUrl: "https://example.com",
    });
  });

  it("accepts camelCase fields as aliases", () => {
    const builder = getBodyBuilder();
    const result = builder({ body: { appId: "a1", envId: "e1", description: "test desc" } });
    expect(result).toEqual({
      appId: "a1",
      envId: "e1",
      description: "test desc",
    });
  });
});

describe("ait_test run bodyBuilder", () => {
  function getBodyBuilder() {
    const res = findResource("ait_test");
    return res.executeActions!.run.bodyBuilder!;
  }

  it("accepts snake_case fields and maps to camelCase wire format", () => {
    const builder = getBodyBuilder();
    const result = builder({ body: { app_id: "a1", environment_id: "e1" } });
    expect(result).toEqual({
      appId: "a1",
      environmentId: "e1",
      params: '{"RUN_MODE":"no-mock","TestExecutorNamespace.fastExecutorMode":"false"}',
    });
  });

  it("accepts camelCase fields as aliases", () => {
    const builder = getBodyBuilder();
    const result = builder({ body: { appId: "a1", environmentId: "e1", params: '{"custom":"value"}' } });
    expect(result).toEqual({
      appId: "a1",
      environmentId: "e1",
      params: '{"custom":"value"}',
    });
  });
});

// ─── Registry dispatch integration ─────────────────────────────────────────

describe("ait registry dispatch", () => {
  it("dispatches ait_app list", async () => {
    const mockRequest = vi.fn().mockResolvedValue([
      { appId: "abc", appName: "test-app", isDeleted: false },
    ]);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ait" }));

    const result = await registry.dispatch(makeClient(mockRequest), "ait_app", "list", {});

    const request = mockRequest.mock.calls[0]![0] as { path: string };
    expect(request.path).toBe("/ait/api/v1/application");
    expect((result as { items: unknown[] }).items).toHaveLength(1);
  });

  it("dispatches ait_test list with app_id filter", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: [], totalItems: 0 });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ait" }));

    await registry.dispatch(makeClient(mockRequest), "ait_test", "list", {
      app_id: "abc-123",
    });

    const request = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(request.path).toBe("/ait/api/v1/testNew");
    expect(request.params.appId).toBe("abc-123");
  });

  it("maps size parameter to limit query param for ait_test list", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: [], totalItems: 0 });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ait" }));

    await registry.dispatch(makeClient(mockRequest), "ait_test", "list", {
      app_id: "abc-123",
      size: 5,
    });

    const request = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(request.params.limit).toBe(5);
  });

  it("dispatches ait_test_environment list with app_id filter", async () => {
    const mockRequest = vi.fn().mockResolvedValue([]);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ait" }));

    await registry.dispatch(makeClient(mockRequest), "ait_test_environment", "list", {
      app_id: "abc-123",
    });

    const request = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(request.path).toBe("/ait/api/v1/testEnvironments");
    expect(request.params.appId).toBe("abc-123");
  });
});
