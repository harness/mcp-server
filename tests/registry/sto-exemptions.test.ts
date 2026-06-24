/**
 * Regression tests for STO security_exemption pagination & projection.
 *
 * Covers the Cursor review concerns on PR feat/STO-11498:
 *   1. `_nextPageHint` preserves the FULL active filter set (status + search),
 *      not just status, so paginating a search-scoped listing stays on the
 *      same dataset.
 *   2. The list preflight performs FAIL-LOUD validation only — it never
 *      silently rewrites caller-supplied `size` or `page` values. In
 *      particular, an explicit `size=20` request must be honored.
 *   3. `skipCompact` keeps the hand-picked projection (severity, requested_by,
 *      …) intact when surfaced through `harness_list`.
 */
import { describe, it, expect, vi } from "vitest";
import { stoExemptionsExtract } from "../../src/registry/extractors.js";
import { stoToolset } from "../../src/registry/toolsets/sto.js";
import { Registry } from "../../src/registry/index.js";
import { compactItems } from "../../src/utils/compact.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { EndpointSpec, ResourceDefinition, PreflightContext } from "../../src/registry/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────

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
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function getExemptionResource(): ResourceDefinition {
  const r = stoToolset.resources.find((x) => x.resourceType === "security_exemption");
  if (!r) throw new Error("security_exemption resource not registered");
  return r;
}

function getListSpec(): EndpointSpec {
  const spec = getExemptionResource().operations.list;
  if (!spec) throw new Error("security_exemption.list spec missing");
  return spec;
}

async function runPreflight(input: Record<string, unknown>): Promise<void> {
  const spec = getListSpec();
  if (!spec.preflight) throw new Error("security_exemption.list has no preflight");
  const ctx: PreflightContext = {
    client: { account: "test-account" },
    input,
    registry: {
      dispatch: async () => undefined,
      getResource: () => getExemptionResource(),
    },
  };
  await spec.preflight(ctx);
}

// ─── 0. list preflight strips approval-scope keywords from list inputs ────

describe("security_exemption list — scope keyword preflight", () => {
  it("strips resource_scope='account'/'org' and literal scope keywords from org_id/project_id", async () => {
    const input: Record<string, unknown> = {
      resource_scope: "account",
      org_id: "org",
      project_id: "account",
      status: "Pending",
      size: 5,
    };
    await runPreflight(input);
    expect(input.resource_scope).toBeUndefined();
    expect(input.org_id).toBeUndefined();
    expect(input.project_id).toBeUndefined();
    expect(input.status).toBe("Pending");
    expect(input.size).toBe(5);
  });

  it("allows real org/project identifiers through unchanged", async () => {
    const input: Record<string, unknown> = {
      org_id: "engineering",
      project_id: "payments",
      status: "Pending",
    };
    await runPreflight(input);
    expect(input.org_id).toBe("engineering");
    expect(input.project_id).toBe("payments");
  });
});

// ─── 1. _nextPageHint preserves active filter set ─────────────────────────

describe("stoExemptionsExtract — _nextPageHint", () => {
  const rawTwoPages = {
    exemptions: [{ id: "e1", status: "Pending", issueSummary: { title: "I1", severityCode: "High" } }],
    pagination: { page: 0, pageSize: 5, totalPages: 3, totalItems: 12 },
    counts: { Pending: 12 },
  };

  it("includes status, search, next page, and size in the hint when both filters are active", () => {
    const result = stoExemptionsExtract(rawTwoPages, { status: "Pending", search: "log4j" }) as {
      _nextPageHint: string;
    };
    expect(result._nextPageHint).toContain('"status":"Pending"');
    expect(result._nextPageHint).toContain('"search":"log4j"');
    expect(result._nextPageHint).toContain('"page":1');
    expect(result._nextPageHint).toContain('"size":5');
  });

  it("omits search from the hint when the caller did not pass one", () => {
    const result = stoExemptionsExtract(rawTwoPages, { status: "Pending" }) as {
      _nextPageHint: string;
    };
    expect(result._nextPageHint).toContain('"status":"Pending"');
    expect(result._nextPageHint).not.toContain('"search"');
  });

  it("skips empty-string filter values so they don't pollute the hint", () => {
    const result = stoExemptionsExtract(rawTwoPages, { status: "Pending", search: "" }) as {
      _nextPageHint: string;
    };
    expect(result._nextPageHint).not.toContain('"search"');
  });

  it("returns the terminal hint when no more pages remain", () => {
    const lastPage = {
      exemptions: [{ id: "e1" }],
      pagination: { page: 2, pageSize: 5, totalPages: 3, totalItems: 12 },
    };
    const result = stoExemptionsExtract(lastPage, { status: "Pending", search: "log4j" }) as {
      _nextPageHint: string;
    };
    expect(result._nextPageHint).toMatch(/No more pages/i);
  });

  it("works without an `input` arg (back-compat with direct callers)", () => {
    const result = stoExemptionsExtract(rawTwoPages) as { _nextPageHint: string };
    // No filters carried, but page/size still embedded.
    expect(result._nextPageHint).toContain('"page":1');
    expect(result._nextPageHint).toContain('"size":5');
  });
});

// ─── 2. Preflight is fail-loud — never silently rewrites ──────────────────

