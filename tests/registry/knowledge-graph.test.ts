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
});
