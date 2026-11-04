/**
 * Unified search toolset: request bodies for harness_list / harness_search /
 * harness_execute, response shaping, opt-in registration, and the error
 * messages that keep auth and feature-flag failures from reading as "no matches".
 * All fixtures are synthetic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { HarnessClient } from "../../src/client/harness-client.js";
import { HarnessApiError } from "../../src/utils/errors.js";
import { unifiedSearchErrorParser } from "../../src/client/error-parsers.js";
import {
  UNIFIED_SEARCH_PATH,
  UNIFIED_SEARCH_SOURCES_PATH,
  buildUnifiedSearchBody,
} from "../../src/registry/toolsets/unified-search.js";
import type { Config } from "../../src/config.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_MCP_MODE: "single-user",
    HARNESS_API_KEY: "pat.test-account.token.secret",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    // Configured defaults: must never turn into search filters.
    HARNESS_ORG: "default-org",
    HARNESS_PROJECT: "default-project",
    HARNESS_API_TIMEOUT_MS: 5000,
    HARNESS_MAX_RETRIES: 0,
    LOG_LEVEL: "error",
    HARNESS_RATE_LIMIT_RPS: 1000,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_TOOLSETS: "unified-search",
    ...overrides,
  } as Config;
}

function makeClient(response: unknown = { query: "q", sources: [] }) {
  const request = vi.fn().mockResolvedValue(response);
  return { client: { request, account: "test-account" } as unknown as HarnessClient, request };
}

const RESPONSE = {
  query: "checkout",
  sources: [
    {
      source: "entities",
      results: [
        {
          id: "doc-1",
          score: 0.812345,
          metadata: {
            entity_type: "cd:service",
            identifier: "checkout_svc",
            name: "Checkout Service",
            org_identifier: "acme",
            project_identifier: "shop",
            type: "Kubernetes",
          },
        },
        {
          id: "doc-2",
          score: 0.7,
          metadata: { entity_type: "platform:project", identifier: "shop", name: "Shop", orgIdentifier: "acme" },
        },
        {
          id: "doc-3",
          score: 0.6,
          metadata: { entity_type: "aisre:incident", title: "Checkout latency", status: "open", severity: "sev1" },
        },
      ],
    },
  ],
};

describe("unified-search registration", () => {
  it("is opt-in: absent by default, present with +unified-search", () => {
    const byDefault = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined }));
    expect(byDefault.getAllResourceTypes()).not.toContain("unified_search");

    const added = new Registry(makeConfig({ HARNESS_TOOLSETS: "+unified-search" }));
    expect(added.getAllResourceTypes()).toEqual(expect.arrayContaining(["unified_search", "unified_search_source", "pipeline"]));
  });

  it("joins harness_search's default scatter (list op, no required filter)", () => {
    // Same candidate rule as src/tools/harness-search.ts when resource_types is omitted.
    const registry = new Registry(makeConfig());
    const candidates = registry.getAllResourceTypes().filter(
      (rt) => registry.supportsOperation(rt, "list") && !registry.getResource(rt).listFilterFields?.some((f) => f.required),
    );
    expect(candidates).toContain("unified_search");
    // The static source list must not show up for every query.
    expect(candidates).not.toContain("unified_search_source");
  });
});

describe("unified_search list (harness_list / harness_search)", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("sends the query and limit only for a harness_search-style call, ignoring configured org/project", async () => {
    const { client, request } = makeClient(RESPONSE);
    await registry.dispatch(client, "unified_search", "list", {
      search_term: "checkout", name: "checkout", query: "checkout", search: "checkout",
      size: 5, limit: 5, page: 0,
    });
    const call = request.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe(UNIFIED_SEARCH_PATH);
    expect(call.body).toEqual({ query: "checkout", limit: 5 });
    expect(call.params?.orgIdentifier).toBeUndefined();
    expect(call.params?.projectIdentifier).toBeUndefined();
  });

  it("turns explicit filters into an entities filter and keeps them out of the body's scope fields", async () => {
    const { client, request } = makeClient(RESPONSE);
    await registry.dispatch(client, "unified_search", "list", {
      search_term: "checkout",
      entity_types: "cd:service, pipeline:pipeline",
      org_id: "acme",
      project_id: "shop",
      size: 20,
    });
    const body = request.mock.calls[0][0].body;
    expect(body.orgIdentifier).toBeUndefined();
    expect(body.projectIdentifier).toBeUndefined();
    expect(body).toEqual({
      query: "checkout",
      limit: 20,
      sources: {
        entities: {
          filter: {
            group: {
              must: [
                {
                  predicate: {
                    field: "entity_type",
                    op: "ANY",
                    values: [{ string_value: "cd:service" }, { string_value: "pipeline:pipeline" }],
                  },
                },
                {
                  group: {
                    should: [
                      { predicate: { field: "org_identifier", op: "EQ", values: [{ string_value: "acme" }] } },
                      { predicate: { field: "orgIdentifier", op: "EQ", values: [{ string_value: "acme" }] } },
                    ],
                  },
                },
                { predicate: { field: "project_identifier", op: "EQ", values: [{ string_value: "shop" }] } },
              ],
            },
          },
        },
      },
    });
  });

  it("clamps harness_list's page size to the server's 50-per-source cap", async () => {
    const { client, request } = makeClient(RESPONSE);
    await registry.dispatch(client, "unified_search", "list", { search_term: "x", size: 100 });
    expect(request.mock.calls[0][0].body.limit).toBe(50);
  });

  it("rejects an empty query before calling the API", async () => {
    const { client, request } = makeClient(RESPONSE);
    await expect(registry.dispatch(client, "unified_search", "list", { search_term: "  " })).rejects.toThrow(/needs a query/);
    expect(request).not.toHaveBeenCalled();
  });

  it("flattens hits, tags the source and adds harness_get args for known types", async () => {
    const { client } = makeClient(RESPONSE);
    const result = (await registry.dispatch(client, "unified_search", "list", { search_term: "checkout" })) as {
      items: Array<Record<string, unknown>>;
      total: number;
    };
    expect(result.total).toBe(3);
    expect(result.items[0]).toMatchObject({
      source: "entities",
      entity_type: "cd:service",
      name: "Checkout Service",
      identifier: "checkout_svc",
      org_id: "acme",
      project_id: "shop",
      score: 0.8123,
      harness_get: { resource_type: "service", resource_id: "checkout_svc", org_id: "acme", project_id: "shop" },
    });
    expect(result.items[1]).toMatchObject({
      entity_type: "platform:project",
      org_id: "acme",
      harness_get: { resource_type: "project", resource_id: "shop", org_id: "acme" },
    });
    // Incidents have no verified harness_get mapping; title stands in for name.
    expect(result.items[2]).toMatchObject({ entity_type: "aisre:incident", name: "Checkout latency" });
    expect(result.items[2].harness_get).toBeUndefined();
  });

  it("compact items drop the metadata bag", () => {
    const def = registry.getResource("unified_search");
    expect(def.compactItem?.({ name: "a", score: 1, metadata: { x: 1 } })).toEqual({ name: "a", score: 1 });
  });

  it("says an empty result is real and points at field names", async () => {
    const { client } = makeClient({ query: "x", sources: [{ source: "entities", results: [] }] });
    const result = (await registry.dispatch(client, "unified_search", "list", { search_term: "x" })) as Record<string, unknown>;
    expect(result.items).toEqual([]);
    expect(result.note).toMatch(/real empty result/);
  });
});

describe("unified_search search action (harness_execute)", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("ANDs source_filters with the shortcuts on the entities source", async () => {
    const { client, request } = makeClient(RESPONSE);
    const statusFilter = { predicate: { field: "status", op: "NE", values: [{ string_value: "closed" }] } };
    await registry.dispatchExecute(client, "unified_search", "search", {
      body: { query: "open incidents", entity_types: ["aisre:incident"], source_filters: { entities: statusFilter }, limit: 10 },
    });
    expect(request.mock.calls[0][0].body).toEqual({
      query: "open incidents",
      limit: 10,
      sources: {
        entities: {
          filter: {
            group: {
              must: [
                statusFilter,
                { predicate: { field: "entity_type", op: "ANY", values: [{ string_value: "aisre:incident" }] } },
              ],
            },
          },
        },
      },
    });
  });

  it("adds every filtered source to sources and leaves the limit to the server", async () => {
    const { client, request } = makeClient(RESPONSE);
    const f = { predicate: { field: "a", op: "EQ", values: [{ string_value: "b" }] } };
    await registry.dispatchExecute(client, "unified_search", "search", {
      body: { query: "q", sources: ["entities"], source_filters: { other: f }, limit: 500 },
    });
    expect(request.mock.calls[0][0].body).toEqual({ query: "q", limit: 500, sources: { entities: {}, other: { filter: f } } });
  });

  it("rejects a non-object source_filters", async () => {
    const { client } = makeClient(RESPONSE);
    await expect(
      registry.dispatchExecute(client, "unified_search", "search", { body: { query: "q", source_filters: "status=open" } }),
    ).rejects.toThrow(/source_filters must be an object/);
  });

  it("requires body.query", async () => {
    const { client, request } = makeClient(RESPONSE);
    await expect(registry.dispatchExecute(client, "unified_search", "search", { body: {} })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it("returns hits grouped per source with a note when scores are not comparable", async () => {
    const { client } = makeClient({
      query: "q",
      sources: [
        { source: "entities", results: [{ id: "1", score: 0.5, metadata: { entity_type: "pipeline:pipeline", identifier: "p" } }] },
        { source: "other", results: [{ id: "2", score: 0.9, metadata: {} }] },
      ],
    });
    const result = (await registry.dispatchExecute(client, "unified_search", "search", { body: { query: "q" } })) as {
      total: number;
      sources: Array<{ source: string; count: number; results: Array<Record<string, unknown>> }>;
      note?: string;
    };
    expect(result.total).toBe(2);
    expect(result.sources.map((s) => [s.source, s.count])).toEqual([["entities", 1], ["other", 1]]);
    expect(result.sources[0].results[0].source).toBeUndefined();
    // No org/project on the hit: harness_get args carry only what is known.
    expect(result.sources[0].results[0].harness_get).toEqual({ resource_type: "pipeline", resource_id: "p" });
    expect(result.note).toMatch(/not comparable/);
  });
});

describe("unified_search_source", () => {
  it("returns the configured sources via harness_get", async () => {
    const registry = new Registry(makeConfig());
    const { client, request } = makeClient({ sources: [{ name: "entities", description: "Harness entities" }] });
    const result = await registry.dispatch(client, "unified_search_source", "get", {});
    expect(request.mock.calls[0][0]).toMatchObject({ method: "GET", path: UNIFIED_SEARCH_SOURCES_PATH });
    expect(result).toEqual({ sources: [{ name: "entities", description: "Harness entities" }] });
  });
});

describe("buildUnifiedSearchBody", () => {
  it("omits sources when nothing is filtered or selected", () => {
    expect(buildUnifiedSearchBody({ query: "q" })).toEqual({ query: "q" });
  });

  it("uses a single shortcut clause directly, without a group", () => {
    expect(buildUnifiedSearchBody({ query: "q", project_id: "p" }).sources).toEqual({
      entities: { filter: { predicate: { field: "project_identifier", op: "EQ", values: [{ string_value: "p" }] } } },
    });
  });
});

describe("unified search errors", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const reject = async (status: number, body: unknown) => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
    const client = new HarnessClient(makeConfig());
    try {
      await client.request({ method: "POST", path: UNIFIED_SEARCH_PATH, body: { query: "q" } });
    } catch (err) {
      return err as HarnessApiError;
    }
    throw new Error("expected the request to fail");
  };

  it("403 keeps the service message and says it is not an empty result", async () => {
    const err = await reject(403, {
      status: 403,
      error: "Forbidden",
      message: "Semantic search is not enabled for this account",
    });
    expect(err.statusCode).toBe(403);
    expect(err.message).toMatch(/^Semantic search is not enabled for this account/);
    expect(err.message).toMatch(/not an empty result/);
  });

  it("401 from the gateway (no message field) is named as an auth failure", async () => {
    const err = await reject(401, { error: "Unauthorized" });
    expect(err.statusCode).toBe(401);
    expect(err.message).toMatch(/authentication failure, not an empty result/);
  });

  it("400 validation messages pass through unchanged", async () => {
    const err = await reject(400, { status: 400, error: "Bad Request", message: "limit must be between 1 and 50" });
    expect(err.message).toBe("limit must be between 1 and 50");
  });

  it("matches only unified-search paths and the hinted statuses", () => {
    expect(unifiedSearchErrorParser.match({ path: UNIFIED_SEARCH_SOURCES_PATH, status: 404 })).toBe(true);
    expect(unifiedSearchErrorParser.match({ path: UNIFIED_SEARCH_PATH, status: 400 })).toBe(false);
    expect(unifiedSearchErrorParser.match({ path: "/ng/api/projects", status: 403 })).toBe(false);
  });
});
