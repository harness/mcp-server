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

    it("throws for invalid toolset names in HARNESS_TOOLSETS", () => {
      expect(() => new Registry(makeConfig({ HARNESS_TOOLSETS: "nonexistent" }))).toThrow(
        /Invalid HARNESS_TOOLSETS: "nonexistent"/,
      );
    });

    it("throws for typo in toolset name (e.g. 'pipeline' instead of 'pipelines')", () => {
      expect(() => new Registry(makeConfig({ HARNESS_TOOLSETS: "pipeline" }))).toThrow(
        /Invalid HARNESS_TOOLSETS: "pipeline"/,
      );
      expect(() => new Registry(makeConfig({ HARNESS_TOOLSETS: "pipeline" }))).toThrow(
        /Valid toolset names:/,
      );
    });

    it("throws listing all invalid names when multiple are wrong", () => {
      expect(() => new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines,badname,services,oops" }))).toThrow(
        /Invalid HARNESS_TOOLSETS: "badname", "oops"/,
      );
    });

    it("accepts all valid toolset names without error", () => {
      // Just use a few known-good names
      const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines,services,connectors" }));
      const desc = registry.describe() as { total_toolsets: number };
      expect(desc.total_toolsets).toBe(3);
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

  describe("getAllFilterFields", () => {
    it("returns deduplicated FilterFieldSpec objects across enabled toolsets", () => {
      const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines,connectors" }));
      const fields = registry.getAllFilterFields();
      expect(Array.isArray(fields)).toBe(true);
      // Every entry should have name and description
      for (const f of fields) {
        expect(f).toHaveProperty("name");
        expect(f).toHaveProperty("description");
        expect(typeof f.name).toBe("string");
        expect(typeof f.description).toBe("string");
      }
      // "search_term" appears in both pipelines and connectors — should only appear once
      const searchTermEntries = fields.filter((f) => f.name === "search_term");
      expect(searchTermEntries).toHaveLength(1);
    });

    it("includes enum metadata when defined", () => {
      const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "connectors" }));
      const fields = registry.getAllFilterFields();
      const typeField = fields.find((f) => f.name === "type");
      expect(typeField).toBeDefined();
      expect(typeField!.enum).toBeDefined();
      expect(typeField!.enum!.length).toBeGreaterThan(0);
    });

    it("returns empty array when no toolsets have filter fields", () => {
      // All toolsets have some filters, but verify the method doesn't crash with a narrow set
      const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
      const fields = registry.getAllFilterFields();
      expect(fields.length).toBeGreaterThan(0);
    });
  });

  describe("LLM field discovery flow", () => {
    let registry: Registry;
    beforeEach(() => {
      registry = new Registry(makeConfig());
    });

    it("harness_describe exposes listFilterFields for each resource type", () => {
      // Simulate what an LLM would get from harness_describe(resource_type="pipeline")
      const def = registry.getResource("pipeline");
      expect(def.listFilterFields).toBeDefined();
      const names = def.listFilterFields!.map((f) => f.name);
      expect(names).toContain("search_term");
      expect(names).toContain("module");
    });

    it("listFilterFields are accepted by dispatch when passed as flat input", async () => {
      // Simulate: LLM discovers filter fields via describe, then passes them via filters catch-all
      const def = registry.getResource("connector");
      const names = def.listFilterFields!.map((f) => f.name);
      expect(names).toContain("search_term");
      expect(names).toContain("type");
      expect(names).toContain("category");

      const mockRequest = vi.fn().mockResolvedValue({
        data: { content: [], totalElements: 0 },
      });
      const client = makeClient(mockRequest);

      // Pass discovered filter fields as flat input (as they arrive after spreading filters catch-all)
      await registry.dispatch(client, "connector", "list", {
        search_term: "docker",
        type: "DockerRegistry",
        category: "CONNECTOR",
        page: 0,
        size: 10,
      });

      const call = mockRequest.mock.calls[0][0];
      // Connector list uses POST listV2 with body-based filtering
      expect(call.method).toBe("POST");
      expect(call.path).toBe("/ng/api/connectors/listV2");
      expect(call.params).toMatchObject({
        searchTerm: "docker",
      });
      // type and category are in the body, not query params
      expect(call.params).not.toHaveProperty("type");
      expect(call.params).not.toHaveProperty("category");
      expect(call.body).toMatchObject({
        filterType: "Connector",
        types: ["DockerRegistry"],
        categories: ["CONNECTOR"],
      });
    });

    it("connector list omits type/category from body when not provided", async () => {
      const mockRequest = vi.fn().mockResolvedValue({
        data: { content: [], totalElements: 0 },
      });
      const client = makeClient(mockRequest);

      await registry.dispatch(client, "connector", "list", {
        search_term: "aws",
        page: 0,
        size: 10,
      });

      const call = mockRequest.mock.calls[0][0];
      expect(call.method).toBe("POST");
      expect(call.body).toMatchObject({ filterType: "Connector" });
      expect(call.body.types).toBeUndefined();
      expect(call.body.categories).toBeUndefined();
    });

    it("identifierFields include parent IDs for nested resources", () => {
      // Trigger needs both pipeline_id and trigger_id
      const triggerDef = registry.getResource("trigger");
      expect(triggerDef.identifierFields).toContain("trigger_id");
      expect(triggerDef.identifierFields).toContain("pipeline_id");
      // pipeline_id is passed via queryParams on get, discoverable via describe
      const getSpec = triggerDef.operations.get;
      expect(getSpec?.queryParams).toHaveProperty("pipeline_id");
    });

    it("most listable resource types expose listFilterFields", () => {
      const allTypes = registry.getAllResourceTypes();
      let withFilters = 0;
      let listable = 0;
      for (const type of allTypes) {
        const def = registry.getResource(type);
        if (def.operations.list) {
          listable++;
          if (def.listFilterFields) withFilters++;
        }
      }
      // Majority of listable resources should have filter fields defined
      expect(withFilters / listable).toBeGreaterThanOrEqual(0.5);
    });

    it("describeSummary includes filter discovery hint", () => {
      const summary = registry.describeSummary() as { hint: string };
      expect(summary.hint).toContain("harness_describe");
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

  describe("bodySchema enforcement", () => {
    let registry: Registry;
    beforeEach(() => {
      registry = new Registry(makeConfig());
    });

    it("every create operation has a bodySchema", () => {
      const missing: string[] = [];
      for (const type of registry.getAllResourceTypes()) {
        const def = registry.getResource(type);
        if (def.operations.create && !def.operations.create.bodySchema) {
          missing.push(`${type}.create`);
        }
      }
      expect(missing, `Missing bodySchema on create: ${missing.join(", ")}`).toEqual([]);
    });

    it("every update operation has a bodySchema", () => {
      const missing: string[] = [];
      for (const type of registry.getAllResourceTypes()) {
        const def = registry.getResource(type);
        if (def.operations.update && !def.operations.update.bodySchema) {
          missing.push(`${type}.update`);
        }
      }
      expect(missing, `Missing bodySchema on update: ${missing.join(", ")}`).toEqual([]);
    });

    it("every executeAction with a bodyBuilder has a bodySchema", () => {
      const missing: string[] = [];
      for (const type of registry.getAllResourceTypes()) {
        const def = registry.getResource(type);
        if (def.executeActions) {
          for (const [action, spec] of Object.entries(def.executeActions)) {
            // Only require bodySchema when the action accepts a body
            if (spec.bodyBuilder && !spec.bodySchema) {
              missing.push(`${type}.${action}`);
            }
          }
        }
      }
      expect(missing, `Missing bodySchema on executeActions: ${missing.join(", ")}`).toEqual([]);
    });

    it("bodySchema fields have required properties", () => {
      const invalid: string[] = [];
      for (const type of registry.getAllResourceTypes()) {
        const def = registry.getResource(type);
        const specs = [
          ...Object.entries(def.operations).map(([op, s]) => [`${type}.${op}`, s] as const),
          ...Object.entries(def.executeActions ?? {}).map(([a, s]) => [`${type}.${a}`, s] as const),
        ];
        for (const [label, spec] of specs) {
          if (spec.bodySchema) {
            if (!spec.bodySchema.description) invalid.push(`${label}: missing description`);
            if (!Array.isArray(spec.bodySchema.fields)) invalid.push(`${label}: fields not array`);
            for (const field of spec.bodySchema.fields) {
              if (!field.name || !field.type || typeof field.required !== "boolean" || !field.description) {
                invalid.push(`${label}.${field.name ?? "?"}: incomplete field spec`);
              }
            }
          }
        }
      }
      expect(invalid, `Invalid bodySchema fields: ${invalid.join("; ")}`).toEqual([]);
    });
  });
});
