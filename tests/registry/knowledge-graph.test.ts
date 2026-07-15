/**
 * Verifies the Knowledge Graph and Semantic Layer toolsets at the registry
 * dispatch layer: HQL request-body construction (including zero-valued
 * options) and the schema/related-type extractors that strip internal
 * metadata while preserving meaningful empty collections.
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
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

// ---------------------------------------------------------------------------
// hql_query — run body construction
// ---------------------------------------------------------------------------

describe("hql_query run body", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("preserves zero-valued timeout_ms and max_results", async () => {
    // Regression: truthiness checks used to drop 0, rewriting the caller's
    // body into a different request shape. Zero must reach the API verbatim.
    const mockRequest = vi.fn().mockResolvedValue({ columns: [], rows: [] });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "hql_query", "run", {
      body: { query_string: "find view \"x\" | select {count()}", timeout_ms: 0, max_results: 0 },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.body).toEqual({
      query_string: "find view \"x\" | select {count()}",
      options: { timeout_ms: 0, max_results: 0, include_stats: true },
    });
  });

  it("omits the options object entirely when no execution options are passed", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ columns: [], rows: [] });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "hql_query", "run", {
      body: { query_string: "find view \"x\"" },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body).toEqual({ query_string: "find view \"x\"" });
    expect(call.body).not.toHaveProperty("options");
  });

  it("carries through positive execution options", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ columns: [], rows: [] });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "hql_query", "run", {
      body: { query_string: "find view \"x\"", timeout_ms: 5000, max_results: 100 },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.options).toEqual({ timeout_ms: 5000, max_results: 100, include_stats: true });
  });
});

// ---------------------------------------------------------------------------
// hql_query — run response shape
// ---------------------------------------------------------------------------

describe("hql_query run response extractor", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("projects a stable {columns, rows, stats} shape and drops backend envelope fields", async () => {
    // Regression: run used a raw passthrough, so query-service envelope/debug
    // fields leaked across the public tool boundary.
    const mockRequest = vi.fn().mockResolvedValue({
      columns: [{ name: "count" }],
      rows: [[42]],
      stats: { scanned_rows: 100 },
      trace_id: "internal-abc",
      debug: { plan: "..." },
      correlationId: "leak-me",
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatchExecute(client, "hql_query", "run", {
      body: { query_string: "find view \"x\" | select {count()}" },
    });

    expect(result).toEqual({
      columns: [{ name: "count" }],
      rows: [[42]],
      stats: { scanned_rows: 100 },
    });
  });

  it("unwraps a data-wrapped payload and defaults missing columns/rows", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: { columns: [{ name: "id" }] } });
    const client = makeClient(mockRequest);

    const result = await registry.dispatchExecute(client, "hql_query", "run", {
      body: { query_string: "find entity \"service\"" },
    });

    expect(result).toEqual({ columns: [{ name: "id" }], rows: [] });
  });
});

// ---------------------------------------------------------------------------
// kg_queryable_type_summary — list extractor
// ---------------------------------------------------------------------------

describe("kg_queryable_type_summary list extractor", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("prefers a stable connector identifier over the display name", async () => {
    // Regression: connectorId used to be filled from connector_name (a display
    // label), making the JOIN/discovery hint unstable. Prefer the identifier.
    const mockRequest = vi.fn().mockResolvedValue({
      queryable_types: [
        {
          type: {
            entity_type: { id: "service", name: "Service", description: "A service" },
          },
          type_reference: { object_kind: "OBJECT_KIND_ENTITY" },
          connector_mapping_config: {
            connector_reference: { connector_identifier: "my_connector_id", connector_name: "My Connector" },
          },
        },
      ],
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "kg_queryable_type_summary", "list", {})) as {
      items: Record<string, unknown>[];
      total: number;
    };

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      identifier: "service",
      name: "Service",
      kind: "OBJECT_KIND_ENTITY",
      connectorId: "my_connector_id",
    });
  });

  it("falls back to the connector name only when no identifier is present", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      queryable_types: [
        {
          type: { view_type: { id: "v1", name: "View 1" } },
          type_reference: { object_kind: "OBJECT_KIND_VIEW" },
          connector_mapping_config: { connector_reference: { connector_name: "Only Name" } },
        },
      ],
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "kg_queryable_type_summary", "list", {})) as {
      items: Record<string, unknown>[];
    };

    expect(result.items[0]!.connectorId).toBe("Only Name");
  });

  it("emits an empty connectorId when no connector mapping exists", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      queryable_types: [
        {
          type: { entity_type: { id: "e1", name: "E1" } },
          type_reference: { object_kind: "OBJECT_KIND_ENTITY" },
        },
      ],
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "kg_queryable_type_summary", "list", {})) as {
      items: Record<string, unknown>[];
    };

    expect(result.items[0]!.connectorId).toBe("");
  });
});

// ---------------------------------------------------------------------------
// kg_type / kg_related_type — extractor behavior
// ---------------------------------------------------------------------------

describe("kg_type get extractor", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("strips columnMappingMeta but keeps real fields and empty arrays", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      type: {
        entity_type: {
          id: "service",
          name: "Service",
          description: "",
          fields: [
            { name: "id", type: "string", columnMappingMeta: { hidden: true } },
            { columnMappingMeta: { only: true } },
          ],
          annotations: [],
        },
      },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "kg_type", "get", {
      type_id: "service",
      kind: "OBJECT_KIND_ENTITY",
    })) as Record<string, unknown>;

    expect(result).toEqual({
      id: "service",
      name: "Service",
      fields: [{ name: "id", type: "string" }],
      annotations: [],
    });
  });
});

describe("kg_related_type get extractor", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("preserves an explicitly empty relationship_types array", async () => {
    // Regression: an empty collection must survive so agents can tell
    // "no related types" from a missing field.
    const mockRequest = vi.fn().mockResolvedValue({ relationship_types: [] });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "kg_related_type", "get", {
      type_id: "service",
      kind: "OBJECT_KIND_ENTITY",
    })) as Record<string, unknown>;

    expect(result).toEqual({ relationship_types: [] });
  });

  it("surfaces dcs_enrichment relationships when annotated", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      relationship_types: [
        {
          id: "service_to_deployment",
          description: "links service to deployment",
          annotations: [{ key: "dcs_enrichment" }],
          left_reference: { id: "service" },
          right_reference: { id: "deployment" },
          join_predicates: [{ left: "id", right: "service_id" }],
          fields: [{ name: "deployed_at" }],
        },
      ],
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "kg_related_type", "get", {
      type_id: "service",
      kind: "OBJECT_KIND_ENTITY",
    })) as Record<string, unknown>;

    expect(result.dcs_enrichments).toEqual([
      {
        id: "service_to_deployment",
        description: "links service to deployment",
        annotations: ["dcs_enrichment"],
        left_reference: { id: "service" },
        right_reference: { id: "deployment" },
        join_predicates: [{ left: "id", right: "service_id" }],
        fields: [{ name: "deployed_at" }],
      },
    ]);
  });

  it("strips nested columnMappingMeta from reattached dcs_enrichment fields", async () => {
    // Regression: reattaching raw relObj.* values used to re-introduce nested
    // columnMappingMeta that the earlier strip had removed.
    const mockRequest = vi.fn().mockResolvedValue({
      relationship_types: [
        {
          id: "rel",
          annotations: [{ key: "dcs_enrichment" }],
          left_reference: { id: "a", columnMappingMeta: { hidden: true } },
          right_reference: { id: "b" },
          join_predicates: [{ left: "id", right: "a_id", columnMappingMeta: { internal: true } }],
          fields: [
            { name: "f1", columnMappingMeta: { x: 1 } },
            { columnMappingMeta: { only: true } },
          ],
        },
      ],
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "kg_related_type", "get", {
      type_id: "service",
      kind: "OBJECT_KIND_ENTITY",
    })) as Record<string, unknown>;

    expect(result.dcs_enrichments).toEqual([
      {
        id: "rel",
        description: undefined,
        annotations: ["dcs_enrichment"],
        left_reference: { id: "a" },
        right_reference: { id: "b" },
        join_predicates: [{ left: "id", right: "a_id" }],
        // The metadata-only field row is pruned; the real field keeps only clean keys.
        fields: [{ name: "f1" }],
      },
    ]);
  });

  it("fails locally with a clear error when type_id is missing", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "kg_related_type", "get", { kind: "OBJECT_KIND_ENTITY" }),
    ).rejects.toThrow(/Missing required identifier/);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// kg_type / kg_related_type get — required kind param and body construction
// ---------------------------------------------------------------------------

describe("kg_type get body validation", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("fails locally with a clear error when type_id is missing", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "kg_type", "get", { kind: "OBJECT_KIND_ENTITY" }),
    ).rejects.toThrow(/Missing required identifier/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("fails locally with a clear error when kind is missing", async () => {
    // Regression: kind used to default silently to OBJECT_KIND_ENTITY, which
    // could return the wrong schema when the same id exists under multiple kinds.
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "kg_type", "get", { type_id: "service" }),
    ).rejects.toThrow(/Missing required param\(s\) for kg_type\.get: kind/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("sends the exact kind in the request body without defaulting to OBJECT_KIND_ENTITY", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ type: { view_type: { id: "v1", name: "V1" } } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "kg_type", "get", {
      type_id: "v1",
      kind: "OBJECT_KIND_VIEW",
    });

    const call = mockRequest.mock.calls[0]![0] as { body: Record<string, unknown> };
    expect(call.body).toEqual({ kind: "OBJECT_KIND_VIEW", id: "v1" });
  });
});

describe("kg_related_type get body validation", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("fails locally with a clear error when kind is missing", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "kg_related_type", "get", { type_id: "service" }),
    ).rejects.toThrow(/Missing required param\(s\) for kg_related_type\.get: kind/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("sends the exact kind in type_reference without defaulting to OBJECT_KIND_ENTITY", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ relationship_types: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "kg_related_type", "get", {
      type_id: "v1",
      kind: "OBJECT_KIND_VIEW",
      include_transitive: true,
    });

    const call = mockRequest.mock.calls[0]![0] as { body: Record<string, unknown> };
    expect(call.body).toEqual({
      type_reference: { object_kind: "OBJECT_KIND_VIEW", id: "v1" },
      include_transitive: true,
    });
  });
});

describe("kg_type / kg_related_type paramsSchema metadata", () => {
  it("marks kind as required on get operations", () => {
    const registry = new Registry(makeConfig());
    const kgType = registry.getResource("kg_type").operations.get!;
    const kgRelated = registry.getResource("kg_related_type").operations.get!;

    expect(kgType.paramsSchema?.fields.find((f) => f.name === "kind")?.required).toBe(true);
    expect(kgRelated.paramsSchema?.fields.find((f) => f.name === "kind")?.required).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// kg_grammar — get response shape
// ---------------------------------------------------------------------------

describe("kg_grammar get extractor", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("wraps grammar text in an object for MCP output validation", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ grammar: "grammar Hql; /* ... */" });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "kg_grammar", "get", {});

    expect(result).toEqual({ grammar: "grammar Hql; /* ... */" });
    expect(typeof result).toBe("object");
  });

  it("preserves an empty grammar string", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ grammar: "" });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "kg_grammar", "get", {});

    expect(result).toEqual({ grammar: "" });
  });
});

// ---------------------------------------------------------------------------
// hql_query run — read-only mode policy
// ---------------------------------------------------------------------------

describe("hql_query run policy", () => {
  it("is allowed in read-only mode because HQL run is read-risk", async () => {
    const registry = new Registry(makeConfig({ HARNESS_READ_ONLY: true }));
    const mockRequest = vi.fn().mockResolvedValue({ columns: [], rows: [] });
    const client = makeClient(mockRequest);

    // Should NOT throw — risk:"read" actions pass the read-only gate.
    await registry.dispatchExecute(client, "hql_query", "run", {
      body: { query_string: "find view \"x\"" },
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});