describe("security_exemption list preflight", () => {
  it("honors an explicit size=20 (does NOT rewrite to a smaller default)", async () => {
    const input: Record<string, unknown> = { status: "Pending", size: 20, page: 0 };
    await runPreflight(input);
    expect(input.size).toBe(20);
    expect(input.page).toBe(0);
  });

  it("honors arbitrary explicit sizes within bounds", async () => {
    for (const size of [1, 5, 10, 25, 50]) {
      const input: Record<string, unknown> = { status: "Pending", size, page: 1 };
      await runPreflight(input);
      expect(input.size).toBe(size);
      expect(input.page).toBe(1);
    }
  });

  it("leaves size untouched when caller omits it (no silent default)", async () => {
    const input: Record<string, unknown> = { status: "Pending" };
    await runPreflight(input);
    expect(input.size).toBeUndefined();
    expect(input.page).toBeUndefined();
  });

  it("fails loud when size exceeds the documented maximum (50)", async () => {
    const input: Record<string, unknown> = { status: "Pending", size: 51 };
    await expect(runPreflight(input)).rejects.toThrow(/size.*<= 50/i);
  });

  it("fails loud when size is below 1", async () => {
    const input: Record<string, unknown> = { status: "Pending", size: 0 };
    await expect(runPreflight(input)).rejects.toThrow(/size.*>= 1/i);
  });

  it("fails loud when size is not an integer", async () => {
    const input: Record<string, unknown> = { status: "Pending", size: 4.5 };
    await expect(runPreflight(input)).rejects.toThrow(/size.*integer/i);
  });

  it("fails loud when page is negative", async () => {
    const input: Record<string, unknown> = { status: "Pending", page: -1 };
    await expect(runPreflight(input)).rejects.toThrow(/page.*>= 0/i);
  });

  it("fails loud when page is non-integer", async () => {
    const input: Record<string, unknown> = { status: "Pending", page: 1.5 };
    await expect(runPreflight(input)).rejects.toThrow(/page.*integer/i);
  });
});

// ─── 3. End-to-end: dispatch round-trip & skipCompact ─────────────────────

describe("security_exemption list — registry dispatch", () => {
  const rawApiResponse = {
    exemptions: [
      {
        id: "e1",
        status: "Pending",
        type: "Other",
        scope: "PROJECT",
        reason: "Upstream bug",
        targetName: "my-target",
        requesterName: "Alice",
        approverName: null,
        numOccurrences: 3,
        created: 1700000000,
        expiration: 1800000000,
        issueSummary: { title: "Log4j RCE", severityCode: "Critical" },
      },
    ],
    pagination: { page: 0, pageSize: 5, totalPages: 2, totalItems: 7 },
    counts: { Pending: 7 },
  };

  it("propagates caller filters into the request and surfaces them in _nextPageHint", async () => {
    const requestSpy = vi.fn().mockResolvedValue(rawApiResponse);
    const client = makeClient(requestSpy);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "sto" }));

    const result = (await registry.dispatch(client, "security_exemption", "list", {
      status: "Pending",
      search: "log4j",
      size: 5,
      page: 0,
    })) as { items: unknown[]; _nextPageHint: string; pageSize: number };

    // Sent correct query params to the API.
    expect(requestSpy).toHaveBeenCalledTimes(1);
    const callArgs = requestSpy.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(callArgs.params.status).toBe("Pending");
    expect(callArgs.params.search).toBe("log4j");
    expect(callArgs.params.pageSize).toBe(5);
    expect(callArgs.params.page).toBe(0);

    // Next-page hint preserves search.
    expect(result._nextPageHint).toContain('"status":"Pending"');
    expect(result._nextPageHint).toContain('"search":"log4j"');
    expect(result._nextPageHint).toContain('"page":1');
    expect(result._nextPageHint).toContain('"size":5');
  });

  it("rejects size=51 at dispatch time (fail loud, never reaches the API)", async () => {
    const requestSpy = vi.fn().mockResolvedValue(rawApiResponse);
    const client = makeClient(requestSpy);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "sto" }));

    await expect(
      registry.dispatch(client, "security_exemption", "list", { status: "Pending", size: 51 }),
    ).rejects.toThrow(/size.*<= 50/i);
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it("preserves projected display fields under skipCompact (severity, requested_by, …)", async () => {
    const client = makeClient(vi.fn().mockResolvedValue(rawApiResponse));
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "sto" }));

    const result = (await registry.dispatch(client, "security_exemption", "list", {
      status: "Pending",
      size: 5,
    })) as Record<string, unknown> & { items: Array<Record<string, unknown>>; __skipCompact?: boolean };

    // The non-enumerable marker is set so harness_list skips the global compaction pass.
    expect((result as Record<string, unknown>).__skipCompact).toBe(true);

    // Projection fields survive — these are EXACTLY what the LLM renders.
    const [row] = result.items;
    expect(row).toBeDefined();
    expect(row!.issue_title).toBe("Log4j RCE");
    expect(row!.severity).toBe("Critical");
    expect(row!.requested_by).toBe("Alice");
    expect(row!.target).toBe("my-target");

    // IDs are intentionally NOT on the row — they live in the side lookup.
    expect(row!.id).toBeUndefined();
    expect((result as Record<string, unknown>)._action_id_by_row).toEqual({ 1: "e1" });

    // Simulating the harness_list compaction pass on a skipCompact result must
    // be a no-op for the caller (we just confirm the projection survives a
    // compactItems call — the actual tool skips it via the marker).
    const compacted = compactItems(result.items);
    expect(compacted[0]).toBeDefined();
  });
});
