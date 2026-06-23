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
// kg_type get — local required-field validation
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

// ---------------------------------------------------------------------------
// hql_query validate — body aliases + response projection
// ---------------------------------------------------------------------------

describe("hql_query validate", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it.each([
    ["query_string", "find view \"x\""],
    ["queryString", "find entity \"service\""],
    ["query", "find metric \"cpu\""],
  ] as const)("accepts body.%s alias and posts query_string", async (field, query) => {
    const mockRequest = vi.fn().mockResolvedValue({ is_valid: true, errors: [] });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "hql_query", "validate", {
      body: { [field]: query },
    });

    const call = mockRequest.mock.calls[0]![0] as { body: Record<string, unknown> };
    expect(call.body).toEqual({ query_string: query });
  });

  it("projects only is_valid and errors, dropping backend envelope fields", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      is_valid: false,
      errors: [{ message: "syntax error near 'foo'" }],
      trace_id: "internal-trace",
      correlationId: "leak-me",
      debug: { plan: "..." },
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatchExecute(client, "hql_query", "validate", {
      body: { query_string: "bad query" },
    });

    expect(result).toEqual({
      is_valid: false,
      errors: [{ message: "syntax error near 'foo'" }],
    });
  });

  it("defaults errors to an empty array when the API omits it", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ is_valid: true });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatchExecute(client, "hql_query", "validate", {
      body: { query_string: "find view \"x\"" },
    })) as { is_valid: boolean; errors: unknown[] };

    expect(result).toEqual({ is_valid: true, errors: [] });
  });
});

// ---------------------------------------------------------------------------
// kg_type list — schemaTypesExtract + schemaTypesBody
// ---------------------------------------------------------------------------

describe("kg_type list extractor", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("flattens multi-bucket API response into compact items with category labels", async () => {
    const longDesc = "x".repeat(130);
    const mockRequest = vi.fn().mockResolvedValue({
      entity_types: [
        { id: "service", name: "Service", kind: "OBJECT_KIND_ENTITY", description: "short" },
        { name: "no-id-should-skip" },
      ],
      view_types: [
        { identifier: "v1", name: "View 1", kind: "OBJECT_KIND_VIEW", description: longDesc },
      ],
      data_model_types: [{ id: "dm1", name: "Data Model 1" }],
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "kg_type", "list", {})) as {
      items: Record<string, unknown>[];
      total: number;
    };

    expect(result.total).toBe(3);
    expect(result.items).toEqual([
      {
        identifier: "service",
        name: "Service",
        category: "entity",
        kind: "OBJECT_KIND_ENTITY",
        description: "short",
      },
      {
        identifier: "v1",
        name: "View 1",
        category: "view",
        kind: "OBJECT_KIND_VIEW",
        description: `${"x".repeat(120)}...`,
      },
      {
        identifier: "dm1",
        name: "Data Model 1",
        category: "data_model",
        kind: undefined,
      },
    ]);
  });

  it("maps object_kind filter to POST body filter.objectKind", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ entity_types: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "kg_type", "list", { object_kind: "OBJECT_KIND_VIEW" });

    const call = mockRequest.mock.calls[0]![0] as { body: Record<string, unknown> };
    expect(call.body).toEqual({ filter: { objectKind: ["OBJECT_KIND_VIEW"] } });
  });
});

// ---------------------------------------------------------------------------
// kg_type get — relationship_type dcs_enrichment branch (schemaTypeExtract)
// ---------------------------------------------------------------------------

describe("kg_type get dcs_enrichment", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("reattaches join metadata for annotated relationship types without leaking columnMappingMeta", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      type: {
        relationship_type: {
          id: "service_to_deployment",
          name: "Service to Deployment",
          annotations: [{ key: "dcs_enrichment" }],
          join_predicates: [{ left: "id", right: "service_id", columnMappingMeta: { hidden: true } }],
          left_reference: { id: "service", columnMappingMeta: { internal: true } },
          right_reference: { id: "deployment" },
          fields: [
            { name: "deployed_at", columnMappingMeta: { x: 1 } },
            { columnMappingMeta: { only: true } },
          ],
        },
      },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "kg_type", "get", {
      type_id: "service_to_deployment",
      kind: "OBJECT_KIND_RELATIONSHIP",
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      id: "service_to_deployment",
      name: "Service to Deployment",
      dcs_enrichment: true,
      join_predicates: [{ left: "id", right: "service_id" }],
      left_reference: { id: "service" },
      right_reference: { id: "deployment" },
      enrichment_fields: [{ name: "deployed_at" }],
    });
    expect(result.join_predicates).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ columnMappingMeta: expect.anything() })]),
    );
    expect(result.enrichment_fields).toEqual([{ name: "deployed_at" }]);
  });
});

// ---------------------------------------------------------------------------
// kg_queryable_type_summary — queryableTypesBody + list edge cases
// ---------------------------------------------------------------------------

describe("kg_queryable_type_summary list filters and projection", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("maps kinds and annotations filters into the POST body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ queryable_types: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "kg_queryable_type_summary", "list", {
      kinds: "OBJECT_KIND_VIEW",
      annotations: "dcs",
    });

    const call = mockRequest.mock.calls[0]![0] as { body: Record<string, unknown> };
    expect(call.body).toEqual({
      filter: { kinds: ["OBJECT_KIND_VIEW"], annotations: ["dcs"] },
    });
  });

  it("truncates long descriptions and surfaces annotation tags", async () => {
    const longDesc = "a".repeat(100);
    const mockRequest = vi.fn().mockResolvedValue({
      queryable_types: [
        {
          type: {
            view_type: {
              id: "v1",
              name: "View 1",
              description: longDesc,
              annotations: [{ key: "dcs" }, { key: "dashboard" }],
            },
          },
          type_reference: { object_kind: "OBJECT_KIND_VIEW" },
        },
      ],
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "kg_queryable_type_summary", "list", {})) as {
      items: Record<string, unknown>[];
    };

    expect(result.items[0]!.description).toBe(`${"a".repeat(80)}...`);
    expect(result.items[0]!.tags).toEqual(["dcs", "dashboard"]);
  });
});
