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

  it("passes sources through and never sends configured org/project or source-specific filters", async () => {
    const { client, request } = makeClient(RESPONSE);
    await registry.dispatch(client, "unified_search", "list", {
      search_term: "checkout",
      sources: "code, docs",
      size: 20,
    });
    const call = request.mock.calls[0][0];
    expect(call.params?.orgIdentifier).toBeUndefined();
    expect(call.body).toEqual({ query: "checkout", limit: 20, sources: { code: {}, docs: {} } });
  });

  it("clamps harness_list's page size to the server's 50-per-source cap", async () => {
    const { client, request } = makeClient(RESPONSE);
    await registry.dispatch(client, "unified_search", "list", { search_term: "x", size: 100 });
    expect(request.mock.calls[0][0].body.limit).toBe(50);
  });

  it("never sends explicit org_id/project_id (as harness_search copies them) and notes results are account-wide", async () => {
    const { client, request } = makeClient({ query: "x", sources: [{ source: "s", results: [] }] });
    const result = (await registry.dispatch(client, "unified_search", "list", {
      search_term: "x",
      org_id: "o1",
      project_id: "p1",
    })) as Record<string, unknown>;
    const call = request.mock.calls[0][0];
    expect(call.params?.orgIdentifier).toBeUndefined();
    expect(call.params?.projectIdentifier).toBeUndefined();
    // Empty note and account-wide note are combined, not overwritten.
    expect(result.note).toMatch(/^No matches for this query/);
    expect(result.note).toMatch(/results are account-wide/);
  });

  it("rejects an empty query before calling the API", async () => {
    const { client, request } = makeClient(RESPONSE);
    await expect(registry.dispatch(client, "unified_search", "list", { search_term: "  " })).rejects.toThrow(/needs a query/);
    expect(request).not.toHaveBeenCalled();
  });

  it("flattens hits, tags the source and passes metadata through untouched", async () => {
    const { client } = makeClient(RESPONSE);
    const result = (await registry.dispatch(client, "unified_search", "list", { search_term: "checkout" })) as {
      items: Array<Record<string, unknown>>;
      total: number;
    };
    expect(result.total).toBe(3);
    const raw = RESPONSE.sources[0].results;
    expect(result.items).toEqual(raw.map((r) => ({ source: "entities", id: r.id, score: r.score, metadata: r.metadata })));
  });

  it("compact items keep every scalar metadata value, shorten long strings and drop nested values, for any source", () => {
    const def = registry.getResource("unified_search");
    const long = "x".repeat(200);
    expect(
      def.compactItem?.({
        source: "code",
        id: "f-1",
        score: 0.8,
        metadata: { path: "src/a.ts", line: 12, generated: false, snippet: long, symbols: ["a", "b"], extra: { k: 1 } },
      }),
    ).toEqual({
      source: "code",
      id: "f-1",
      score: 0.8,
      metadata: { path: "src/a.ts", line: 12, generated: false, snippet: `${"x".repeat(120)}…` },
    });
    expect(def.compactItem?.({ source: "s", id: "d", score: 1 })).toEqual({ source: "s", id: "d", score: 1 });
  });

  it("hint starts from the query, filters on hit metadata keys and uses the KG only when a hit names a type", () => {
    const def = registry.getResource("unified_search");
    expect(def.executeHint).toMatch(/^1\. Search with the user's query text first/);
    expect(def.executeHint).toMatch(/metadata keys are the fields that source indexes/);
    expect(def.executeHint).toMatch(/If a metadata value names a Harness Knowledge Graph type/);
    expect(def.executeHint).toMatch(/resource_type='kg_type'/);
    expect(def.executeHint).toMatch(/use the value type the hit shows/);
    expect(def.executeHint).toMatch(/query that type with hql_query using the hit's id value/);
    expect(def.executeHint).toMatch(/GT\/GTE\/LT\/LTE only match fields stored as numbers or RFC 3339 datetimes/);
    expect(def.relatedResources?.map((r) => r.resourceType)).toEqual(
      expect.arrayContaining(["unified_search_source", "kg_queryable_type_summary", "kg_type", "hql_query"]),
    );
  });

  it("names no particular source, metadata key or entity type in any prompt text", () => {
    const defs = ["unified_search", "unified_search_source"].map((rt) => registry.getResource(rt));
    const text = JSON.stringify(
      defs.map((d) => ({
        description: d.description,
        hint: d.executeHint,
        aliases: d.searchAliases,
        filters: d.listFilterFields,
        actions: d.executeActions,
        ops: Object.values(d.operations).map((o) => o?.description),
      })),
    );
    expect(text).not.toMatch(/'entities'|\bentities:|entity_types|entity_type|entity_id|OBJECT_KIND_ENTITY/);
    expect(defs[0].listFilterFields?.map((f) => f.name)).toEqual(["search_term", "sources"]);
  });

  it("an unfiltered empty result says it is not an error", async () => {
    const { client } = makeClient({ query: "x", sources: [{ source: "entities", results: [] }] });
    const result = (await registry.dispatch(client, "unified_search", "list", { search_term: "x" })) as Record<string, unknown>;
    expect(result.items).toEqual([]);
    expect(result.note).toMatch(/^No matches for this query/);
  });

  it("restricting sources alone keeps the plain empty note", async () => {
    const { client } = makeClient({ query: "x", sources: [{ source: "entities", results: [] }] });
    const result = (await registry.dispatch(client, "unified_search", "list", {
      search_term: "x",
      sources: "entities",
    })) as Record<string, unknown>;
    // Restricting sources is not a filter: the plain note still applies.
    expect(result.note).toMatch(/^No matches for this query/);
  });
});

