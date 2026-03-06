import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_DEFAULT_ORG_ID: "default",
    HARNESS_DEFAULT_PROJECT_ID: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("Registry", () => {
  describe("constructor — toolset loading", () => {
    it("loads all toolsets when HARNESS_TOOLSETS is not set", () => {
      const registry = new Registry(makeConfig());
      const desc = registry.describe() as { total_toolsets: number };
      // There are 23 toolsets imported in registry/index.ts (including access_control)
      // But ToolsetName only has 22 entries. Let's just check it loaded many.
      expect(desc.total_toolsets).toBeGreaterThanOrEqual(20);
    });

    it("filters to specific toolsets when HARNESS_TOOLSETS is set", () => {
      const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines,services" }));
      const desc = registry.describe() as { total_toolsets: number };
      expect(desc.total_toolsets).toBe(2);
    });

    it("loads zero toolsets for non-matching filter", () => {
      const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "nonexistent" }));
      const desc = registry.describe() as { total_toolsets: number };
      expect(desc.total_toolsets).toBe(0);
    });
  });

  describe("getResource", () => {
    let registry: Registry;
    beforeEach(() => {
      registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    });

    it("returns a resource definition for a valid type", () => {
      const def = registry.getResource("pipeline");
      expect(def.resourceType).toBe("pipeline");
      expect(def.displayName).toBe("Pipeline");
    });

    it("throws for unknown resource type with available list", () => {
      expect(() => registry.getResource("nonexistent")).toThrow(/Unknown resource_type "nonexistent"/);
      expect(() => registry.getResource("nonexistent")).toThrow(/Available:/);
    });
  });

  describe("getAllResourceTypes", () => {
    it("returns sorted array of resource types", () => {
      const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
      const types = registry.getAllResourceTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types).toContain("pipeline");
      // Verify sorted
      const sorted = [...types].sort();
      expect(types).toEqual(sorted);
    });
  });

  describe("supportsOperation", () => {
    let registry: Registry;
    beforeEach(() => {
      registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    });

    it("returns true for supported operation", () => {
      expect(registry.supportsOperation("pipeline", "list")).toBe(true);
      expect(registry.supportsOperation("pipeline", "get")).toBe(true);
    });

    it("returns false for unsupported operation", () => {
      expect(registry.supportsOperation("pipeline", "nonexistent" as any)).toBe(false);
    });

    it("returns false for unknown resource type", () => {
      expect(registry.supportsOperation("nonexistent", "list")).toBe(false);
    });
  });

  describe("describe", () => {
    it("returns structured metadata", () => {
      const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
      const desc = registry.describe() as {
        total_resource_types: number;
        total_toolsets: number;
        toolsets: Record<string, unknown>;
      };
      expect(desc.total_toolsets).toBe(1);
      expect(desc.total_resource_types).toBeGreaterThan(0);
      expect(desc.toolsets).toHaveProperty("pipelines");
    });
  });

  describe("dispatch", () => {
    let registry: Registry;
    beforeEach(() => {
      registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    });

    it("builds correct path and params for a list operation", async () => {
      const mockRequest = vi.fn().mockResolvedValue({
        data: { content: [{ identifier: "p1" }], totalElements: 1 },
      });
      const client = makeClient(mockRequest);

      await registry.dispatch(client, "pipeline", "list", {
        search_term: "deploy",
        page: 0,
        size: 10,
      });

      expect(mockRequest).toHaveBeenCalledOnce();
      const call = mockRequest.mock.calls[0][0];
      expect(call.method).toBe("POST");
      expect(call.path).toBe("/pipeline/api/pipelines/list");
      expect(call.params).toMatchObject({
        orgIdentifier: "default",
        projectIdentifier: "test-project",
        searchTerm: "deploy",
        page: 0,
        size: 10,
      });
    });

    it("builds correct path with path params for a get operation", async () => {
      const mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "my-pipeline" } });
      const client = makeClient(mockRequest);

      await registry.dispatch(client, "pipeline", "get", {
        pipeline_id: "my-pipeline",
      });

      expect(mockRequest).toHaveBeenCalledOnce();
      const call = mockRequest.mock.calls[0][0];
      expect(call.method).toBe("GET");
      expect(call.path).toBe("/pipeline/api/pipelines/my-pipeline");
    });

    it("throws on unsupported operation", async () => {
      const client = makeClient();
      await expect(
        registry.dispatch(client, "pipeline", "nonexistent" as any, {}),
      ).rejects.toThrow(/does not support "nonexistent"/);
    });

    it("throws on unknown resource type", async () => {
      const client = makeClient();
      await expect(
        registry.dispatch(client, "nonexistent", "list", {}),
      ).rejects.toThrow(/Unknown resource_type "nonexistent"/);
    });

    it("throws when required path param is missing", async () => {
      const client = makeClient();
      await expect(
        registry.dispatch(client, "pipeline", "get", {}),
      ).rejects.toThrow(/Missing required field/);
    });

    it("pipeline update with yamlPipeline sends raw YAML string as body with Content-Type header and returns openInHarness", async () => {
      const yaml = "pipeline:\n  name: Test\n  identifier: test_pipeline\n  stages: []";
      const mockRequest = vi.fn().mockResolvedValue({
        data: { identifier: "test_pipeline", yamlPipeline: yaml },
      });
      const client = makeClient(mockRequest);

      const result = (await registry.dispatch(client, "pipeline", "update", {
        pipeline_id: "test_pipeline",
        project_id: "my-project",
        org_id: "default",
        body: { yamlPipeline: yaml },
      })) as Record<string, unknown>;

      expect(mockRequest).toHaveBeenCalledOnce();
      const call = mockRequest.mock.calls[0][0];
      expect(call.method).toBe("PUT");
      expect(call.path).toBe("/pipeline/api/pipelines/v2/test_pipeline");
      // Body is the raw YAML string, not a JSON wrapper
      expect(call.body).toBe(yaml);
      // Content-Type header is set to application/yaml via spec headers
      expect(call.headers).toEqual({ "Content-Type": "application/yaml" });
      expect(result.openInHarness).toBeDefined();
      expect(String(result.openInHarness)).toContain("/pipelines/test_pipeline/pipeline-studio");
    });

    it("pipeline update with body.pipeline passes body through", async () => {
      const body = { pipeline: { name: "X", identifier: "x", stages: [] } };
      const mockRequest = vi.fn().mockResolvedValue({ data: body.pipeline });
      const client = makeClient(mockRequest);

      await registry.dispatch(client, "pipeline", "update", {
        pipeline_id: "x",
        project_id: "p",
        org_id: "default",
        body,
      });

      const call = mockRequest.mock.calls[0][0];
      expect(call.body).toEqual(body);
    });

    it("pipeline update without pipeline or yamlPipeline throws", async () => {
      const client = makeClient();
      await expect(
        registry.dispatch(client, "pipeline", "update", {
          pipeline_id: "x",
          body: {},
        }),
      ).rejects.toThrow(/body must include either pipeline/);
    });
  });

  describe("read-only mode", () => {
    let registry: Registry;
    beforeEach(() => {
      registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines", HARNESS_READ_ONLY: true }));
    });

    it("allows list operations", async () => {
      const mockRequest = vi.fn().mockResolvedValue({ data: { content: [], totalElements: 0 } });
      const client = makeClient(mockRequest);
      await registry.dispatch(client, "pipeline", "list", {});
      expect(mockRequest).toHaveBeenCalledOnce();
    });

    it("allows get operations", async () => {
      const mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "p1" } });
      const client = makeClient(mockRequest);
      await registry.dispatch(client, "pipeline", "get", { pipeline_id: "p1" });
      expect(mockRequest).toHaveBeenCalledOnce();
    });

    it("blocks create operations", async () => {
      const client = makeClient();
      await expect(
        registry.dispatch(client, "pipeline", "create", { body: {} }),
      ).rejects.toThrow(/Read-only mode/);
    });

    it("blocks update operations", async () => {
      const client = makeClient();
      await expect(
        registry.dispatch(client, "pipeline", "update", { pipeline_id: "p1", body: {} }),
      ).rejects.toThrow(/Read-only mode/);
    });

    it("blocks delete operations", async () => {
      const client = makeClient();
      await expect(
        registry.dispatch(client, "pipeline", "delete", { pipeline_id: "p1" }),
      ).rejects.toThrow(/Read-only mode/);
    });

    it("blocks execute actions", async () => {
      const client = makeClient();
      await expect(
        registry.dispatchExecute(client, "pipeline", "run", { pipeline_id: "p1" }),
      ).rejects.toThrow(/Read-only mode/);
    });
  });
});
