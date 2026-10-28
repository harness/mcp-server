/**
 * Regression tests for population totals on list responses.
 *
 * Harness v1 list endpoints return a bare array and report the size of the
 * matching population only in `X-Total-Elements`. When that header was dropped,
 * `total` was the page length — so "how many components does team PL own"
 * answered 20 (or the sum of however many pages were fetched) for a population
 * of 507.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { applyHeaderPagination } from "../../src/registry/pagination.js";

function makeConfig(): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
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
  } as Config;
}

/** Client whose request resolves `body` and reports `headers` to the caller. */
function makeClient(body: unknown, headers: Record<string, string> = {}) {
  const request = vi.fn(
    async (options: { onResponseHeaders?: (h: Record<string, string>) => void }) => {
      options.onResponseHeaders?.(headers);
      return body;
    },
  );
  return {
    client: { request, account: "test-account" } as unknown as HarnessClient,
    request,
  };
}

const entity = (i: number) => ({ identifier: `svc-${i}`, kind: "component", scope: "account" });

describe("applyHeaderPagination", () => {
  it("replaces a page-length total with the population size from headers", () => {
    const result = applyHeaderPagination(
      { items: Array.from({ length: 20 }, (_, i) => entity(i)), total: 20 },
      { "x-total-elements": "507", "x-page-number": "0", "x-page-size": "20" },
    );

    expect(result).toMatchObject({ total: 507, page: 0, page_size: 20, has_more: true });
  });

  it("reports has_more=false once the fetched pages cover the population", () => {
    const result = applyHeaderPagination(
      { items: Array.from({ length: 7 }, (_, i) => entity(i)), total: 7 },
      { "x-total-elements": "507", "x-page-number": "5", "x-page-size": "100" },
    );

    expect(result).toMatchObject({ total: 507, has_more: false });
  });

  it("flags more pages from the page itself when no page number is returned", () => {
    const result = applyHeaderPagination({ items: [entity(0)], total: 1 }, { "x-total-elements": "507" });

    expect(result).toMatchObject({ total: 507, has_more: true });
  });

  it("keeps a body-provided total — it is already population-wide", () => {
    const result = applyHeaderPagination({ items: [entity(0)], total: 42 }, { "x-total-elements": "507" });

    expect(result).toMatchObject({ total: 42 });
    expect((result as Record<string, unknown>).has_more).toBeUndefined();
  });

  it("leaves results untouched without a total header, and non-list results alone", () => {
    const list = { items: [entity(0)], total: 1 };
    expect(applyHeaderPagination(list, { "x-page-size": "20" })).toEqual(list);
    expect(applyHeaderPagination({ identifier: "svc-0" }, { "x-total-elements": "507" })).toEqual({
      identifier: "svc-0",
    });
    expect(applyHeaderPagination([entity(0)], { "x-total-elements": "507" })).toEqual([entity(0)]);
    expect(applyHeaderPagination(null, { "x-total-elements": "507" })).toBeNull();
  });

  it("ignores a malformed total header", () => {
    const list = { items: [entity(0)], total: 1 };
    expect(applyHeaderPagination({ ...list }, { "x-total-elements": "not-a-number" })).toEqual(list);
    expect(applyHeaderPagination({ ...list }, { "x-total-elements": "-5" })).toEqual(list);
  });
});

describe("idp_entity list: catalog entity counts", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("reports the owner-filtered population total, not the page length", async () => {
    const page = Array.from({ length: 20 }, (_, i) => entity(i));
    const { client, request } = makeClient(page, {
      "x-total-elements": "507",
      "x-page-number": "0",
      "x-page-size": "20",
    });

    const result = (await registry.dispatch(client, "idp_entity", "list", {
      resource_scope: "account",
      owner: "group:account/pl",
    })) as Record<string, unknown>;

    expect(request).toHaveBeenCalledOnce();
    expect((result.items as unknown[]).length).toBe(20);
    expect(result.total).toBe(507);
    expect(result.has_more).toBe(true);
  });

  it("opts in only the /v1/entities list specs — other list endpoints are untouched", () => {
    const optedIn: string[] = [];
    for (const type of registry.getAllResourceTypes()) {
      const spec = registry.getResource(type).operations.list;
      if (spec?.headerPagination) optedIn.push(type);
    }

    expect(optedIn.sort()).toEqual(["idp_entity", "idp_workflow"]);
  });

  it("does not read headers for a resource that has not opted in", async () => {
    const { client, request } = makeClient(
      { data: { content: [{ identifier: "tpl-0" }], totalElements: 9 } },
      { "x-total-elements": "507" },
    );

    const result = (await registry.dispatch(client, "template", "list", {
      resource_scope: "project",
      org_id: "default",
      project_id: "test-project",
    })) as Record<string, unknown>;

    expect(
      (request.mock.calls[0][0] as { onResponseHeaders?: unknown }).onResponseHeaders,
    ).toBeUndefined();
    expect(result.total).toBe(9);
    expect(result.has_more).toBeUndefined();
  });

  it("falls back to the page length when the API sends no total header", async () => {
    const { client } = makeClient([entity(0), entity(1)], {});

    const result = (await registry.dispatch(client, "idp_entity", "list", {
      resource_scope: "account",
    })) as Record<string, unknown>;

    expect(result.total).toBe(2);
    expect(result.has_more).toBeUndefined();
  });
});