describe("unified_search search action (harness_execute)", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("passes source_filters through unchanged on any source name", async () => {
    const { client, request } = makeClient(RESPONSE);
    const filter = {
      group: {
        must: [
          { predicate: { field: "language", op: "EQ", values: [{ string_value: "go" }] } },
          { predicate: { field: "path", op: "CONTAINS", values: [{ string_value: "auth" }] } },
        ],
      },
    };
    await registry.dispatchExecute(client, "unified_search", "search", {
      body: { query: "token refresh", source_filters: { code: filter }, limit: 10 },
    });
    expect(request.mock.calls[0][0].body).toEqual({ query: "token refresh", limit: 10, sources: { code: { filter } } });
  });

  it("adds every filtered source to sources and clamps the limit to 1..50", async () => {
    const { client, request } = makeClient(RESPONSE);
    const f = { predicate: { field: "a", op: "EQ", values: [{ string_value: "b" }] } };
    await registry.dispatchExecute(client, "unified_search", "search", {
      body: { query: "q", sources: ["entities"], source_filters: { other: f }, limit: 500 },
    });
    expect(request.mock.calls[0][0].body).toEqual({ query: "q", limit: 50, sources: { entities: {}, other: { filter: f } } });
    await registry.dispatchExecute(client, "unified_search", "search", { body: { query: "q", limit: 0 } });
    expect(request.mock.calls[1][0].body.limit).toBe(1);
  });

  it("never sends explicit org_id/project_id and says results are account-wide", async () => {
    const { client, request } = makeClient(RESPONSE);
    const result = (await registry.dispatchExecute(client, "unified_search", "search", {
      org_id: "o1",
      project_id: "p1",
      body: { query: "q" },
    })) as Record<string, unknown>;
    const call = request.mock.calls[0][0];
    expect(call.params?.orgIdentifier).toBeUndefined();
    expect(call.params?.projectIdentifier).toBeUndefined();
    expect(call.body).toEqual({ query: "q" });
    expect(result.note).toMatch(/results are account-wide/);
  });

  it("a filtered empty search result does not claim nothing exists", async () => {
    const { client } = makeClient({ query: "q", sources: [{ source: "entities", results: [] }] });
    const result = (await registry.dispatchExecute(client, "unified_search", "search", {
      body: { query: "q", source_filters: { docs: { predicate: { field: "severity", op: "LTE", values: [{ int_value: 2 }] } } } },
    })) as Record<string, unknown>;
    expect(result.total).toBe(0);
    expect(result.note).toMatch(/does not mean nothing matching exists/);
  });

  it("an unfiltered empty search result gets the plain note", async () => {
    const { client } = makeClient({ query: "q", sources: [{ source: "entities", results: [] }] });
    const result = (await registry.dispatchExecute(client, "unified_search", "search", { body: { query: "q" } })) as Record<
      string,
      unknown
    >;
    expect(result.note).toMatch(/^No matches for this query/);
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
    expect(result.sources[0].results[0]).toEqual({
      id: "1",
      score: 0.5,
      metadata: { entity_type: "pipeline:pipeline", identifier: "p" },
    });
    expect(result.note).toMatch(/not comparable/);
  });
});

describe("unified_search_source", () => {
  it("returns the configured sources via harness_get, passing every field through", async () => {
    const registry = new Registry(makeConfig());
    const sources = [
      { name: "entities", description: "Harness entities" },
      { name: "code", description: "Source code", types: ["file"] },
    ];
    const { client, request } = makeClient({ sources });
    const result = await registry.dispatch(client, "unified_search_source", "get", {});
    expect(request.mock.calls[0][0]).toMatchObject({ method: "GET", path: UNIFIED_SEARCH_SOURCES_PATH });
    expect(result).toEqual({ sources });
  });
});

describe("buildUnifiedSearchBody", () => {
  it("omits sources when nothing is filtered or selected", () => {
    expect(buildUnifiedSearchBody({ query: "q" })).toEqual({ query: "q" });
  });

  it("adds a filtered source even when sources lists others", () => {
    const f = { predicate: { field: "k", op: "IS_EMPTY" } };
    expect(buildUnifiedSearchBody({ query: "q", sources: ["a"], source_filters: { b: f } }).sources).toEqual({
      a: {},
      b: { filter: f },
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
    expect(err.message).toMatch(/retrying will not help/);
  });

  it("a 403 without the flag message is reported as an authorization failure, without blaming the flag", async () => {
    const err = await reject(403, { error: "Forbidden" });
    expect(err.statusCode).toBe(403);
    expect(err.message).toMatch(/authorization failure, not an empty result/);
    expect(err.message).not.toMatch(/retrying will not help/);
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
